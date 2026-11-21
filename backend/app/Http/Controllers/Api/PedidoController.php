<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Ajuste;
use App\Models\Negocio;
use App\Models\Pedido;
use App\Models\ReputacionEvento;
use App\Models\User;
use App\Notifications\NuevoPedidoParaComercio;
use App\Rules\Direccion;
use App\Rules\Telefono;
use App\Support\CancelarPedido;
use App\Support\CantidadPedido;
use App\Support\OpcionesPedido;
use App\Support\PagoTransferencia;
use App\Support\PrecioCarrito;
use App\Support\Push;
use App\Support\Reembolso;
use App\Support\Reputacion;
use App\Support\Resenas;
use App\Support\TiempoEntrega;
use App\Support\UbicacionDomiciliario;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

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
            'items.*.cantidad' => ['required', 'numeric', 'min:0.001', 'max:99'],
            'items.*.precio_token' => ['sometimes', 'nullable', 'string', 'max:2048'],
            // Ropa y calzado.
            'items.*.talla' => ['nullable', 'string', 'max:100'],
            'items.*.color' => ['nullable', 'string', 'max:100'],
            // Comida: ingredientes que no quiere y extras que pide aparte, con
            // cuántas porciones de cada uno (el precio lo pone el producto).
            'items.*.sin' => ['nullable', 'array', 'max:30'],
            'items.*.sin.*' => ['string', 'max:100'],
            'items.*.extras' => ['nullable', 'array', 'max:20'],
            'items.*.extras.*.nombre' => ['required', 'string', 'max:100'],
            'items.*.extras.*.cantidad' => ['required', 'integer', 'min:0', 'max:'.OpcionesPedido::MAX_PORCIONES_EXTRA],
            // De versiones anteriores de la app; ya no cuenta.
            'items.*.extra' => ['nullable', 'array', 'max:30'],
            'items.*.extra.*' => ['string', 'max:100'],
            'metodo_pago' => ['required', Rule::in(Pedido::METODOS_PAGO)],
            'direccion_entrega' => ['required', 'string', 'max:255', new Direccion],
            // Dirección guardada que eligió: de ahí sale el punto en el mapa.
            'direccion_id' => ['required', 'integer'],
            'telefono_contacto' => ['required', 'string', new Telefono],
            // Identifica el intento de compra: reintentar con la misma clave
            // devuelve el pedido ya creado en vez de duplicarlo.
            'clave_intento' => ['sometimes', 'nullable', 'string', 'min:8', 'max:64'],
            // Total que el cliente vio en pantalla: si ya no coincide (cambió un
            // precio o la tarifa), no se crea hasta que acepte el nuevo.
            'total_esperado' => ['sometimes', 'nullable', 'numeric', 'min:0'],
        ]);

        $clave = $datos['clave_intento'] ?? null;
        if ($clave && $repetido = $request->user()->pedidos()->where('clave_intento', $clave)->first()) {
            return $this->pedidoCreado($repetido);
        }

        // El negocio debe estar abierto (y no vetado por baja confiabilidad ni
        // archivado porque su único dueño eliminó la cuenta).
        $negocio = Negocio::where('activo', true)
            ->whereNull('vetado_at')
            ->whereNull('archivado_at')->whereNull('desactivado_at')
            ->find($datos['negocio_id']);
        if (! $negocio) {
            return response()->json(['message' => 'Ese negocio no está disponible.'], 422);
        }

        // Transferencia solo si el negocio dejó dónde recibirla.
        if ($datos['metodo_pago'] === 'transferencia' && ! $negocio->aceptaTransferencia()) {
            throw ValidationException::withMessages(['metodo_pago' => 'Este negocio no recibe transferencias. Elige efectivo.']);
        }

        // Productos de ESTE negocio, disponibles, que estén en el pedido.
        $ids = collect($datos['items'])->pluck('producto_id');
        $productos = $negocio->productos()
            ->where('disponible', true)->where('precio', '>', 0)
            ->whereIn('id', $ids)
            ->with('tipoProducto')
            ->get()
            ->keyBy('id');

        // Todos los ítems deben corresponder a un producto válido del negocio.
        foreach ($datos['items'] as $item) {
            if (! $productos->has($item['producto_id'])) {
                return response()->json(['message' => 'Hay un producto que ya no está disponible.'], 422);
            }

            CantidadPedido::validar($productos[$item['producto_id']], $item['cantidad']);
            $problema = OpcionesPedido::problema($productos[$item['producto_id']], $item);
            if ($problema) {
                return response()->json(['message' => $problema], 422);
            }
        }

        // El domicilio se cobra aparte: la tarifa vigente queda copiada en el
        // pedido (si el admin la cambia después, este pedido no cambia).
        $domicilio = Ajuste::tarifaDomicilio();
        foreach ($datos['items'] as &$item) {
            // Cada unidad cuesta el producto más los extras que lleva.
            $producto = $productos[$item['producto_id']];
            $item['opciones'] = OpcionesPedido::normalizar($producto, $item);
            $item['precio_reservado'] = PrecioCarrito::deItem($producto, $item, $request->user()->id)
                + OpcionesPedido::costoExtras($item['opciones']);
        }
        unset($item);
        $subtotal = collect($datos['items'])->sum(fn ($item) => round($item['precio_reservado'] * $item['cantidad'], 2));
        $total = $subtotal + $domicilio;

        if (isset($datos['total_esperado']) && $total - (float) $datos['total_esperado'] >= 0.01) {
            return response()->json([
                'message' => 'El total cambió desde que armaste el pedido. Revisa el nuevo total y confirma de nuevo.',
                'codigo' => 'total_cambio',
                'subtotal' => (float) $subtotal,
                'costo_domicilio' => (float) $domicilio,
                'total' => (float) $total,
                'precios' => $productos->map(fn ($p) => ['producto_id' => $p->id, 'precio' => (float) $p->precio])->values(),
            ], 409);
        }

        try {
            $pedido = $this->crear($request, $negocio, $datos, $productos, $subtotal, $domicilio);
        } catch (UniqueConstraintViolationException $e) {
            // Dos envíos del mismo intento a la vez: el segundo recibe el del primero.
            $repetido = $clave ? $request->user()->pedidos()->where('clave_intento', $clave)->first() : null;
            if (! $repetido) {
                throw $e;
            }

            return $this->pedidoCreado($repetido);
        }

        // Si el cliente aún no tenía teléfono guardado, el que escribió aquí
        // queda en su perfil como opción para los próximos pedidos.
        $user = $request->user();
        if (blank($user->telefono)) {
            $user->update(['telefono' => $datos['telefono_contacto']]);
        }

        // Avisa a TODO el equipo del negocio (propietarios y trabajadores
        // activos) que entró un pedido nuevo.
        $miembros = $negocio->miembrosActivos()->get()->filter(fn ($m) => $negocio->puede($m, 'gestionar_pedidos'));
        if ($miembros->isNotEmpty()) {
            Push::enviar($miembros, new NuevoPedidoParaComercio($pedido));
        }

        return $this->pedidoCreado($pedido);
    }

    public function fotoEntrega(Request $request, int $id, string $tipo)
    {
        $pedido = Pedido::findOrFail($id);
        abort_unless($pedido->domiciliario_id === $request->user()->id
            && $request->user()->hasRole('domiciliario')
            && in_array($pedido->estado, ['tomado', 'recogido', 'en_camino'], true), 403);
        $path = ($pedido->entrega_fotos ?? [])[$tipo] ?? null;
        abort_unless($path, 404);

        return Storage::disk('local')->response($path, null, ['Cache-Control' => 'private, no-store, max-age=0', 'X-Content-Type-Options' => 'nosniff']);
    }

    private function pedidoCreado(Pedido $pedido): JsonResponse
    {
        return response()->json(['id' => $pedido->id, 'message' => '¡Pedido confirmado!'], 201);
    }

    /** Guarda los ítems con su precio reservado válido o el precio confirmado. */
    private function crear(Request $request, Negocio $negocio, array $datos, $productos, float $subtotal, float $domicilio): Pedido
    {
        return DB::transaction(function () use ($request, $negocio, $datos, $productos, $subtotal, $domicilio) {
            $negocio = Negocio::whereKey($negocio->id)->lockForUpdate()->firstOrFail();
            abort_if($negocio->archivado_at || $negocio->desactivado_at || ! $negocio->activo, 409, 'El negocio ya no está disponible.');
            $cliente = User::whereKey($request->user()->id)->lockForUpdate()->firstOrFail();
            abort_if($cliente->eliminado_at || $cliente->suspendido_at, 403, 'Tu cuenta no está habilitada para hacer pedidos.');
            // El punto se copia al pedido: si luego edita o borra la dirección,
            // este pedido sigue yendo a donde se pidió.
            $direccion = isset($datos['direccion_id'])
                ? $cliente->clienteDirecciones()->find($datos['direccion_id'])
                : null;
            $faltanFotos = config('vitrina.fotos_entrega_obligatorias')
                && count(array_intersect(['frente', 'izquierda', 'derecha'], array_keys($direccion?->fotos ?? []))) !== 3;
            if (! $direccion || ! $direccion->tieneUbicacion() || $faltanFotos) {
                throw ValidationException::withMessages(['direccion_id' => $faltanFotos
                    ? 'Edita la dirección: marca tu casa en el mapa y añade las tres fotos.'
                    : 'Edita la dirección: marca tu casa en el mapa.']);
            }
            validator(['direccion' => $direccion->direccion, 'barrio' => $direccion->barrio], [
                'direccion' => ['required', 'max:255', new Direccion],
                'barrio' => ['required', 'regex:/\A[\p{L}\p{N}-]+\z/u'],
            ])->validate();
            if ($datos['direccion_entrega'] !== $direccion->direccion) {
                throw ValidationException::withMessages(['direccion_entrega' => 'La dirección no coincide con la ubicación seleccionada.']);
            }
            $pedido = Pedido::create([
                'negocio_id' => $negocio->id,
                'user_id' => $request->user()->id,
                'estado' => 'pendiente',
                'metodo_pago' => $datos['metodo_pago'],
                // Transferencia: el cliente paga cuando el negocio acepte.
                'pago_estado' => $datos['metodo_pago'] === 'transferencia' ? 'por_pagar' : null,
                'total' => 0,
                'direccion_entrega' => $direccion->direccion.' - Barrio '.$direccion->barrio,
                'entrega_fotos' => $direccion->fotos,
                'entrega_lat' => $direccion?->lat,
                'entrega_lng' => $direccion?->lng,
                'telefono_contacto' => $datos['telefono_contacto'],
                // Lo que el negocio promete tardar HOY: con esto se mide si cumplió.
                'minutos_preparacion' => $negocio->tiempo_preparacion,
                'clave_intento' => $datos['clave_intento'] ?? null,
            ]);

            foreach ($datos['items'] as $item) {
                $p = $productos[$item['producto_id']];
                $pedido->items()->create([
                    'producto_id' => $p->id,
                    'nombre' => $p->nombre,
                    'precio' => $item['precio_reservado'],
                    'cantidad' => $item['cantidad'],
                    'unidad_medida' => $productos[$item['producto_id']]->unidad_medida,
                    'opciones' => $item['opciones'],
                ]);
            }

            $pedido->update([
                'subtotal' => $subtotal,
                'costo_domicilio' => $domicilio,
                'total' => $subtotal + $domicilio,
            ]);

            return $pedido;
        });
    }

    /** Mis pedidos (más recientes primero), 20 por página (`?page=`). */
    public function index(Request $request): JsonResponse
    {
        $pagina = $request->user()->pedidos()
            ->with(['negocio', 'calificacion'])
            ->withCount('resenas')
            ->latest()
            ->latest('id')
            ->paginate(20);

        $pedidos = $pagina->getCollection()
            ->map(fn ($p) => [
                'id' => $p->id,
                'codigo' => $p->codigo,
                'estado' => $p->estado,
                'estado_label' => $p->estadoLabel(),
                'total' => (float) $p->total,
                'negocio' => $p->nombreNegocio(),
                'fecha' => $p->created_at->format('d/m/Y H:i'),
                'cancelado_por' => $p->cancelado_por,
                'por_calificar' => $p->puedeCalificarse(),
                'por_resenar' => $p->resenas_count === 0 && $p->puedeResenarse(),
            ])
            ->values();

        return response()->json([
            'pedidos' => $pedidos,
            'pagina' => $pagina->currentPage(),
            'ultima_pagina' => $pagina->lastPage(),
        ]);
    }

    /**
     * El cliente pide que le devuelvan la transferencia de un pedido
     * cancelado y dice a dónde (si ya estaba abierta, cambia a dónde). Pedirla
     * no es que ya se la hayan devuelto: el negocio la marca devuelta.
     */
    public function solicitarReembolso(Request $request, int $id): JsonResponse
    {
        $datos = $request->validate([
            'cuenta' => ['required', 'string', 'min:5', 'max:150'],
        ], [
            'cuenta.required' => 'Escribe a dónde te devuelven el dinero (por ejemplo: Nequi 3001234567).',
            'cuenta.min' => 'Escribe a dónde te devuelven el dinero (por ejemplo: Nequi 3001234567).',
        ]);

        $pedido = $request->user()->pedidos()->findOrFail($id);
        abort_unless($pedido->estado === 'cancelado' && $pedido->metodo_pago === 'transferencia', 422,
            'Solo puedes solicitar el reembolso de un pedido cancelado pagado por transferencia.');

        if (! Reembolso::solicitar($pedido, $datos['cuenta'])) {
            return response()->json(['message' => 'El negocio ya respondió esta devolución. Actualiza el pedido.'], 409);
        }

        return response()->json(['message' => 'Devolución solicitada. Te avisaremos cuando el negocio la marque como devuelta.']);
    }

    /** El cliente dice si le llegó la devolución que el negocio marcó. */
    public function responderReembolso(Request $request, int $id): JsonResponse
    {
        $datos = $request->validate(['recibido' => ['required', 'boolean']]);
        $pedido = $request->user()->pedidos()->findOrFail($id);

        if (! Reembolso::responder($pedido, (bool) $datos['recibido'])) {
            return response()->json(['message' => 'Esta devolución ya no espera tu respuesta.'], 409);
        }

        return response()->json(['message' => $datos['recibido']
            ? '¡Listo! La devolución quedó cerrada.'
            : 'Le avisamos al negocio que no te ha llegado.']);
    }

    /** Foto del comprobante de la devolución: el cliente y el equipo del negocio. */
    public function comprobanteReembolso(Request $request, int $id)
    {
        $pedido = Pedido::with('negocio')->findOrFail($id);
        abort_unless(Reembolso::puedeVerComprobante($pedido, $request->user()), 403);
        abort_unless($pedido->reembolso_comprobante, 404);

        return Storage::disk('local')->response($pedido->reembolso_comprobante, null, ['Cache-Control' => 'private, no-store, max-age=0', 'X-Content-Type-Options' => 'nosniff']);
    }

    /**
     * Bandeja del equipo (Mi perfil): las devoluciones de sus negocios, las
     * que esperan algo del negocio primero. `total` cuenta solo esas.
     */
    public function reembolsos(Request $request): JsonResponse
    {
        $negocios = $request->user()->negociosActivos()->get()
            ->filter(fn (Negocio $n) => $n->puede($request->user(), 'gestionar_pedidos'))->pluck('id');
        $base = fn () => Pedido::whereIn('negocio_id', $negocios)->whereNotNull('reembolso_estado');
        $pedidos = $base()
            ->with(['negocio', 'cliente'])
            ->orderByRaw("CASE WHEN reembolso_estado IN ('solicitado', 'no_recibido') THEN 0 ELSE 1 END")
            ->orderByDesc('reembolso_solicitado_at')
            ->paginate(20);

        return response()->json([
            'solicitudes' => $pedidos->getCollection()->map(fn (Pedido $p) => [
                'id' => $p->id, 'codigo' => $p->codigo, 'negocio_id' => $p->negocio_id,
                'negocio' => $p->negocio?->nombre, 'cliente' => $p->cliente?->nombre_completo,
                'telefono' => $p->telefono_contacto,
                'fecha' => $p->reembolso_solicitado_at,
                'estado' => $p->reembolso_estado,
                'cuenta' => $p->reembolso_cuenta,
                'monto' => $p->reembolso_monto !== null ? (float) $p->reembolso_monto : Reembolso::montoSugerido($p),
            ]),
            'pagina' => $pedidos->currentPage(), 'ultima_pagina' => $pedidos->lastPage(),
            'total' => $base()->whereIn('reembolso_estado', Pedido::REEMBOLSO_PENDIENTES)->count(),
        ]);
    }

    /** Seguimiento de un pedido propio. */
    public function show(Request $request, int $id): JsonResponse
    {
        $pedido = $request->user()->pedidos()
            ->with(['negocio', 'items.producto', 'domiciliario', 'calificacion', 'resenas'])
            ->find($id);

        if (! $pedido) {
            return response()->json(['message' => 'Pedido no encontrado.'], 404);
        }

        $puedeCalificar = $pedido->puedeCalificarse();
        $calificacion = $pedido->calificacion;

        return response()->json([
            'id' => $pedido->id,
            'codigo' => $pedido->codigo,
            'estado' => $pedido->estado,
            'estado_label' => $pedido->estadoLabel(),
            'estados' => $this->pasos($pedido),
            'estado_index' => $this->pasoActual($pedido),
            'subtotal' => (float) $pedido->subtotal,
            'costo_domicilio' => (float) $pedido->costo_domicilio,
            'total' => (float) $pedido->total,
            'metodo_pago' => $pedido->metodo_pago,
            // Transferencia: cuentas del negocio, en qué va el pago y si puede avisar que pagó.
            'pago' => PagoTransferencia::paraCliente($pedido),
            'reembolso_solicitado' => $pedido->reembolso_solicitado_at !== null,
            // Devolución de la transferencia si se canceló: estado, a dónde, cuánto y comprobante.
            'reembolso' => Reembolso::datos($pedido),
            'direccion_entrega' => $pedido->direccion_entrega,
            'minutos_recogida' => $pedido->minutos_recogida,
            'fecha' => $pedido->created_at->format('d/m/Y H:i'),
            'negocio' => $pedido->nombreNegocio(),
            'negocio_id' => $pedido->negocio_id,
            'faltante_motivo' => $pedido->faltante_motivo,
            'faltante_version' => $pedido->faltante_version,
            'cliente_no_encontrado_at' => $pedido->cliente_no_encontrado_at?->toIso8601String(),
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
            'codigo_entrega' => in_array($pedido->estado, Pedido::CON_CODIGO_ENTREGA, true) ? $pedido->codigo_confirmacion : null,
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
            // Su propia puerta en el mapa, y en cuánto llega el domiciliario
            // (aproximado por distancia; solo cuando ya viene en camino).
            'entrega_ubicacion' => $pedido->puntoEntrega(),
            'minutos_estimados' => $pedido->estado === 'en_camino'
                ? TiempoEntrega::minutos(UbicacionDomiciliario::de($pedido->domiciliario), $pedido->puntoEntrega())
                : null,
            'items' => $pedido->items->map(fn ($i) => [
                'producto_id' => $i->producto_id,
                'opciones' => $i->opciones,
                'nombre' => $i->nombre,
                'cantidad' => $i->cantidad,
                'unidad_medida' => $i->unidad_medida,
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
            // Estrellas y comentario públicos de la tienda y de lo que compró.
            'puede_resenar' => $pedido->puedeResenarse(),
            'resenas' => Resenas::dePedido($pedido),
        ]);
    }

    /**
     * Pasos de la línea de tiempo. Por transferencia hay uno más después de
     * que el negocio acepta: pagar y que el negocio confirme el pago.
     */
    private function pasos(Pedido $pedido): array
    {
        if ($pedido->estado === 'devolviendo') {
            return ['devolviendo'];
        }

        return $pedido->metodo_pago === 'transferencia'
            ? ['pendiente', 'pago', ...array_slice(Pedido::ESTADOS, 1)]
            : Pedido::ESTADOS;
    }

    private function pasoActual(Pedido $pedido): int
    {
        $indice = $pedido->estadoIndex();
        if ($pedido->metodo_pago !== 'transferencia' || $pedido->estado === 'devolviendo' || $pedido->estado === 'pendiente') {
            return $indice;
        }

        // Aceptado sin pago confirmado: va en el paso del pago.
        return $pedido->estado === 'aceptado' && $pedido->esperaPago() ? 1 : $indice + 1;
    }

    /**
     * El cliente avisa que ya pagó por transferencia: en qué cuenta del
     * negocio y, si quiere, la foto del comprobante. El negocio debe revisar
     * que el dinero le llegó antes de confirmarlo.
     */
    public function informarPago(Request $request, int $id): JsonResponse
    {
        $datos = $request->validate([
            'cuenta_id' => ['required', 'integer'],
            'comprobante' => ['nullable', 'image', 'max:8192'],
        ], [
            'cuenta_id.required' => 'Elige en cuál cuenta pagaste.',
            'comprobante.image' => 'El comprobante debe ser una foto.',
            'comprobante.max' => 'La foto del comprobante es muy pesada (máximo 8 MB).',
        ]);

        $pedido = $request->user()->pedidos()->with('negocio')->find($id);
        if (! $pedido) {
            return response()->json(['message' => 'Pedido no encontrado.'], 404);
        }

        if (! PagoTransferencia::informar($pedido, (int) $datos['cuenta_id'], $request->file('comprobante'))) {
            return response()->json(['message' => 'Este pedido ya no está esperando tu pago. Actualiza para ver en qué va.'], 409);
        }

        return response()->json(['message' => 'Le avisamos al negocio. Confirmará cuando vea el dinero en su cuenta.']);
    }

    /** Foto del comprobante de pago: la ven el cliente y el equipo del negocio. */
    public function comprobante(Request $request, int $id)
    {
        $pedido = Pedido::with('negocio')->findOrFail($id);
        abort_unless(PagoTransferencia::puedeVerComprobante($pedido, $request->user()), 403);
        abort_unless($pedido->pago_comprobante, 404);

        return Storage::disk('local')->response($pedido->pago_comprobante, null, ['Cache-Control' => 'private, no-store, max-age=0', 'X-Content-Type-Options' => 'nosniff']);
    }

    /**
     * El cliente cancela antes de que el domiciliario marque en camino.
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
                'message' => 'El pedido ya salió en camino o terminó. Ya no se puede cancelar.',
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
            // Opcional: la app ya no lo pregunta (la tienda se valora con su reseña).
            'negocio_ok' => ['sometimes', 'nullable', 'boolean'],
            'negocio_problemas' => [Rule::requiredIf($request->input('negocio_ok') !== null && ! $request->boolean('negocio_ok')), 'array'],
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

        $negocioOk = $datos['negocio_ok'] ?? null;
        $negocioProblemas = $negocioOk === false
            ? array_values(array_unique($datos['negocio_problemas']))
            : [];
        $domiciliarioProblemas = $conDomiciliario
            ? array_values(array_unique($datos['domiciliario_problemas'] ?? []))
            : [];
        // {"amabilidad": 5, "rapidez": 4, "estado_producto": 5}
        $caritas = $pideCaritas
            ? collect($aspectos)->mapWithKeys(fn ($a) => [$a => (int) $datos['domiciliario_caritas'][$a]])->all()
            : null;
        $comentario = filled($datos['comentario'] ?? null) ? trim($datos['comentario']) : null;

        DB::transaction(function () use ($pedido, $negocioOk, $conDomiciliario, $negocioProblemas, $domiciliarioProblemas, $caritas, $comentario) {
            $pedido->calificacion()->create([
                'user_id' => $pedido->user_id,
                'negocio_ok' => $negocioOk,
                'negocio_problemas' => $negocioProblemas ?: null,
                // "Cumplió": nada grave y ninguna carita por debajo de 3.
                'domiciliario_ok' => $conDomiciliario ? (! $domiciliarioProblemas && min($caritas) >= 3) : null,
                'domiciliario_caritas' => $caritas,
                'domiciliario_problemas' => $domiciliarioProblemas ?: null,
                'comentario' => $comentario,
            ]);

            // El comentario del cliente acompaña las quejas (lo ve el admin).
            $nota = $comentario ? Str::limit($comentario, 250) : null;

            // Solo si respondió por el negocio (clientes con una versión anterior).
            foreach ($negocioOk === null ? [] : ($negocioProblemas ?: ['cliente_conforme']) as $motivo) {
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
