<?php
// Exporta el sitio público de Vitrina (backend Laravel) a HTML estático para GitHub Pages
// (repositorio ZapataMor/vitrina, https://zapatamor.github.io/vitrina).
// Uso, desde backend/: php ../scripts/exportar-sitio-estatico.php "$(pwd -W)" C:/dev/vitrina-sitio https://zapatamor.github.io/vitrina
// Luego, en C:/dev/vitrina-sitio: git add -A && git commit -m "..." && git push

[$_, $backend, $salida, $base] = $argv;
$base = rtrim($base, '/');
$falso = 'https://exportar.local';

require $backend.'/vendor/autoload.php';
$app = require $backend.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

config([
    'app.url' => $falso,
    'app.env' => 'production',
    'app.debug' => false,
    'vitrina.responsable' => 'Luis Felipe Zapata Pérez',
    'vitrina.documento' => 'C.C. 1121527872',
    'vitrina.correo_contacto' => 'vitrinacomercioapp@gmail.com',
    'vitrina.ciudad' => 'Maicao, La Guajira, Colombia',
    'vitrina.direccion' => '',
    'vitrina.telefono' => '313 632 3644',
]);
Illuminate\Support\Facades\URL::forceRootUrl($falso);
Illuminate\Support\Facades\URL::forceScheme('https');

$paginas = [
    '/' => 'index.html',
    '/como-funciona' => 'como-funciona.html',
    '/planes' => 'planes.html',
    '/preguntas-frecuentes' => 'preguntas-frecuentes.html',
    '/contacto' => 'contacto.html',
    '/privacidad' => 'privacidad.html',
    '/aviso-de-privacidad' => 'aviso-de-privacidad.html',
    '/terminos' => 'terminos.html',
    '/condiciones-de-membresia' => 'condiciones-de-membresia.html',
    '/cookies' => 'cookies.html',
    '/cancelaciones' => 'cancelaciones.html',
    '/eliminar-cuenta' => 'eliminar-cuenta.html',
    '/sitemap.xml' => 'sitemap.xml',
];

@mkdir($salida, 0777, true);
foreach ($paginas as $ruta => $archivo) {
    $req = Illuminate\Http\Request::create($falso.$ruta, 'GET');
    $res = $kernel->handle($req);
    if ($res->getStatusCode() !== 200) {
        fwrite(STDERR, "ERROR {$ruta}: {$res->getStatusCode()}\n");
        exit(1);
    }
    $html = $res->getContent();
    $kernel->terminate($req, $res);

    // Sin servidor: el acceso a la cuenta y el pago de membresías van a Contacto.
    $html = preg_replace('#<a href="'.preg_quote($falso, '#').'/cuenta/entrar" class="boton boton-claro boton-chico">.*?</a>#s', '', $html);
    $html = str_replace($falso.'/cuenta/entrar', $falso.'/contacto', $html);
    $html = str_replace('>Pagar mi membresía<', '>Pagar mi membresía (escríbenos)<', $html);
    $html = preg_replace('#En esta web, en «Iniciar sesión», con la misma cuenta del negocio en la app\.#u',
        'Escríbenos a vitrinacomercioapp@gmail.com o al 313 632 3644 y te indicamos cómo pagarla.', $html);

    // Eliminar cuenta: el formulario necesita servidor; se cambia por instrucciones.
    if ($ruta === '/eliminar-cuenta') {
        $html = preg_replace('#<div class="caja-doc">.*?</form>\s*</div>#s',
            '<div class="caja-doc"><p><strong>Sin la app:</strong> escríbenos a '
            .'<a href="mailto:vitrinacomercioapp@gmail.com?subject=Eliminar%20mi%20cuenta">vitrinacomercioapp@gmail.com</a> '
            .'con el asunto <em>Eliminar mi cuenta</em>, desde el correo de tu cuenta o indicando el celular con el que te registraste. '
            .'La eliminamos en máximo 15 días hábiles y te confirmamos por el mismo medio.</p></div>', $html, 1, $n);
        if ($n !== 1) { fwrite(STDERR, "No encontré el formulario de eliminar cuenta\n"); exit(1); }
    }
    // Quitar el token CSRF y metadatos de sesión que no sirven en un sitio estático.
    $html = preg_replace('#<meta name="csrf-token"[^>]*>\s*#', '', $html);

    // Enlaces a páginas: rutas sin extensión (GitHub Pages sirve privacidad.html en /privacidad).
    $html = str_replace($falso, $base, $html);
    file_put_contents($salida.'/'.$archivo, $html);
    echo "ok {$ruta}\n";
}

// Archivos estáticos que usan las páginas.
foreach (['brand.css', 'sitio.css', 'web-theme.js', 'favicon.ico', 'images/vitrina-mark.svg', 'fonts/Inter-Regular.ttf', 'fonts/Sora_700Bold.ttf'] as $f) {
    @mkdir(dirname($salida.'/'.$f), 0777, true);
    copy($backend.'/public/'.$f, $salida.'/'.$f);
}
file_put_contents($salida.'/.nojekyll', '');
file_put_contents($salida.'/robots.txt', "User-agent: *\nAllow: /\nSitemap: {$base}/sitemap.xml\n");
echo "listo\n";
