<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Propiedad;
use App\Rules\Direccion;
use App\Rules\Telefono;
use App\Support\Busqueda;
use App\Support\FotoOptimizada;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

/**
 * Propiedades: casas en venta, casas en alquiler y patios para eventos.
 *
 * Cualquier persona publica las suyas (no hace falta tener un negocio) y el
 * cliente las ve en la sección «Propiedades»: listado, detalle y mapa. Solo
 * salen las disponibles de cuentas activas; el dueño ve y edita las suyas
 * aunque estén ocultas.
 */
class PropiedadController extends Controller
{
    private const MAX_FOTOS = 10;

    private const POR_PAGINA = 20;

    /** Peso máximo de cada foto (el servidor admite 12 MB por archivo). */
    private const MAX_KB_FOTO = 10240;

    /** Listado del cliente, con filtros. Primero las más recientes. */
    public function index(Request $request): JsonResponse
    {
        $filtros = $request->validate([
            'tipo' => ['sometimes', Rule::in(Propiedad::TIPOS)],
            'buscar' => ['sometimes', 'nullable', 'string', 'max:100'],
            'precio_max' => ['sometimes', 'integer', 'min:1'],
            'habitaciones' => ['sometimes', 'integer', 'min:1', 'max:20'],
            'page' => ['sometimes', 'integer', 'min:1'],
        ]);

        $query = Propiedad::query()->publicadas()
            ->when($filtros['tipo'] ?? null, fn ($q, $tipo) => $q->where('tipo', $tipo))
            ->when($filtros['precio_max'] ?? null, fn ($q, $max) => $q->where('precio', '<=', $max))
            ->when($filtros['habitaciones'] ?? null, fn ($q, $n) => $q->where('habitaciones', '>=', $n));

        // Búsqueda tolerante a errores (ver App\Support\Busqueda).
        if (filled($filtros['buscar'] ?? null)) {
            Busqueda::contieneTodos($query, 'propiedades.busqueda', Busqueda::terminos($filtros['buscar']));
        }

        $pagina = $query->latest('id')->paginate(self::POR_PAGINA);

        return response()->json([
            'propiedades' => collect($pagina->items())->map(fn (Propiedad $p) => $this->resumen($p))->values(),
            'meta' => [
                'pagina' => $pagina->currentPage(),
                'ultima_pagina' => $pagina->lastPage(),
                'total' => $pagina->total(),
            ],
        ]);
    }

    /** Todas las publicadas, sin paginar, para el mapa de propiedades. */
    public function mapa(): JsonResponse
    {
        $propiedades = Propiedad::query()->publicadas()->latest('id')->get()
            ->map(fn (Propiedad $p) => $this->resumen($p));

        return response()->json(['propiedades' => $propiedades]);
    }

    /** Lo que el formulario ofrece marcar, según el tipo. */
    public function opciones(): JsonResponse
    {
        return response()->json([
            'caracteristicas' => [
                'venta' => Propiedad::CARACTERISTICAS_CASA,
                'alquiler' => Propiedad::CARACTERISTICAS_CASA,
                'eventos' => Propiedad::CARACTERISTICAS_EVENTOS,
            ],
            'max_fotos' => self::MAX_FOTOS,
        ]);
    }

    /** Detalle: lo ve cualquiera si está publicada; si no, solo su dueño. */
    public function show(Request $request, int $id): JsonResponse
    {
        $propiedad = Propiedad::findOrFail($id);
        $mia = $propiedad->user_id === $request->user()->id;
        abort_unless($mia || Propiedad::query()->publicadas()->whereKey($id)->exists(), 404, 'Esta propiedad ya no está publicada.');

        return response()->json(['propiedad' => $this->detalle($propiedad, $mia)]);
    }

    public function mias(Request $request): JsonResponse
    {
        $propiedades = $request->user()->propiedades()->latest('id')->get()
            ->map(fn (Propiedad $p) => $this->detalle($p, true));

        return response()->json(['propiedades' => $propiedades]);
    }

