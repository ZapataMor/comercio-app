<?php

/**
 * Datos de la marca que aparecen en las páginas públicas (política de
 * privacidad, eliminar cuenta) y en los correos. Se llenan en el .env del
 * servidor ANTES de publicar la app.
 */
return [
    // Persona o empresa responsable del tratamiento de datos (Ley 1581 de 2012).
    'responsable' => env('VITRINA_RESPONSABLE', 'Vitrina'),

    // Correo donde la gente ejerce sus derechos (consultas, reclamos, borrado).
    'correo_contacto' => env('VITRINA_CORREO_CONTACTO', 'soporte@vitrina.example'),

    'ciudad' => env('VITRINA_CIUDAD', 'Maicao, La Guajira, Colombia'),
];
