@extends('layouts.documento')

@section('titulo', 'Política de cookies')
@section('descripcion', 'Qué cookies usa el sitio de Vitrina y para qué.')
@section('encabezado', 'Política de cookies')
@section('vigencia', 'Vigente desde el 23 de noviembre de 2026.')

@section('documento')
<p>
    Las cookies son pequeños archivos que un sitio guarda en tu navegador. Este sitio usa <strong>solo las cookies
    necesarias</strong> para funcionar y protegerte. No usamos cookies de publicidad, de redes sociales ni de
    analítica de terceros, por eso no te pedimos que las aceptes.
</p>

<h2>Cookies que usamos</h2>
<table class="doc-tabla">
    <thead>
        <tr><th>Nombre</th><th>Para qué sirve</th><th>Duración</th></tr>
    </thead>
    <tbody>
        <tr><td><code>{{ config('session.cookie') }}</code></td><td>Mantener tu sesión abierta mientras navegas, por ejemplo al iniciar sesión o al enviar un formulario.</td><td>{{ config('session.lifetime') }} minutos sin actividad</td></tr>
        <tr><td><code>XSRF-TOKEN</code></td><td>Proteger los formularios para que nadie los envíe en tu nombre desde otro sitio.</td><td>La misma de la sesión</td></tr>
        <tr><td><code>remember_web_…</code></td><td>Solo en el panel de administración, si el administrador pide que lo recuerden.</td><td>Hasta que cierre sesión</td></tr>
    </tbody>
</table>

<h2>La app</h2>
<p>
    La app de Vitrina no usa cookies: guarda en tu teléfono la sesión y tus preferencias para que no tengas que
    entrar cada vez. Lo que recoge la app está en la <a href="{{ route('privacidad') }}">política de privacidad</a>.
</p>

<h2>Cómo borrarlas</h2>
<p>
    Puedes borrar o bloquear las cookies desde la configuración de tu navegador. Si bloqueas las de este sitio,
    no podrás iniciar sesión ni enviar formularios, como el de eliminar tu cuenta.
</p>

<h2>Cambios</h2>
<p>Si algún día usamos otras cookies, actualizaremos esta página y, si no son necesarias, te pediremos permiso antes de usarlas.</p>
@endsection