    public function store(Request $request): JsonResponse
    {
        $propiedad = $this->guardar($request, $request->user()->propiedades()->make());

        return response()->json(['propiedad' => $this->detalle($propiedad, true)], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $propiedad = $this->propia($request, $id);

        return response()->json(['propiedad' => $this->detalle($this->guardar($request, $propiedad), true)]);
    }

    /**
     * Añade una foto al final de la galería. La app sube las fotos de a una:
     * varias fotos del celular juntas pasan del límite de una petición.
     */
    public function agregarFoto(Request $request, int $id): JsonResponse
    {
        $propiedad = $this->propia($request, $id);
        $request->validate(['foto' => ['required', 'image', 'max:'.self::MAX_KB_FOTO]], [
            'foto.max' => 'Cada foto puede pesar hasta 10 MB.',
        ]);
        $galeria = $propiedad->galeria ?? [];
        abort_if(count($galeria) >= self::MAX_FOTOS, 422, 'Puedes mostrar hasta '.self::MAX_FOTOS.' fotos por propiedad.');
        $galeria[] = FotoOptimizada::guardar($request->file('foto'), 'propiedades');
        $propiedad->galeria = $galeria;
        $propiedad->save();

        return response()->json(['propiedad' => $this->detalle($propiedad, true)]);
    }

    /** Ocultar (vendida, alquilada, en pausa) o volver a publicar. */
    public function disponibilidad(Request $request, int $id): JsonResponse
    {
        $propiedad = $this->propia($request, $id);
        $propiedad->update($request->validate(['disponible' => ['required', 'boolean']]));

        return response()->json(['propiedad' => $this->detalle($propiedad, true)]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $propiedad = $this->propia($request, $id);
        $fotos = $propiedad->galeria ?? [];
        $propiedad->delete();
        $this->borrarFotos($fotos);

        return response()->json(['message' => 'Propiedad eliminada.']);
    }

    /** Una propiedad del usuario; la de otro responde 404 (no se revela que existe). */
    private function propia(Request $request, int $id): Propiedad
    {
        return $request->user()->propiedades()->findOrFail($id);
    }

    private function guardar(Request $request, Propiedad $propiedad): Propiedad
    {
        $datos = $this->validar($request, $propiedad);
        $anteriores = $propiedad->galeria ?? [];
        $conservar = $datos['conservar_imagenes'] ?? $anteriores;
        $nuevas = $request->file('imagenes', []);
        $total = count($conservar) + count($nuevas);
        abort_if($total > self::MAX_FOTOS, 422, 'Puedes mostrar hasta '.self::MAX_FOTOS.' fotos por propiedad.');
        abort_if($total === 0, 422, 'Añade al menos una foto de la propiedad.');
        unset($datos['conservar_imagenes'], $datos['imagenes']);

        // Lo que no aplica al tipo no se guarda: un patio no tiene estrato.
        if ($datos['tipo'] === 'eventos') {
            $datos = ['habitaciones' => null, 'banos' => null, 'estrato' => null] + $datos;
        } else {
            $datos['capacidad'] = null;
        }

        $propiedad->fill($datos);
        foreach ($nuevas as $foto) {
            $conservar[] = FotoOptimizada::guardar($foto, 'propiedades');
        }
        $propiedad->galeria = array_values($conservar);
        $propiedad->save();
        $this->borrarFotos(array_diff($anteriores, $conservar));

        return $propiedad;
    }

    private function validar(Request $request, Propiedad $propiedad): array
    {
        // Multipart: la lista de fotos que se conservan llega como JSON.
        if (is_string($request->input('conservar_imagenes'))) {
            $request->merge(['conservar_imagenes' => json_decode($request->input('conservar_imagenes'), true) ?? []]);
        }
        if (is_string($request->input('caracteristicas'))) {
            $request->merge(['caracteristicas' => json_decode($request->input('caracteristicas'), true) ?? []]);
        }
        foreach (['titulo', 'descripcion', 'direccion', 'barrio', 'condiciones', 'contacto_nombre'] as $campo) {
            if (is_string($request->input($campo))) {
                $request->merge([$campo => trim($request->input($campo))]);
            }
        }
        $esPatio = $request->input('tipo') === 'eventos';
        $caracteristicas = $esPatio ? Propiedad::CARACTERISTICAS_EVENTOS : Propiedad::CARACTERISTICAS_CASA;

        return $request->validate([
            'tipo' => ['required', Rule::in(Propiedad::TIPOS)],
            'titulo' => ['required', 'string', 'max:120'],
            'descripcion' => ['required', 'string', 'max:5000'],
            'precio' => ['required', 'integer', 'min:1', 'max:100000000000'],
            'negociable' => ['sometimes', 'boolean'],
            'direccion' => ['required', 'string', 'max:191', new Direccion],
            // Los barrios oficiales traen espacios y puntos («Urb. Villa Inés»).
            'barrio' => ['required', 'string', 'max:100', 'regex:/\A[\p{L}\p{N}][\p{L}\p{N}. -]*\z/u'],
            'lat' => ['required', 'numeric', 'between:-90,90'],
            'lng' => ['required', 'numeric', 'between:-180,180'],
            'habitaciones' => [$esPatio ? 'nullable' : 'required', 'integer', 'min:0', 'max:50'],
            'banos' => [$esPatio ? 'nullable' : 'required', 'integer', 'min:0', 'max:50'],
            'area_m2' => ['nullable', 'integer', 'min:1', 'max:60000'],
            'estrato' => ['nullable', 'integer', 'min:1', 'max:6'],
            'capacidad' => [$esPatio ? 'required' : 'nullable', 'integer', 'min:1', 'max:10000'],
            'caracteristicas' => ['sometimes', 'array', 'max:'.count($caracteristicas)],
            'caracteristicas.*' => ['string', 'distinct', Rule::in($caracteristicas)],
            'condiciones' => ['nullable', 'string', 'max:3000'],
            'contacto_nombre' => ['required', 'string', 'max:100'],
            'contacto_telefono' => ['required', 'string', new Telefono],
            'disponible' => ['sometimes', 'boolean'],
            'imagenes' => ['sometimes', 'array', 'max:'.self::MAX_FOTOS],
            'imagenes.*' => ['image', 'max:'.self::MAX_KB_FOTO],
            'conservar_imagenes' => ['sometimes', 'array', 'max:'.self::MAX_FOTOS],
            'conservar_imagenes.*' => ['string', Rule::in($propiedad->galeria ?? [])],
        ], [
            'habitaciones.required' => 'Indica cuántas habitaciones tiene.',
            'banos.required' => 'Indica cuántos baños tiene.',
            'capacidad.required' => 'Indica cuántas personas caben en el patio.',
            'lat.required' => 'Fija la ubicación en el mapa.',
            'lng.required' => 'Fija la ubicación en el mapa.',
        ]);
    }

    private function borrarFotos(array $fotos): void
    {
        foreach ($fotos as $foto) {
            if (is_string($foto) && str_starts_with($foto, '/storage/propiedades/')) {
                Storage::disk('public')->delete(substr($foto, strlen('/storage/')));
            }
        }
    }

    /** Lo que necesitan la tarjeta del listado y el pin del mapa. */
    private function resumen(Propiedad $p): array
    {
        return [
            'id' => $p->id,
            'tipo' => $p->tipo,
            'titulo' => $p->titulo,
            'precio' => $p->precio,
            'negociable' => $p->negociable,
            'direccion' => $p->direccion,
            'barrio' => $p->barrio,
            'habitaciones' => $p->habitaciones,
            'banos' => $p->banos,
            'area_m2' => $p->area_m2,
            'capacidad' => $p->capacidad,
            'foto' => $p->galeria[0] ?? null,
            'lat' => $p->lat,
            'lng' => $p->lng,
            'publicada_at' => $p->created_at?->toIso8601String(),
        ];
    }

    private function detalle(Propiedad $p, bool $mia): array
    {
        return $this->resumen($p) + [
            'descripcion' => $p->descripcion,
            'estrato' => $p->estrato,
            'caracteristicas' => $p->caracteristicas ?? [],
            'condiciones' => $p->condiciones,
            'contacto_nombre' => $p->contacto_nombre,
            'contacto_telefono' => $p->contacto_telefono,
            'galeria' => $p->galeria ?? [],
            'disponible' => $p->disponible,
            'es_mia' => $mia,
            'actualizada_at' => $p->updated_at?->toIso8601String(),
        ];
    }
}
