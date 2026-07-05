<?php

namespace Database\Seeders;

use App\Models\Barrio;
use Illuminate\Database\Seeder;

/**
 * Barrios oficiales de Maicao, organizados por comuna (fuente: listado
 * municipal). Es idempotente: si el barrio ya existe no lo duplica, y si
 * existía como sugerencia pendiente lo aprueba.
 */
class BarriosSeeder extends Seeder
{
    private const BARRIOS = [
        // Comuna 1
        'Boscán', 'La Concepción', 'Bosque', 'Centro', 'La Esmeralda',
        '11 de Noviembre', '20 de Julio', 'La Cristalina', 'Majupay',
        'Maximilano Moscote', 'La Flor del Cañaguate', 'Altos del Boscán',
        // Comuna 2
        'El Carmen', 'Paraíso', 'Vincula Palacio', 'Donith Vergara',
        'Loma Fresca', 'Santander', 'Nazareth', 'La Mosca', 'Maicaito',
        'Almirante Padilla', '28 de Noviembre',
        // Comuna 3
        '7 de Agosto', 'Villa Nati', 'Los Laureles', 'Los Laureles 2',
        'Simón Mejía', 'Alto Prado', 'Miraflores', 'San Francisco',
        'Monte Bello', 'Divino Niño', 'Mareigua', 'Buenos Aires',
        'Urb. Buenos Aires', 'Torre de la Majayura', 'San Agustín',
        'Las Américas', 'Mareyguita', 'Ovidio Mejía', 'Villa Mery',
        'Villa Astrid', 'Villa del Sol', 'Pastrana', 'Parantial',
        'Villa Usy', '1 de Diciembre', 'La Armonía', 'San Martín',
        // Comuna 4
        'La Unión', 'Santa Fe', 'Luis Carlos Galán', 'Los Olivos',
        'San José', 'Alfonso López', 'Santa Isabel', 'Rojas Pinilla',
        'San Antonio',
        // Comuna 5
        'Colombia Libre', 'Villa Amelia 2', 'Erika Beatriz', 'Fonseca Siosi',
        'Nueva Esperanza', 'La Floresta', 'Villa Inés', 'Urb. Villa Inés',
        'Primero de Mayo', 'Los Comuneros', 'Libertador', 'Jorge Arrieta',
        'Villa Luz', 'Mingo Ocando', 'Camilo Torres', 'Villa Maicao',
        'La Victoria', 'Santo Domingo', 'Villa Amelia 1', 'Simón Bolívar',
        'Villa Jiménez', 'Villa Fátima',
    ];

    public function run(): void
    {
        foreach (self::BARRIOS as $nombre) {
            $barrio = Barrio::whereRaw('LOWER(nombre) = ?', [mb_strtolower($nombre)])->first();
            if ($barrio) {
                if (! $barrio->aprobado) {
                    $barrio->update(['aprobado' => true]);
                }
            } else {
                Barrio::create(['nombre' => $nombre, 'aprobado' => true]);
            }
        }
    }
}
