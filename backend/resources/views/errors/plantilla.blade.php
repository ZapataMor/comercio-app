{{-- Páginas de error con el diseño del sitio público. --}}
@extends('layouts.sitio')

@section('contenido')
<section class="error-pagina">
    <div class="error-codigo">@yield('codigo')</div>
    <h1>@yield('titulo')</h1>
    <p>@yield('mensaje')</p>
    <div class="acciones">
        <a href="{{ route('sitio.inicio') }}" class="boton boton-oscuro">Ir al inicio</a>
        <a href="{{ route('sitio.contacto') }}" class="boton boton-claro">Contacto</a>
    </div>
</section>
@endsection
