<?php

namespace App\Support;

use App\Models\Negocio;
use App\Models\Producto;
use App\Models\Resena;
use App\Models\ResenaModeracion;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Lo que el admin hace con las reseñas públicas. Cada acción queda en el
 * historial (`resena_moderaciones`).
 *
 * Ocultar y descartar atienden los reportes pendientes: si no, una reseña que
 * el admin ya revisó seguiría en su lista.
 */
class ModeracionResenas
{
    public const OCULTAR = 'ocultar';

    public const RESTAURAR = 'restaurar';

    public const DESCARTAR = 'descartar';

    /** Motivos para reportar, con el texto que ve el admin. */
    public const MOTIVOS_REPORTE = [
        'ofensiva' => 'Ofensiva o irrespetuosa',
        'falsa' => 'Falsa o engañosa',
        'spam' => 'Publicidad o spam',
        'otro' => 'Otro motivo',
    ];

    /** false si ya estaba oculta. */
    public static function ocultar(Resena $resena, User $admin, string $motivo): bool
    {
        return DB::transaction(function () use ($resena, $admin, $motivo) {
            // Condicional: dos admins a la vez no dejan dos entradas en el historial.
            if (! Resena::visibles()->whereKey($resena->id)->update(['oculta_at' => now()])) {
                return false;
            }

            $resena->reportes()->whereNull('resuelto_at')->update(['resuelto_at' => now()]);
            self::anotar($resena, $admin, self::OCULTAR, $motivo);
            self::recalcular($resena);

            return true;
        });
    }

    /** false si no estaba oculta. */
    public static function restaurar(Resena $resena, User $admin, string $motivo): bool
    {
        return DB::transaction(function () use ($resena, $admin, $motivo) {
            if (! Resena::whereNotNull('oculta_at')->whereKey($resena->id)->update(['oculta_at' => null])) {
                return false;
            }

            self::anotar($resena, $admin, self::RESTAURAR, $motivo);
            self::recalcular($resena);

            return true;
        });
    }

    /** La reseña se queda publicada. false si no había reportes pendientes. */
    public static function descartarReportes(Resena $resena, User $admin): bool
    {
        return DB::transaction(function () use ($resena, $admin) {
            if (! $resena->reportes()->whereNull('resuelto_at')->update(['resuelto_at' => now()])) {
                return false;
            }

            self::anotar($resena, $admin, self::DESCARTAR, null);

            return true;
        });
    }

    /** Lo que ve el admin de una reseña; va con sus reportes e historial cargados. */
    public static function paraAdmin(Resena $resena): array
    {
        return [
            'id' => $resena->id,
            'autor' => $resena->user->nombre_completo,
            'estrellas' => $resena->estrellas,
            'comentario' => $resena->comentario,
            'fecha' => $resena->created_at->format('d/m/Y'),
            'negocio' => $resena->negocio?->nombre,
            'producto' => $resena->producto?->nombre,
            'oculta' => $resena->oculta_at !== null,
            'respuesta' => $resena->respuesta,
            'reportes' => $resena->reportes
                ->whereNull('resuelto_at')
                ->countBy('motivo')
                ->map(fn (int $cantidad, string $motivo) => [
                    'motivo' => self::MOTIVOS_REPORTE[$motivo] ?? $motivo,
                    'cantidad' => $cantidad,
                ])
                ->values(),
            'historial' => $resena->moderaciones->map(fn (ResenaModeracion $m) => [
                'accion' => $m->accion,
                'motivo' => $m->motivo,
                'admin' => $m->admin?->nombre_completo,
                'fecha' => $m->created_at->format('d/m/Y'),
            ])->values(),
        ];
    }

    private static function anotar(Resena $resena, User $admin, string $accion, ?string $motivo): void
    {
        $resena->moderaciones()->create(['admin_id' => $admin->id, 'accion' => $accion, 'motivo' => $motivo]);
    }

    private static function recalcular(Resena $resena): void
    {
        // Un producto borrado del catálogo conserva sus reseñas.
        $sujeto = $resena->producto_id
            ? Producto::withTrashed()->find($resena->producto_id)
            : Negocio::find($resena->negocio_id);

        if ($sujeto) {
            Resenas::recalcular($sujeto);
        }
    }
}
