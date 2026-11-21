<?php

namespace App\Support;

use App\Models\Negocio;
use App\Models\Pedido;
use App\Models\User;
use App\Notifications\EstadoPedidoActualizado;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * Pago por transferencia verificado por el negocio.
 *
 *  1. El cliente elige transferencia. Cuando el negocio acepta, ve sus
 *     cuentas (Nequi, llave, banco, QR…), elige una, paga y avisa «Ya pagué»
 *     (con foto del comprobante si quiere).
 *  2. El negocio revisa en su banco que el dinero llegó y lo confirma. Es su
 *     responsabilidad: un comprobante se puede falsificar.
 *  3. Solo entonces se prepara y se ofrece a los domiciliarios, que no le
 *     cobran nada al cliente. El negocio le entrega al domiciliario el valor
 *     del domicilio al recogerlo (el cliente se lo pagó en la transferencia).
 */
class PagoTransferencia
{
    /** Lo que ve el cliente en su pedido (null si no es por transferencia). */
    public static function paraCliente(Pedido $pedido): ?array
    {
        if ($pedido->metodo_pago !== 'transferencia') {
            return null;
        }

        return self::comun($pedido) + [
            // Las cuentas solo mientras tenga que pagar.
            'cuentas' => $pedido->puedeInformarPago() && $pedido->negocio
                ? $pedido->negocio->cuentasPago->map->datos()->values()->all()
                : [],
            'puede_informar' => $pedido->puedeInformarPago(),
        ];
    }

    /** Lo que ve el equipo del negocio (null si no es por transferencia). */
    public static function paraNegocio(Pedido $pedido): ?array
    {
        if ($pedido->metodo_pago !== 'transferencia') {
            return null;
        }

        return self::comun($pedido) + [
            'puede_confirmar' => $pedido->puedeConfirmarPago(),
        ];
    }

    private static function comun(Pedido $pedido): array
    {
        return [
            'estado' => $pedido->pago_estado,
            'cuenta' => $pedido->pago_cuenta,
            'comprobante' => $pedido->pago_comprobante ? '/api/pedidos/'.$pedido->id.'/comprobante' : null,
            'informado_at' => $pedido->pago_informado_at?->toIso8601String(),
            'confirmado_at' => $pedido->pago_confirmado_at?->toIso8601String(),
            'no_llego_at' => $pedido->pago_no_llego_at?->toIso8601String(),
        ];
    }

    /**
     * El cliente avisa que ya pagó en una de las cuentas del negocio.
     * Devuelve false si ya no podía (el pedido cambió).
     */
    public static function informar(Pedido $pedido, int $cuentaId, ?UploadedFile $comprobante): bool
    {
        $cuenta = $pedido->negocio?->cuentasPago()->find($cuentaId);
        if (! $cuenta) {
            abort(422, 'Esa cuenta ya no está disponible. Elige otra.');
        }

        // La foto se guarda antes (fuera de la transacción) y se borra si no se usa.
        $ruta = $comprobante ? FotoOptimizada::guardarEn($comprobante, 'comprobantes', 'local') : null;

        $anterior = null;
        $ok = DB::transaction(function () use ($pedido, $cuenta, $ruta, &$anterior) {
            $actual = Pedido::whereKey($pedido->id)->lockForUpdate()->first();
            if (! $actual || ! $actual->puedeInformarPago()) {
                return false;
            }
            $anterior = $ruta ? $actual->pago_comprobante : null;
            $actual->update([
                'pago_estado' => 'informado',
                'pago_cuenta' => $cuenta->datos(),
                'pago_comprobante' => $ruta ?? $actual->pago_comprobante,
                'pago_informado_at' => now(),
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
        $equipo = self::equipo($pedido->negocio);
        if ($equipo->isNotEmpty()) {
            Push::enviar($equipo, new EstadoPedidoActualizado($pedido, [
                'El cliente dice que ya pagó 💸',
                "Pedido #{$pedido->codigo}: revisa en {$cuenta->nombre()} que te llegaron $".number_format((float) $pedido->total, 0, ',', '.').' y confirma el pago.',
            ]));
        }

        return true;
    }

    /** El negocio revisó su cuenta: el dinero llegó. Ya se puede preparar. */
    public static function confirmar(Pedido $pedido, User $quien): bool
    {
        $ok = DB::transaction(function () use ($pedido, $quien) {
            $actual = Pedido::whereKey($pedido->id)->lockForUpdate()->first();
            if (! $actual || ! $actual->puedeConfirmarPago()) {
                return false;
            }
            $actual->update([
                'pago_estado' => 'confirmado',
                'pago_confirmado_at' => now(),
                'pago_confirmado_por' => $quien->id,
            ]);

            return true;
        });

        if ($ok) {
            $pedido->refresh();
            if ($pedido->cliente) {
                Push::enviar($pedido->cliente, new EstadoPedidoActualizado($pedido, [
                    'Pago confirmado ✅', 'El negocio recibió tu transferencia y ya está preparando tu pedido.',
                ]));
            }
        }

        return $ok;
    }

    /** El negocio no encuentra la transferencia: el cliente revisa y vuelve a avisar. */
    public static function noLlego(Pedido $pedido, User $quien): bool
    {
        $ok = DB::transaction(function () use ($pedido) {
            $actual = Pedido::whereKey($pedido->id)->lockForUpdate()->first();
            if (! $actual || ! $actual->puedeConfirmarPago() || $actual->pago_estado !== 'informado') {
                return false;
            }
            $actual->update(['pago_estado' => 'no_llego', 'pago_no_llego_at' => now()]);

            return true;
        });

        if ($ok) {
            $pedido->refresh();
            if ($pedido->cliente) {
                Push::enviar($pedido->cliente, new EstadoPedidoActualizado($pedido, [
                    'El negocio no ve tu transferencia',
                    "{$pedido->nombreNegocio()} aún no recibe el pago del pedido #{$pedido->codigo}. Revisa tu transferencia y vuelve a avisar, o comunícate con el negocio.",
                ]));
            }
        }

        return $ok;
    }

    /** Ver la foto del comprobante: el cliente del pedido o quien gestiona sus pedidos. */
    public static function puedeVerComprobante(Pedido $pedido, User $user): bool
    {
        return $pedido->user_id === $user->id
            || ($pedido->negocio !== null && $pedido->negocio->puede($user, 'gestionar_pedidos'));
    }

    private static function equipo(?Negocio $negocio)
    {
        return $negocio
            ? $negocio->miembrosActivos()->get()->filter(fn (User $m) => $negocio->puede($m, 'gestionar_pedidos'))->values()
            : collect();
    }
}
