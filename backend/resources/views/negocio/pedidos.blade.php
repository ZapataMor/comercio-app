@extends('layouts.negocio')
@section('titulo', 'Pedidos')
@section('contenido')
@php
    use App\Models\Pedido;
    $dinero = fn ($v) => '$ '.number_format((float) $v, 0, ',', '.');
    // Minutos entre dos momentos, legible: «8 min», «1 h 05 min».
    $duracion = function ($desde, $hasta) {
        if (! $desde || ! $hasta) {
            return null;
        }
        $min = max(0, (int) round($desde->diffInSeconds($hasta) / 60));

        return $min < 60 ? $min.' min' : intdiv($min, 60).' h '.str_pad((string) ($min % 60), 2, '0', STR_PAD_LEFT).' min';
    };
    $tonoEstado = fn (string $e) => match (true) {
        $e === 'entregado' => 'chip-exito',
        $e === 'cancelado' => 'chip-peligro',
        default => 'chip-acento',
    };
    $nombreDia = function ($fecha) {
        $f = $fecha->copy()->locale('es');
        if ($f->isToday()) {
            return 'Hoy';
        }
        if ($f->isYesterday()) {
            return 'Ayer';
        }

        $texto = $f->translatedFormat('l j \d\e F'.($f->year !== now()->year ? ' \d\e Y' : ''));

        return mb_strtoupper(mb_substr($texto, 0, 1)).mb_substr($texto, 1);
    };
    $porDia = $pedidos->getCollection()->groupBy(fn ($p) => $p->created_at->format('Y-m-d'));
    $hayFiltros = $estado || $dia || $buscar !== '';
@endphp

<header class="panel-encabezado">
    <span class="panel-ceja">Núcleo</span>
    <h1>Pedidos</h1>
    <p>Los pedidos se atienden en la app (con la alarma); aquí se consultan. Toca uno para ver todo su detalle.</p>
</header>

<form method="GET" class="pedidos-filtros" role="search">
    <input type="search" name="buscar" value="{{ $buscar }}" placeholder="Código, cliente o teléfono" aria-label="Buscar pedido">
    <select name="estado" aria-label="Filtrar por estado" onchange="this.form.submit()">
        <option value="">Todos los estados</option>
        <option value="en_curso" @selected($estado === 'en_curso')>En curso</option>
        <option value="entregados" @selected($estado === 'entregados')>Entregados</option>
        <option value="cancelados" @selected($estado === 'cancelados')>Cancelados</option>
    </select>
    {{-- El botón del calendario abre el selector de fecha del navegador. --}}
    <label @class(['boton-calendario', 'activo' => $dia]) title="Elegir un día">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="16.5" rx="3"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/></svg>
        <span>{{ $dia ? $dia->copy()->locale('es')->translatedFormat('j M Y') : 'Elegir día' }}</span>
        <input type="date" name="dia" value="{{ $dia?->format('Y-m-d') }}" max="{{ now()->format('Y-m-d') }}" aria-label="Elegir un día" data-calendario>
    </label>
    <button class="boton boton-claro boton-chico">Buscar</button>
    @if($hayFiltros)<a class="enlace" href="{{ route('negocio.pedidos') }}">Quitar filtros</a>@endif
</form>

<div data-vivo data-vivo-intervalo="20000">
@if($pedidos->isEmpty())
    <section class="bloque"><p class="apagado catalogo-vacio">{{ $hayFiltros ? 'Ningún pedido coincide con el filtro.' : 'Todavía no hay pedidos.' }}</p></section>
