<?php

namespace App\Http\Controllers\Web;

use App\Gestion\Gestion;
use App\Gestion\Modulos;
use App\Http\Controllers\Controller;
use App\Models\Barrio;
use App\Models\CategoriaCatalogo;
use App\Models\Cita;
use App\Models\Negocio;
use App\Models\Pedido;
use App\Models\Resena;
use App\Models\Sede;
use App\Models\TipoProducto;
use App\Rules\Direccion;
use App\Rules\Telefono;
use App\Support\Busqueda;
use App\Support\ClavePin;
use App\Support\EditorCuentaPago;
use App\Support\EditorProducto;
use App\Support\EditorServicio;
use App\Support\FotoOptimizada;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Illuminate\View\View;

/**
 * Panel web del negocio (ADR-005). Por ahora:
 * - el núcleo muestra los datos que ya existen en la app y la edición se trae
 *   módulo por módulo (Catálogo y Mi tienda ya se editan aquí),
 * - «Varias sedes» funciona completo,
 * - Inventario vive en InventarioController,
 * - Trabajadores vive en TrabajadoresController,
 * - los módulos en construcción muestran cómo van a estar constituidos.
 */
class PanelNegocioController extends Controller
{
    public function elegir(Request $request): View
    {
        return view('negocio.elegir', ['negocios' => $request->attributes->get('negocios_web')]);
    }

    public function cambiar(Request $request): RedirectResponse
    {
        $id = (int) $request->validate(['negocio_id' => ['required', 'integer']])['negocio_id'];
        abort_unless($request->attributes->get('negocios_web')->contains('id', $id), 403);
        $request->session()->put('negocio_web_id', $id);

        return redirect()->route('negocio.inicio');
    }

    public function inicio(Request $request): View
    {
        $negocio = $this->negocio($request);
        $hoy = now()->startOfDay();

        return view('negocio.inicio', [
            'sedes' => $negocio->sedes()->where('activa', true)->orderByDesc('principal')->get(),
            'equipo' => $negocio->miembrosActivos()->count(),
            'productos' => $negocio->productos()->count(),
            'pedidosHoy' => $negocio->pedidos()->where('created_at', '>=', $hoy)->count(),
            'enCurso' => $negocio->pedidos()->whereIn('estado', Pedido::EN_CURSO)->count(),
            'citasHoy' => Cita::where('negocio_id', $negocio->id)->whereBetween('inicio', [$hoy, $hoy->copy()->endOfDay()])->whereIn('estado', ['pendiente', 'confirmada'])->count(),
            'opcionales' => array_values(array_diff(Gestion::modulosActivos($negocio), Modulos::nucleo())),
            'permisos' => Gestion::permisosDe($request->user(), $negocio),
        ]);
    }

    public function tienda(Request $request): View
    {
        $negocio = $this->negocio($request);
        $administra = $negocio->administra($request->user());

        return view('negocio.tienda', [
            'puedeEditar' => $administra,
            'cuentas' => $administra ? $negocio->cuentasPago()->orderBy('orden')->get() : collect(),
            'tiposNegocio' => $negocio->tiposNegocio()->orderBy('nombre')->pluck('nombre'),
        ]);
    }

    /** Editar la información del negocio y su foto principal (la misma de la app, que aquí sale de portada; solo dueño o administrador). */
    public function guardarTienda(Request $request): RedirectResponse
    {
        $negocio = $this->negocio($request);
        abort_unless($negocio->administra($request->user()), 403, 'Solo el dueño o el administrador del negocio cambia su información.');

        $data = $request->validate([
            'nombre' => ['required', 'string', 'max:255'],
            'descripcion' => ['nullable', 'string', 'max:2000'],
            'direccion' => ['required', 'string', 'max:255', new Direccion],
            'barrio' => ['required', 'string', 'max:100', 'regex:'.Direccion::BARRIO],
            'telefono' => ['nullable', 'string', new Telefono],
            'tiempo_preparacion' => ['required', 'integer', 'min:5', 'max:180'],
            'imagen' => ['nullable', 'image', 'max:4096'],
        ], [
            'barrio.regex' => 'El barrio solo lleva letras, números, puntos y guiones.',
            'imagen.image' => 'La foto del negocio debe ser una imagen.',
            'imagen.max' => 'La foto del negocio no puede pasar de 4 MB.',
        ], [
            'nombre' => 'nombre', 'descripcion' => 'descripción', 'direccion' => 'dirección', 'barrio' => 'barrio',
            'telefono' => 'teléfono', 'tiempo_preparacion' => 'tiempo de preparación', 'imagen' => 'foto del negocio',
        ]);
        unset($data['imagen']);

        $negocio->update($data);
        Barrio::registrarSiEsNuevo($data['barrio'], $request->user()->id);
        if ($request->hasFile('imagen')) {
            $anterior = $negocio->imagen;
            $negocio->imagen = FotoOptimizada::guardarEn($request->file('imagen'), 'negocios');
            $negocio->save();
            if ($anterior) {
                Storage::disk('public')->delete($anterior);
            }
        }

        return redirect()->route('negocio.tienda')->with('ok', 'Se guardó la información del negocio.');
    }

