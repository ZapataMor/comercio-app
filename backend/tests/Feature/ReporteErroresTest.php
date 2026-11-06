<?php

use Sentry\Options;

/**
 * El reporte de errores sale del servidor: lo que importa probar es que no se
 * lleve datos de las personas. Si esto falla, revisa también la política de
 * privacidad antes de cambiarlo.
 */
test('el reporte de errores no envía datos personales ni el cuerpo de las peticiones', function () {
    expect(config('sentry.send_default_pii'))->toBeFalse()
        ->and(config('sentry.max_request_body_size'))->toBe('never')
        ->and(config('sentry.breadcrumbs.sql_bindings'))->toBeFalse()
        ->and(config('sentry.tracing.sql_bindings'))->toBeFalse();
});

test('la opción que oculta el cuerpo de las peticiones llega al cliente de Sentry', function () {
    expect((new Options(['max_request_body_size' => config('sentry.max_request_body_size')]))->getMaxRequestBodySize())
        ->toBe('never');
});
