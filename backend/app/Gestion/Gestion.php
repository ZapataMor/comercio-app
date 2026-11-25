<?php

namespace App\Gestion;

use App\Models\Negocio;
use App\Models\PlantillaGestion;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Reglas de Vitrina Gestión: qué módulos tiene un negocio, qué puede hacer
 * cada miembro y cómo el super administrador enciende el panel web,
 * aplica plantillas y prende o apaga módulos. La web y la app preguntan aquí;
 * ninguna pantalla decide por su cuenta (ADR-005).
 */
final class Gestion
{
    /** Módulos que el negocio puede usar: el núcleo más los opcionales encendidos. @return string[] */
    public static function modulosActivos(Negocio $negocio): array
    {
        if (! $negocio->gestion_activa) {
            return [];
        }
        $opcionales = $negocio->modulosGestion()->where('activo', true)->pluck('modulo')
            ->filter(fn ($m) => Modulos::existe($m) && ! Modulos::esNucleo($m))
            ->all();

        return array_values(array_unique([...Modulos::nucleo(), ...$opcionales]));
    }

    public static function tieneModulo(Negocio $negocio, string $modulo): bool
    {
        return in_array($modulo, self::modulosActivos($negocio), true);
    }

    /** ¿Es el dueño o el administrador del negocio? (tienen todos los permisos) */
    public static function administra(User $user, Negocio $negocio): bool
    {
        return $negocio->administra($user);
    }

    /**
     * Permisos de módulos que tiene la persona en este negocio, solo de los
     * módulos encendidos. El dueño y el administrador del negocio los tienen todos.
     *
     * @return string[]
     */
    public static function permisosDe(User $user, Negocio $negocio): array
    {
        $activos = self::modulosActivos($negocio);
        $posibles = array_keys(array_filter(Modulos::permisos(), fn ($p) => in_array($p[0], $activos, true)));
        if (self::administra($user, $negocio)) {
            return $posibles;
        }
        $miembro = $negocio->miembrosActivos()->whereKey($user->id)->first();
        if (! $miembro) {
            return [];
        }
        $propios = json_decode($miembro->pivot->permisos_gestion ?? '[]', true) ?: [];

        return array_values(array_intersect($posibles, $propios));
    }

    public static function puede(User $user, Negocio $negocio, string $permiso): bool
    {
        return in_array($permiso, self::permisosDe($user, $negocio), true);
    }

    /**
     * ¿La persona puede abrir este módulo en la web? El núcleo lo ven todos los
     * miembros (lo que pueden hacer adentro lo limitan los permisos de Vitrina);
     * un módulo opcional se ve con al menos uno de sus permisos.
     */
    public static function puedeVerModulo(User $user, Negocio $negocio, string $modulo): bool
    {
        if (! self::tieneModulo($negocio, $modulo)) {
            return false;
        }
        if (Modulos::esNucleo($modulo) || self::administra($user, $negocio)) {
            return true;
        }

        return (bool) array_intersect(array_keys(Modulos::get($modulo)['permisos']), self::permisosDe($user, $negocio));
    }

    /** Menú de la web para esta persona, agrupado. @return array<string, array<string, array<string, mixed>>> */
    public static function menu(User $user, Negocio $negocio): array
    {
        $visibles = array_values(array_filter(self::modulosActivos($negocio), fn ($m) => self::puedeVerModulo($user, $negocio, $m)));

        return Modulos::porGrupo($visibles);
    }

    /** Negocios con panel web donde la persona es miembro activo. */
    public static function negociosConWeb(User $user): Collection
    {
        return $user->negociosActivos()->where('negocios.gestion_activa', true)->orderBy('negocios.nombre')->get();
    }

    // ------------------------------------------------- Super administrador

    /** Enciende el panel web: crea la sede principal si no la tiene. */
    public static function activar(Negocio $negocio): void
    {
        DB::transaction(function () use ($negocio) {
            $negocio->forceFill([
                'gestion_activa' => true,
                'gestion_activada_at' => $negocio->gestion_activada_at ?? now(),
            ])->save();
            if (! $negocio->sedes()->exists()) {
                $negocio->sedes()->create([
                    'nombre' => 'Principal',
                    'tipo' => 'punto_venta',
                    'direccion' => $negocio->direccion,
                    'barrio' => $negocio->barrio,
                    'telefono' => $negocio->telefono,
                    'principal' => true,
                ]);
            }
        });
    }

