<?php

test('la raíz redirige a quien no ha iniciado sesión', function () {
    // '/' manda al "home" por rol; sin sesión, ese flujo termina en /login.
    $this->get('/')->assertRedirect();
});
