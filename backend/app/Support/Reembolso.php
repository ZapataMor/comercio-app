<?php

namespace App\Support;

use App\Models\Pedido;
use App\Models\User;
use App\Notifications\EstadoPedidoActualizado;
use App\Notifications\ReembolsoSolicitado;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * Devolución de una transferencia cuando el pedido se cancela.
 *
 *  1. solicitado: el cliente la pide e indica a dónde le devuelven. Si el
 *     negocio ya había confirmado el pago, se abre sola al cancelar.
 *  2. devuelto: el negocio devolvió el dinero (monto y foto del comprobante
 *     opcional). Puede ser menos que el total: si el cliente no apareció,
 *     la regla es devolver la mitad de los productos (el domicilio es del
 *     domiciliario).
 *  3. recibido: el cliente confirma y se cierra. Si dice que no le llegó
 *     (no_recibido), el negocio revisa y vuelve a marcarlo devuelto.
 *  - rechazado: el negocio dice que nunca recibió ese pago, con motivo. Solo
 *    si no lo había confirmado; el cliente puede reportarlo a Vitrina.
 *
 * La solicitud por sí sola no significa que se haya devuelto dinero.
 */
class Reembolso
{
    /** ¿El cliente puede pedir la devolución? Pedido por transferencia cancelado, sin otra abierta. */
    public static function puedeSolicitar(Pedido $pedido): bool
    {
        return $pedido->estado === 'cancelado'
            && $pedido->metodo_pago === 'transferencia'
            && $pedido->negocio_id !== null
            && $pedido->reembolso_estado === null;
    }

    /** ¿Puede cambiar a dónde le devuelven? Mientras el negocio no haya devuelto. */
    public static function puedeCambiarCuenta(Pedido $pedido): bool
    {
        return in_array($pedido->reembolso_estado, Pedido::REEMBOLSO_PENDIENTES, true);
    }

    /** Lo que debería devolver el negocio (sugerido; el negocio escribe lo que devolvió). */
    public static function montoSugerido(Pedido $pedido): float
    {
        // Cliente ausente: la mitad de los productos; el domicilio se le reconoce al domiciliario.
        return $pedido->cancelado_por === 'cliente_no_encontrado'
            ? round((float) $pedido->subtotal / 2)
            : (float) $pedido->total;
    }

    /** Datos de la devolución para el cliente y el negocio (null si no aplica). */
    public static function datos(Pedido $pedido): ?array
    {
        if ($pedido->metodo_pago !== 'transferencia' || $pedido->estado !== 'cancelado') {
            return null;
        }

        return [
            'estado' => $pedido->reembolso_estado,
            'cuenta' => $pedido->reembolso_cuenta,
            'monto_sugerido' => self::montoSugerido($pedido),
            'regla_mitad' => $pedido->cancelado_por === 'cliente_no_encontrado',
            'monto' => $pedido->reembolso_monto !== null ? (float) $pedido->reembolso_monto : null,
            'comprobante' => $pedido->reembolso_comprobante ? '/api/pedidos/'.$pedido->id.'/reembolso/comprobante' : null,
            'motivo' => $pedido->reembolso_motivo,
            'solicitado_at' => $pedido->reembolso_solicitado_at?->toIso8601String(),
            'devuelto_at' => $pedido->reembolso_devuelto_at?->toIso8601String(),
            'rechazado_at' => $pedido->reembolso_rechazado_at?->toIso8601String(),
            'respondido_at' => $pedido->reembolso_respondido_at?->toIso8601String(),
            // Si el negocio confirmó el pago, no puede decir que no le llegó.
            'puede_rechazar' => in_array($pedido->reembolso_estado, Pedido::REEMBOLSO_PENDIENTES, true) && $pedido->pago_estado !== 'confirmado',
            'puede_solicitar' => self::puedeSolicitar($pedido),
            'puede_cambiar_cuenta' => self::puedeCambiarCuenta($pedido),
        ];
    }

    /**
     * Al cancelar un pedido cuyo pago el negocio ya confirmó, la devolución
     * se abre sola: el negocio sabe que recibió el dinero.
     */
    public static function abrirSiCorresponde(Pedido $pedido): void
    {
        if ($pedido->estado !== 'cancelado' || $pedido->metodo_pago !== 'transferencia' || $pedido->pago_estado !== 'confirmado') {
            return;
        }

        $abierto = Pedido::whereKey($pedido->id)->where('estado', 'cancelado')->whereNull('reembolso_estado')
            ->update(['reembolso_estado' => 'solicitado', 'reembolso_solicitado_at' => now()]);
        if ($abierto) {
            $pedido->refresh();
            self::avisarEquipo($pedido, new ReembolsoSolicitado($pedido));
        }
    }