    /**
     * Crear (sin cuenta) o editar una cuenta para transferencias. Pide la
     * clave de 4 números, como en la app: quien entre a la sesión de un
     * comerciante no puede cambiar el número para quedarse con los pagos.
     */
    public function guardarCuenta(Request $request, ?int $cuenta = null): RedirectResponse
    {
        $negocio = $this->negocio($request);
        abort_unless($negocio->administra($request->user()), 403, 'Solo el dueño o el administrador del negocio maneja las cuentas.');
        $modelo = $cuenta ? $negocio->cuentasPago()->findOrFail($cuenta) : null;

        return $this->conClave($request, function () use ($request, $negocio, $modelo) {
            $datos = EditorCuentaPago::validar($request, $modelo);
            if ($modelo) {
                EditorCuentaPago::actualizar($modelo, $datos, $request->file('qr'), $request->boolean('quitar_qr'));
            } else {
                $modelo = EditorCuentaPago::crear($negocio, $datos, $request->file('qr'));
            }

            return redirect()->route('negocio.tienda')->with('ok', 'Se guardó la cuenta de '.$modelo->nombre().'.');
        });
    }

    public function eliminarCuenta(Request $request, int $cuenta): RedirectResponse
    {
        $negocio = $this->negocio($request);
        abort_unless($negocio->administra($request->user()), 403, 'Solo el dueño o el administrador del negocio maneja las cuentas.');
        $modelo = $negocio->cuentasPago()->findOrFail($cuenta);

        return $this->conClave($request, function () use ($modelo) {
            EditorCuentaPago::eliminar($modelo);

            return redirect()->route('negocio.tienda')->with('ok', 'Se eliminó la cuenta de '.$modelo->nombre().'.');
        });
    }

    /**
     * Revisa la clave y corre `$accion`. Los errores vuelven al formulario sin
     * guardar la clave en la sesión (Laravel la guardaría con el resto).
     */
    private function conClave(Request $request, \Closure $accion): RedirectResponse
    {
        $volver = fn () => back()->withInput($request->except(['pin', 'qr']));
        try {
            ClavePin::comprobar($request->user(), $request->input('pin'));

            return $accion();
        } catch (ValidationException $e) {
            return $volver()->withErrors($e->errors());
        } catch (HttpResponseException) {
            return $volver()->with('error', 'Tu clave quedó bloqueada por intentos fallidos. Desbloquéala en la app con «¿Olvidaste tu clave?».');
        }
    }

    public function catalogo(Request $request): View
    {
        $negocio = $this->negocio($request);
        $buscar = trim((string) $request->query('buscar', ''));
        $estado = $request->query('estado');

        $query = $negocio->productos()->with(['categoria', 'tipoProducto', 'categoriasCatalogo'])->orderBy('nombre');
        if ($buscar !== '') {
            Busqueda::contieneTodos($query, 'productos.busqueda', Busqueda::terminos($buscar));
        }
        if (in_array($estado, ['disponibles', 'agotados'], true)) {
            $query->where('disponible', $estado === 'disponibles');
        }

        $totalProductos = $negocio->productos()->count();
        $servicios = $negocio->servicios()->orderBy('nombre')->get();
        // Primero los productos; los servicios si no hay productos o si los piden.
        $pestana = $request->query('pestana') === 'servicios' || ($totalProductos === 0 && $servicios->isNotEmpty()) ? 'servicios' : 'productos';
        if ($buscar !== '' || $estado) {
            $pestana = 'productos';
        }

        return view('negocio.catalogo', [
            'productos' => $query->paginate(24, ['*'], 'productos')->withQueryString(),
            'totalProductos' => $totalProductos,
            'buscar' => $buscar,
            'estado' => $estado,
            'servicios' => $servicios,
            'pestana' => $pestana,
            'campos' => $negocio->plantillaGestion?->campos_producto ?? [],
            'puedeEditar' => $negocio->puede($request->user(), 'modificar_inventario'),
            'categorias' => $negocio->categorias()->orderBy('nombre')->get(['id', 'nombre']),
            'tipos' => TipoProducto::orderBy('orden')->orderBy('nombre')->get(),
            'categoriasCatalogo' => CategoriaCatalogo::orderBy('nombre')->get(['id', 'nombre']),
        ]);
    }

