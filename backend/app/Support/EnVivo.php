<?php

namespace App\Support;

use App\Events\CambioEnVivo;
use App\Http\Controllers\Api;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\CategoriaController;
use App\Http\Controllers\NegocioController;
use App\Http\Controllers\ProductoController;
use App\Http\Controllers\ServicioController;
use App\Http\Controllers\Web;
use App\Models\Cita;
use App\Models\InvitacionTrabajo;
use App\Models\Negocio;
use App\Models\Pedido;
use App\Models\PedidoReporte;
use App\Models\ReputacionEvento;
use App\Models\Resena;
use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

/**
 * Cambios en tiempo real: cuando alguien hace algo, los demás dispositivos lo
 * ven al instante (WebSockets con Laravel Reverb).
 *
 * El aviso solo dice QUÉ cambió (el «tema») y de quién; la app vuelve a pedir
 * a la API lo que tenga en pantalla. Canales:
 *  - catalogo            público: negocios, productos, reseñas, tarifa, barrios.
 *  - usuario.{id}        privado: mis pedidos, citas, invitaciones, perfil, negocios.
 *  - negocio.{id}        privado, del equipo: pedidos, citas, equipo, catálogo.
 *  - domiciliarios       privado: pedidos disponibles para tomar.
 *  - admin               privado: todo lo que ven los paneles del administrador.
 *
 * Los avisos se juntan durante la petición (o el comando) y salen al final,
 * sin repetidos y solo si la transacción se confirmó. Si Reverb no está
 * corriendo no pasa nada grave: la app sigue con su refresco de respaldo.
 *
 * Qué acción avisa a quién está en self::acciones(): cada ruta que cambia
 * datos tiene ahí su entrada (lo exige un test).
 */
class EnVivo
{
    public const CATALOGO = 'catalogo';

    public const ADMIN = 'admin';

    public const DOMICILIARIOS = 'domiciliarios';

    /** @var array<string, array{0: list<string>, 1: string, 2: array}> */
    private static array $pendientes = [];

    private static bool $alTerminar = false;

    private static bool $avisoFallo = false;

    public static function usuario(?int $id): ?string
    {
        return $id ? "usuario.{$id}" : null;
    }

    public static function negocio(?int $id): ?string
    {
        return $id ? "negocio.{$id}" : null;
    }

    /** Deja un aviso listo para salir al final de la petición. */
    public static function avisar(array|string|null $canales, string $tema, array $datos = []): void
    {
        $canales = array_values(array_unique(array_filter((array) $canales)));
        if (! $canales) {
            return;
        }

        // Dentro de una transacción espera a que se confirme (si se revierte, no avisa).
        DB::afterCommit(function () use ($canales, $tema, $datos) {
            sort($canales);
            self::$pendientes[$tema.'|'.implode(',', $canales).'|'.json_encode($datos)] = [$canales, $tema, $datos];

            if (! self::$alTerminar) {
                self::$alTerminar = true;
                app()->terminating(fn () => self::enviar());
            }
        });
    }

    /** Emite lo pendiente. Lo llama Laravel al terminar; los tests, a mano. */
    public static function enviar(): void
    {
        $pendientes = self::$pendientes;
        self::$pendientes = [];
        self::$alTerminar = false;

        foreach ($pendientes as [$canales, $tema, $datos]) {
            try {
                event(new CambioEnVivo($canales, $tema, $datos));
            } catch (Throwable $e) {
                // Sin Reverb la app sigue funcionando (refresca cada cierto tiempo).
                if (! self::$avisoFallo) {
                    self::$avisoFallo = true;
                    Log::warning('No se pudo emitir un cambio en vivo (¿está corriendo reverb:start?): '.$e->getMessage());
                }
            }
        }
    }

    /** Lo que quedó pendiente (para los tests). */
    public static function pendientes(): array
    {
        return array_values(self::$pendientes);
    }

    public static function olvidar(): void
    {
        self::$pendientes = [];
        self::$alTerminar = false;
    }

    // ------------------------------------------------------------------
    // Avisos por tipo de dato
    // ------------------------------------------------------------------

