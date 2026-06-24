{{-- Línea de tiempo (vertical) del estado de un pedido. Recibe $pedido. --}}
@php
    $estados = \App\Models\Pedido::ESTADOS;
    $labels = \App\Models\Pedido::ESTADO_LABEL;
    $actual = $pedido->estadoIndex();
@endphp
<ol class="relative border-l-2 border-slate-200 ml-2">
    @foreach ($estados as $i => $estado)
        <li class="ml-5 pb-4 last:pb-0">
            <span class="absolute -left-[11px] flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold
                {{ $i < $actual ? 'bg-indigo-600 text-white' : ($i === $actual ? 'bg-indigo-600 text-white ring-4 ring-indigo-100' : 'bg-slate-200 text-slate-400') }}">
                {{ $i < $actual ? '✓' : '' }}
            </span>
            <p class="text-sm {{ $i <= $actual ? 'font-semibold text-slate-800' : 'text-slate-400' }}">
                {{ $labels[$estado] }}
                @if ($i === $actual)
                    <span class="text-indigo-600 text-xs">● actual</span>
                @endif
            </p>
        </li>
    @endforeach
</ol>
