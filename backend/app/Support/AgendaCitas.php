<?php

namespace App\Support;

use App\Models\Cita;
use App\Models\Negocio;
use App\Models\Servicio;
use App\Models\User;
use App\Notifications\CitaActualizada;
use App\Notifications\RecordatorioCita;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class AgendaCitas
{
    public const MINUTOS_CONFIRMACION = 60;
    public const MINUTOS_TOLERANCIA = 15;
    /** Las citas empiezan solo en punto, y cuarto, y media o menos cuarto. */
    public const PASO_MINUTOS = 15;
    public const REGLA_HORA = 'regex:/^([01]\d|2[0-3]):(00|15|30|45)$/';
    public const MENSAJE_HORA = 'Elige una hora en punto o en intervalos de 15 minutos (por ejemplo 04:00, 04:15, 04:30 o 04:45).';
    /** Citas vigentes que un cliente puede tener el mismo día en un negocio. */
    public const MAX_CITAS_DIA = 3;
    /** Recordatorios al cliente, en minutos antes del inicio: 1 día, 5 h, 1 h y 15 min. */
    public const RECORDATORIOS = [1440, 300, 60, 15];
    public const REGLA_NOMBRE = "regex:/^[\pL\pM\s'.-]+$/u";

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

    /** Primer cuarto de hora igual o posterior a `$hora` (07:07 → 07:15). */
    public static function alCuarto(Carbon $hora): Carbon
    {
        $hora = $hora->copy()->second(0)->microsecond(0);
        $resto = $hora->minute % self::PASO_MINUTOS;

        return $resto ? $hora->addMinutes(self::PASO_MINUTOS - $resto) : $hora;
    }

    /**
     * Horas de inicio libres del profesional en `$dia`, en cuartos de hora y
     * dentro del horario automático. `$excepto` ignora la cita que se reprograma.
     *
     * @return string[]
     */
    public static function horasLibres(Negocio $negocio, Servicio $servicio, int $profesionalId, Carbon $dia, ?int $excepto = null): array
    {
        $dia = $dia->copy()->startOfDay();
        $limite = $dia->copy()->addDay();
        $ocupadas = self::ocupadas($profesionalId)->when($excepto, fn ($q) => $q->whereKeyNot($excepto))
            ->where('inicio', '<', $limite->copy()->addDay())->where('fin', '>', $dia)->get();
        $horas = [];
        foreach (HorarioNegocio::intervalosDeFecha($negocio->horario, $dia) as [$abre, $cierra]) {
            for ($hora = self::alCuarto($abre); $hora->lt($cierra) && $hora->lt($limite); $hora->addMinutes(self::PASO_MINUTOS)) {
                if ($hora->lt($dia) || $hora->lte(now()) || $hora->gt(now()->addDays(90))) {
                    continue;
                }
                $fin = $hora->copy()->addMinutes($servicio->duracion_minutos);
                if ($fin->gt($cierra)) {
                    continue;
                }
                if ($ocupadas->contains(fn ($cita) => $cita->inicio->lt($fin) && $cita->fin->gt($hora))) {
                    continue;
                }
                $horas[] = $hora->format('H:i');
            }
        }

        return array_values(array_unique($horas));
    }

    /** Citas vigentes del cliente en ese negocio para el día de `$dia`. */
    public static function citasDelDia(int $clienteId, int $negocioId, Carbon $dia, ?int $excepto = null): int
    {
        $desde = $dia->copy()->startOfDay();

        return Cita::where('cliente_id', $clienteId)->where('negocio_id', $negocioId)
            ->where('inicio', '>=', $desde)->where('inicio', '<', $desde->copy()->addDay())
            ->when($excepto, fn ($q) => $q->whereKeyNot($excepto))
            ->where(function ($q) {
                $q->whereIn('estado', ['confirmada', 'completada', 'no_asistio'])->orWhere(function ($q) {
                    $q->where('estado', 'pendiente')->where('confirmar_antes_de', '>', now())->where('inicio', '>', now());
                });
            })
            ->count();
    }

    /**
     * Revisa que el intervalo se pueda reservar: cuarto de hora, plazo de 90 días,
     * horario automático, profesional libre y límite diario del cliente.
     * Se llama dentro de la transacción, con el negocio y el profesional bloqueados.
     */
    private static function validarEspacio(Negocio $negocio, int $profesionalId, Carbon $inicio, Carbon $fin, ?int $clienteId, ?int $excepto = null): void
    {
        abort_unless($inicio->minute % self::PASO_MINUTOS === 0, 422, self::MENSAJE_HORA);
        abort_unless($inicio->gt(now()) && $inicio->lte(now()->addDays(90)), 422, 'Elige una fecha futura dentro de los próximos 90 días.');
        abort_unless(self::disponible($negocio, $inicio, $fin), 422, 'Elige una hora dentro del horario de atención del negocio: el servicio no cabe en esa hora o coincide con el almuerzo.');
        // Lectura actual bajo bloqueo: evita usar un snapshot anterior a otra reserva concurrente.
        abort_if(self::ocupadas($profesionalId)->when($excepto, fn ($q) => $q->whereKeyNot($excepto))
            ->where('inicio', '<', $fin)->where('fin', '>', $inicio)->lockForUpdate()->first(['id']) !== null, 409, 'Ese horario ya está ocupado. Elige otra hora disponible.');
        if ($clienteId) {
            abort_if(self::citasDelDia($clienteId, $negocio->id, $inicio, $excepto) >= self::MAX_CITAS_DIA, 422,
                'Ya tienes '.self::MAX_CITAS_DIA.' citas ese día en este negocio. Elige otra fecha o cancela una de ellas.');
        }
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
            $fin = $inicio->copy()->addMinutes($servicio->duracion_minutos);
            self::validarEspacio($negocio, $profesional->id, $inicio, $fin, $presencial ? null : $usuario->id);

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
                'a_nombre_de' => $presencial ? null : self::aNombreDe($datos['a_nombre_de'] ?? null, $usuario),
            ]);
        });
    }

    /** Vacío o igual al nombre de quien pide: la cita es para el propio cliente. */
    private static function aNombreDe(?string $nombre, User $usuario): ?string
    {
        $nombre = trim(preg_replace('/\s+/u', ' ', (string) $nombre));
        if ($nombre === '' || mb_strtolower($nombre) === mb_strtolower(trim($usuario->name.' '.$usuario->apellidos))) {
            return null;
        }

        return $nombre;
    }

    /**
     * El cliente mueve su cita a otra fecha, hora o profesional. Vuelve a quedar
     * pendiente: el negocio confirma de nuevo y el horario anterior se libera.
     */
    public static function reprogramar(Cita $cita, User $cliente, array $datos): Cita
    {
        return DB::transaction(function () use ($cita, $cliente, $datos) {
            // Mismo orden de bloqueos que crear(): negocio, profesionales, servicio.
            $negocio = Negocio::lockForUpdate()->findOrFail($cita->negocio_id);
            abort_if($negocio->archivado_at || $negocio->desactivado_at || $negocio->estaVetado(), 409, 'El negocio no está recibiendo citas.');
            $ids = array_values(array_unique(array_filter([$cita->profesional_id, (int) $datos['profesional_id']])));
            User::whereIn('id', $ids)->orderBy('id')->lockForUpdate()->get();
            $cita = Cita::where('cliente_id', $cliente->id)->lockForUpdate()->findOrFail($cita->id);
            abort_unless(in_array($cita->estado, ['pendiente', 'confirmada']) && $cita->inicio->gt(now()), 409, 'Esta cita ya no se puede reprogramar.');
            abort_if($cita->llegada_at, 409, 'Ya registraron tu llegada; esta cita no se puede reprogramar.');
            $profesional = User::findOrFail($datos['profesional_id']);
            abort_unless($negocio->esMiembroActivo($profesional), 422, 'El profesional ya no está disponible en este negocio.');
            $servicio = Servicio::where('negocio_id', $negocio->id)->where('disponible', true)->where('permite_citas', true)->lockForUpdate()->find($cita->servicio_id);
            abort_unless($servicio, 409, 'El servicio ya no recibe citas. Cancela esta cita y elige otro servicio.');
            $inicio = Carbon::createFromFormat('!Y-m-d H:i', $datos['fecha'].' '.$datos['hora'], config('app.timezone'));
            $fin = $inicio->copy()->addMinutes($servicio->duracion_minutos);
            abort_if($inicio->eq($cita->inicio) && $profesional->id === $cita->profesional_id, 422, 'Elige una fecha, hora o profesional diferente.');
            self::validarEspacio($negocio, $profesional->id, $inicio, $fin, $cliente->id, $cita->id);
            $cita->update([
                'profesional_id' => $profesional->id, 'inicio' => $inicio, 'fin' => $fin,
                'servicio_nombre' => $servicio->nombre,
                'estado' => 'pendiente', 'motivo' => null, 'recordatorio_minutos' => null,
                'confirmar_antes_de' => now()->addMinutes(self::MINUTOS_CONFIRMACION)->min($inicio),
            ]);

            return $cita->load(['profesional', 'negocio']);
        });
    }

    /**
     * El recordatorio más cercano cuyo momento ya llegó (null si falta más de un día).
     * Al confirmar se guarda para no enviar los que ya no tenían tiempo: una cita
     * confirmada 3 horas antes solo recibe los avisos de 1 hora y 15 minutos.
     */
    public static function recordatorioAlcanzado(Carbon $inicio): ?int
    {
        $faltan = now()->diffInMinutes($inicio, false);
        $alcanzado = null;
        foreach (self::RECORDATORIOS as $minutos) {
            if ($faltan <= $minutos) {
                $alcanzado = $minutos;
            }
        }

        return $alcanzado;
    }

    /** Envía al cliente los recordatorios de sus citas confirmadas que ya tocan. */
    public static function enviarRecordatorios(): int
    {
        $total = 0;
        Cita::where('estado', 'confirmada')->whereNotNull('cliente_id')->whereNull('llegada_at')
            ->where('inicio', '>', now())->where('inicio', '<=', now()->addMinutes(self::RECORDATORIOS[0]))
            ->with('negocio')
            ->chunkById(100, function ($citas) use (&$total) {
                foreach ($citas as $cita) {
                    $toca = self::recordatorioAlcanzado($cita->inicio);
                    if ($toca === null || ($cita->recordatorio_minutos !== null && $cita->recordatorio_minutos <= $toca)) {
                        continue;
                    }
                    // Atómico: si dos programadores coinciden, solo uno envía el aviso.
                    $marcada = Cita::whereKey($cita->id)->where('estado', 'confirmada')->where('inicio', $cita->inicio)
                        ->where(fn ($q) => $q->whereNull('recordatorio_minutos')->orWhere('recordatorio_minutos', '>', $toca))
                        ->update(['recordatorio_minutos' => $toca]);
                    if ($marcada) {
                        Push::enviar(User::whereKey($cita->cliente_id)->get(), new RecordatorioCita($cita, $toca));
                        $total++;
                    }
                }
            });

        return $total;
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
        // Además del push, las pantallas abiertas se actualizan en vivo.
        EnVivo::cita($cita);
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
            'a_nombre_de' => $cita->a_nombre_de, 'servicio_id' => $cita->servicio_id,
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
