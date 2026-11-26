<?php

namespace App\Support;

use App\Models\CuentaPago;
use App\Models\Negocio;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Crear, editar y borrar las cuentas donde el negocio recibe transferencias.
 * Lo comparten la API de la app y el panel web («Mi tienda»), así las dos
 * aplican las mismas reglas. La clave de 4 números la revisa cada entrada
 * antes de llamar aquí (ClavePin::comprobar).
 */
class EditorCuentaPago
{
    /** Reglas según el tipo: número o llave, banco, ahorros/corriente, QR. */
    public static function validar(Request $request, ?CuentaPago $cuenta): array
    {
        $tipo = $request->input('tipo', $cuenta?->tipo);
        $datos = $request->validate([
            'tipo' => [$cuenta ? 'sometimes' : 'required', Rule::in(CuentaPago::TIPOS)],
            'titular' => [$cuenta ? 'sometimes' : 'required', 'string', 'min:3', 'max:100'],
            'numero' => [$tipo === 'qr' ? 'nullable' : 'required', 'string', 'max:60', 'regex:/\A[\p{L}\p{N}@._+\- ]+\z/u'],
            'banco' => [$tipo === 'banco' ? 'required' : 'nullable', 'string', 'max:60'],
            'tipo_cuenta' => [in_array($tipo, CuentaPago::CON_TIPO_CUENTA, true) ? 'required' : 'nullable', Rule::in(CuentaPago::TIPOS_CUENTA)],
            'qr' => [$tipo === 'qr' && ! $cuenta?->qr ? 'required' : 'nullable', 'image', 'max:4096'],
            'quitar_qr' => ['sometimes', 'boolean'],
        ], [
            'tipo.required' => 'Elige el tipo de cuenta.',
            'titular.required' => 'Escribe a nombre de quién está la cuenta.',
            'titular.min' => 'El titular debe tener al menos 3 letras.',
            'numero.required' => $tipo === 'llave' ? 'Escribe la llave.' : 'Escribe el número.',
            'numero.regex' => 'Usa solo letras, números, @, punto, guion o espacios.',
            'banco.required' => 'Escribe el nombre del banco.',
            'tipo_cuenta.required' => 'Elige si es de ahorros o corriente.',
            'qr.required' => 'Sube la imagen del código QR.',
            'qr.image' => 'El código QR debe ser una imagen.',
        ]);

        unset($datos['qr'], $datos['quitar_qr']);
        if (isset($datos['numero'])) {
            $datos['numero'] = trim(preg_replace('/\s+/', ' ', $datos['numero']));
        }
        // Lo que no aplica al tipo no se guarda.
        if ($tipo !== 'banco') {
            $datos['banco'] = null;
        }
        if (! in_array($tipo, CuentaPago::CON_TIPO_CUENTA, true)) {
            $datos['tipo_cuenta'] = null;
        }

        return $datos;
    }

    public static function crear(Negocio $negocio, array $datos, ?UploadedFile $qr): CuentaPago
    {
        return DB::transaction(function () use ($negocio, $datos, $qr) {
            Negocio::whereKey($negocio->id)->lockForUpdate()->first();
            if ($negocio->cuentasPago()->count() >= CuentaPago::MAXIMO) {
                throw ValidationException::withMessages([
                    'tipo' => 'Puedes tener hasta '.CuentaPago::MAXIMO.' cuentas. Borra una para agregar otra.',
                ]);
            }
            $cuenta = $negocio->cuentasPago()->make($datos);
            $cuenta->orden = (int) $negocio->cuentasPago()->max('orden') + 1;
            if ($qr) {
                $cuenta->qr = FotoOptimizada::guardarEn($qr, 'cuentas-pago');
            }
            $cuenta->save();

            return $cuenta;
        });
    }

    public static function actualizar(CuentaPago $cuenta, array $datos, ?UploadedFile $qr, bool $quitarQr): CuentaPago
    {
        $cuenta->fill($datos);
        $anterior = null;
        if ($qr) {
            $anterior = $cuenta->qr;
            $cuenta->qr = FotoOptimizada::guardarEn($qr, 'cuentas-pago');
        } elseif ($quitarQr) {
            $anterior = $cuenta->qr;
            $cuenta->qr = null;
        }
        if ($cuenta->tipo === 'qr' && ! $cuenta->qr) {
            throw ValidationException::withMessages(['qr' => 'Sube la imagen del código QR.']);
        }
        $cuenta->save();
        if ($anterior) {
            Storage::disk('public')->delete($anterior);
        }

        return $cuenta;
    }

    /** Los pedidos ya pagados conservan su copia de la cuenta (pago_cuenta). */
    public static function eliminar(CuentaPago $cuenta): void
    {
        $cuenta->delete();
        if ($cuenta->qr) {
            Storage::disk('public')->delete($cuenta->qr);
        }
    }
}
