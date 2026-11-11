<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Barrio;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ClienteDireccionController extends Controller
{
    /** Punto en el mapa: opcional, pero latitud y longitud van juntas. */
    private const REGLAS_PUNTO = [
        'lat' => ['nullable', 'required_with:lng', 'numeric', 'between:-90,90'],
        'lng' => ['nullable', 'required_with:lat', 'numeric', 'between:-180,180'],
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
            'nombre' => ['nullable', 'string', 'max:80'],
            'direccion' => ['required', 'string', 'max:255', new \App\Rules\Direccion],
            'barrio' => ['required', 'string', 'max:120'],
            ...self::REGLAS_PUNTO,
        ]);

        // Barrio escrito a mano → sugerencia pendiente para el admin.
        Barrio::registrarSiEsNuevo($data['barrio'], $request->user()->id);

        $direccion = DB::transaction(function () use ($request, $data) {
            $user = $request->user()->newQuery()->lockForUpdate()->findOrFail($request->user()->id);
            $principal = ! $user->clienteDirecciones()->where('es_principal', true)->exists();
            $direccion = $user->clienteDirecciones()->create([
                'nombre' => $data['nombre'] ?? null,
                'direccion' => $data['direccion'],
                'barrio' => $data['barrio'],
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
        $request->user()->clienteDirecciones()->findOrFail($id);
        $data = $request->validate([
            'nombre' => ['nullable', 'string', 'max:80'],
            'direccion' => ['required', 'string', 'max:255', new \App\Rules\Direccion],
            'barrio' => ['required', 'string', 'max:120'],
            ...self::REGLAS_PUNTO,
        ]);
        Barrio::registrarSiEsNuevo($data['barrio'], $request->user()->id);
        // Sin punto en la petición se quita el que hubiera: la app siempre lo envía.
        $data['lat'] ??= null;
        $data['lng'] ??= null;
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
        ];
    }
}
