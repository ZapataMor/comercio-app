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
    {{-- Calendario propio (el del navegador cambia en cada uno y a veces no abre). --}}
    <div class="calendario-envoltura" data-calendario
         data-dias='@json($diasConPedidos)' data-hoy="{{ now()->format('Y-m-d') }}" data-elegido="{{ $dia?->format('Y-m-d') }}">
        <input type="hidden" name="dia" value="{{ $dia?->format('Y-m-d') }}">
        <button type="button" @class(['boton-calendario', 'activo' => $dia]) aria-haspopup="dialog" aria-expanded="false" data-calendario-boton>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="16.5" rx="3"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/></svg>
            <span>{{ $dia ? $dia->copy()->locale('es')->translatedFormat('j M Y') : 'Elegir día' }}</span>
        </button>
        <div class="calendario" role="dialog" aria-label="Elegir un día" hidden data-calendario-panel>
            <div class="calendario-cabeza">
                <button type="button" class="calendario-flecha" data-mes="-1" aria-label="Mes anterior">‹</button>
                <strong data-calendario-titulo></strong>
                <button type="button" class="calendario-flecha" data-mes="1" aria-label="Mes siguiente">›</button>
            </div>
            <div class="calendario-semana" aria-hidden="true"><span>L</span><span>M</span><span>M</span><span>J</span><span>V</span><span>S</span><span>D</span></div>
            <div class="calendario-dias" data-calendario-dias></div>
            <div class="calendario-pie">
                <button type="button" class="enlace-boton" data-calendario-hoy>Hoy</button>
                @if($dia)<button type="button" class="enlace-boton" data-calendario-quitar>Todos los días</button>@endif
            </div>
            <p class="calendario-ayuda"><span class="calendario-marca" aria-hidden="true"></span> Días con pedidos</p>
        </div>
    </div>
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
                                @foreach($asignados->get($p->id, collect()) as $t)<span class="pedido-domi" title="Asignado a">👤 {{ $t->trabajador?->name }}</span>@endforeach
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
                    @php $tareasPedido = $asignados->get($p->id, collect()); @endphp
                    @if($tareasPedido->isNotEmpty())
                        <section class="pedido-caja">
                            <h3>Asignado a</h3>
                            <dl class="pedido-datos">
                                @foreach($tareasPedido as $t)
                                    <dt>{{ $t->trabajador?->name ?? 'Trabajador' }}</dt><dd>{{ $t->estadoTexto() }}@if($t->titulo !== 'Atender el pedido '.$p->codigo)<span class="apagado"> · {{ $t->titulo }}</span>@endif</dd>
                                @endforeach
                            </dl>
                        </section>
                    @endif
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
    // Calendario para ver un día: se mueve por meses, marca los días con
    // pedidos y al tocar un día filtra de una vez. Los días futuros no se eligen.
    document.querySelectorAll('[data-calendario]').forEach((caja) => {
        const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
        const boton = caja.querySelector('[data-calendario-boton]');
        const panel = caja.querySelector('[data-calendario-panel]');
        const rejilla = caja.querySelector('[data-calendario-dias]');
        const input = caja.querySelector('input[name=dia]');
        const dias = JSON.parse(caja.dataset.dias || '{}');
        const hoy = caja.dataset.hoy;
        const elegido = caja.dataset.elegido;
        const base = (elegido || hoy).split('-').map(Number);
        let anio = base[0], mes = base[1] - 1;
        const dos = (n) => String(n).padStart(2, '0');

        const pintar = () => {
            caja.querySelector('[data-calendario-titulo]').textContent = MESES[mes][0].toUpperCase() + MESES[mes].slice(1) + ' ' + anio;
            const primero = (new Date(anio, mes, 1).getDay() + 6) % 7; // lunes = 0
            const total = new Date(anio, mes + 1, 0).getDate();
            const celdas = [];
            for (let i = 0; i < primero; i++) celdas.push('<span></span>');
            for (let d = 1; d <= total; d++) {
                const f = anio + '-' + dos(mes + 1) + '-' + dos(d);
                const n = dias[f] || 0;
                const clases = ['calendario-dia', f === hoy ? 'hoy' : '', f === elegido ? 'elegido' : '', n ? 'con-pedidos' : ''].join(' ');
                const etiqueta = d + ' de ' + MESES[mes] + (n ? ', ' + n + (n === 1 ? ' pedido' : ' pedidos') : '');
                celdas.push('<button type="button" class="' + clases + '" data-fecha="' + f + '" aria-label="' + etiqueta + '"'
                    + (f > hoy ? ' disabled' : '') + (f === elegido ? ' aria-current="date"' : '') + '>' + d + '</button>');
            }
            rejilla.innerHTML = celdas.join('');
            const [ha, hm] = hoy.split('-').map(Number);
            caja.querySelector('[data-mes="1"]').disabled = anio > ha || (anio === ha && mes >= hm - 1);
        };
        const abrir = () => {
            pintar();
            panel.hidden = false;
            // Que no se salga de la pantalla (en celular el botón queda a la derecha).
            panel.style.left = '0px';
            const r = panel.getBoundingClientRect();
            const sobra = r.right - (document.documentElement.clientWidth - 16);
            if (sobra > 0) panel.style.left = Math.max(-sobra, 16 - r.left) + 'px';
            boton.setAttribute('aria-expanded', 'true');
            (rejilla.querySelector('.elegido') || rejilla.querySelector('.hoy') || rejilla.querySelector('button:not([disabled])'))?.focus();
        };
        const cerrar = (devolverFoco) => {
            panel.hidden = true;
            boton.setAttribute('aria-expanded', 'false');
            if (devolverFoco) boton.focus();
        };
        const elegir = (fecha) => { input.value = fecha; input.form.submit(); };

        boton.addEventListener('click', () => (panel.hidden ? abrir() : cerrar(false)));
        panel.addEventListener('click', (e) => {
            const flecha = e.target.closest('[data-mes]');
            if (flecha) {
                mes += Number(flecha.dataset.mes);
                if (mes < 0) { mes = 11; anio--; }
                if (mes > 11) { mes = 0; anio++; }
                pintar();
                return;
            }
            const dia = e.target.closest('[data-fecha]');
            if (dia && !dia.disabled) { elegir(dia.dataset.fecha); return; }
            if (e.target.closest('[data-calendario-hoy]')) { elegir(hoy); return; }
            if (e.target.closest('[data-calendario-quitar]')) { elegir(''); }
        });
        // Flechas del teclado para moverse entre días.
        rejilla.addEventListener('keydown', (e) => {
            const salto = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
            if (!salto || !e.target.dataset.fecha) return;
            e.preventDefault();
            const botones = [...rejilla.querySelectorAll('[data-fecha]')];
            const destino = botones[botones.indexOf(e.target) + salto];
            if (destino && !destino.disabled) destino.focus();
        });
        document.addEventListener('click', (e) => { if (!panel.hidden && !caja.contains(e.target)) cerrar(false); });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) cerrar(true); });
    });
</script>
@endpush
