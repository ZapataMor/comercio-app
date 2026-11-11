<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Barrio;
use App\Rules\Direccion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ClienteDireccionController extends Controller
{
    /** Punto obligatorio para las direcciones de entrega. */
    private const REGLAS_PUNTO = [
        'lat' => ['required', 'numeric', 'between:-90,90'],
        'lng' => ['required', 'numeric', 'between:-180,180'],
    ];

    public function index(Request $request): JsonResponse
    {
        $direcciones = $request->user()
            ->clienteDirecciones()
            ->orderByDesc('es_principal')
            ->latest()
            ->get()
            ->map(fn ($d) => $this->map($d));

        return response()->json(['direcciones' => $direcciones]);
    }

    public function store(Request $request): JsonResponse
    {
        if (! $request->user()->hasRole('usuario')) {
            return response()->json(['message' => 'Solo los clientes pueden agregar ubicaciones.'], 403);
        }
        $data = $request->validate([
            'nombre' => ['nullable', 'string', 'max:80', 'regex:'.Direccion::TEXTO],
            'direccion' => ['required', 'string', 'max:255', new Direccion],
            'barrio' => ['required', 'string', 'max:120', 'regex:/\A[\p{L}\p{N}-]+\z/u'],
            ...self::REGLAS_PUNTO,
            ...$this->reglasFotos([]),
        ]);
        $data = $this->guardarFotos($request, $data);
        // Barrio escrito a mano → sugerencia pendiente para el admin.
        Barrio::registrarSiEsNuevo($data['barrio'], $request->user()->id);
        $direccion = DB::transaction(function () use ($request, $data) {
            $user = $request->user()->newQuery()->lockForUpdate()->findOrFail($request->user()->id);
            $principal = ! $user->clienteDirecciones()->where('es_principal', true)->exists();
            $direccion = $user->clienteDirecciones()->create([
                'nombre' => $data['nombre'] ?? null,
                'direccion' => $data['direccion'],
                'barrio' => $data['barrio'],
                'fotos' => $data['fotos'],
                'lat' => $data['lat'] ?? null,
                'lng' => $data['lng'] ?? null,
                'es_principal' => $principal,
            ]);
            if ($principal) {
                $user->update(['direccion' => $direccion->direccion, 'barrio' => $direccion->barrio]);
            }

            return $direccion;
        });

        return response()->json(['direccion' => $this->map($direccion)], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        abort_unless($request->user()->hasRole('usuario'), 403);
        $existente = $request->user()->clienteDirecciones()->findOrFail($id);
        $data = $request->validate([
            'nombre' => ['nullable', 'string', 'max:80', 'regex:'.Direccion::TEXTO],
            'direccion' => ['required', 'string', 'max:255', new Direccion],
            'barrio' => ['required', 'string', 'max:120', 'regex:/\A[\p{L}\p{N}-]+\z/u'],
            ...self::REGLAS_PUNTO,
            ...$this->reglasFotos($existente->fotos ?? []),
        ]);
        $data = $this->guardarFotos($request, $data, $existente->fotos ?? []);
        Barrio::registrarSiEsNuevo($data['barrio'], $request->user()->id);
        $direccion = DB::transaction(function () use ($request, $id, $data) {
            $user = $request->user()->newQuery()->lockForUpdate()->findOrFail($request->user()->id);
            $direccion = $user->clienteDirecciones()->findOrFail($id);
            $direccion->update($data);
            if ($direccion->es_principal) {
                $request->user()->update(['direccion' => $data['direccion'], 'barrio' => $data['barrio']]);
            }

            return $direccion;
        });

        return response()->json(['direccion' => $this->map($direccion)]);
    }

    public function principal(Request $request, int $id): JsonResponse
    {
        abort_unless($request->user()->hasRole('usuario'), 403);
        DB::transaction(function () use ($request, $id) {
            // Serializar cambios de direcciones por usuario, incluso si su lista está vacía.
            $user = $request->user()->newQuery()->lockForUpdate()->findOrFail($request->user()->id);
            $direccion = $user->clienteDirecciones()->findOrFail($id);
            $user->clienteDirecciones()->where('es_principal', true)->update(['es_principal' => false]);
            $direccion->refresh()->update(['es_principal' => true]);
            $user->update(['direccion' => $direccion->direccion, 'barrio' => $direccion->barrio]);
        });

        return $this->index($request);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        abort_unless($request->user()->hasRole('usuario'), 403);
        DB::transaction(function () use ($request, $id) {
            $user = $request->user()->newQuery()->lockForUpdate()->findOrFail($request->user()->id);
            $direccion = $user->clienteDirecciones()->findOrFail($id);
            $direccion->delete();
            if ($direccion->es_principal || ! $user->clienteDirecciones()->exists()) {
                $principal = $user->clienteDirecciones()->orderBy('id')->first();
                $user->clienteDirecciones()->where('es_principal', true)->update(['es_principal' => false]);
                $principal?->refresh()->update(['es_principal' => true]);
                $user->update(['direccion' => $principal?->direccion, 'barrio' => $principal?->barrio]);
            }
        });

        return $this->index($request);
    }

    private function reglasFotos(array $existentes): array
    {
        $reglas = [];
        foreach (['frente', 'izquierda', 'derecha'] as $tipo) {
            $reglas['foto_'.$tipo] = [isset($existentes[$tipo]) || ! config('vitrina.fotos_entrega_obligatorias') ? 'sometimes' : 'required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'];
        }
        return $reglas;
    }

    private function guardarFotos(Request $request, array $data, array $fotos = []): array
    {
        foreach (['frente', 'izquierda', 'derecha'] as $tipo) {
            if ($request->hasFile('foto_'.$tipo)) {
                $path = $request->file('foto_'.$tipo)->store('referencias-entrega', 'local');
                abort_unless($path, 500, 'No se pudo guardar la foto.');
                $fotos[$tipo] = $path;
            }
            unset($data['foto_'.$tipo]);
        }
        $data['fotos'] = $fotos;
        return $data;
    }

    public function foto(Request $request, int $id, string $tipo)
    {
        $direccion = $request->user()->clienteDirecciones()->findOrFail($id);
        $path = ($direccion->fotos ?? [])[$tipo] ?? null;
        abort_unless($path, 404);
        return \Illuminate\Support\Facades\Storage::disk('local')->response($path, null, ['Cache-Control' => 'private, no-store, max-age=0', 'X-Content-Type-Options' => 'nosniff']);
    }

    private function map($direccion): array
    {
        return [
            'id' => $direccion->id,
            'nombre' => $direccion->nombre,
            'direccion' => $direccion->direccion,
            'barrio' => $direccion->barrio,
            'es_principal' => (bool) $direccion->es_principal,
            'lat' => $direccion->lat,
            'lng' => $direccion->lng,
            'fotos' => collect($direccion->fotos ?? [])->mapWithKeys(fn ($path, $tipo) => [$tipo => '/api/cliente/direcciones/'.$direccion->id.'/fotos/'.$tipo])->all(),
        ];
    }
}