    /** Apaga el panel web. Los datos y los módulos se conservan. */
    public static function desactivar(Negocio $negocio): void
    {
        $negocio->forceFill(['gestion_activa' => false])->save();
    }

    /**
     * Deja encendidos exactamente estos módulos opcionales (más sus
     * dependencias). Devuelve los que quedaron encendidos.
     *
     * @param  string[]  $claves
     * @return string[]
     */
    public static function definirModulos(Negocio $negocio, array $claves, ?User $quien = null): array
    {
        $desconocidos = array_filter($claves, fn ($c) => ! Modulos::existe($c) || Modulos::esNucleo($c));
        if ($desconocidos) {
            throw ValidationException::withMessages(['modulos' => 'Módulo desconocido: '.implode(', ', $desconocidos).'.']);
        }
        $finales = [];
        foreach ($claves as $clave) {
            $finales = [...$finales, ...Modulos::conDependencias($clave)];
        }
        $finales = array_values(array_unique($finales));

        if (! in_array('sedes', $finales, true) && $negocio->sedes()->where('activa', true)->count() > 1) {
            throw ValidationException::withMessages(['modulos' => 'Este negocio tiene varias sedes activas: desactiva las que sobran antes de apagar «Varias sedes».']);
        }

        DB::transaction(function () use ($negocio, $finales, $quien) {
            foreach (Modulos::opcionales() as $clave) {
                $encender = in_array($clave, $finales, true);
                $fila = $negocio->modulosGestion()->where('modulo', $clave)->first();
                if (! $fila && ! $encender) {
                    continue;
                }
                if ($fila && $fila->activo === $encender) {
                    continue;
                }
                $negocio->modulosGestion()->updateOrCreate(
                    ['modulo' => $clave],
                    ['activo' => $encender, 'cambiado_por' => $quien?->id],
                );
            }
        });

        return $finales;
    }

    /** Aplica la plantilla: la guarda en el negocio y suma sus módulos a los que ya tenía. */
    public static function aplicarPlantilla(Negocio $negocio, PlantillaGestion $plantilla, ?User $quien = null): array
    {
        $actuales = self::opcionalesEncendidos($negocio);
        $negocio->forceFill(['plantilla_gestion_id' => $plantilla->id])->save();

        return self::definirModulos($negocio, array_values(array_unique([...$actuales, ...$plantilla->modulosCompletos()])), $quien);
    }

    /** Opcionales encendidos aunque el panel esté apagado. @return string[] */
    public static function opcionalesEncendidos(Negocio $negocio): array
    {
        return $negocio->modulosGestion()->where('activo', true)->pluck('modulo')->all();
    }

    /** Permisos de módulos que se le pueden dar a un miembro (solo módulos encendidos). @return array<string, array{0:string,1:string}> */
    public static function permisosAsignables(Negocio $negocio): array
    {
        $activos = self::modulosActivos($negocio);

        return array_filter(Modulos::permisos(), fn ($p) => in_array($p[0], $activos, true));
    }

    /**
     * Guarda los permisos de módulos de un miembro. No toca los permisos de
     * módulos apagados (se conservan por si se vuelven a encender).
     *
     * @param  string[]  $permisos
     */
    public static function guardarPermisos(Negocio $negocio, User $miembro, array $permisos): void
    {
        $asignables = array_keys(self::permisosAsignables($negocio));
        $invalidos = array_diff($permisos, $asignables);
        if ($invalidos) {
            throw ValidationException::withMessages(['permisos' => 'Permiso no disponible: '.implode(', ', $invalidos).'.']);
        }
        $fila = $negocio->miembros()->whereKey($miembro->id)->first();
        if (! $fila) {
            throw ValidationException::withMessages(['permisos' => 'Esa persona no es del equipo.']);
        }
        $anteriores = json_decode($fila->pivot->permisos_gestion ?? '[]', true) ?: [];
        $deApagados = array_diff($anteriores, $asignables);
        $negocio->miembros()->updateExistingPivot($miembro->id, [
            'permisos_gestion' => json_encode(array_values(array_unique([...$deApagados, ...$permisos]))),
        ]);
    }
}