@else
    @foreach($porDia as $fecha => $delDia)
        @php $f = \Illuminate\Support\Carbon::parse($fecha); @endphp
        <section class="pedidos-dia">
            <h2 class="pedidos-dia-titulo">
                <span>{{ $nombreDia($f) }}</span>
                <span class="bloque-cuenta">{{ $delDia->count() }} {{ $delDia->count() === 1 ? 'pedido' : 'pedidos' }}</span>
                <span class="pedidos-dia-total">{{ $dinero($delDia->where('estado', '!=', 'cancelado')->sum('total')) }}</span>
            </h2>
            <ul class="pedidos">
                @foreach($delDia as $p)
                    @php $unidades = $p->items->sum('cantidad'); @endphp
                    <li>
                        <button type="button" @class(['pedido', 'cancelado' => $p->estado === 'cancelado']) data-abrir="pedido-{{ $p->id }}" aria-haspopup="dialog">
                            <span class="pedido-cabeza">
                                <span class="pedido-codigo">{{ $p->codigo ?? '#'.$p->id }}</span>
                                <span class="pedido-hora">{{ $p->created_at->format('g:i a') }}</span>
                            </span>
                            <span @class(['chip', 'pedido-estado', $tonoEstado($p->estado)])>{{ Pedido::ESTADO_LABEL[$p->estado] ?? $p->estado }}</span>
                            <span class="pedido-cliente">{{ $p->cliente?->name ?? 'Cliente' }}</span>
                            <span class="pedido-items">{{ $p->items->map(fn ($i) => rtrim(rtrim(number_format($i->cantidad, 2, ',', ''), '0'), ',').'× '.$i->nombre)->implode(', ') ?: 'Sin productos' }}</span>
                            <span class="pedido-pie">
                                <span class="pedido-total">{{ $dinero($p->total) }}</span>
                                <span class="chip">{{ $p->metodo_pago === 'transferencia' ? 'Transferencia' : 'Efectivo' }}</span>
                                @if($p->domiciliario)<span class="pedido-domi" title="Domiciliario">🛵 {{ $p->domiciliario->name }}</span>@endif
                            </span>
                        </button>
                    </li>
                @endforeach
            </ul>
        </section>
    @endforeach
    {{ $pedidos->links('negocio._paginas') }}
@endif

