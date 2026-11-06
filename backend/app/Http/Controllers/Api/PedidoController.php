<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Ajuste;
use App\Models\Negocio;
use App\Models\Pedido;
use App\Models\ReputacionEvento;
use App\Notifications\NuevoPedidoParaComercio;
use App\Support\CancelarPedido;
use App\Support\OpcionesPedido;
use App\Support\Push;
use App\Support\Reputacion;
use App\Support\UbicacionDomiciliario;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * API de pedidos del CLIENTE: crear un pedido (desde el carrito de la app),
 * listar mis pedidos y ver el seguimiento de uno.
 */
class PedidoController extends Controller
{
    /** Crear un pedido. El carrito vive en la app; aquí llegan los ítems. */
    public function store(Request $request): JsonResponse
    {
        $datos = $request->validate([
            'negocio_id' => ['required', 'integer'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.producto_id' => ['required', 'integer'],
            'items.*.cantidad' => ['required', 'integer', 'min:1', 'max:99'],
            // Ropa y calzado.
            'items.*.talla' => ['nullable', 'string', 'max:100'],
            'items.*.color' => ['nullable', 'string', 'max:100'],
            // Comida: ingredientes que no quiere o de los que quiere más.
            'items.*.sin' => ['nullable', 'array', 'max:30'],
            'items.*.sin.*' => ['string', 'max:100'],
            'items.*.extra' => ['nullable', 'array', 'max:30'],
            'items.*.extra.*' => ['string', 'max:100'],
            'metodo_pago' => ['required', Rule::in(Pedido::METODOS_PAGO)],
            'direccion_entrega' => ['required', 'string', 'max:255'],
            'telefono_contacto' => ['required', 'string', 'max:30'],
        ]);

        // El negocio debe estar abierto (y no vetado por baja confiabilidad ni
        // archivado porque su único dueño eliminó la cuenta).
        $negocio = Negocio::where('activo', true)
            ->whereNull('vetado_at')
            ->whereNull('archivado_at')
            ->find($datos['negocio_id']);
        if (! $negocio) {
            return response()->json(['message' => 'Ese negocio no está disponible.'], 422);
        }

        // Productos de ESTE negocio, disponibles, que estén en el pedido.
        $ids = collect($datos['items'])->pluck('producto_id');
        $productos = $negocio->productos()
            ->where('disponible', true)
            ->whereIn('id', $ids)
            ->with('tipoProducto')
            ->get()
            ->keyBy('id');

        // Todos los ítems deben corresponder a un producto válido del negocio.
        foreach ($datos['items'] as $item) {
            if (! $productos->has($item['producto_id'])) {
                return response()->json(['message' => 'Hay un producto que ya no está disponible.'], 422);
            }

            $problema = OpcionesPedido::problema($productos[$item['producto_id']], $item);
            if ($problema) {
                return response()->json(['message' => $problema], 422);
            }
        }

        $pedido = DB::transaction(function () use ($request, $negocio, $datos, $productos) {
            $pedido = Pedido::create([
                'negocio_id' => $negocio->id,
                'user_id' => $request->user()->id,
                'estado' => 'pendiente',
                'metodo_pago' => $datos['metodo_pago'],
                'total' => 0,
                'direccion_entrega' => $datos['direccion_entrega'],
                'telefono_contacto' => $datos['telefono_contacto'],
                // Lo que el negocio promete tardar HOY: con esto se mide si cumplió.
                'minutos_preparacion' => $negocio->tiempo_preparacion,
            ]);

            $subtotal = 0;
            foreach ($datos['items'] as $item) {
                $p = $productos[$item['producto_id']];
                $pedido->items()->create([
                    'producto_id' => $p->id,
                    'nombre' => $p->nombre,
                    'precio' => $p->precio,
                    'cantidad' => $item['cantidad'],
                    'opciones' => OpcionesPedido::normalizar($p, $item),
                ]);
                $subtotal += $p->precio * $item['cantidad'];
            }

            // El domicilio se cobra aparte: la tarifa vigente queda copiada en el
            // pedido (si el admin la cambia después, este pedido no cambia).
            $domicilio = Ajuste::tarifaDomicilio();
            $pedido->update([
                'subtotal' => $subtotal,
                'costo_domicilio' => $domicilio,
                'total' => $subtotal + $domicilio,
            ]);

            return $pedido;
        });

        // Si el cliente aún no tenía teléfono guardado, el que escribió aquí
        // queda en su perfil como opción para los próximos pedidos.
        $user = $request->user();
        if (blank($user->telefono)) {
            $user->update(['telefono' => $datos['telefono_contacto']]);
        }

        // Avisa a TODO el equipo del negocio (propietarios y trabajadores
        // activos) que entró un pedido nuevo.
        $miembros = $negocio->miembrosActivos()->get();
        if ($miembros->isNotEmpty()) {
            Push::enviar($miembros, new NuevoPedidoParaComercio($pedido));
        }

        return response()->json(['id' => $pedido->id, 'message' => '¡Pedido confirmado!'], 201);
    }

    /** Mis pedidos (más recientes primero), 20 por página (`?page=`). */
    public function index(Request $request): JsonResponse
    {
        $pagina = $request->user()->pedidos()
            ->with(['negocio', 'calificacion'])
            ->latest()
            ->latest('id')
            ->paginate(20);

        $pedidos = $pagina->getCollection()
            ->map(fn ($p) => [
                'id' => $p->id,
                'estado' => $p->estado,
                'estado_label' => $p->estadoLabel(),
                'total' => (float) $p->total,
                'negocio' => $p->negocio?->nombre,
                'fecha' => $p->created_at->format('d/m/Y H:i'),
                'cancelado_por' => $p->cancelado_por,
                'por_calificar' => $p->puedeCalificarse(),
            ])
            ->values();

        return response()->json([
            'pedidos' => $pedidos,
            'pagina' => $pagina->currentPage(),
            'ultima_pagina' => $pagina->lastPage(),
        ]);
    }

    /** Seguimiento de un pedido propio. */
    public function show(Request $request, int $id): JsonResponse
    {
        $pedido = $request->user()->pedidos()
            ->with(['negocio', 'items', 'domiciliario', 'calificacion'])
            ->find($id);

        if (! $pedido) {
            return response()->json(['message' => 'Pedido no encontrado.'], 404);
        }

        $puedeCalificar = $pedido->puedeCalificarse();
        $calificacion = $pedido->calificacion;

        return response()->json([
            'id' => $pedido->id,
            'estado' => $pedido->estado,
            'estado_label' => $pedido->estadoLabel(),
            'estados' => Pedido::ESTADOS,
            'estado_index' => $pedido->estadoIndex(),
            'subtotal' => (float) $pedido->subtotal,
            'costo_domicilio' => (float) $pedido->costo_domicilio,
            'total' => (float) $pedido->total,
            'metodo_pago' => $pedido->metodo_pago,
            'direccion_entrega' => $pedido->direccion_entrega,
            'minutos_recogida' => $pedido->minutos_recogida,
            'fecha' => $pedido->created_at->format('d/m/Y H:i'),
            'negocio' => $pedido->negocio?->nombre,
            // Para llamar o escribir por WhatsApp al negocio.
            'negocio_telefono' => $pedido->negocio?->telefono,
            'negocio_reputacion' => $pedido->negocio
                ? Reputacion::resumen(Reputacion::NEGOCIO, $pedido->negocio)
                : null,
            'domiciliario' => $pedido->domiciliario?->nombre_completo,
            // El teléfono del domiciliario solo mientras lleva el pedido.
            'domiciliario_telefono' => in_array($pedido->estado, Pedido::EN_RUTA, true)
                ? $pedido->domiciliario?->telefono
                : null,
            'domiciliario_reputacion' => $pedido->domiciliario
                ? Reputacion::resumen(Reputacion::DOMICILIARIO, $pedido->domiciliario)
                : null,
            // Se lo da al domiciliario al recibir el pedido; solo lo ve el cliente.
            'codigo_entrega' => in_array($pedido->estado, Pedido::CON_CODIGO_ENTREGA, true) ? $pedido->codigo_entrega : null,
            // Justificación del domiciliario si se está demorando.
            'novedad' => $pedido->novedad,
            // Mapa: el cliente ve al domiciliario solo mientras le lleva el
            // pedido (desde que lo recoge hasta que lo entrega).
            'domiciliario_ubicacion' => in_array($pedido->estado, ['recogido', 'en_camino'], true)
                ? UbicacionDomiciliario::de($pedido->domiciliario)
                : null,
            'negocio_ubicacion' => $pedido->negocio?->tieneUbicacion()
                ? ['lat' => $pedido->negocio->lat, 'lng' => $pedido->negocio->lng]
                : null,
            'items' => $pedido->items->map(fn ($i) => [
                'nombre' => $i->nombre,
                'cantidad' => $i->cantidad,
                'precio' => (float) $i->precio,
                'detalle' => $i->detalle(),
            ]),
            // Cancelación: quién, por qué y si el cliente aún puede cancelar.
            'cancelado_por' => $pedido->cancelado_por,
            'motivo_cancelacion' => $pedido->motivo_cancelacion,
            'puede_cancelar' => CancelarPedido::puede($pedido, CancelarPedido::POR_CLIENTE),
            'motivos_cancelacion' => CancelarPedido::MOTIVOS_CLIENTE,
            'puede_calificar' => $puedeCalificar,
            'opciones_problemas' => $puedeCalificar ? [
                'negocio' => Reputacion::opcionesCliente(Reputacion::NEGOCIO),
                'domiciliario' => Reputacion::opcionesCliente(Reputacion::DOMICILIARIO),
            ] : null,
            // Amabilidad, rapidez y estado del producto (caritas de 1 a 5).
            'aspectos_domiciliario' => $puedeCalificar && $pedido->domiciliario
                ? Reputacion::aspectosCliente()
                : null,
            'calificacion' => $calificacion ? [
                'negocio_ok' => $calificacion->negocio_ok,
                'negocio_problemas' => $this->etiquetas(Reputacion::NEGOCIO, $calificacion->negocio_problemas),
                'domiciliario_ok' => $calificacion->domiciliario_ok,
                'domiciliario_caritas' => $this->caritasDadas($calificacion->domiciliario_caritas),
                'domiciliario_problemas' => $this->etiquetas(Reputacion::DOMICILIARIO, $calificacion->domiciliario_problemas),
                'comentario' => $calificacion->comentario,
            ] : null,
        ]);
    }

    /**
     * El cliente cancela su pedido mientras el negocio no lo tenga listo.
     * Se avisa a todo el equipo del negocio.
     */
    public function cancelar(Request $request, int $id): JsonResponse
    {
        $datos = $request->validate([
            'motivo' => ['nullable', 'string', 'max:255'],
        ]);

        $pedido = $request->user()->pedidos()->find($id);
        if (! $pedido) {
            return response()->json(['message' => 'Pedido no encontrado.'], 404);
        }

        if (! CancelarPedido::ejecutar($pedido, CancelarPedido::POR_CLIENTE, $datos['motivo'] ?? null)) {
            return response()->json([
                'message' => 'El negocio ya tiene listo tu pedido; ya no se puede cancelar desde la app. Llama al negocio.',
            ], 409);
        }

        return response()->json(['message' => 'Pedido cancelado.']);
    }

    /**
     * Calificar un pedido entregado: ¿el negocio cumplió? (si no, qué falló),
     * caritas de 1 a 5 para el domiciliario en amabilidad, rapidez y estado
     * del producto, y si pasó algo grave con él. Si el pedido nunca llegó no
     * se piden caritas. Cada respuesta sube o baja su nivel de confiabilidad.
     * Una sola vez por pedido y dentro de `reputacion.horas_para_calificar`.
     */
    public function calificar(Request $request, int $id): JsonResponse
    {
        $pedido = $request->user()->pedidos()
            ->with(['negocio', 'domiciliario', 'calificacion'])
            ->find($id);

        if (! $pedido) {
            return response()->json(['message' => 'Pedido no encontrado.'], 404);
        }

        if (! $pedido->puedeCalificarse()) {
            return response()->json(['message' => 'Este pedido ya no se puede calificar.'], 409);
        }

        $conDomiciliario = $pedido->domiciliario !== null;
        $aspectos = array_keys(Reputacion::ASPECTOS_DOMICILIARIO);
        // Si el pedido nunca llegó, no hay trato, rapidez ni estado que calificar.
        $noLlego = in_array('no_llego', (array) $request->input('domiciliario_problemas', []), true);
        $pideCaritas = $conDomiciliario && ! $noLlego;

        $reglas = [
            'negocio_ok' => ['required', 'boolean'],
            'negocio_problemas' => [Rule::requiredIf(! $request->boolean('negocio_ok')), 'array'],
            'negocio_problemas.*' => [Rule::in(array_keys(Reputacion::PROBLEMAS_CLIENTE[Reputacion::NEGOCIO]))],
            'domiciliario_caritas' => [Rule::requiredIf($pideCaritas), 'array:'.implode(',', $aspectos)],
            'domiciliario_problemas' => ['nullable', 'array'],
            'domiciliario_problemas.*' => [Rule::in(array_keys(Reputacion::PROBLEMAS_CLIENTE[Reputacion::DOMICILIARIO]))],
            'comentario' => ['nullable', 'string', 'max:500'],
        ];
        $mensajes = [
            'negocio_problemas.required' => 'Cuéntanos qué falló con el negocio.',
            'domiciliario_caritas.required' => 'Califica al domiciliario con las caritas.',
        ];
        foreach ($aspectos as $aspecto) {
            $reglas["domiciliario_caritas.{$aspecto}"] = [Rule::requiredIf($pideCaritas), 'integer', 'between:1,5'];
            $mensajes["domiciliario_caritas.{$aspecto}.required"] =
                'Elige una carita para «'.Reputacion::ASPECTOS_DOMICILIARIO[$aspecto]['nombre'].'».';
        }

        $datos = $request->validate($reglas, $mensajes);

        $negocioProblemas = $datos['negocio_ok']
            ? []
            : array_values(array_unique($datos['negocio_problemas']));
        $domiciliarioProblemas = $conDomiciliario
            ? array_values(array_unique($datos['domiciliario_problemas'] ?? []))
            : [];
        // {"amabilidad": 5, "rapidez": 4, "estado_producto": 5}
        $caritas = $pideCaritas
            ? collect($aspectos)->mapWithKeys(fn ($a) => [$a => (int) $datos['domiciliario_caritas'][$a]])->all()
            : null;
        $comentario = filled($datos['comentario'] ?? null) ? trim($datos['comentario']) : null;

        DB::transaction(function () use ($pedido, $datos, $conDomiciliario, $negocioProblemas, $domiciliarioProblemas, $caritas, $comentario) {
            $pedido->calificacion()->create([
                'user_id' => $pedido->user_id,
                'negocio_ok' => $datos['negocio_ok'],
                'negocio_problemas' => $negocioProblemas ?: null,
                // "Cumplió": nada grave y ninguna carita por debajo de 3.
                'domiciliario_ok' => $conDomiciliario ? (! $domiciliarioProblemas && min($caritas) >= 3) : null,
                'domiciliario_caritas' => $caritas,
                'domiciliario_problemas' => $domiciliarioProblemas ?: null,
                'comentario' => $comentario,
            ]);

            // El comentario del cliente acompaña las quejas (lo ve el admin).
            $nota = $comentario ? Str::limit($comentario, 250) : null;

            foreach ($negocioProblemas ?: ['cliente_conforme'] as $motivo) {
                Reputacion::registrar(
                    Reputacion::NEGOCIO, $pedido->negocio, $motivo, $pedido,
                    ReputacionEvento::ORIGEN_CLIENTE, $negocioProblemas ? $nota : null,
                );
            }

            if ($conDomiciliario) {
                // Motivo => ¿es una queja? (caritas de 1 o 2 y lo grave).
                $motivos = [];
                foreach ($caritas ?? [] as $aspecto => $n) {
                    $motivos[Reputacion::motivoCarita($aspecto, $n)] = $n <= 2;
                }
                foreach ($domiciliarioProblemas as $motivo) {
                    $motivos[$motivo] = true;
                }

                foreach ($motivos as $motivo => $esQueja) {
                    Reputacion::registrar(
                        Reputacion::DOMICILIARIO, $pedido->domiciliario, $motivo, $pedido,
                        ReputacionEvento::ORIGEN_CLIENTE, $esQueja ? $nota : null,
                    );
                }
            }
        });

        return response()->json(['message' => '¡Gracias! Tu calificación ayuda a todos.'], 201);
    }

    /** Claves de problemas → textos que el cliente eligió. */
    private function etiquetas(string $tipo, ?array $claves): array
    {
        return collect($claves ?? [])
            // Quejas de antes de las caritas (llegó tarde, mal trato): su descripción.
            ->map(fn ($clave) => Reputacion::PROBLEMAS_CLIENTE[$tipo][$clave] ?? Reputacion::descripcion($tipo, $clave))
            ->values()
            ->all();
    }

    /** {"rapidez": 4, ...} → [{clave, nombre, nota, texto}] para mostrarle al cliente. */
    private function caritasDadas(?array $caritas): ?array
    {
        if (! $caritas) {
            return null;
        }

        return collect(Reputacion::ASPECTOS_DOMICILIARIO)
            ->filter(fn ($a, $clave) => isset($caritas[$clave]))
            ->map(fn ($a, $clave) => [
                'clave' => $clave,
                'nombre' => $a['nombre'],
                'nota' => (int) $caritas[$clave],
                'texto' => $a['caritas'][$caritas[$clave] - 1],
            ])
            ->values()
            ->all();
    }
}