    /** Un pedido cambió: cliente, equipo del negocio, domiciliario, admins y, si se puede tomar, domiciliarios. */
    public static function pedido(Pedido|int|null $pedido): void
    {
        $pedido = $pedido instanceof Pedido ? $pedido : ($pedido ? Pedido::find($pedido) : null);
        if (! $pedido) {
            return;
        }

        $datos = ['id' => $pedido->id, 'negocio_id' => $pedido->negocio_id];
        self::avisar([
            self::usuario($pedido->user_id),
            self::negocio($pedido->negocio_id),
            self::usuario($pedido->domiciliario_id),
            self::ADMIN,
        ], 'pedidos', $datos);

        // Lista de pedidos para tomar: cambia cuando uno queda listo sin
        // domiciliario, cuando alguien lo toma o cuando se cancela.
        $sinAsignar = ! $pedido->domiciliario_id && ! in_array($pedido->estado, ['pendiente', 'aceptado'], true);
        if ($sinAsignar || $pedido->estado === 'tomado') {
            self::avisar(self::DOMICILIARIOS, 'disponibles', $datos);
        }
    }

    /** Una cita cambió: cliente, profesional, equipo y la disponibilidad pública. */
    public static function cita(Cita|int|null $cita): void
    {
        $cita = $cita instanceof Cita ? $cita : ($cita ? Cita::find($cita) : null);
        if (! $cita) {
            return;
        }

        $datos = ['id' => $cita->id, 'negocio_id' => $cita->negocio_id];
        self::avisar([
            self::usuario($cita->cliente_id),
            self::usuario($cita->profesional_id),
            self::negocio($cita->negocio_id),
        ], 'citas', $datos);
        // Los demás clientes que miran la agenda ven el horario ocupado o libre.
        self::avisar(self::CATALOGO, 'agenda', ['negocio_id' => $cita->negocio_id]);
    }

    /** Los datos o el estado (abierto/cerrado) de un negocio cambiaron. */
    public static function datosNegocio(?int $negocioId): void
    {
        $datos = $negocioId ? ['negocio_id' => $negocioId] : [];
        self::avisar([self::CATALOGO, self::negocio($negocioId), self::ADMIN], 'negocio', $datos);
    }

    /** Productos, servicios o categorías de un negocio. */
    public static function catalogo(?int $negocioId): void
    {
        self::avisar([self::CATALOGO, self::negocio($negocioId)], 'catalogo', ['negocio_id' => $negocioId]);
    }

    /** Miembros, permisos o invitaciones de un negocio; y la lista de negocios de cada afectado. */
    public static function equipo(?int $negocioId, array $usuarios = []): void
    {
        self::avisar(self::negocio($negocioId), 'equipo', ['negocio_id' => $negocioId]);
        foreach (array_unique(array_filter($usuarios)) as $id) {
            self::avisar(self::usuario($id), 'negocios', ['negocio_id' => $negocioId]);
        }
    }

    public static function resenas(?int $negocioId): void
    {
        self::avisar([self::CATALOGO, self::negocio($negocioId), self::ADMIN], 'resenas', ['negocio_id' => $negocioId]);
    }

    /** Roles, datos, turno o suspensión de una persona. */
    public static function perfil(?int $userId): void
    {
        self::avisar([self::usuario($userId), self::ADMIN], 'perfil', ['id' => $userId]);
    }

    public static function reputacion(string $tipo, ?int $id): void
    {
        $canal = $tipo === Reputacion::NEGOCIO ? self::negocio($id) : self::usuario($id);
        self::avisar([$canal, self::ADMIN], 'reputacion', ['tipo' => $tipo, 'id' => $id]);
        if ($tipo === Reputacion::NEGOCIO) {
            // Un negocio vetado deja de verse en el catálogo (y vuelve al levantarlo).
            self::datosNegocio($id);
        }
    }

    /** Ids de los miembros activos de un negocio (antes de que algo los cambie). */
    private static function miembros(?int $negocioId): array
    {
        return $negocioId ? DB::table('negocio_user')->where('negocio_id', $negocioId)->where('activo', true)->pluck('user_id')->all() : [];
    }

