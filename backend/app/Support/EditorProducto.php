<?php

namespace App\Support;

use App\Models\Negocio;
use App\Models\Producto;
use App\Models\User;
use App\Notifications\PrecioProductoActualizado;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

/**
 * Crear y editar productos del catálogo de un negocio. Lo usan la app
 * (ProductoController) y el panel web del negocio, con las mismas reglas.
 */
class EditorProducto
{
    /**
     * Reglas de validación. La categoría debe existir Y pertenecer a este
     * negocio: así un comerciante no puede asignar la categoría de otra tienda.
     *
     * @return array<string, mixed>
     */
    public static function reglas(Negocio $negocio, bool $creando): array
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

    /** Crea el producto con los datos ya validados. */
    public static function crear(Negocio $negocio, array $data, ?UploadedFile $imagen = null): Producto
    {
        [$data, $categorias] = self::separarCategorias(self::normalizar($data));
        unset($data['imagen']);

        $producto = $negocio->productos()->create($data);
        if ($categorias !== null) {
            $producto->categoriasCatalogo()->sync($categorias);
        }
        self::guardarImagen($producto, $imagen);

        return $producto;
    }

    /** Actualiza el producto; si cambia el precio avisa a quien lo tiene en el carrito. */
    public static function actualizar(Producto $producto, array $data, ?UploadedFile $imagen = null): Producto
    {
        [$data, $categorias] = self::separarCategorias(self::normalizar($data));
        unset($data['imagen']);
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
        self::guardarImagen($producto, $imagen);

        return $producto;
    }

    /**
     * Saca las categorías globales de los datos del producto: van en su propia
     * tabla. null = no vinieron (no se tocan); [] = quitarlas todas.
     *
     * @return array{0: array<string, mixed>, 1: ?array<int, int>}
     */
    private static function separarCategorias(array $data): array
    {
        if (! array_key_exists('categorias_catalogo', $data)) {
            return [$data, null];
        }
        $ids = array_values(array_unique(array_map('intval', $data['categorias_catalogo'] ?? [])));
        unset($data['categorias_catalogo']);

        return [$data, $ids];
    }

    /**
     * Limpia los atributos validados: recorta espacios, descarta vacíos y
     * duplicados. Deja un array plano de textos listo para guardar.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private static function normalizar(array $data): array
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
    private static function guardarImagen(Producto $producto, ?UploadedFile $imagen): void
    {
        if (! $imagen) {
            return;
        }

        if ($producto->imagen) {
            Storage::disk('public')->delete($producto->imagen);
        }

        $producto->imagen = FotoOptimizada::guardarEn($imagen, 'productos');
        $producto->save();
    }

    /** URL pública de la imagen guardada (o null). */
    public static function urlImagen(?string $ruta): ?string
    {
        return $ruta ? asset('storage/'.ltrim(preg_replace('#^/?storage/#', '', $ruta), '/')) : null;
    }
}
