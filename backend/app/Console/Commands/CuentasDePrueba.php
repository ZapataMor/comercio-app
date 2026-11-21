<?php

namespace App\Console\Commands;

use App\Models\Negocio;
use App\Models\User;
use App\Support\Reputacion;
use Illuminate\Console\Command;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/**
 * Deja la base lista para pruebas con cuentas como si se hubieran registrado
 * con el celular:
 *
 *  - Conserva a los dueños de negocio (comerciantes), a los domiciliarios y a
 *    los administradores (estos solo entran al panel web, con su contraseña).
 *  - Borra a todos los demás (clientes), y con ellos sus pedidos, reseñas,
 *    direcciones y carritos (las llaves foráneas los borran en cascada).
 *  - A comerciantes y luego domiciliarios les pone celulares seguidos desde
 *    `--desde` (verificados) y la misma clave de 4 números; sin correo,
 *    usuario, contraseña ni Google. Cierra todas sus sesiones y teléfonos de
 *    confianza: entran de cero con celular + clave + código.
 *
 * Es destructivo: pide confirmación salvo con --force.
 */
class CuentasDePrueba extends Command
{
    protected $signature = 'vitrina:cuentas-de-prueba
        {--desde=3000000000 : Primer celular (luego +1 por cuenta)}
        {--clave=1920 : Clave de 4 números para todas las cuentas}
        {--force : No preguntar antes de borrar}';

    protected $description = 'Borra a los clientes y deja a comerciantes y domiciliarios con celular y la misma clave, para pruebas';

    public function handle(): int
    {
        $desde = (string) $this->option('desde');
        $clave = (string) $this->option('clave');
        if (! preg_match('/\A3\d{9}\z/', $desde) || ! preg_match('/\A\d{4}\z/', $clave)) {
            $this->error('--desde debe ser un celular de 10 dígitos que empiece por 3, y --clave 4 números.');

            return self::FAILURE;
        }

        $duenos = DB::table('negocios')->pluck('user_id')
            ->merge(DB::table('negocio_user')->where('rol', 'propietario')->pluck('user_id'))
            ->unique()->sort()->values();
        $domiciliarios = User::role('domiciliario')->orderBy('id')->pluck('id')->diff($duenos)->values();
        $admins = User::role('administrador')->pluck('id')->diff($duenos)->diff($domiciliarios)->values();
        $conservar = $duenos->merge($domiciliarios)->merge($admins);
        $borrar = User::whereNotIn('id', $conservar)->pluck('id');

        $this->line("Comerciantes: {$duenos->count()} · Domiciliarios: {$domiciliarios->count()} · Administradores (se conservan): {$admins->count()}");
        $this->line("Se borran {$borrar->count()} cuentas y ".DB::table('pedidos')->whereIn('user_id', $borrar)->count().' pedidos suyos.');
        if (! $this->option('force') && ! $this->confirm('¿Seguir? Esto no se puede deshacer.')) {
            return self::FAILURE;
        }

        DB::transaction(function () use ($borrar, $duenos, $domiciliarios, $desde, $clave) {
            $this->borrar($borrar);

            $pin = Hash::make($clave);
            $numero = (int) $desde;
            // Nadie más puede quedar con esos celulares verificados.
            $celulares = collect(range(0, $duenos->count() + $domiciliarios->count() - 1))->map(fn ($i) => (string) ($numero + $i));
            User::whereIn('telefono', $celulares)->whereNotIn('id', $duenos->merge($domiciliarios))
                ->update(['telefono' => null, 'telefono_verificado_at' => null]);

            foreach ($duenos->merge($domiciliarios) as $i => $id) {
                DB::table('users')->where('id', $id)->update([
                    'telefono' => (string) ($numero + $i),
                    'telefono_verificado_at' => now(),
                    'pin' => $pin,
                    'pin_fallidos' => 0,
                    'pin_bloqueado_at' => null,
                    'email' => null,
                    'email_verified_at' => null,
                    'username' => null,
                    'password' => null,
                    'google_id' => null,
                    'remember_token' => null,
                    'updated_at' => now(),
                ]);
            }

            // De cero: sin sesiones, teléfonos de confianza ni códigos pendientes.
            $ids = $duenos->merge($domiciliarios);
            DB::table('personal_access_tokens')->where('tokenable_type', User::class)->whereIn('tokenable_id', $ids)->delete();
            DB::table('dispositivos_confianza')->whereIn('user_id', $ids)->delete();
            DB::table('codigos_telefono')->delete();
        });

        // Sin pedidos, la confiabilidad vuelve a contarse desde lo que quede.
        Negocio::query()->each(fn (Negocio $n) => Reputacion::recalcular(Reputacion::NEGOCIO, $n, puedeLevantarVeto: true));
        User::whereIn('id', $domiciliarios)->each(fn (User $u) => Reputacion::recalcular(Reputacion::DOMICILIARIO, $u, puedeLevantarVeto: true));

        $filas = User::whereIn('id', $duenos->merge($domiciliarios))->orderBy('telefono')->get()->map(fn (User $u) => [
            $u->telefono,
            $domiciliarios->contains($u->id) ? 'Domiciliario' : 'Comerciante',
            trim($u->name.' '.$u->apellidos),
            $domiciliarios->contains($u->id) ? '' : $u->negociosActivos()->pluck('nombre')->implode(', '),
        ]);
        $this->table(['Celular', 'Tipo', 'Nombre', 'Negocio'], $filas);
        $this->info("Listo. Clave para todos: {$clave}.");

        return self::SUCCESS;
    }

    /** Borra las cuentas y lo que no se va solo por llave foránea. */
    private function borrar(Collection $ids): void
    {
        if ($ids->isEmpty()) {
            return;
        }
        foreach ($ids->chunk(500) as $parte) {
            DB::table('personal_access_tokens')->where('tokenable_type', User::class)->whereIn('tokenable_id', $parte)->delete();
            DB::table('model_has_roles')->where('model_type', User::class)->whereIn('model_id', $parte)->delete();
            DB::table('model_has_permissions')->where('model_type', User::class)->whereIn('model_id', $parte)->delete();
            DB::table('sessions')->whereIn('user_id', $parte)->delete();
            // Sus pedidos (y en cascada sus líneas, reseñas, reportes…) y la cuenta.
            DB::table('pedidos')->whereIn('user_id', $parte)->delete();
            DB::table('users')->whereIn('id', $parte)->delete();
        }
    }
}
