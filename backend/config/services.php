<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    // Códigos por WhatsApp (registro, acceso y recuperación con el celular).
    // driver: 'log' mientras no haya cuenta de Meta (el código va al log);
    // 'cloud' para enviarlos de verdad con WhatsApp Cloud API.
    // Guía: Vitrina/00 - Inicio/Configurar WhatsApp Cloud API.md
    'whatsapp' => [
        'driver' => env('WHATSAPP_DRIVER', 'log'),
        // Servidor de pruebas sin WhatsApp: con el canal `log`, la app muestra
        // el código en pantalla (en local siempre). Nunca en uno de verdad.
        'codigo_en_pantalla' => (bool) env('WHATSAPP_CODIGO_EN_PANTALLA', false),
        'token' => env('WHATSAPP_TOKEN'),
        'phone_number_id' => env('WHATSAPP_PHONE_NUMBER_ID'),
        'plantilla' => env('WHATSAPP_PLANTILLA_CODIGO', 'codigo_vitrina'),
        'idioma' => env('WHATSAPP_PLANTILLA_IDIOMA', 'es'),
        'version' => env('WHATSAPP_API_VERSION', 'v23.0'),
    ],

    // Rutas por calles dentro de la app («Cómo llegar»), con OSRM sobre
    // OpenStreetMap. Cada modo es la dirección base hasta el perfil (sin las
    // coordenadas). Los servidores públicos de prueba no piden clave, pero
    // aceptan pocas peticiones y no garantizan nada: para el piloto, un OSRM
    // propio (ej. http://127.0.0.1:5000/route/v1/driving con el mapa de La Guajira).
    'rutas' => [
        'moto' => env('RUTAS_URL_MOTO', 'https://router.project-osrm.org/route/v1/driving'),
        'pie' => env('RUTAS_URL_PIE', 'https://routing.openstreetmap.de/routed-foot/route/v1/foot'),
        'timeout' => (int) env('RUTAS_TIMEOUT', 8),
    ],

    // Entrar con Google. Los «ID de cliente» de OAuth (Google Cloud →
    // Credenciales) que la app usa para pedir el token, separados por coma:
    // el del tipo «Aplicación web» es el que va en la app (GOOGLE_WEB_CLIENT_ID
    // de frontend/src/config.ts). Vacío = entrar con Google desactivado.
    // Guía: Vitrina/00 - Inicio/Configurar acceso con Google.md
    'google' => [
        'client_ids' => array_values(array_filter(array_map('trim', explode(',', (string) env('GOOGLE_CLIENT_IDS', ''))))),
        // Botón «Entrar con Google» del login web: el mismo cliente «Aplicación
        // web». En Google Cloud debe tener como orígenes de JavaScript autorizados
        // el dominio del servidor (y http://localhost:8000 para desarrollo).
        'web_client_id' => env('GOOGLE_WEB_CLIENT_ID', '801366967290-eoe61014gikuhileb0a4rq7pnsgv9217.apps.googleusercontent.com'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

];