{{-- Un modal por pedido con toda su información. --}}
@foreach($pedidos as $p)
    @php
        $tiempos = array_values(array_filter([
            ['Pedido realizado', $p->created_at],
            ['Aceptado por el negocio', $p->aceptado_at],
            ['Listo para recoger', $p->listo_at],
            ['Domiciliario asignado', $p->tomado_at],
            ['Recogido', $p->recogido_at],
            ['En camino', $p->en_camino_at],
            ['Llegó donde el cliente', $p->llegada_at],
            ['Entregado', $p->entregado_at],
            ['Cancelado', $p->cancelado_at],
        ], fn ($t) => $t[1] !== null));
        usort($tiempos, fn ($a, $b) => $a[1] <=> $b[1]);
        $prepReal = $duracion($p->aceptado_at, $p->listo_at);
        $resumen = array_filter([
            'Espera para aceptar' => $duracion($p->created_at, $p->aceptado_at),
            'Preparación' => $prepReal ? $prepReal.($p->minutos_preparacion ? ' (prometido: '.$p->minutos_preparacion.' min)' : '') : ($p->minutos_preparacion && $p->aceptado_at && ! $p->listo_at ? 'prometido: '.$p->minutos_preparacion.' min' : null),
            'Espera del domiciliario' => $duracion($p->listo_at ?? $p->aceptado_at, $p->recogido_at),
            'Entrega' => $duracion($p->recogido_at, $p->entregado_at),
            'Tiempo total' => $duracion($p->created_at, $p->entregado_at ?? $p->cancelado_at),
        ]);
        $c = $p->calificacion;
    @endphp
    <dialog class="modal" id="pedido-{{ $p->id }}" aria-labelledby="pedido-{{ $p->id }}-titulo">
        <div class="modal-cabeza">
            <div class="pedido-modal-titulo">
                <h2 id="pedido-{{ $p->id }}-titulo">Pedido {{ $p->codigo ?? '#'.$p->id }}</h2>
                <span @class(['chip', $tonoEstado($p->estado)])>{{ Pedido::ESTADO_LABEL[$p->estado] ?? $p->estado }}</span>
            </div>
            <button type="button" class="modal-cerrar" data-cerrar aria-label="Cerrar">✕</button>
        </div>
        <div class="modal-detalle pedido-detalle">
            <p class="apagado pedido-fecha">{{ ucfirst($p->created_at->copy()->locale('es')->translatedFormat('l j \d\e F \d\e Y, g:i a')) }}</p>

            @if($p->estado === 'cancelado')
                <div class="aviso aviso-error">
                    <strong>Cancelado{{ $p->cancelado_por ? ' por '.match ($p->cancelado_por) { 'cliente' => 'el cliente', 'negocio' => 'el negocio', 'domiciliario' => 'el domiciliario', 'administrador', 'sistema' => 'Vitrina', 'cliente_no_encontrado' => 'no encontrar al cliente', default => $p->cancelado_por } : '' }}</strong>
                    @if($p->motivo_cancelacion)<br>{{ $p->motivo_cancelacion }}@endif
                </div>
            @endif
            @if($p->novedad)<div class="aviso aviso-info"><strong>Novedad:</strong> {{ $p->novedad }}</div>@endif

            <div class="pedido-columnas">
                <section class="pedido-caja">
                    <h3>Productos</h3>
                    <ul class="pedido-lineas">
                        @foreach($p->items as $i)
                            <li>
                                <span class="pedido-cantidad">{{ rtrim(rtrim(number_format($i->cantidad, 2, ',', ''), '0'), ',') }}×</span>
                                <span class="pedido-linea-nombre">{{ $i->nombre }}@if($i->detalle())<small>{{ $i->detalle() }}</small>@endif</span>
                                <strong>{{ $dinero($i->subtotal()) }}</strong>
                            </li>
                        @endforeach
                    </ul>
                    <dl class="pedido-cuentas">
                        <dt>Subtotal</dt><dd>{{ $dinero($p->subtotal) }}</dd>
                        <dt>Domicilio</dt><dd>{{ $dinero($p->costo_domicilio) }}</dd>
                        <dt class="fuerte">Total</dt><dd class="fuerte">{{ $dinero($p->total) }}</dd>
                    </dl>
                    <dl class="pedido-datos">
                        <dt>Pago</dt>
                        <dd>{{ $p->metodo_pago === 'transferencia' ? 'Transferencia' : 'Efectivo' }}
                            @if($p->metodo_pago === 'efectivo' && $p->paga_con)<span class="apagado"> · paga con {{ $dinero($p->paga_con) }} (cambio {{ $dinero(max(0, $p->paga_con - $p->total)) }})</span>@endif
                            @if($p->pago_estado)<span class="apagado"> · {{ ['por_pagar' => 'por pagar', 'informado' => 'el cliente avisó que pagó', 'confirmado' => 'pago confirmado', 'no_llego' => 'el pago no llegó'][$p->pago_estado] ?? $p->pago_estado }}</span>@endif
                        </dd>
                        @if($p->pago_cuenta)<dt>Cuenta</dt><dd>{{ $p->pago_cuenta['nombre'] ?? '' }} {{ $p->pago_cuenta['numero'] ?? '' }}</dd>@endif
                        @if($p->dinero_estado)<dt>Dinero al negocio</dt><dd>{{ ['recibido' => 'Recibido', 'incompleto' => 'Incompleto', 'no_recibido' => 'No recibido'][$p->dinero_estado] ?? $p->dinero_estado }}</dd>@endif
                        @if($p->reembolso_estado)<dt>Devolución</dt><dd>{{ ucfirst(str_replace('_', ' ', $p->reembolso_estado)) }}@if($p->reembolso_monto) · {{ $dinero($p->reembolso_monto) }}@endif</dd>@endif
                    </dl>
                </section>

                <div class="pedido-lado">
                    <section class="pedido-caja">
                        <h3>Cliente</h3>
                        <p class="pedido-persona">{{ $p->cliente?->name ?? 'Cliente' }}</p>
                        <dl class="pedido-datos">
                            @php $tel = $p->telefono_contacto ?: $p->cliente?->telefono; @endphp
                            <dt>Teléfono</dt><dd>@if($tel)<a class="enlace" href="tel:{{ $tel }}">{{ $tel }}</a>@else — @endif</dd>
                            <dt>Dirección</dt><dd>{{ $p->direccion_entrega ?: '—' }}</dd>
                            @if($p->entrega_indicaciones)<dt>Indicaciones</dt><dd>{{ $p->entrega_indicaciones }}</dd>@endif
                            @if($p->puntoEntrega())<dt>Mapa</dt><dd><a class="enlace" href="https://www.openstreetmap.org/?mlat={{ $p->entrega_lat }}&mlon={{ $p->entrega_lng }}#map=18/{{ $p->entrega_lat }}/{{ $p->entrega_lng }}" target="_blank" rel="noopener">Ver el punto de entrega</a></dd>@endif
                        </dl>
                    </section>
                    <section class="pedido-caja">
                        <h3>Domiciliario</h3>
                        @if($p->domiciliario)
                            <p class="pedido-persona">{{ $p->domiciliario->name }} {{ $p->domiciliario->apellidos }}</p>
                            <dl class="pedido-datos">
                                <dt>Teléfono</dt><dd>@if($p->domiciliario->telefono)<a class="enlace" href="tel:{{ $p->domiciliario->telefono }}">{{ $p->domiciliario->telefono }}</a>@else — @endif</dd>
                                @if($p->minutos_recogida)<dt>Prometió recoger en</dt><dd>{{ $p->minutos_recogida }} min</dd>@endif
                            </dl>
                        @else
                            <p class="apagado">{{ $p->estado === 'cancelado' ? 'No llegó a tener domiciliario.' : 'Todavía no hay domiciliario asignado.' }}</p>
                        @endif
                    </section>
                </div>
            </div>

            <section class="pedido-caja">
                <h3>Tiempos</h3>
                @if($resumen)
                    <div class="pedido-resumen">
                        @foreach($resumen as $etiqueta => $valor)
                            <div><span>{{ $etiqueta }}</span><strong>{{ $valor }}</strong></div>
                        @endforeach
                    </div>
                @endif
                <ol class="pedido-linea-tiempo">
                    @foreach($tiempos as $k => [$etiqueta, $momento])
                        <li @class(['final-cancelado' => $etiqueta === 'Cancelado'])>
                            <span class="pedido-punto" aria-hidden="true"></span>
                            <span class="pedido-evento">{{ $etiqueta }}</span>
                            <span class="pedido-momento">{{ $momento->format('g:i a') }}@if(! $momento->isSameDay($p->created_at)) <small>{{ $momento->format('d/m') }}</small>@endif</span>
                            @if($k > 0)<span class="pedido-desde">+{{ $duracion($tiempos[$k - 1][1], $momento) }}</span>@endif
                        </li>
                    @endforeach
                </ol>
            </section>

            @if($c)
                <section class="pedido-caja">
                    <h3>Calificación del cliente</h3>
                    <dl class="pedido-datos">
                        @if($c->negocio_ok !== null)<dt>Negocio</dt><dd>{{ $c->negocio_ok ? '👍 Bien' : '👎 Con problemas' }}@if($c->negocio_problemas)<span class="apagado"> · {{ implode(', ', (array) $c->negocio_problemas) }}</span>@endif</dd>@endif
                        @if($c->domiciliario_ok !== null)<dt>Domiciliario</dt><dd>{{ $c->domiciliario_ok ? '👍 Bien' : '👎 Con problemas' }}@if($c->domiciliario_problemas)<span class="apagado"> · {{ implode(', ', (array) $c->domiciliario_problemas) }}</span>@endif</dd>@endif
                        @if($c->comentario)<dt>Comentario</dt><dd>{{ $c->comentario }}</dd>@endif
                    </dl>
                </section>
            @endif
        </div>
    </dialog>
@endforeach
</div>
@endsection

@push('pie')
<script src="{{ asset('panel-catalogo.js') }}?v={{ filemtime(public_path('panel-catalogo.js')) }}"></script>
<script>
    // Al elegir un día en el calendario se filtra de una vez.
    document.querySelectorAll('[data-calendario]').forEach((input) => {
        input.addEventListener('change', () => input.form.submit());
        input.closest('label').addEventListener('click', (e) => {
            if (e.target !== input && typeof input.showPicker === 'function') { e.preventDefault(); try { input.showPicker(); } catch (_) { input.focus(); } }
        });
    });
</script>
@endpush
