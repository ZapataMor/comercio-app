<?php

/**
 * Datos de la marca que aparecen en las páginas públicas (política de
 * privacidad, eliminar cuenta) y en los correos. Se llenan en el .env del
 * servidor ANTES de publicar la app.
 */
return [
    // Persona o empresa responsable del tratamiento de datos (Ley 1581 de 2012).
    'responsable' => env('VITRINA_RESPONSABLE', 'Vitrina'),

    // Cédula o NIT del responsable, como aparece en su RUT. La Ley 1480 de
    // 2011 (art. 50) pide identificar a quien vende por internet (aquí, las
    // membresías). Vacío, las páginas no muestran esa línea.
    'documento' => env('VITRINA_DOCUMENTO', ''),

    // Correo donde la gente ejerce sus derechos (consultas, reclamos, borrado).
    'correo_contacto' => env('VITRINA_CORREO_CONTACTO', 'soporte@vitrina.example'),

    'ciudad' => env('VITRINA_CIUDAD', 'Maicao, La Guajira, Colombia'),

    // Dirección y teléfono del responsable. El Decreto 1377 de 2013 (art. 13)
    // exige que la política de privacidad los muestre: llenarlos en producción.
    // Vacíos, la política no muestra esas líneas.
    'direccion' => env('VITRINA_DIRECCION', ''),
    'telefono' => env('VITRINA_TELEFONO', ''),

    // Fotos de referencia (frente y calle a cada lado) al guardar una dirección
    // de entrega. Opcionales mientras se prueba; en producción poner true y
    // cambiar también FOTOS_OBLIGATORIAS en frontend/src/components/FotosDireccion.tsx.
    'fotos_entrega_obligatorias' => (bool) env('FOTOS_ENTREGA_OBLIGATORIAS', false),
];
