{{-- Días y horas de trabajo. $horario: lo guardado (Horario::leer) o null. --}}
@php
    use App\Gestion\Horario;
    $horas = Horario::horas();
@endphp
<div class="horario" data-horario>
    <div class="horario-atajos" role="group" aria-label="Atajos de días">
        @foreach(Horario::ATAJOS as $texto => $dias)
            <button type="button" class="horario-atajo" data-atajo="{{ implode(',', $dias) }}">{{ $texto }}</button>
        @endforeach
        <button type="button" class="horario-atajo" data-atajo="">Ninguno</button>
    </div>
    <ul class="horario-dias">
        @foreach(Horario::DIAS as $d => $nombre)
            @php
                $marcado = isset($horario[$d]);
                $entrada = $horario[$d]['entrada'] ?? null;
                $salida = $horario[$d]['salida'] ?? null;
            @endphp
            <li @class(['horario-dia', 'activo' => $marcado]) data-dia>
                <label class="chip-casilla horario-nombre">
                    <input type="checkbox" name="dias[]" value="{{ $d }}" @checked($marcado) data-dia-casilla>
                    <span>{{ $nombre }}</span>
                </label>
                <span class="horario-horas">
                    <select name="entrada[{{ $d }}]" aria-label="Hora de entrada del {{ mb_strtolower($nombre) }}" @disabled(! $marcado)>
                        <option value="">Entrada</option>
                        @foreach($horas as $valor => $texto)<option value="{{ $valor }}" @selected($entrada === $valor)>{{ $texto }}</option>@endforeach
                    </select>
                    <span class="apagado">a</span>
                    <select name="salida[{{ $d }}]" aria-label="Hora de salida del {{ mb_strtolower($nombre) }}" @disabled(! $marcado)>
                        <option value="">Salida</option>
                        @foreach($horas as $valor => $texto)<option value="{{ $valor }}" @selected($salida === $valor)>{{ $texto }}</option>@endforeach
                    </select>
                </span>
                <span class="horario-descansa apagado">Descansa</span>
            </li>
        @endforeach
    </ul>
    <button type="button" class="enlace-boton" data-copiar-horario>Poner la hora del primer día marcado en todos los demás</button>
</div>
