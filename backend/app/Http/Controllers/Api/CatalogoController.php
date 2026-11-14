<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProductoResource;
use App\Models\Negocio;
use App\Models\Producto;
use App\Models\TipoNegocio;
use App\Models\TipoProducto;
use App\Support\Busqueda;
use App\Support\HorarioNegocio;
use App\Support\Reputacion;
use App\Support\Resenas;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * API de catálogo para que el CLIENTE (app móvil) explore negocios abiertos
 * y vea sus productos disponibles. Solo lectura.
 */
class CatalogoController extends Controller
{
    /**
     * Lista de TODOS los negocios registrados (abiertos y cerrados), con su
     * número de productos disponibles, paginados de 50 en 50.
     *
     * Parámetros opcionales:
     *   ?page=N       -> página a consultar (50 negocios por página).
     *   ?buscar=texto -> filtra por nombre/descripción del negocio, o por
     *                    negocios que tengan algún producto disponible que
     *                    coincida (por nombre o por su categoría).
     */
    public function index(Request $request): JsonResponse
    {
        $query = Negocio::query()
            // Los vetados por baja confiabilidad y los archivados (su único
            // dueño eliminó la cuenta) no se muestran.
            ->whereNull('vetado_at')
            ->whereNull('archivado_at')->whereNull('desactivado_at')
            ->with('tiposNegocio')
            ->withCount(['productos' => fn ($q) => $q->where('disponible', true), 'servicios' => fn ($q) => $q->where('disponible', true)]);
        $seccion = $request->validate(['seccion' => ['sometimes', 'in:productos,servicios']])['seccion'] ?? null;
        if ($seccion) {
            $query->whereHas($seccion, fn ($q) => $q->where('disponible', true));
        }

        if ($request->filled('tipo_negocio_id')) {
            $tipoId = $request->integer('tipo_negocio_id');
            $query->whereHas('tiposNegocio', fn ($q) => $q->where('tipos_negocio.id', $tipoId));
        }

        // Búsqueda tolerante a errores (ver App\Support\Busqueda): cada palabra
        // debe aparecer en el negocio, en su tipo o en algún producto/servicio
        // disponible. Una consulta sin letras ni números («%») no encuentra nada.
        $terminos = $request->filled('buscar') ? Busqueda::terminos((string) $request->string('buscar')) : null;
        if ($terminos === []) {
            $query->whereRaw('1 = 0');
        }
        foreach ($terminos ?? [] as $alternativas) {
            $query->where(function ($q) use ($alternativas, $seccion) {
                Busqueda::orContiene($q, 'negocios.busqueda', $alternativas)
                    ->orWhereHas('tiposNegocio', fn ($t) => Busqueda::contieneAlguna($t, 'tipos_negocio.busqueda', $alternativas))
                    // Por un producto disponible: su nombre, descripción,
                    // atributos o el nombre de su categoría.
                    ->when($seccion !== 'servicios', fn ($q) => $q->orWhereHas('productos', function ($p) use ($alternativas) {
                        $p->where('disponible', true)->where(fn ($pp) => Busqueda::orContiene($pp, 'productos.busqueda', $alternativas)
                            ->orWhereHas('categoria', fn ($c) => Busqueda::contieneAlguna($c, 'categorias.busqueda', $alternativas)));
                    }))
                    ->when($seccion !== 'productos', fn ($q) => $q->orWhereHas('servicios', function ($s) use ($alternativas) {
                        $s->where('disponible', true)->where(fn ($ss) => Busqueda::orContiene($ss, 'servicios.busqueda', $alternativas));
                    }));
            });
        }

        $pagina = $query
            // Primero los abiertos, y dentro de cada grupo por nombre.
            ->orderByDesc('activo')
            ->orderBy('nombre')
            ->paginate(50);

        $negocios = collect($pagina->items())->map(fn ($n) => [
            'id' => $n->id,
            'nombre' => $n->nombre,
            'descripcion' => $n->descripcion,
            'categoria' => $n->tiposNegocio->first()?->nombre ?? $n->categoria,
            'categorias' => $n->tiposNegocio->pluck('nombre')->values()->all(),
            'direccion' => $n->direccion,
            'barrio' => $n->barrio,
            'imagen' => $n->imagen ? '/storage/'.$n->imagen : null,
            'productos' => $n->productos_count,
            'servicios' => $n->servicios_count,
            'abierto' => (bool) $n->activo,
            'estado_texto' => HorarioNegocio::estadoTexto($n),
            'horario_hoy' => HorarioNegocio::textoHoyDe($n, now()),
            'tiempo_preparacion' => $n->tiempo_preparacion,
            'reputacion' => Reputacion::resumen(Reputacion::NEGOCIO, $n),
            'resenas' => Resenas::resumen($n),
            // En una búsqueda: si coincide por su nombre o su tipo (la app lo
            // lista en "Negocios"), y no solo por lo que vende.
            'coincide_nombre' => $terminos
                ? Busqueda::coincide(Str::before((string) $n->busqueda, '|').' '.$n->tiposNegocio->pluck('busqueda')->implode(' '), $terminos)
                : null,
        ]);

        return response()->json([
            'negocios' => $negocios,
            'meta' => [
                'pagina' => $pagina->currentPage(),
                'ultima_pagina' => $pagina->lastPage(),
                'total' => $pagina->total(),
            ],
        ]);
    }

