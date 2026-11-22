<?php

namespace App\Http\Controllers;

use App\Http\Resources\ProductoResource;
use App\Models\Negocio;
use App\Models\Producto;
use App\Models\User;
use App\Notifications\PrecioProductoActualizado;
use App\Support\Busqueda;
use App\Support\FotoOptimizada;
use App\Support\NombresAlternos;
use App\Support\Push;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
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
    public function index(Request $request, Negocio $negocio): AnonymousResourceCollection|JsonResponse
    {
        if (! $negocio->puede($request->user(), 'modificar_inventario')) {
            return $this->sinAcceso();
        }

        $query = $negocio->productos()->with(['categoria', 'tipoProducto', 'categoriasCatalogo'])->latest();

        if ($request->filled('buscar')) {
            // Tolerante a errores, como la del cliente (ver App\Support\Busqueda).
            Busqueda::contieneTodos($query, 'productos.busqueda', Busqueda::terminos((string) $request->string('buscar')));
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
    public function store(Request $request, Negocio $negocio): JsonResponse
    {
        if (! $negocio->puede($request->user(), 'modificar_inventario')) {
            return $this->sinAcceso();
        }

        $data = $this->normalizarAtributos($request->validate($this->reglas($negocio, creando: true)));
        [$data, $categorias] = $this->separarCategorias($data);

        $producto = $negocio->productos()->create($data);
        if ($categorias !== null) {
            $producto->categoriasCatalogo()->sync($categorias);
        }

        $this->guardarImagen($request, $producto);

        return response()->json([
            'producto' => new ProductoResource($producto->load(['categoria', 'tipoProducto', 'categoriasCatalogo'])),
        ], 201);
    }

    /**
     * Ver UN producto mío.
     */
    public function show(Request $request, Negocio $negocio, int $id): JsonResponse
    {
        if (! $negocio->puede($request->user(), 'modificar_inventario')) {
            return $this->sinAcceso();
        }

        $producto = $negocio->productos()->find($id);

        if (! $producto) {
            return $this->noEncontrado();
        }

        return response()->json([
            'producto' => new ProductoResource($producto->load(['categoria', 'tipoProducto', 'categoriasCatalogo'])),
        ]);
    }

    /**
     * Actualizar UN producto mío (incluye activar/desactivar y cambiar categoría).
     */
    public function update(Request $request, Negocio $negocio, int $id): JsonResponse
    {
        if (! $negocio->puede($request->user(), 'modificar_inventario')) {
            return $this->sinAcceso();
        }

        $producto = $negocio->productos()->find($id);

        if (! $producto) {
            return $this->noEncontrado();
        }

        $data = $this->normalizarAtributos($request->validate($this->reglas($negocio, creando: false)));
        [$data, $categorias] = $this->separarCategorias($data);
        if (array_key_exists('nombres_alternos', $data)) {
            // El nombre principal puede venir o no en la misma petición.
            $data['nombres_alternos'] = NombresAlternos::limpiar($data['nombres_alternos'], $data['nombre'] ?? $producto->nombre);
        }

        $producto->update($data);
        if ($categorias !== null) {
            $producto->categoriasCatalogo()->sync($categorias);
        }
        if ($producto->wasChanged('precio')) {
            $usuarios = User::whereIn('id', DB::table('carrito_reservas')
                ->where('producto_id', $producto->id)->where('vence_at', '>', now())->select('user_id'))->get();
            Push::enviar($usuarios, new PrecioProductoActualizado($producto));
        }

        $this->guardarImagen($request, $producto);

        return response()->json([
            'producto' => new ProductoResource($producto->load(['categoria', 'tipoProducto', 'categoriasCatalogo'])),
        ]);
    }

    /**
     * Borrar UN producto mío (borrado suave: queda recuperable y no rompe
     * el historial de pedidos que lo referencien).
     */
    public function destroy(Request $request, Negocio $negocio, int $id): JsonResponse
    {
        if (! $negocio->puede($request->user(), 'modificar_inventario')) {
            return $this->sinAcceso();
        }

        $producto = $negocio->productos()->find($id);

        if (! $producto) {
            return $this->noEncontrado();
        }

        $producto->delete();

        return response()->json(['message' => 'Producto eliminado.']);
    }

    // ---------- Helpers privados ----------

    /**
     * Saca las categorías globales de los datos del producto: van en su propia
     * tabla. null = no vinieron (no se tocan); [] = quitarlas todas.
     *
     * @return array{0: array<string, mixed>, 1: ?array<int, int>}
     */
    private function separarCategorias(array $data): array
    {
        if (! array_key_exists('categorias_catalogo', $data)) {
            return [$data, null];
        }
        $ids = array_values(array_unique(array_map('intval', $data['categorias_catalogo'] ?? [])));
        unset($data['categorias_catalogo']);

        return [$data, $ids];
    }

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
            'precio' => [$requerido, 'integer', 'min:1'],
            // Tipo global del producto (Comida, Medicamento...): obligatorio
            // al crear; define qué atributos pide la app.
            'tipo_producto_id' => [$requerido, Rule::exists('tipos_producto', 'id')],
            // Ingredientes, usos, tallas... según el tipo de producto.
            'atributos' => ['sometimes', 'nullable', 'array', 'max:30'],
            // nullable: Laravel convierte '' en null; luego se descartan.
            'atributos.*' => ['nullable', 'string', 'max:100'],
            // Colores disponibles (ropa y calzado).
            'colores' => ['sometimes', 'nullable', 'array', 'max:30'],
            'colores.*' => ['nullable', 'string', 'max:100'],
            // Comida: ingredientes que el cliente no puede quitar (de los de `atributos`).
            'ingredientes_fijos' => ['sometimes', 'nullable', 'array', 'max:30'],
            'ingredientes_fijos.*' => ['nullable', 'string', 'max:100'],
            // Comida: extras que se piden aparte, con su precio por porción
            // (0 = gratis), en pesos sin puntos ni comas.
            'extras' => ['sometimes', 'nullable', 'array', 'max:20'],
            'extras.*.nombre' => ['nullable', 'string', 'max:100'],
            'extras.*.precio' => ['nullable', 'integer', 'min:0', 'max:1000000'],
            // Cómo se selecciona la cantidad: cantidad | peso | volumen | longitud.
            'tipo_venta' => ['sometimes', Rule::in(Producto::TIPOS_VENTA)],
            // Etiqueta de la medida del precio: 'unidad', 'kg', 'litro', 'metro', 'combo'...
            'unidad_medida' => ['sometimes', 'string', 'max:20'],
            'disponible' => ['sometimes', 'boolean'],
            // Categorías globales (Comida, Bebidas...): opcionales y varias.
            // Las crea el administrador; aquí solo se eligen.
            'categorias_catalogo' => ['sometimes', 'nullable', 'array', 'max:8'],
            'categorias_catalogo.*' => ['integer', 'distinct', Rule::exists('categorias_catalogo', 'id')],
            ...NombresAlternos::reglas(),
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
        foreach (['atributos', 'colores', 'ingredientes_fijos'] as $campo) {
            if (! array_key_exists($campo, $data)) {
                continue;
            }

            $data[$campo] = collect($data[$campo] ?? [])
                ->map(fn ($a) => trim((string) $a))
                ->filter()
                ->unique()
                ->values()
                ->all();
        }

        // Un ingrediente fijo tiene que estar entre los ingredientes.
        if (isset($data['ingredientes_fijos'], $data['atributos'])) {
            $data['ingredientes_fijos'] = array_values(array_intersect($data['ingredientes_fijos'], $data['atributos']));
        }

        if (array_key_exists('nombres_alternos', $data)) {
            $data['nombres_alternos'] = NombresAlternos::limpiar($data['nombres_alternos'], $data['nombre'] ?? null);
        }

        if (array_key_exists('extras', $data)) {
            // Sin nombre no es un extra; con el mismo nombre (sin importar
            // mayúsculas) vale el primero, para que el cliente no vea dos iguales.
            $data['extras'] = collect($data['extras'] ?? [])
                ->map(fn ($e) => ['nombre' => trim((string) ($e['nombre'] ?? '')), 'precio' => (int) ($e['precio'] ?? 0)])
                ->filter(fn ($e) => $e['nombre'] !== '')
                ->unique(fn ($e) => mb_strtolower($e['nombre']))
                ->values()
                ->all();
        }

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

        $producto->imagen = FotoOptimizada::guardarEn($request->file('imagen'), 'productos');
        $producto->save();
    }

    private function sinAcceso(): JsonResponse
    {
        return response()->json(['message' => 'No tienes acceso a este negocio.'], 403);
    }

    private function noEncontrado(): JsonResponse
    {
        return response()->json(['message' => 'Producto no encontrado.'], 404);
    }
}