    /** Crear (sin producto) o editar un producto del catálogo desde la web. */
    public function guardarProducto(Request $request, ?int $producto = null): RedirectResponse
    {
        $negocio = $this->negocio($request);
        abort_unless($negocio->puede($request->user(), 'modificar_inventario'), 403, 'No tienes permiso para cambiar el catálogo.');
        $modelo = $producto ? $negocio->productos()->findOrFail($producto) : null;

        $request->merge($this->datosDeFormulario($request));
        $data = $request->validate(EditorProducto::reglas($negocio, creando: $modelo === null), [], [
            'nombre' => 'nombre', 'precio' => 'precio', 'tipo_producto_id' => 'tipo de producto',
            'categoria_id' => 'sección', 'imagen' => 'imagen', 'descripcion' => 'descripción',
        ]);

        if ($modelo) {
            EditorProducto::actualizar($modelo, $data, $request->file('imagen'));
        } else {
            $modelo = EditorProducto::crear($negocio, $data, $request->file('imagen'));
        }

        return redirect()->to(url()->previous())->with('ok', 'Se guardó «'.$modelo->nombre.'».');
    }

    /** Añadir un servicio desde la pestaña Servicios del catálogo (mismas reglas que la app). */
    public function crearServicio(Request $request): RedirectResponse
    {
        $negocio = $this->negocio($request);
        abort_unless($negocio->puede($request->user(), 'modificar_inventario'), 403, 'No tienes permiso para cambiar el catálogo.');

        $precio = preg_replace('/\D/', '', (string) $request->input('precio', ''));
        $request->merge([
            'precio' => $precio === '' ? null : (int) $precio,
            'disponible' => $request->boolean('disponible'),
            'permite_citas' => $request->boolean('permite_citas'),
        ]);
        $servicio = EditorServicio::guardar($request, $negocio);

        return redirect()->route('negocio.catalogo', ['pestana' => 'servicios'])->with('ok', 'Se añadió el servicio «'.$servicio->nombre.'».');
    }

    /**
     * Disponible o agotado. El switch de cada tarjeta manda el valor
     * (`disponible`) y espera JSON; sin valor, se cambia al contrario.
     */
    public function disponibilidadProducto(Request $request, int $producto): RedirectResponse|JsonResponse
    {
        $negocio = $this->negocio($request);
        abort_unless($negocio->puede($request->user(), 'modificar_inventario'), 403, 'No tienes permiso para cambiar el catálogo.');
        $modelo = $negocio->productos()->findOrFail($producto);
        $disponible = $request->has('disponible') ? $request->boolean('disponible') : ! $modelo->disponible;
        $modelo->update(['disponible' => $disponible]);
        $mensaje = '«'.$modelo->nombre.'» quedó '.($modelo->disponible ? 'disponible.' : 'agotado.');

        if ($request->expectsJson()) {
            return response()->json(['disponible' => $modelo->disponible, 'message' => $mensaje]);
        }

        return back()->with('ok', $mensaje);
    }

    /** Borrado suave, como en la app: no rompe el historial de pedidos. */
    public function eliminarProducto(Request $request, int $producto): RedirectResponse
    {
        $negocio = $this->negocio($request);
        abort_unless($negocio->puede($request->user(), 'modificar_inventario'), 403, 'No tienes permiso para cambiar el catálogo.');
        $modelo = $negocio->productos()->findOrFail($producto);
        $modelo->delete();

        return back()->with('ok', 'Se eliminó «'.$modelo->nombre.'».');
    }