    /** Ids de los negocios donde la persona es miembro activo. */
    private static function negociosDe(?int $userId): array
    {
        return $userId ? DB::table('negocio_user')->where('user_id', $userId)->where('activo', true)->pluck('negocio_id')->all() : [];
    }

    // ------------------------------------------------------------------
    // Qué avisa cada ruta (lo aplica el middleware AvisarEnVivo)
    // ------------------------------------------------------------------

    /**
     * Acción del controlador => qué avisar si respondió bien.
     * `despues` recibe la petición, la respuesta y lo que devolvió `antes`
     * (para los datos que la acción borra, como los miembros de un negocio).
     *
     * @return array<string, array{despues: Closure, antes?: Closure}|null>
     */
    public static function acciones(): array
    {
        $id = fn (Request $r) => (int) $r->route('id');
        $negocioRuta = function (Request $r): ?int {
            $negocio = $r->route('negocio');

            return $negocio instanceof Negocio ? $negocio->id : ($negocio ? (int) $negocio : null);
        };
        $yo = fn (Request $r) => ($r->user() ?? $r->user('sanctum'))?->id;
        $json = fn (Response $res, string ...$claves) => data_get(json_decode((string) $res->getContent(), true), implode('.', $claves));
        $pedido = ['despues' => fn (Request $r) => self::pedido($id($r))];

        return [
            // --- Sesión, dispositivos y lectura: no cambian lo que ven otros ---
            AuthController::class.'@login' => null,
            AuthController::class.'@logout' => null,
            Api\DeviceTokenController::class.'@store' => null,
            Api\DeviceTokenController::class.'@destroy' => null,
            Api\RecuperarClaveController::class.'@enviarCodigo' => null,
            Api\RecuperarClaveController::class.'@restablecer' => null,
            Api\TrabajadorController::class.'@resolverCodigo' => null,
            // El carrito vive en el teléfono; esto solo recalcula precios.
            Api\CarritoController::class.'@actualizar' => null,
            Web\AuthWebController::class.'@login' => null,
            Web\AuthWebController::class.'@logout' => null,

            // --- Cuenta y perfil ---
            AuthController::class.'@register' => ['despues' => fn () => self::avisar(self::ADMIN, 'usuarios')],
            AuthController::class.'@actualizarPerfil' => ['despues' => fn (Request $r) => self::perfil($yo($r))],
            AuthController::class.'@hacerseDomiciliario' => ['despues' => fn (Request $r) => self::perfil($yo($r))],
            AuthController::class.'@dejarDeSerDomiciliario' => ['despues' => fn (Request $r) => self::perfil($yo($r))],
            Api\ClienteDireccionController::class.'@principal' => ['despues' => function (Request $r) use ($yo) {
                self::avisar(self::usuario($yo($r)), 'direcciones');
                self::perfil($yo($r));
            }],
            Api\ClienteDireccionController::class.'@destroy' => ['despues' => function (Request $r) use ($yo) {
                self::avisar(self::usuario($yo($r)), 'direcciones');
                self::perfil($yo($r));
            }],
            Api\ClienteDireccionController::class.'@store' => ['despues' => function (Request $r) use ($yo) {
                self::avisar(self::usuario($yo($r)), 'direcciones');
                self::avisar(self::ADMIN, 'barrios');
            }],
            Api\ClienteDireccionController::class.'@update' => ['despues' => function (Request $r) use ($yo) {
                self::avisar(self::usuario($yo($r)), 'direcciones');
                self::avisar(self::ADMIN, 'barrios');
            }],
            Api\CuentaController::class.'@destroy' => [
                'antes' => fn (Request $r) => self::negociosDe($yo($r)),
                'despues' => function (Request $r, Response $res, array $negocios) {
                    self::avisar(self::ADMIN, 'usuarios');
                    foreach ($negocios ?: [null] as $negocioId) {
                        self::datosNegocio($negocioId);
                    }
                },
            ],
            Web\PublicoController::class.'@eliminarCuenta' => ['despues' => function () {
                self::avisar(self::ADMIN, 'usuarios');
                self::datosNegocio(null);
            }],

            // --- Mis negocios: datos, estado (abierto/cerrado), equipo ---
            NegocioController::class.'@store' => ['despues' => function (Request $r, Response $res) use ($yo, $json) {
                self::datosNegocio($json($res, 'negocio', 'id'));
                self::avisar(self::usuario($yo($r)), 'negocios');
            }],
            NegocioController::class.'@update' => ['despues' => fn (Request $r) => self::datosNegocio($negocioRuta($r))],
            NegocioController::class.'@confirmarCierre' => ['despues' => fn (Request $r) => self::datosNegocio($negocioRuta($r))],
            NegocioController::class.'@desactivacion' => [
                'antes' => fn (Request $r) => self::miembros($negocioRuta($r)),
                'despues' => function (Request $r, Response $res, array $miembros) use ($negocioRuta) {
                    self::datosNegocio($negocioRuta($r));
                    self::equipo($negocioRuta($r), $miembros);
                },
            ],
            NegocioController::class.'@destroy' => [
                'antes' => fn (Request $r) => self::miembros($negocioRuta($r)),
                'despues' => function (Request $r, Response $res, array $miembros) use ($negocioRuta) {
                    self::datosNegocio($negocioRuta($r));
                    self::equipo($negocioRuta($r), $miembros);
                },
            ],
            Api\TrabajadorController::class.'@invitar' => ['despues' => function (Request $r) use ($negocioRuta) {
                $invitado = InvitacionTrabajo::where('negocio_id', $negocioRuta($r))->latest('id')->value('user_id');
                self::equipo($negocioRuta($r));
                self::avisar(self::usuario($invitado), 'invitaciones');
            }],
            Api\TrabajadorController::class.'@cancelarInvitacion' => [
                'antes' => fn (Request $r) => InvitacionTrabajo::whereKey($id($r))->value('user_id'),
                'despues' => function (Request $r, Response $res, ?int $invitado) use ($negocioRuta) {
                    self::equipo($negocioRuta($r));
                    self::avisar(self::usuario($invitado), 'invitaciones');
                },
            ],
            Api\TrabajadorController::class.'@actualizarPermisos' => ['despues' => fn (Request $r) => self::equipo($negocioRuta($r), [(int) $r->route('userId')])],
            Api\TrabajadorController::class.'@quitarMiembro' => ['despues' => fn (Request $r) => self::equipo($negocioRuta($r), [(int) $r->route('userId')])],
            Api\TrabajadorController::class.'@salir' => ['despues' => fn (Request $r) => self::equipo($negocioRuta($r), [$yo($r)])],
            Api\InvitacionController::class.'@aceptar' => ['despues' => function (Request $r) use ($id, $yo) {
                $negocioId = InvitacionTrabajo::whereKey($id($r))->value('negocio_id');
                self::equipo($negocioId, [$yo($r)]);
                self::avisar(self::usuario($yo($r)), 'invitaciones');
            }],
            Api\InvitacionController::class.'@rechazar' => ['despues' => function (Request $r) use ($id, $yo) {
                self::equipo(InvitacionTrabajo::whereKey($id($r))->value('negocio_id'));
                self::avisar(self::usuario($yo($r)), 'invitaciones');
            }],

            // --- Catálogo del negocio ---
            ProductoController::class.'@store' => ['despues' => fn (Request $r) => self::catalogo($negocioRuta($r))],
            ProductoController::class.'@update' => ['despues' => fn (Request $r) => self::catalogo($negocioRuta($r))],
            ProductoController::class.'@destroy' => ['despues' => fn (Request $r) => self::catalogo($negocioRuta($r))],
            ServicioController::class.'@store' => ['despues' => fn (Request $r) => self::catalogo($negocioRuta($r))],
            ServicioController::class.'@update' => ['despues' => fn (Request $r) => self::catalogo($negocioRuta($r))],
            ServicioController::class.'@destroy' => ['despues' => fn (Request $r) => self::catalogo($negocioRuta($r))],
            CategoriaController::class.'@store' => ['despues' => fn (Request $r) => self::catalogo($negocioRuta($r))],
            CategoriaController::class.'@update' => ['despues' => fn (Request $r) => self::catalogo($negocioRuta($r))],
            CategoriaController::class.'@destroy' => ['despues' => fn (Request $r) => self::catalogo($negocioRuta($r))],

            // --- Pedidos: cliente ---
            Api\PedidoController::class.'@store' => ['despues' => fn (Request $r, Response $res) => self::pedido($json($res, 'id'))],
            Api\PedidoController::class.'@cancelar' => $pedido,
            Api\PedidoController::class.'@calificar' => ['despues' => function (Request $r) use ($id) {
                $p = Pedido::find($id($r));
                self::pedido($p);
                self::reputacion(Reputacion::NEGOCIO, $p?->negocio_id);
                if ($p?->domiciliario_id) {
                    self::reputacion(Reputacion::DOMICILIARIO, $p->domiciliario_id);
                }
            }],
            Api\PedidoIncidenciaController::class.'@ajustar' => $pedido,
            Api\PedidoReporteController::class.'@store' => ['despues' => function (Request $r) use ($id) {
                self::pedido($id($r));
                self::avisar(self::ADMIN, 'reportes');
            }],
            Api\ResenaController::class.'@guardar' => ['despues' => function (Request $r) use ($id) {
                $p = Pedido::find($id($r));
                self::pedido($p);
                self::resenas($p?->negocio_id);
            }],
            Api\ResenaController::class.'@responder' => ['despues' => fn (Request $r) => self::resenas(Resena::whereKey($id($r))->value('negocio_id'))],
            Api\ResenaController::class.'@reportar' => ['despues' => fn () => self::avisar(self::ADMIN, 'resenas')],

            // --- Pedidos: negocio ---
            Api\ComercioPedidoController::class.'@aceptar' => $pedido,
            Api\ComercioPedidoController::class.'@marcarListo' => $pedido,
            Api\ComercioPedidoController::class.'@recogido' => $pedido,
            Api\ComercioPedidoController::class.'@cancelar' => $pedido,
            Api\ComercioPedidoController::class.'@confirmarDinero' => ['despues' => function (Request $r) use ($id) {
                $p = Pedido::find($id($r));
                self::pedido($p);
                self::reputacion(Reputacion::DOMICILIARIO, $p?->domiciliario_id);
            }],
            Api\PedidoIncidenciaController::class.'@faltante' => $pedido,
            Api\PedidoIncidenciaController::class.'@devolucion' => $pedido,

            // --- Pedidos: domiciliario ---
            Api\DomiciliarioController::class.'@tomar' => $pedido,
            Api\DomiciliarioController::class.'@soltar' => $pedido,
            Api\DomiciliarioController::class.'@ocupado' => $pedido,
            Api\DomiciliarioController::class.'@enCamino' => $pedido,
            Api\DomiciliarioController::class.'@llegada' => $pedido,
            Api\DomiciliarioController::class.'@clienteNoEncontrado' => $pedido,
            Api\DomiciliarioController::class.'@entregado' => $pedido,
            Api\DomiciliarioController::class.'@novedad' => $pedido,
            Api\DomiciliarioController::class.'@turno' => ['despues' => function (Request $r) use ($yo) {
                self::perfil($yo($r));
                self::avisar(self::ADMIN, 'mapa');
            }],
            // Posición del domiciliario: la ven el cliente y el negocio de lo que lleva, y el mapa del admin.
            Api\DomiciliarioController::class.'@ubicacion' => ['despues' => function (Request $r) use ($yo) {
                Pedido::where('domiciliario_id', $yo($r))->whereIn('estado', Pedido::EN_RUTA)
                    ->get(['id', 'user_id', 'negocio_id'])
                    ->each(fn (Pedido $p) => self::avisar(
                        [self::usuario($p->user_id), self::negocio($p->negocio_id)],
                        'ubicacion',
                        ['id' => $p->id, 'negocio_id' => $p->negocio_id],
                    ));
                self::avisar(self::ADMIN, 'mapa');
            }],

            // --- Citas ---
            Api\CitaController::class.'@store' => ['despues' => fn (Request $r, Response $res) => self::cita($json($res, 'cita', 'id'))],
            Api\CitaController::class.'@presencial' => ['despues' => fn (Request $r, Response $res) => self::cita($json($res, 'cita', 'id'))],
            Api\CitaController::class.'@actualizar' => ['despues' => fn (Request $r) => self::cita($id($r))],
            Api\CitaController::class.'@reasignar' => ['despues' => fn (Request $r) => self::cita($id($r))],
            Api\CitaController::class.'@llegada' => ['despues' => fn (Request $r) => self::cita($id($r))],
            Api\CitaController::class.'@cancelar' => ['despues' => fn (Request $r) => self::cita($id($r))],

            // --- Administración ---
            Api\AdminController::class.'@storeUsuario' => ['despues' => fn () => self::avisar(self::ADMIN, 'usuarios')],
            Api\AdminController::class.'@updateRol' => ['despues' => fn (Request $r) => self::perfil(self::idUsuarioRuta($r))],
            Api\AdminController::class.'@suspender' => ['despues' => function (Request $r) {
                self::perfil(self::idUsuarioRuta($r));
                // Sus negocios dejan de verse mientras esté suspendido.
                self::datosNegocio(null);
            }],
            Api\AdminController::class.'@reactivar' => ['despues' => function (Request $r) {
                self::perfil(self::idUsuarioRuta($r));
                self::datosNegocio(null);
            }],
            Web\AdminController::class.'@storeUsuario' => ['despues' => fn () => self::avisar(self::ADMIN, 'usuarios')],
            Web\AdminController::class.'@updateRol' => ['despues' => fn (Request $r) => self::perfil(self::idUsuarioRuta($r))],
            Api\AdminPedidoController::class.'@cerrar' => $pedido,
            Api\PedidoReporteController::class.'@resolver' => ['despues' => function (Request $r) use ($id) {
                self::pedido(PedidoReporte::whereKey($id($r))->value('pedido_id'));
                self::avisar(self::ADMIN, 'reportes');
            }],
            Web\AdminController::class.'@resolverReporte' => ['despues' => function (Request $r) use ($id) {
                self::pedido(PedidoReporte::whereKey($id($r))->value('pedido_id'));
                self::avisar(self::ADMIN, 'reportes');
            }],
            Api\AjusteController::class.'@actualizar' => ['despues' => fn () => self::avisar([self::CATALOGO, self::ADMIN], 'ajustes')],
            Api\BarrioController::class.'@aprobar' => ['despues' => fn () => self::avisar([self::CATALOGO, self::ADMIN], 'barrios')],
            Api\BarrioController::class.'@rechazar' => ['despues' => fn () => self::avisar([self::CATALOGO, self::ADMIN], 'barrios')],
            Api\AdminResenaController::class.'@ocultar' => ['despues' => fn (Request $r) => self::resenas(Resena::whereKey($id($r))->value('negocio_id'))],
            Api\AdminResenaController::class.'@restaurar' => ['despues' => fn (Request $r) => self::resenas(Resena::whereKey($id($r))->value('negocio_id'))],
            Api\AdminResenaController::class.'@descartarReportes' => ['despues' => fn () => self::avisar(self::ADMIN, 'resenas')],
            Api\AdminReputacionController::class.'@anular' => ['despues' => function (Request $r) use ($id) {
                $evento = ReputacionEvento::find($id($r));
                if ($evento) {
                    self::reputacion($evento->tipo, $evento->sujeto_id);
                }
            }],
            Api\AdminReputacionController::class.'@suspender' => ['despues' => fn (Request $r) => self::reputacion((string) $r->route('tipo'), $id($r))],
            Api\AdminReputacionController::class.'@levantarVeto' => ['despues' => fn (Request $r) => self::reputacion((string) $r->route('tipo'), $id($r))],
        ];
    }

    private static function idUsuarioRuta(Request $r): ?int
    {
        $usuario = $r->route('usuario');

        return $usuario instanceof User ? $usuario->id : ($usuario ? (int) $usuario : null);
    }
}
