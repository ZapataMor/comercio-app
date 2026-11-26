<?php

namespace App\Http\Controllers\Web;

use App\Gestion\Terminados;
use App\Http\Controllers\Controller;
use App\Models\Negocio;
use App\Models\ProductoEnEspera;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Pestaña «En espera» del catálogo web: lo fabricado que espera sus datos
 * puntuales (medidas, color, foto, precio) para publicarse en el catálogo,
 * como producto nuevo o sumándose a uno que ya existe. Lo maneja quien puede
 * cambiar el catálogo.
 */
class EnEsperaController extends Controller
{
    /** Guarda los datos y, con accion=publicar, lo lleva al catálogo. */
    public function guardar(Request $request, int $espera): RedirectResponse
    {
        $modelo = $this->buscar($request, $espera);
        $request->merge(['precio' => filled($request->input('precio')) ? preg_replace('/\D/', '', (string) $request->input('precio')) : null]);
        $datos = $request->validate([
            'nombre' => ['required', 'string', 'max:255'],
            'precio' => ['nullable', 'integer', 'min:1', 'max:999999999'],
            'descripcion' => ['nullable', 'string', 'max:5000'],
            'imagen' => ['nullable', 'image', 'max:4096'],
            'quitar_imagen' => ['boolean'],
            'especificaciones' => ['array', 'max:30'],
            'especificaciones.*.nombre' => ['nullable', 'string', 'max:40'],
            'especificaciones.*.valor' => ['nullable', 'string', 'max:80'],
            'accion' => ['required', Rule::in(['guardar', 'publicar'])],
            'modo' => ['required_if:accion,publicar', 'nullable', Rule::in(['nuevo', 'sumar'])],
        ], ['modo.required_if' => 'Elige cómo entra al catálogo.'], [
            'nombre' => 'nombre', 'precio' => 'precio', 'descripcion' => 'descripción', 'imagen' => 'foto',
            'especificaciones.*.nombre' => 'nombre de la especificación', 'especificaciones.*.valor' => 'valor de la especificación',
        ]);

        $especificaciones = collect($datos['especificaciones'] ?? [])
            ->map(fn ($f) => ['nombre' => trim((string) ($f['nombre'] ?? '')), 'valor' => trim((string) ($f['valor'] ?? ''))])
            ->filter(fn ($f) => $f['nombre'] !== '' && $f['valor'] !== '')
            ->unique(fn ($f) => mb_strtolower($f['nombre']))->values()->all();

        Terminados::guardar($modelo, [
            'nombre' => trim($datos['nombre']),
            'descripcion' => filled($datos['descripcion'] ?? null) ? trim($datos['descripcion']) : null,
            'precio' => isset($datos['precio']) ? (int) $datos['precio'] : null,
            'especificaciones' => $especificaciones,
        ], $request->file('imagen'), $request->boolean('quitar_imagen'));

        if ($datos['accion'] === 'publicar') {
            $producto = Terminados::publicar($modelo->fresh(), $datos['modo']);

            return redirect()->route('negocio.catalogo')
                ->with('ok', '«'.$producto->nombre.'» ya está en el catálogo con '.Terminados::textoExistencias($producto->existencias).'.');
        }

        return redirect()->route('negocio.catalogo', ['pestana' => 'espera'])->with('ok', 'Se guardaron los datos de «'.$modelo->nombre.'».');
    }

    public function descartar(Request $request, int $espera): RedirectResponse
    {
        $modelo = $this->buscar($request, $espera);
        Terminados::descartar($modelo);

        return redirect()->route('negocio.catalogo', ['pestana' => 'espera'])->with('ok', 'Se quitó «'.$modelo->nombre.'» de «En espera».');
    }

    private function buscar(Request $request, int $espera): ProductoEnEspera
    {
        /** @var Negocio $negocio */
        $negocio = $request->attributes->get('negocio_web');
        abort_unless($negocio->puede($request->user(), 'modificar_inventario'), 403, 'No tienes permiso para cambiar el catálogo.');

        return $negocio->productosEnEspera()->findOrFail($espera);
    }
}