    /**
     * Lleva el formulario web a los campos de la app: listas que se agregan
     * una por una (ingredientes, obligatorios, colores, otros nombres), «se
     * vende por» y el precio con puntos.
     *
     * @return array<string, mixed>
     */
    private function datosDeFormulario(Request $request): array
    {
        $lista = fn (string $campo) => array_values(array_unique(array_filter(
            array_map(fn ($v) => trim((string) $v), array_filter((array) $request->input($campo, []), 'is_scalar')),
            'strlen'
        )));
        $venta = ['cantidad' => ['cantidad', 'unidad'], 'kilos' => ['peso', 'kg'], 'libras' => ['peso', 'libra']][$request->input('venta')] ?? ['cantidad', 'unidad'];
        $precio = preg_replace('/\D/', '', (string) $request->input('precio', ''));

        return [
            'precio' => $precio === '' ? null : (int) $precio,
            'categoria_id' => $request->input('categoria_id') ?: null,
            'atributos' => $lista('atributos_lista'),
            'colores' => $lista('colores_lista'),
            'ingredientes_fijos' => $lista('fijos_lista'),
            'nombres_alternos' => $lista('otros_nombres_lista'),
            'extras' => collect($request->input('extras_lista', []))
                ->filter(fn ($e) => is_array($e) && trim((string) ($e['nombre'] ?? '')) !== '')
                ->map(fn ($e) => ['nombre' => $e['nombre'], 'precio' => (int) preg_replace('/\D/', '', (string) ($e['precio'] ?? '0'))])
                ->values()->all(),
            'categorias_catalogo' => array_map('intval', (array) $request->input('categorias_marcadas', [])),
            'tipo_venta' => $venta[0],
            'unidad_medida' => $venta[1],
            'disponible' => $request->boolean('disponible'),
        ];
    }

    public function pedidos(Request $request): View
    {
        $negocio = $this->negocio($request);
        $user = $request->user();
        abort_unless($negocio->puede($user, 'gestionar_pedidos') || $negocio->puede($user, 'cambiar_estado'), 403, 'No tienes permiso para ver los pedidos.');

        $estado = $request->query('estado');
        $buscar = trim((string) $request->query('buscar', ''));
        $dia = null;
        if (is_string($request->query('dia')) && preg_match('/\A\d{4}-\d{2}-\d{2}\z/', $request->query('dia'))) {
            try {
                $dia = Carbon::createFromFormat('!Y-m-d', $request->query('dia'));
            } catch (\Throwable) {
                $dia = null;
            }
        }

        $query = $negocio->pedidos()->with(['cliente', 'domiciliario', 'items', 'calificacion'])->latest()->latest('id');
        match ($estado) {
            'en_curso' => $query->whereIn('estado', Pedido::EN_CURSO),
            'entregados' => $query->where('estado', 'entregado'),
            'cancelados' => $query->where('estado', 'cancelado'),
            default => null,
        };
        if ($dia) {
            $query->whereBetween('created_at', [$dia->copy()->startOfDay(), $dia->copy()->endOfDay()]);
        }
        if ($buscar !== '') {
            $digitos = preg_replace('/\D/', '', $buscar);
            $query->where(fn ($q) => $q->where('codigo', 'like', '%'.strtoupper($buscar).'%')
                ->when(strlen($digitos) >= 4, fn ($q) => $q->orWhere('telefono_contacto', 'like', '%'.$digitos.'%'))
                ->orWhereHas('cliente', fn ($c) => $c->where('name', 'like', '%'.$buscar.'%')));
        }

        $pedidos = $query->paginate(30)->withQueryString();

        return view('negocio.pedidos', [
            'pedidos' => $pedidos,
            // A quién se le asignó cada pedido desde Trabajadores.
            'asignados' => $negocio->tareas()->whereIn('pedido_id', $pedidos->pluck('id'))->with('trabajador')->get()->groupBy('pedido_id'),
            'estado' => in_array($estado, ['en_curso', 'entregados', 'cancelados'], true) ? $estado : null,
            'dia' => $dia,
            'buscar' => $buscar,
            // Para marcar en el calendario los días con pedidos (último año).
            'diasConPedidos' => $negocio->pedidos()->where('created_at', '>=', now()->subYear()->startOfDay())
                ->selectRaw('DATE(created_at) as dia, COUNT(*) as total')->groupBy('dia')->pluck('total', 'dia')
                ->mapWithKeys(fn ($total, $d) => [substr((string) $d, 0, 10) => (int) $total]),
        ]);
    }

    public function agenda(Request $request): View
    {
        $negocio = $this->negocio($request);

        return view('negocio.agenda', [
            'citas' => Cita::where('negocio_id', $negocio->id)->where('inicio', '>=', now()->startOfDay())
                ->with('profesional')->orderBy('inicio')->paginate(30),
        ]);
    }

