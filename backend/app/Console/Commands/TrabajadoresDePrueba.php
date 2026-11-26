<?php

namespace App\Console\Commands;

use App\Models\Negocio;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Role;

/**
 * Trabajadores de prueba: unos cuantos por negocio, con cargo, sede, días de
 * trabajo distintos (toda la semana, lunes a viernes, fines de semana…),
 * permisos variados y alguna tarea, para ver el apartado Trabajadores lleno.
 *
 * Cada uno es una cuenta con celular (desde `--desde`, de 10 en 10 por
 * negocio) y la misma clave, así que también se puede entrar a la app como
 * trabajador. Se puede repetir: actualiza las mismas cuentas por su celular.
 * Con --quitar borra las cuentas de ese rango.
 */
class TrabajadoresDePrueba extends Command
{
    protected $signature = 'vitrina:trabajadores-de-prueba
        {--por-negocio=5 : Trabajadores por negocio (máximo 10)}
        {--desde=3200000000 : Primer celular; cada negocio usa un bloque de 10}
        {--clave=1920 : Clave de 4 números para todos}
        {--quitar : Borrar los trabajadores de prueba en vez de crearlos}';

    protected $description = 'Crea trabajadores de prueba (con días, sede, permisos y tareas) en cada negocio';

    private const NOMBRES = [
        ['Yuleidis', 'Pushaina'], ['Carlos', 'Epieyú'], ['Mariana', 'Gómez'], ['Andrés', 'Uriana'], ['Daniela', 'Fernández'],
        ['Kevin', 'Iguarán'], ['Luz Dary', 'Brito'], ['Jhon', 'Arregocés'], ['Sofía', 'Mendoza'], ['Wilmer', 'Ipuana'],
        ['Valentina', 'Romero'], ['Óscar', 'Choles'], ['Paola', 'Cotes'], ['Rafael', 'Pimienta'], ['Yesenia', 'Barros'],
        ['Hamid', 'Saleh'], ['Leidy', 'Mejía'], ['Samir', 'Abdala'], ['Karen', 'Solano'], ['Edwin', 'Pana'],
    ];

    private const CARGOS = ['Cajero', 'Vendedor', 'Ayudante', 'Mesero', 'Domicilios internos', 'Bodega', 'Cocina', 'Atención al cliente', 'Oficios varios', 'Supervisor'];

    /** [días (1 = lunes), entrada, salida] */
    private const HORARIOS = [
        [[1, 2, 3, 4, 5, 6, 7], '07:00', '15:00'],
        [[1, 2, 3, 4, 5], '08:00', '17:00'],
        [[6, 7], '09:00', '18:00'],
        [[1, 3, 5], '14:00', '20:00'],
        [[1, 2, 3, 4, 5, 6], null, null],
        [[2, 4, 6], '08:00', '12:00'],
    ];

    private const TAREAS = [
        ['Limpiar y ordenar el mostrador', 'Antes de abrir.'],
        ['Revisar lo que se está acabando', 'Anotar lo que falta para el pedido del proveedor.'],
        ['Atender las llamadas de la mañana', null],
        ['Organizar la bodega', 'Lo nuevo atrás, lo viejo adelante.'],
        ['Poner los precios nuevos en la vitrina', null],
        ['Sacar la basura y reciclar el cartón', null],
    ];

