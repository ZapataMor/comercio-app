<?php

namespace App\Http\Controllers;

use App\Http\Resources\ProductoResource;
use App\Models\Negocio;
use App\Models\Producto;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class ProductoController extends Controller
{
    /**
     * Listar los productos de MI negocio, con búsqueda, filtro y paginación.
     *
     * Parámetros opcionales (query string):
     *   ?buscar=texto        -> filtra por nombre
     *   ?categoria_id=3      -> filtra por categoría
     *   ?disponible=1|0      -> filtra por disponibilidad
     *   ?por_pagina=15       -> tamaño de página (máx 100)
     *   ?page=2              -> número de página
     */
    public function index(Request $request): AnonymousResourceCollection|JsonResponse
    {
        $negocio = $this->negocioDe($request);

        if (! $negocio) {
            return $this->sinNegocio();
        }

        $query = $negocio->productos()->with(['categoria', 'tipoProducto'])->latest();

        if ($request->filled('buscar')) {
            $query->where('nombre', 'like', '%'.$request->string('buscar').'%');
        }

        if ($request->boolean('sin_categoria')) {
            // Productos sin categoría (grupo "Sin categoría" de la app).
            $query->whereNull('categoria_id');
        } elseif ($request->filled('categoria_id')) {
            $query->where('categoria_id', $request->integer('categoria_id'));
        }

        if ($request->filled('disponible')) {
            $query->where('disponible', $request->boolean('disponible'));
        }

        $porPagina = min($request->integer('por_pagina', 15), 100);

        return ProductoResource::collection($query->paginate($porPagina));
    }

    /**
     * Crear un producto en MI negocio.
     */
    public function store(Request $request): JsonResponse
    {
        $negocio = $this->negocioDe($request);

        if (! $negocio) {
            return $this->sinNegocio();
        }

        $data = $this->normalizarAtributos($request->validate($this->reglas($negocio, creando: true)));

        $producto = $negocio->productos()->create($data);

        $this->guardarImagen($request, $producto);

        return response()->json([
            'producto' => new ProductoResource($producto->load(['categoria', 'tipoProducto'])),
        ], 201);
    }

    /**
     * Ver UN producto mío.
     */
    public function show(Request $request, int $id): JsonResponse
    {
        $producto = $this->productoDe($request, $id);

        if (! $producto) {
            return $this->noEncontrado();
        }

        return response()->json([
            'producto' => new ProductoResource($producto->load(['categoria', 'tipoProducto'])),
        ]);
    }

    /**
     * Actualizar UN producto mío (incluye activar/desactivar y cambiar categoría).
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $producto = $this->productoDe($request, $id);

        if (! $producto) {
            return $this->noEncontrado();
        }

        $data = $this->normalizarAtributos($request->validate($this->reglas($producto->negocio, creando: false)));

        $producto->update($data);

        $this->guardarImagen($request, $producto);

        return response()->json([
            'producto' => new ProductoResource($producto->load(['categoria', 'tipoProducto'])),
        ]);
    }

    /**
     * Borrar UN producto mío (borrado suave: queda recuperable y no rompe
     * el historial de pedidos que lo referencien).
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $producto = $this->productoDe($request, $id);

        if (! $producto) {
            return $this->noEncontrado();
        }

        $producto->delete();

        return response()->json(['message' => 'Producto eliminado.']);
    }

    // ---------- Helpers privados ----------

    /**
     * Reglas de validación. La categoría debe existir Y pertenecer a este
     * negocio: así un comerciante no puede asignar la categoría de otra tienda.
     *
     * @return array<string, mixed>
     */
    private function reglas(Negocio $negocio, bool $creando): array
    {
        $requerido = $creando ? 'required' : 'sometimes';

        return [
            'nombre' => [$requerido, 'string', 'max:255'],
            'descripcion' => ['nullable', 'string'],
            // Precio en pesos colombianos, SIN puntos ni comas (entero).
            // Se entiende "por unidad_medida" (por unidad, por kg, por litro...).
            'precio' => [$requerido, 'integer', 'min:0'],
            // Tipo global del producto (Comida, Medicamento...): obligatorio
            // al crear; define qué atributos pide la app.
            'tipo_producto_id' => [$requerido, Rule::exists('tipos_producto', 'id')],
            // Ingredientes, usos, tallas... según el tipo de producto.
            'atributos' => ['sometimes', 'nullable', 'array', 'max:30'],
            // nullable: Laravel convierte '' en null; luego se descartan.
            'atributos.*' => ['nullable', 'string', 'max:100'],
            // Cómo se selecciona la cantidad: cantidad | peso | volumen | longitud.
            'tipo_venta' => ['sometimes', Rule::in(Producto::TIPOS_VENTA)],
            // Etiqueta de la medida del precio: 'unidad', 'kg', 'litro', 'metro', 'combo'...
            'unidad_medida' => ['sometimes', 'string', 'max:20'],
            'disponible' => ['sometimes', 'boolean'],
            'categoria_id' => [
                'nullable',
                Rule::exists('categorias', 'id')->where('negocio_id', $negocio->id),
            ],
            'imagen' => ['sometimes', 'image', 'max:4096'], // máx 4 MB
        ];
    }

    /**
     * Limpia los atributos validados: recorta espacios, descarta vacíos y
     * duplicados. Deja un array plano de textos listo para guardar.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function normalizarAtributos(array $data): array
    {
        if (! array_key_exists('atributos', $data)) {
            return $data;
        }

        $data['atributos'] = collect($data['atributos'] ?? [])
            ->map(fn ($a) => trim((string) $a))
            ->filter()
            ->unique()
            ->values()
            ->all();

        return $data;
    }

    /**
     * Guarda la imagen subida (si viene) en storage/public/productos y la
     * asigna, borrando la anterior. `imagen` no está en $fillable.
     */
    private function guardarImagen(Request $request, Producto $producto): void
    {
        if (! $request->hasFile('imagen')) {
            return;
        }

        if ($producto->imagen) {
            Storage::disk('public')->delete($producto->imagen);
        }

        $producto->imagen = $request->file('imagen')->store('productos', 'public');
        $producto->save();
    }

    private function negocioDe(Request $request): ?Negocio
    {
        return $request->user()->negocio;
    }

    /**
     * Busca un producto SOLO dentro del negocio del comerciante.
     */
    private function productoDe(Request $request, int $id): ?Producto
    {
        return $this->negocioDe($request)?->productos()->find($id);
    }

    private function sinNegocio(): JsonResponse
    {
        return response()->json(['message' => 'Primero debes crear tu negocio.'], 409);
    }

    private function noEncontrado(): JsonResponse
    {
        return response()->json(['message' => 'Producto no encontrado.'], 404);
    }
}