    /**
     * El cliente pide la devolución (o, si ya está abierta, cambia a dónde
     * se la devuelven). Devuelve false si ya no se puede.
     */
    public static function solicitar(Pedido $pedido, string $cuenta): bool
    {
        $cuenta = mb_substr(trim(preg_replace('/\s+/', ' ', $cuenta)), 0, 150);

        $nueva = false;
        $ok = DB::transaction(function () use ($pedido, $cuenta, &$nueva) {
            $actual = Pedido::whereKey($pedido->id)->lockForUpdate()->first();
            if (! $actual) {
                return false;
            }
            if (self::puedeSolicitar($actual)) {
                $actual->update(['reembolso_estado' => 'solicitado', 'reembolso_solicitado_at' => now(), 'reembolso_cuenta' => $cuenta]);
                $nueva = true;

                return true;
            }
            if (self::puedeCambiarCuenta($actual)) {
                $actual->update(['reembolso_cuenta' => $cuenta]);

                return true;
            }

            return false;
        });

        if ($ok && $nueva) {
            $pedido->refresh();
            self::avisarEquipo($pedido, new ReembolsoSolicitado($pedido));
        }

        return $ok;
    }

    /** El negocio devolvió el dinero: cuánto y, si quiere, la foto del comprobante. */
    public static function devolver(Pedido $pedido, User $quien, float $monto, ?UploadedFile $comprobante): bool
    {
        $ruta = $comprobante ? FotoOptimizada::guardarEn($comprobante, 'comprobantes-reembolso', 'local') : null;

        $anterior = null;
        $ok = DB::transaction(function () use ($pedido, $quien, $monto, $ruta, &$anterior) {
            $actual = Pedido::whereKey($pedido->id)->lockForUpdate()->first();
            if (! $actual || ! in_array($actual->reembolso_estado, Pedido::REEMBOLSO_PENDIENTES, true)) {
                return false;
            }
            $anterior = $ruta ? $actual->reembolso_comprobante : null;
            $actual->update([
                'reembolso_estado' => 'devuelto',
                'reembolso_monto' => $monto,
                'reembolso_comprobante' => $ruta ?? $actual->reembolso_comprobante,
                'reembolso_devuelto_at' => now(),
                'reembolso_devuelto_por' => $quien->id,
                'reembolso_respondido_at' => null,
            ]);

            return true;
        });

        if (! $ok) {
            if ($ruta) {
                Storage::disk('local')->delete($ruta);
            }

            return false;
        }
        if ($anterior) {
            Storage::disk('local')->delete($anterior);
        }

        $pedido->refresh();
        if ($pedido->cliente) {
            Push::enviar($pedido->cliente, new EstadoPedidoActualizado($pedido, [
                'Te devolvieron tu dinero 💸',
                "{$pedido->nombreNegocio()} dice que te devolvió $".self::pesos($monto)." del pedido #{$pedido->codigo}. Abre el pedido y confirma si te llegó.",
            ]));
        }

        return true;
    }

    /** El negocio dice que nunca recibió ese pago. Solo si no lo había confirmado. */
    public static function rechazar(Pedido $pedido, string $motivo): bool
    {
        $ok = DB::transaction(function () use ($pedido, $motivo) {
            $actual = Pedido::whereKey($pedido->id)->lockForUpdate()->first();
            if (! $actual || ! in_array($actual->reembolso_estado, Pedido::REEMBOLSO_PENDIENTES, true) || $actual->pago_estado === 'confirmado') {
                return false;
            }
            $actual->update([
                'reembolso_estado' => 'rechazado',
                'reembolso_motivo' => mb_substr(trim($motivo), 0, 255),
                'reembolso_rechazado_at' => now(),
            ]);

            return true;
        });

        if ($ok) {
            $pedido->refresh();
            if ($pedido->cliente) {
                Push::enviar($pedido->cliente, new EstadoPedidoActualizado($pedido, [
                    'El negocio no encontró tu pago',
                    "{$pedido->nombreNegocio()} dice que no recibió tu transferencia del pedido #{$pedido->codigo}. Si sí pagaste, repórtalo desde el pedido.",
                ]));
            }
        }

        return $ok;
    }

    /** El cliente responde si le llegó la devolución. */
    public static function responder(Pedido $pedido, bool $recibido): bool
    {
        $ok = Pedido::whereKey($pedido->id)->where('reembolso_estado', 'devuelto')->update([
            'reembolso_estado' => $recibido ? 'recibido' : 'no_recibido',
            'reembolso_respondido_at' => now(),
        ]) > 0;

        if ($ok) {
            $pedido->refresh();
            self::avisarEquipo($pedido, new EstadoPedidoActualizado($pedido, $recibido
                ? ['Devolución recibida ✅', "El cliente confirmó que le llegó la devolución del pedido #{$pedido->codigo}."]
                : ['El cliente no ve la devolución', "Pedido #{$pedido->codigo}: el cliente dice que no le ha llegado. Revisa la transferencia y vuelve a marcarla devuelta."]));
        }

        return $ok;
    }

    /** Ver la foto del comprobante de la devolución: el cliente o quien gestiona los pedidos. */
    public static function puedeVerComprobante(Pedido $pedido, User $user): bool
    {
        return PagoTransferencia::puedeVerComprobante($pedido, $user);
    }

    private static function avisarEquipo(Pedido $pedido, $aviso): void
    {
        $negocio = $pedido->negocio;
        $equipo = $negocio
            ? $negocio->miembrosActivos()->get()->filter(fn (User $m) => $negocio->puede($m, 'gestionar_pedidos'))->values()
            : collect();
        if ($equipo->isNotEmpty()) {
            Push::enviar($equipo, $aviso);
        }
    }

    private static function pesos(float $monto): string
    {
        return number_format($monto, 0, ',', '.');
    }
}
