<?php

namespace App\Http\Controllers\Web;

use App\Gestion\AccesosWeb;
use App\Gestion\Gestion;
use App\Gestion\Modulos;
use App\Http\Controllers\Controller;
use App\Models\AccesoWeb;
use App\Models\Negocio;
use App\Models\PlantillaGestion;
use App\Models\TipoNegocio;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Illuminate\View\View;

/**
 * Configuración de Vitrina Gestión para el super administrador (/admin/gestion):
 * a qué negocios se les enciende el panel web, qué plantilla y qué módulos
 * tienen, y las plantillas por tipo de negocio.
 */
class GestionAdminController extends Controller
{
    public function index(Request $request): View
    {
        $buscar = trim((string) $request->query('q', ''));
        $negocios = Negocio::query()
            ->whereNull('archivado_at')
            ->when($buscar !== '', fn ($q) => $q->where('nombre', 'like', '%'.$buscar.'%'))
            ->when($request->query('filtro') === 'con-panel', fn ($q) => $q->where('gestion_activa', true))
            ->with(['plantillaGestion', 'user'])
            ->withCount(['modulosGestion as modulos_activos' => fn ($q) => $q->where('activo', true), 'sedes as sedes_activas' => fn ($q) => $q->where('activa', true)])
            ->orderByDesc('gestion_activa')->orderBy('nombre')
            ->paginate(25)->withQueryString();

        return view('admin.gestion.index', [
            'negocios' => $negocios,
            'buscar' => $buscar,
            'plantillas' => PlantillaGestion::withCount('negocios')->orderBy('nombre')->get(),
            'grupos' => Modulos::porGrupo(),
        ]);
    }

    public function negocio(Negocio $negocio): View
    {
        $negocio->load(['plantillaGestion', 'user', 'sedes' => fn ($q) => $q->orderByDesc('principal')->orderBy('nombre')]);
        $miembros = $negocio->miembrosActivos()->get();

        return view('admin.gestion.negocio', [
            'negocio' => $negocio,
            'encendidos' => Gestion::opcionalesEncendidos($negocio),
            'grupos' => Modulos::porGrupo(Modulos::opcionales()),
            'plantillas' => PlantillaGestion::where('activa', true)->orderBy('nombre')->get(),
            'miembros' => $miembros,
            'accesos' => AccesoWeb::whereIn('user_id', $miembros->pluck('id'))->where('estado', 'usado')->whereNull('cerrado_at')
                ->where('usado_at', '>', now()->subHours(AccesosWeb::HORAS_SESION))->with('user')->latest('usado_at')->get(),
        ]);
    }

    public function panel(Request $request, Negocio $negocio): RedirectResponse
    {
        $datos = $request->validate(['activa' => ['required', 'boolean'], 'motivo' => ['required', 'string', 'max:255']]);
        if ($negocio->archivado_at) {
            return back()->with('error', 'El negocio está archivado.');
        }
        $datos['activa'] ? Gestion::activar($negocio) : Gestion::desactivar($negocio);

        return back()->with('ok', $datos['activa'] ? 'Panel web encendido para '.$negocio->nombre.'.' : 'Panel web apagado. Los datos se conservan.');
    }

    public function modulos(Request $request, Negocio $negocio): RedirectResponse
    {
        $datos = $request->validate(['modulos' => ['array'], 'modulos.*' => ['string', Rule::in(Modulos::opcionales())]]);
        $pedidos = $datos['modulos'] ?? [];
        $finales = Gestion::definirModulos($negocio, $pedidos, $request->user());
        $agregados = array_diff($finales, $pedidos);

        return back()->with('ok', 'Módulos guardados.'.($agregados ? ' Se encendieron también, porque los necesitan: '.implode(', ', array_map(fn ($m) => Modulos::get($m)['nombre'], $agregados)).'.' : ''));
    }

    public function plantilla(Request $request, Negocio $negocio): RedirectResponse
    {
        $datos = $request->validate(['plantilla_gestion_id' => ['required', 'integer', Rule::exists('plantillas_gestion', 'id')->where('activa', true)]]);
        $plantilla = PlantillaGestion::findOrFail($datos['plantilla_gestion_id']);
        Gestion::aplicarPlantilla($negocio, $plantilla, $request->user());

        return back()->with('ok', 'Plantilla «'.$plantilla->nombre.'» aplicada: se encendieron sus módulos.');
    }

    public function cerrarAcceso(Negocio $negocio, AccesoWeb $acceso): RedirectResponse
    {
        abort_unless($negocio->miembros()->whereKey($acceso->user_id)->exists(), 404);
        AccesosWeb::cerrar($acceso);

        return back()->with('ok', 'Sesión web cerrada.');
    }