    /**
     * Negocios para el MAPA: todos los que ya fijaron su pin (abiertos y
     * cerrados), sin paginar y solo con lo que necesita el marcador.
     */
    public function mapa(): JsonResponse
    {
        $negocios = Negocio::query()
            ->whereNull('vetado_at')
            ->whereNull('archivado_at')->whereNull('desactivado_at')
            ->whereNotNull('lat')
            ->whereNotNull('lng')
            ->with('tiposNegocio')
            ->orderBy('nombre')
            ->get()
            ->map(fn (Negocio $n) => [
                'id' => $n->id,
                'nombre' => $n->nombre,
                'categoria' => $n->tiposNegocio->first()?->nombre ?? $n->categoria,
                // Todos sus tipos (un negocio puede ser farmacia y droguería): para el filtro del mapa.
                'tipos' => $n->tiposNegocio->isNotEmpty()
                    ? $n->tiposNegocio->pluck('nombre')->values()
                    : array_values(array_filter([$n->categoria])),
                'direccion' => $n->direccion,
                'barrio' => $n->barrio,
                'imagen' => $n->imagen ? '/storage/'.$n->imagen : null,
                'abierto' => (bool) $n->activo,
                'estado_texto' => HorarioNegocio::estadoTexto($n),
                'horario_hoy' => HorarioNegocio::textoHoyDe($n, now()),
                'lat' => $n->lat,
                'lng' => $n->lng,
            ]);

        return response()->json(['negocios' => $negocios]);
    }

    /** Tipos de negocio disponibles para filtrar la exploracion del cliente. */
    public function tiposNegocio(Request $request): JsonResponse
    {
        $seccion = $request->validate(['seccion' => ['sometimes', 'in:productos,servicios']])['seccion'] ?? null;
        $tipos = TipoNegocio::query()
            ->whereHas('negocios', function ($q) use ($seccion) {
                $q->whereNull('vetado_at')->whereNull('archivado_at')->whereNull('desactivado_at');
                if ($seccion) {
                    $q->whereHas($seccion, fn ($items) => $items->where('disponible', true));
                }
            })
            ->orderBy('nombre')
            ->get(['id', 'nombre', 'slug']);

        return response()->json(['categorias' => $tipos]);
    }

    /**
     * Tipos globales de producto (Comida, Medicamento...) con la configuración
     * del formulario: qué pregunta hacer (atributo_label), el texto del botón
     * de añadir y las sugerencias pre-creadas.
     */
    public function tiposProducto(): JsonResponse
    {
        $tipos = TipoProducto::query()
            ->orderBy('orden')
            ->orderBy('nombre')
            ->get(['id', 'nombre', 'slug', 'atributo_label', 'atributo_boton', 'sugerencias', 'sugerencias_colores']);

        return response()->json(['tipos_producto' => $tipos]);
    }

