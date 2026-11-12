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
        'token' => env('WHATSAPP_TOKEN'),
        'phone_number_id' => env('WHATSAPP_PHONE_NUMBER_ID'),
        'plantilla' => env('WHATSAPP_PLANTILLA_CODIGO', 'codigo_vitrina'),
        'idioma' => env('WHATSAPP_PLANTILLA_IDIOMA', 'es'),
        'version' => env('WHATSAPP_API_VERSION', 'v23.0'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

];
