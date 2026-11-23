<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use Illuminate\Contracts\View\View;

/**
 * Sitio público de Vitrina: qué es la app, cómo funciona, los planes de los
 * negocios y la entrada al apartado de pagos de la membresía. Por ahora los
 * botones de pago y de acceso no hacen nada: solo es la vitrina del sitio.
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
}