    /**
     * Búsqueda de PRODUCTOS para el cliente (app móvil).
     *
     * Devuelve los productos disponibles de negocios abiertos cuyo nombre
     * (o el de su categoría/descripción) coincide con ?buscar=texto, junto al
     * negocio que los vende. El orden es por RELEVANCIA: de la coincidencia más
     * cercana a la más lejana (nombre exacto → empieza por → contiene → otros),
     * y a igualdad de relevancia, alfabético.
     */
    public function buscarProductos(Request $request): JsonResponse
    {
        $texto = trim((string) $request->string('buscar'));
        $tipoNegocioId = $request->integer('tipo_negocio_id') ?: null;
        $terminos = $texto !== '' ? Busqueda::terminos($texto) : [];

        // Sin texto ni categoria no buscamos productos (la app muestra negocios).
        // Un texto sin letras ni números («%», «...») tampoco encuentra nada.
        if (($texto === '' && ! $tipoNegocioId && ! $request->boolean('todos')) || ($texto !== '' && $terminos === [])) {
            return response()->json(['productos' => []]);
        }

        // La frase tal como suena (y con los errores de tecleo corregidos), para
        // ordenar por cercanía al nombre.
        $frase = Busqueda::fraseCorregida($texto, $terminos);

        $productos = Producto::query()
            ->where('disponible', true)->where('precio', '>', 0)
            ->whereHas('negocio', function ($q) use ($tipoNegocioId) {
                $q->whereNull('vetado_at')->whereNull('archivado_at')->whereNull('desactivado_at');
                if ($tipoNegocioId) {
                    $q->whereHas('tiposNegocio', fn ($t) => $t->where('tipos_negocio.id', $tipoNegocioId));
                }
            })
            // Cada palabra en el producto (nombre, descripción, atributos) o en
            // el nombre de su categoría, escrita como suene.
            ->when($terminos !== [], function ($q) use ($terminos) {
                foreach ($terminos as $alternativas) {
                    $q->where(fn ($qq) => Busqueda::orContiene($qq, 'productos.busqueda', $alternativas)
                        ->orWhereHas('categoria', fn ($c) => Busqueda::contieneAlguna($c, 'categorias.busqueda', $alternativas)));
                }
            })
            ->with(['categoria', 'negocio'])
            ->orderByDesc(
                Negocio::select('activo')
                    ->whereColumn('negocios.id', 'productos.negocio_id')
                    ->limit(1)
            )
            // Ranking de cercanía de la coincidencia (0 = más cercana): nombre
            // igual, nombre que empieza por, nombre que contiene, otros campos
            // y, al final, lo que solo coincide palabra por palabra.
            ->when($frase !== '', fn ($q) => $q->orderByRaw(
                'CASE
                    WHEN productos.busqueda LIKE ? THEN 0
                    WHEN productos.busqueda LIKE ? THEN 1
                    WHEN productos.busqueda LIKE ? THEN 2
                    WHEN productos.busqueda LIKE ? THEN 3
                    ELSE 4
                END',
                [$frase.'|%', $frase.'%', '%'.$frase.'%|%', '%'.$frase.'%']
            ))
            ->orderBy('nombre')
            ->limit(50)
            ->get();

        return response()->json([
            'productos' => ProductoResource::collection($productos),
        ]);
    }

    /**
     * Lo que cambia solo con el tiempo. La app lo consulta cada pocos segundos
     * mientras se mira una tienda, sin volver a pedir todo el catálogo.
     */
    public function estado(int $id): JsonResponse
    {
        $negocio = Negocio::whereNull('vetado_at')->whereNull('archivado_at')->whereNull('desactivado_at')->find($id);

        if (! $negocio) {
            return response()->json(['message' => 'Negocio no encontrado.'], 404);
        }

        return response()->json([
            'activo' => (bool) $negocio->activo,
            'estado_texto' => HorarioNegocio::estadoTexto($negocio),
            'horario_hoy' => HorarioNegocio::textoHoyDe($negocio, now()),
        ]);
    }

    /** Detalle de un negocio + sus productos disponibles. */
    public function show(int $id): JsonResponse
    {
        $negocio = Negocio::with('tiposNegocio')->whereNull('vetado_at')->whereNull('archivado_at')->whereNull('desactivado_at')->find($id);

        if (! $negocio) {
            return response()->json(['message' => 'Negocio no encontrado.'], 404);
        }

        $productos = $negocio->productos()
            ->where('disponible', true)->where('precio', '>', 0)
            ->with(['categoria', 'tipoProducto'])
            ->orderBy('nombre')
            ->get();

        return response()->json([
            'negocio' => [
                'id' => $negocio->id,
                'nombre' => $negocio->nombre,
                'descripcion' => $negocio->descripcion,
                'categoria' => $negocio->tiposNegocio->first()?->nombre ?? $negocio->categoria,
                'categorias' => $negocio->tiposNegocio->pluck('nombre')->values()->all(),
                'direccion' => $negocio->direccion,
                'barrio' => $negocio->barrio,
                'telefono' => $negocio->telefono,
                'activo' => (bool) $negocio->activo,
                'estado_texto' => HorarioNegocio::estadoTexto($negocio),
                'imagen' => $negocio->imagen ? '/storage/'.$negocio->imagen : null,
                'tiempo_preparacion' => $negocio->tiempo_preparacion,
                // Horario semanal y el texto de hoy ("Hoy de 7:00 a. m. a 8:00 p. m.").
                'horario' => HorarioNegocio::normalizar($negocio->horario),
                'horario_hoy' => HorarioNegocio::textoHoyDe($negocio, now()),
                // Cierra pronto por horario: se le advierte al cliente antes de pedir.
                'minutos_para_cerrar' => $negocio->activo
                    ? HorarioNegocio::minutosParaCerrar($negocio->horario, now(), HorarioNegocio::ajusteDe($negocio))
                    : null,
                'reputacion' => Reputacion::resumen(Reputacion::NEGOCIO, $negocio),
                'resenas' => Resenas::resumen($negocio),
                'lat' => $negocio->lat,
                'lng' => $negocio->lng,
            ],
            'productos' => ProductoResource::collection($productos),
            'servicios' => $negocio->servicios()->where('disponible', true)->orderBy('nombre')->get(),
        ]);
    }
}
