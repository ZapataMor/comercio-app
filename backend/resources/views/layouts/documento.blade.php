{{--
    Páginas legales y de texto largo del sitio. Cada página puede definir
    $indice (['ancla' => 'Título']) antes de sus secciones para mostrar el
    índice lateral.
--}}
@extends('layouts.sitio')

@section('contenido')
<section class="portada doc-portada">
    <div class="sitio-ancho portada-sola">
        <span class="etiqueta">@yield('etiqueta', 'Legal')</span>
        <h1>@yield('encabezado')</h1>
        @hasSection('vigencia')
            <p class="doc-vigencia">@yield('vigencia')</p>
        @endif
    </div>
</section>

<div @class(['sitio-ancho', 'doc-cuerpo', 'sin-indice' => empty($indice)])>
    @if (! empty($indice))
        <nav class="doc-indice" aria-label="En esta página">
            <h2>En esta página</h2>
            @foreach ($indice as $ancla => $titulo)
                <a href="#{{ $ancla }}">{{ $titulo }}</a>
            @endforeach
        </nav>
    @endif

    <article class="doc">
        @yield('documento')

        <p class="doc-otras">
            Más información:
            <a href="{{ route('terminos') }}">términos y condiciones</a> ·
            <a href="{{ route('privacidad') }}">política de privacidad</a> ·
            <a href="{{ route('cancelaciones') }}">cancelaciones y devoluciones</a> ·
            <a href="{{ route('sitio.contacto') }}">contacto y PQR</a>.
        </p>
    </article>
</div>
@endsection