    public function handle(): int
    {
        $porNegocio = max(1, min(10, (int) $this->option('por-negocio')));
        $desde = (int) $this->option('desde');
        $clave = (string) $this->option('clave');
        if (! preg_match('/\A3\d{9}\z/', (string) $desde) || ! preg_match('/\A\d{4}\z/', $clave)) {
            $this->error('--desde debe ser un celular de 10 dígitos que empiece por 3, y --clave 4 números.');

            return self::FAILURE;
        }
        $negocios = Negocio::whereNull('archivado_at')->orderBy('id')->get();

        if ($this->option('quitar')) {
            $rango = [(string) $desde, (string) ($desde + $negocios->count() * 10 + 9)];
            $ids = User::whereBetween('telefono', $rango)->whereDoesntHave('negocios', fn ($q) => $q->where('negocio_user.rol', 'propietario'))->pluck('id');
            DB::table('personal_access_tokens')->where('tokenable_type', User::class)->whereIn('tokenable_id', $ids)->delete();
            DB::table('model_has_roles')->where('model_type', User::class)->whereIn('model_id', $ids)->delete();
            User::whereIn('id', $ids)->delete();
            $this->info("Se borraron {$ids->count()} trabajadores de prueba.");

            return self::SUCCESS;
        }

        $pin = Hash::make($clave);
        $filas = [];
        DB::transaction(function () use ($negocios, $porNegocio, $desde, $pin, &$filas) {
            foreach ($negocios as $n => $negocio) {
                $sedes = $negocio->sedes()->where('activa', true)->pluck('id')->all();
                for ($i = 0; $i < $porNegocio; $i++) {
                    $k = $n * 3 + $i; // varía los nombres entre negocios
                    [$nombre, $apellido] = self::NOMBRES[$k % count(self::NOMBRES)];
                    $telefono = (string) ($desde + $n * 10 + $i);
                    $user = User::where('telefono', $telefono)->first() ?? new User;
                    $user->forceFill([
                        'name' => $nombre, 'apellidos' => $apellido, 'telefono' => $telefono,
                        'telefono_verificado_at' => now(), 'pin' => $pin, 'pin_fallidos' => 0, 'pin_bloqueado_at' => null,
                    ])->save();
                    if (! $user->hasRole('usuario')) {
                        $user->assignRole(Role::findOrCreate('usuario', 'web'));
                    }

                    [$dias, $entrada, $salida] = self::HORARIOS[($n + $i) % count(self::HORARIOS)];
                    $horario = collect($dias)->mapWithKeys(fn ($d) => [(string) $d => ['entrada' => $entrada, 'salida' => $salida]])->all();
                    $pivote = [
                        'rol' => Negocio::ROL_TRABAJADOR, 'activo' => true,
                        'cargo' => self::CARGOS[($n + $i) % count(self::CARGOS)],
                        'sede_id' => $sedes ? $sedes[$i % count($sedes)] : null,
                        'horario' => json_encode($horario),
                        // El primero administra; los demás atienden pedidos y unos cambian el catálogo.
                        'administrador' => $i === 0,
                        'gestionar_pedidos' => $i !== 4,
                        'modificar_inventario' => $i % 2 === 1,
                        'cambiar_estado' => $i === 1,
                        'permisos_gestion' => json_encode($i === 2 ? ['equipo.tareas'] : []),
                        'updated_at' => now(),
                    ];
                    if ($negocio->miembros()->whereKey($user->id)->exists()) {
                        $negocio->miembros()->updateExistingPivot($user->id, $pivote);
                    } else {
                        $negocio->miembros()->attach($user->id, $pivote + ['created_at' => now()->subDays(10 + $i * 7)]);
                    }

                    // Una o dos tareas por hacer (si no tiene ya), una de ellas para hoy.
                    if (! $negocio->tareas()->where('user_id', $user->id)->exists()) {
                        foreach (range(0, $i % 2) as $t) {
                            [$titulo, $detalle] = self::TAREAS[($n + $i + $t) % count(self::TAREAS)];
                            $negocio->tareas()->create([
                                'user_id' => $user->id, 'creada_por' => $negocio->user_id, 'sede_id' => $pivote['sede_id'],
                                'titulo' => $titulo, 'descripcion' => $detalle,
                                'fecha' => $t === 0 ? today() : today()->addDays(2 + $i),
                                'urgente' => $t === 0 && $i === 3,
                            ]);
                        }
                    }
                    $filas[] = [$telefono, "{$nombre} {$apellido}", $pivote['cargo'], $negocio->nombre];
                }
            }
        });

        $this->table(['Celular', 'Nombre', 'Cargo', 'Negocio'], $filas);
        $this->info('Listo: '.count($filas).' trabajadores. Clave para todos: '.$clave.'.');

        return self::SUCCESS;
    }
}
