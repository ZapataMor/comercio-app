<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Contracts\View\View;

/**
 * Punto de entrada tras el login: manda a cada usuario a la zona de su rol.
 */
class HomeController extends Controller
{
    public function index(Request $request): RedirectResponse|View
    {
        $user = $request->user();

        return match (true) {
            $user->hasRole('comerciante') => redirect()->route('panel'),
            $user->hasRole('usuario') => redirect()->route('explorar'),
            $user->hasRole('administrador') => redirect()->route('admin.panel'),
            // Domiciliario: su vista se construirá después.
            default => view('home.proximamente', [
                'rol' => $user->getRoleNames()->first() ?? 'sin rol',
            ]),
        };
    }
}
