<?php

/*
|--------------------------------------------------------------------------
| Nivel de confiabilidad (reputación) de negocios y domiciliarios
|--------------------------------------------------------------------------
|
| El puntaje va de 0 a 100. Cada pedido suma o resta puntos según cómo le
| fue (ver App\Support\Reputacion::MOTIVOS). Estos son los umbrales.
|
*/

return [

    // Puntaje con el que arranca un negocio o domiciliario nuevo.
    'inicial' => 80,

    // Por debajo de esto se muestra "En riesgo" (aviso, sin castigo).
    'umbral_riesgo' => 50,

    // Por debajo de esto queda VETADO: el domiciliario no puede tomar
    // pedidos y el negocio deja de aparecer y de recibir pedidos.
    'umbral_veto' => 30,

    // Faltas graves (robo, no entregar el dinero) que vetan de una vez
    // aunque el puntaje siga alto, si ocurren dentro de esta ventana.
    'graves_para_veto' => 2,
    'dias_graves' => 30,

    // ¿Los negocios también se vetan solos? Si es false, solo bajan de nivel.
    'vetar_negocios' => true,

    // Con menos pedidos evaluados que esto, el nivel se muestra como "Nuevo".
    'pedidos_para_nivel' => 5,

    // Margen antes de contar una demora: el mayor entre estos minutos y este
    // porcentaje del tiempo prometido (20 min prometidos → 5 min de margen).
    'tolerancia_minutos' => 5,
    'tolerancia_porcentaje' => 20,

    // Horas que tiene el cliente para calificar después de la entrega.
    'horas_para_calificar' => 72,

    // Horas que tiene el negocio para decir si recibió el dinero (efectivo),
    // contadas desde que el domiciliario recogió el pedido.
    'horas_para_confirmar_dinero' => 72,

];
