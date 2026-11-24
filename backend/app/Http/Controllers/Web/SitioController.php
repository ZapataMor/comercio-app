<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use Illuminate\Contracts\View\View;
use Illuminate\Http\Response;

/**
 * Sitio público de Vitrina: qué es la app, cómo funciona, los planes de los
 * negocios, preguntas frecuentes, contacto y la entrada al apartado de pagos
 * de la membresía. Por ahora los botones de pago y de acceso no hacen nada.
 * También sirve robots.txt, sitemap.xml y security.txt.
 */
class SitioController extends Controller
{
    public function inicio(): View
    {
        return view('sitio.inicio');
    }

    public function comoFunciona(): View
    {
        return view('sitio.como-funciona');
    }

    public function planes(): View
    {
        return view('sitio.planes');
    }

    public function entrar(): View
    {
        return view('sitio.entrar');
    }

    public function preguntas(): View
    {
        return view('sitio.preguntas');
    }

    /** Datos del responsable y canales para peticiones, quejas y reclamos. */
    public function contacto(): View
    {
        return view('sitio.contacto');
    }

    /** Páginas que se ofrecen a los buscadores (sitemap.xml). */
    public const PAGINAS = [
        'sitio.inicio', 'sitio.como-funciona', 'sitio.planes', 'sitio.preguntas', 'sitio.contacto',
        'privacidad', 'aviso-privacidad', 'terminos', 'membresia', 'cookies', 'cancelaciones', 'eliminar-cuenta',
    ];

    public function robots(): Response
    {
        $texto = implode("\n", [
            'User-agent: *',
            'Disallow: /admin',
            'Disallow: /login',
            'Disallow: /cuenta/',
            '',
            'Sitemap: '.url('/sitemap.xml'),
        ])."\n";

        return response($texto)->header('Content-Type', 'text/plain; charset=UTF-8');
    }

    public function sitemap(): Response
    {
        return response()->view('sitio.sitemap', ['paginas' => self::PAGINAS])
            ->header('Content-Type', 'application/xml; charset=UTF-8');
    }

    /** RFC 9116: a dónde escribir si alguien encuentra una falla de seguridad. */
    public function seguridad(): Response
    {
        $texto = implode("\n", [
            'Contact: mailto:'.config('vitrina.correo_contacto'),
            'Expires: '.now()->addYear()->startOfDay()->toIso8601ZuluString(),
            'Preferred-Languages: es',
            'Policy: '.route('sitio.contacto').'#seguridad',
            'Canonical: '.url('/.well-known/security.txt'),
        ])."\n";

        return response($texto)->header('Content-Type', 'text/plain; charset=UTF-8');
    }
}