    public function resenas(Request $request): View
    {
        $negocio = $this->negocio($request);

        return view('negocio.resenas', [
            'resenas' => Resena::where('negocio_id', $negocio->id)->latest()->paginate(30),
        ]);
    }

    // --------------------------------------------------------------- Sedes

    public function sedes(Request $request): View
    {
        $negocio = $this->negocio($request);

        return view('negocio.sedes', [
            'sedes' => $negocio->sedes()->orderByDesc('activa')->orderByDesc('principal')->orderBy('nombre')->get(),
            'variasSedes' => Gestion::tieneModulo($negocio, 'sedes'),
            'puedeEditar' => Gestion::puede($request->user(), $negocio, 'sedes.gestionar') || $negocio->administra($request->user()),
            'editar' => $request->query('editar') ? $negocio->sedes()->find($request->query('editar')) : null,
        ]);
    }

    public function guardarSede(Request $request, ?Sede $sede = null): RedirectResponse
    {
        $negocio = $this->negocio($request);
        $user = $request->user();
        abort_unless(Gestion::puede($user, $negocio, 'sedes.gestionar') || $negocio->administra($user), 403, 'No tienes permiso para cambiar las sedes.');
        abort_if($sede && $sede->negocio_id !== $negocio->id, 404);

        $datos = $request->validate([
            'nombre' => ['required', 'string', 'max:80', Rule::unique('sedes', 'nombre')->where('negocio_id', $negocio->id)->ignore($sede?->id)],
            'tipo' => ['required', Rule::in(array_keys(Sede::TIPOS))],
            'direccion' => ['nullable', 'string', 'max:255'],
            'barrio' => ['nullable', 'string', 'max:120'],
            'telefono' => ['nullable', 'string', 'max:20'],
            'factura' => ['boolean'],
            'principal' => ['boolean'],
            'activa' => ['boolean'],
        ]);
        $datos['factura'] = $request->boolean('factura');
        $datos['principal'] = $request->boolean('principal');
        $datos['activa'] = $sede ? $request->boolean('activa') : true;

        $activasDespues = $negocio->sedes()->where('activa', true)->when($sede, fn ($q) => $q->whereKeyNot($sede->id))->count() + ($datos['activa'] ? 1 : 0);
        if ($activasDespues > 1 && ! Gestion::tieneModulo($negocio, 'sedes')) {
            return back()->withInput()->with('error', 'Para tener más de una sede activa el negocio necesita el módulo «Varias sedes». Pídeselo a Vitrina.');
        }
        if ($activasDespues === 0) {
            return back()->withInput()->with('error', 'El negocio necesita al menos una sede activa.');
        }
        if ($sede?->principal && ! $datos['activa']) {
            return back()->withInput()->with('error', 'La sede principal no se puede desactivar: primero marca otra como principal.');
        }

        DB::transaction(function () use ($negocio, $sede, $datos) {
            if ($datos['principal']) {
                $negocio->sedes()->update(['principal' => false]);
                $datos['activa'] = true;
            } elseif ($sede?->principal) {
                $datos['principal'] = true; // siempre queda una principal
            }
            $sede ? $sede->update($datos) : $negocio->sedes()->create($datos);
            if (! $negocio->sedes()->where('principal', true)->exists()) {
                $negocio->sedes()->where('activa', true)->oldest()->first()?->update(['principal' => true]);
            }
        });

        return redirect()->route('negocio.sedes')->with('ok', 'Sede guardada.');
    }

    // ------------------------------------------- Módulos en construcción

    public function modulo(Request $request, string $modulo): View|RedirectResponse
    {
        $negocio = $this->negocio($request);
        abort_unless(Modulos::existe($modulo), 404);
        if ($modulo === 'inicio' || Route::has('negocio.'.$modulo)) {
            return redirect()->route('negocio.'.$modulo);
        }
        abort_unless(Gestion::puedeVerModulo($request->user(), $negocio, $modulo), 403, 'Este módulo no está activo o no tienes permiso.');

        return view('negocio.modulo', [
            'clave' => $modulo,
            'modulo' => Modulos::get($modulo),
            'permisos' => array_intersect(array_keys(Modulos::get($modulo)['permisos']), Gestion::permisosDe($request->user(), $negocio)),
        ]);
    }

    private function negocio(Request $request): Negocio
    {
        return $request->attributes->get('negocio_web');
    }
}
