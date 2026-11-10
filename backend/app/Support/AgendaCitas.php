<?php

namespace App\Support;

use App\Models\Cita;
use App\Models\Negocio;
use App\Models\Servicio;
use App\Models\User;
use App\Notifications\CitaActualizada;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class AgendaCitas
{
    public const MINUTOS_CONFIRMACION = 60;
    public const MINUTOS_TOLERANCIA = 15;

    public static function ocupadas(int $profesional): Builder
    {
        return Cita::where('profesional_id', $profesional)->where(function ($q) {
            $q->where('estado', 'confirmada')->orWhere(function ($q) {
                $q->where('estado', 'pendiente')->where('confirmar_antes_de', '>', now())->where('inicio', '>', now());
            });
        });
    }

    public static function disponible(Negocio $negocio, Carbon $inicio, Carbon $fin): bool
    {
        foreach (HorarioNegocio::intervalosDeFecha($negocio->horario, $inicio) as [$abre, $cierra]) {
            if ($inicio->gte($abre) && $fin->lte($cierra)) {
                return true;
            }
        }

        return false;
    }

    public static function vencer(?int $negocioId = null, ?int $clienteId = null): int
    {
        $vencidas = Cita::where('estado', 'pendiente')
            ->when($negocioId, fn ($q) => $q->where('negocio_id', $negocioId))
            ->when($clienteId, fn ($q) => $q->where('cliente_id', $clienteId))
            ->where(fn ($q) => $q->where('confirmar_antes_de', '<=', now())->orWhere('inicio', '<=', now()))
            ->get();
        $total = 0;
        foreach ($vencidas as $cita) {
            if (Cita::whereKey($cita->id)->where('estado', 'pendiente')->update(['estado' => 'vencida', 'updated_at' => now()])) {
                $cita->estado = 'vencida';
                self::avisar($cita);
                $total++;
            }
        }

        return $total;
    }

    public static function crear(Negocio $negocio, User $usuario, array $datos, bool $presencial): Cita
    {
        return DB::transaction(function () use ($negocio, $usuario, $datos, $presencial) {
            // Todos los escritores de la agenda toman estos bloqueos en el mismo orden.
            $negocio = Negocio::lockForUpdate()->findOrFail($negocio->id);
            abort_if($negocio->archivado_at || (! $presencial && $negocio->desactivado_at) || $negocio->estaVetado(), 404, 'Negocio no disponible.');
            if ($presencial) {
                abort_unless($negocio->esMiembroActivo($usuario), 403);
            }
            $profesional = User::lockForUpdate()->findOrFail($datos['profesional_id']);
            abort_unless($negocio->esMiembroActivo($profesional), 422, 'El profesional ya no está disponible en este negocio.');
            $servicio = Servicio::where('negocio_id', $negocio->id)->where('disponible', true)->where('permite_citas', true)->lockForUpdate()->findOrFail($datos['servicio_id']);
            $inicio = Carbon::createFromFormat('!Y-m-d H:i', $datos['fecha'].' '.$datos['hora'], config('app.timezone'));
            abort_unless($inicio->gt(now()) && $inicio->lte(now()->addDays(90)), 422, 'Elige una fecha futura dentro de los próximos 90 días.');
            $fin = $inicio->copy()->addMinutes($servicio->duracion_minutos);
            abort_unless(self::disponible($negocio, $inicio, $fin), 422, 'El servicio no cabe en el horario de atención o coincide con el almuerzo.');
            // Lectura actual bajo bloqueo: evita usar un snapshot anterior a otra reserva concurrente.
            abort_if(self::ocupadas($profesional->id)->where('inicio', '<', $fin)->where('fin', '>', $inicio)->lockForUpdate()->first(['id']) !== null, 409, 'Ese horario ya está ocupado. Elige otra hora disponible.');

            return Cita::create([
                'negocio_id' => $negocio->id,
                'servicio_id' => $servicio->id,
                'servicio_nombre' => $servicio->nombre,
                'cliente_id' => $presencial ? null : $usuario->id,
                'cliente_nombre' => $presencial ? $datos['cliente_nombre'] : trim($usuario->name.' '.$usuario->apellidos),
                'cliente_telefono' => $presencial ? ($datos['cliente_telefono'] ?? null) : $usuario->telefono,
                'profesional_id' => $profesional->id,
                'origen' => $presencial ? 'presencial' : 'app',
                'estado' => $presencial ? 'confirmada' : 'pendiente',
                'inicio' => $inicio,
                'fin' => $fin,
                'confirmar_antes_de' => $presencial ? null : now()->addMinutes(self::MINUTOS_CONFIRMACION)->min($inicio),
                'notas' => $datos['notas'] ?? null,
            ]);
        });
    }

    public static function cancelarInasistencias(?int $negocioId = null, ?int $clienteId = null): int
    {
        $limite = now()->subMinutes(self::MINUTOS_TOLERANCIA);
        $total = 0;
        Cita::where('estado', 'confirmada')->whereNull('llegada_at')->where('inicio', '<', $limite)
            ->when($negocioId, fn ($q) => $q->where('negocio_id', $negocioId))
            ->when($clienteId, fn ($q) => $q->where('cliente_id', $clienteId))
            ->chunkById(100, function ($citas) use (&$total, $limite) {
                foreach ($citas as $cita) {
                    $motivo = 'Cita cancelada automáticamente por no registrar la llegada dentro de los 15 minutos de tolerancia. Solicita una nueva cita para renovar tu reserva.';
                    // Compite de forma atómica con el registro de llegada y otros cambios de estado.
                    if (Cita::whereKey($cita->id)->where('estado', 'confirmada')->whereNull('llegada_at')
                        ->where('inicio', '<', $limite)->update(['estado' => 'no_asistio', 'motivo' => $motivo, 'updated_at' => now()])) {
                        $cita->estado = 'no_asistio';
                        $cita->motivo = $motivo;
                        self::avisar($cita);
                        $total++;
                    }
                }
            });

        return $total;
    }

    /**
     * Cancela las citas futuras (pendientes o confirmadas) de `$citas` y avisa
     * a la otra parte. Para cuando la cita ya no se puede cumplir: el profesional
     * salió del negocio, el negocio cerró o el cliente eliminó su cuenta.
     *
     * @return int cuántas se cancelaron
     */
    public static function cancelarFuturas(Builder $citas, string $motivo, bool $alNegocio = false): int
    {
        $total = 0;
        $futuras = $citas->whereIn('estado', ['pendiente', 'confirmada'])->where('fin', '>', now())->get();

        foreach ($futuras as $cita) {
            $cambio = Cita::whereKey($cita->id)
                ->whereIn('estado', ['pendiente', 'confirmada'])
                ->update(['estado' => 'cancelada', 'motivo' => $motivo, 'updated_at' => now()]);

            if ($cambio) {
                $cita->estado = 'cancelada';
                $cita->motivo = $motivo;
                self::avisar($cita, $alNegocio);
                $total++;
            }
        }

        return $total;
    }

    public static function avisar(Cita $cita, bool $alNegocio = false): void
    {
        $destinatarios = $alNegocio ? $cita->negocio->miembrosActivos()->get() : User::whereKey($cita->cliente_id)->get();
        Push::enviar($destinatarios, new CitaActualizada($cita, $alNegocio));
    }

    public static function datos(Cita $cita): array
    {
        return [
            'id' => $cita->id, 'negocio_id' => $cita->negocio_id,
            'negocio_nombre' => $cita->negocio?->nombre,
            'servicio_nombre' => $cita->servicio_nombre,
            'profesional_nombre' => $cita->profesional ? trim($cita->profesional->name.' '.$cita->profesional->apellidos) : 'Profesional no disponible',
            'profesional_id' => $cita->profesional_id,
            'cliente_nombre' => $cita->cliente_nombre, 'cliente_telefono' => $cita->cliente_telefono,
            'estado' => $cita->estado, 'origen' => $cita->origen,
            // Campos locales explícitos: no dependen de la zona horaria del teléfono.
            'fecha' => $cita->inicio->format('Y-m-d'), 'hora' => $cita->inicio->format('H:i'),
            'hora_fin' => $cita->fin->format('H:i'), 'fecha_fin' => $cita->fin->format('Y-m-d'),
            'confirmar_antes_de' => $cita->confirmar_antes_de?->toIso8601String(),
            'llegada_at' => $cita->llegada_at?->toIso8601String(),
            'notas' => $cita->notas, 'motivo' => $cita->motivo,
        ];
    }
}
