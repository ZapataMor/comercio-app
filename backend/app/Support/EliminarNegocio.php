<?php

namespace App\Support;

use App\Models\Cita;
use App\Models\Negocio;
use App\Models\Pedido;
use App\Models\ReputacionEvento;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class EliminarNegocio
{
    public static function ejecutar(Negocio $negocio, User $usuario): void
    {
        DB::transaction(function () use ($negocio, $usuario) {
            $negocio = Negocio::lockForUpdate()->findOrFail($negocio->id);
            abort_unless($negocio->esPropietario($usuario), 403);
            abort_if($negocio->pedidos()->whereIn('estado', Pedido::EN_CURSO)->exists(), 409,
                'Termina o cancela los pedidos activos antes de eliminar el negocio. Los pedidos en camino deben finalizar su entrega o devolución.');

            $galerias = $negocio->servicios()->get()->flatMap(fn ($servicio) => $servicio->galeria ?? [])
                ->filter(fn ($ruta) => str_starts_with($ruta, '/storage/'))
                ->map(fn ($ruta) => substr($ruta, strlen('/storage/')));
            $imagenes = $negocio->productos()->withTrashed()->pluck('imagen')
                ->merge($galerias)->push($negocio->imagen)
                ->filter()->unique()->values()->all();

            // Estos eventos no tienen una clave foránea al negocio. Los de
            // otros sujetos conservan su puntaje y pierden el vínculo al pedido.
            ReputacionEvento::where('tipo', Reputacion::NEGOCIO)->where('sujeto_id', $negocio->id)->delete();
            AgendaCitas::cancelarFuturas(Cita::where('negocio_id', $negocio->id), 'El negocio fue eliminado definitivamente.');

            // Los pedidos ya terminados no se borran: son también el historial del
            // cliente y del domiciliario. Quedan sin negocio, con el nombre que tenía.
            Pedido::where('negocio_id', $negocio->id)->update(['negocio_nombre' => $negocio->nombre]);

            // Las claves foráneas borran catálogo (incluidos productos con
            // soft delete), carritos, citas, reseñas, equipo e invitaciones, y
            // desligan los pedidos.
            $negocio->delete();
            DB::afterCommit(fn () => Storage::disk('public')->delete($imagenes));
        });
    }
}