    // ---------------------------------------------------------- Plantillas

    public function nuevaPlantilla(): View
    {
        return $this->formularioPlantilla(new PlantillaGestion(['modulos' => [], 'campos_producto' => []]));
    }

    public function verPlantilla(PlantillaGestion $plantilla): View
    {
        return $this->formularioPlantilla($plantilla);
    }

    public function guardarPlantilla(Request $request, ?PlantillaGestion $plantilla = null): RedirectResponse
    {
        $plantilla ??= new PlantillaGestion;
        $datos = $request->validate([
            'nombre' => ['required', 'string', 'max:80', Rule::unique('plantillas_gestion', 'nombre')->ignore($plantilla->id)],
            'descripcion' => ['nullable', 'string', 'max:500'],
            'modulos' => ['array'],
            'modulos.*' => ['string', Rule::in(Modulos::opcionales())],
            'tipos_negocio' => ['array'],
            'tipos_negocio.*' => ['integer', Rule::exists('tipos_negocio', 'id')],
            'activa' => ['boolean'],
            'campos' => ['array', 'max:40'],
            'campos.*.etiqueta' => ['nullable', 'string', 'max:60'],
            'campos.*.tipo' => ['nullable', Rule::in(array_keys(PlantillaGestion::TIPOS_CAMPO))],
            'campos.*.unidad' => ['nullable', 'string', 'max:15'],
            'campos.*.opciones' => ['nullable', 'string', 'max:500'],
            'campos.*.requerido' => ['nullable', 'boolean'],
        ]);

        $plantilla->fill([
            'nombre' => $datos['nombre'],
            'descripcion' => $datos['descripcion'] ?? null,
            'modulos' => array_values(array_unique($datos['modulos'] ?? [])),
            'tipos_negocio' => array_map('intval', $datos['tipos_negocio'] ?? []),
            'campos_producto' => $this->campos($datos['campos'] ?? []),
            'activa' => $request->boolean('activa'),
        ]);
        if (! $plantilla->exists) {
            $base = Str::slug($datos['nombre']) ?: 'plantilla';
            $slug = $base;
            for ($i = 2; PlantillaGestion::where('slug', $slug)->exists(); $i++) {
                $slug = $base.'-'.$i;
            }
            $plantilla->slug = $slug;
        }
        $plantilla->save();

        return redirect()->route('admin.gestion.plantilla', $plantilla)->with('ok', 'Plantilla guardada. Los negocios que ya la tienen no cambian sus módulos hasta que se la vuelvas a aplicar.');
    }

    private function formularioPlantilla(PlantillaGestion $plantilla): View
    {
        return view('admin.gestion.plantilla', [
            'plantilla' => $plantilla,
            'grupos' => Modulos::porGrupo(Modulos::opcionales()),
            'tipos' => TipoNegocio::orderBy('nombre')->get(['id', 'nombre']),
            'tiposCampo' => PlantillaGestion::TIPOS_CAMPO,
        ]);
    }

    /** Filas del formulario → ficha técnica. Ignora las filas vacías. */
    private function campos(array $filas): array
    {
        $campos = [];
        foreach ($filas as $i => $fila) {
            $etiqueta = trim((string) ($fila['etiqueta'] ?? ''));
            if ($etiqueta === '') {
                continue;
            }
            $tipo = $fila['tipo'] ?? 'texto';
            $clave = Str::slug($etiqueta, '_');
            if ($clave === '' || isset($campos[$clave])) {
                throw ValidationException::withMessages(["campos.$i.etiqueta" => "El campo «{$etiqueta}» está repetido."]);
            }
            $campo = ['clave' => $clave, 'etiqueta' => $etiqueta, 'tipo' => $tipo, 'requerido' => (bool) ($fila['requerido'] ?? false)];
            if ($tipo === 'numero' && trim((string) ($fila['unidad'] ?? '')) !== '') {
                $campo['unidad'] = trim($fila['unidad']);
            }
            if ($tipo === 'opciones') {
                $opciones = array_values(array_unique(array_filter(array_map('trim', explode(',', (string) ($fila['opciones'] ?? ''))), fn ($o) => $o !== '')));
                if (count($opciones) < 2) {
                    throw ValidationException::withMessages(["campos.$i.opciones" => "«{$etiqueta}» necesita al menos dos opciones separadas por comas."]);
                }
                $campo['opciones'] = $opciones;
            }
            $campos[$clave] = $campo;
        }

        return array_values($campos);
    }
}
