@if($rutaFoto)
    @php $urlFoto = asset('storage/'.ltrim(preg_replace('#^/?storage/#', '', $rutaFoto), '/')); @endphp
    <a class="foto-enlace {{ $claseFoto }}" href="{{ $urlFoto }}" target="_blank" rel="noopener noreferrer" aria-label="Ampliar imagen: {{ $textoFoto }}">
        <img src="{{ $urlFoto }}" alt="{{ $textoFoto }}" loading="lazy" data-foto-negocio>
    </a>
@else
    <div class="foto-vacia {{ $claseFoto }}" role="img" aria-label="Sin imagen de {{ $textoFoto }}">Sin imagen registrada</div>
@endif
