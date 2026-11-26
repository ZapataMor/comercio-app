<?php

namespace App\Gestion;

/**
 * Catálogo de módulos de Vitrina Gestión (ADR-005).
 *
 * Los módulos viven en el código porque cada uno es una parte del programa;
 * la base de datos solo guarda cuáles tiene encendidos cada negocio
 * (tabla negocio_modulos). El NÚCLEO viene con el panel web y no se apaga.
 *
 * Cada módulo dice:
 * - grupo, nombre y descripción (lo que ve el super administrador),
 * - depende_de: módulos que se encienden con él y no se pueden apagar antes,
 * - permisos: los que se le dan a cada miembro (el dueño y el administrador
 *   del negocio los tienen todos),
 * - secciones: lo que tendrá en la web,
 * - en_app: la parte que también irá en la app (regla del ADR-005),
 * - estado: 'disponible' si ya funciona, 'en_construccion' si solo está la estructura.
 */
final class Modulos
{
    public const GRUPOS = [
        'nucleo' => 'Núcleo',
        'ventas' => 'Ventas',
        'operacion' => 'Operación',
        'personal' => 'Personal',
        'finanzas' => 'Finanzas',
    ];

    /** @return array<string, array<string, mixed>> */
    public static function todos(): array
    {
        return [
            // ---------------------------------------------------------- Núcleo
            'inicio' => [
                'grupo' => 'nucleo', 'nombre' => 'Inicio',
                'descripcion' => 'Resumen del negocio: sedes, equipo, pedidos y módulos activos.',
                'depende_de' => [], 'permisos' => [],
                'secciones' => ['Resumen del día', 'Pendientes', 'Alertas'],
                'en_app' => ['Resumen del día para el dueño'],
                'estado' => 'disponible',
            ],
            'tienda' => [
                'grupo' => 'nucleo', 'nombre' => 'Mi tienda',
                'descripcion' => 'Datos del negocio, horario y cuentas para transferencias.',
                'depende_de' => [], 'permisos' => [],
                'secciones' => ['Datos y ubicación', 'Horario automático', 'Cuentas para transferencias'],
                'en_app' => ['Abrir y cerrar', 'Horario', 'Cuentas (ya existe)'],
                'estado' => 'disponible',
            ],
            'catalogo' => [
                'grupo' => 'nucleo', 'nombre' => 'Catálogo',
                'descripcion' => 'Productos y servicios que se muestran en Vitrina, con la ficha técnica de la plantilla.',
                'depende_de' => [], 'permisos' => [],
                'secciones' => ['Productos', 'Servicios', 'Ficha técnica', 'Importar de Excel', 'Guía «Antes de pedir»', 'Galería de trabajos'],
                'en_app' => ['Crear o editar con foto', 'Marcar agotado (ya existe)'],
                'estado' => 'disponible',
            ],
            'pedidos' => [
                'grupo' => 'nucleo', 'nombre' => 'Pedidos',
                'descripcion' => 'Pedidos que llegan por Vitrina.',
                'depende_de' => [], 'permisos' => [],
                'secciones' => ['En curso', 'Historial', 'Exportar'],
                'en_app' => ['Atender con alarma, aceptar y cambiar estado (ya existe)'],
                'estado' => 'disponible',
            ],
            // La clave sigue siendo «equipo»; en la web se llama Trabajadores.
            'equipo' => [
                'grupo' => 'nucleo', 'nombre' => 'Trabajadores',
                'descripcion' => 'Personas del negocio: se asocian con su código, con su sede, días de trabajo, permisos y tareas.',
                'depende_de' => [],
                'permisos' => ['equipo.tareas' => 'Asignar tareas y pedidos a los trabajadores'],
                'secciones' => ['Trabajadores', 'Asociar con el código', 'Sede y días de trabajo', 'Permisos', 'Tareas y pedidos asignados'],
                'en_app' => ['Invitar y cambiar permisos (ya existe)', 'Mis tareas (ver y marcar hecha)'],
                'estado' => 'disponible',
            ],
            'agenda' => [
                'grupo' => 'nucleo', 'nombre' => 'Agenda',
                'descripcion' => 'Citas y visitas de todo el equipo.',
                'depende_de' => [], 'permisos' => [],
                'secciones' => ['Próximas', 'Pendientes por confirmar', 'Historial'],
                'en_app' => ['Mis citas del día, confirmar y registrar presencial (ya existe)'],
                'estado' => 'disponible',
            ],
            'resenas' => [
                'grupo' => 'nucleo', 'nombre' => 'Reseñas',
                'descripcion' => 'Lo que opinan los clientes.',
                'depende_de' => [], 'permisos' => [],
                'secciones' => ['Reseñas', 'Respuestas'],
                'en_app' => ['Ver y responder (ya existe)'],
                'estado' => 'disponible',
            ],

            // ---------------------------------------------------------- Ventas
            'caja' => [
                'grupo' => 'ventas', 'nombre' => 'Caja',
                'descripcion' => 'Venta de mostrador en cada sede; descuenta del inventario.',
                'depende_de' => ['inventario'],
                'permisos' => ['caja.vender' => 'Vender en la caja', 'caja.cerrar' => 'Abrir y cerrar la caja del día'],
                'secciones' => ['Vender', 'Ventas del día', 'Cierre de caja'],
                'en_app' => [],
                'estado' => 'en_construccion',
            ],
            'medida' => [
                'grupo' => 'ventas', 'nombre' => 'Pedidos a la medida',
                'descripcion' => 'Cotizaciones, bocetos, visitas para medir, fechas de entrega y garantías.',
                'depende_de' => [],
                'permisos' => ['medida.cotizar' => 'Hacer y enviar cotizaciones', 'medida.garantias' => 'Atender garantías'],
                'secciones' => ['Cotizaciones', 'Trabajos en curso', 'Fechas de entrega', 'Garantías', 'Visitas para medir'],
                'en_app' => ['Tomar medidas y fotos en la visita', 'Aprobar una cotización', 'Aviso de reclamo de garantía'],
                'estado' => 'en_construccion',
            ],
            'clientes' => [
                'grupo' => 'ventas', 'nombre' => 'Clientes preferenciales',
                'descripcion' => 'Niveles por frecuencia de compra, afiliados, descuentos por porcentaje y avisos.',
                'depende_de' => [],
                'permisos' => ['clientes.gestionar' => 'Gestionar niveles, afiliados y descuentos', 'clientes.avisos' => 'Enviar avisos y ofertas'],
                'secciones' => ['Clientes', 'Niveles', 'Afiliados', 'Descuentos', 'Avisos y ofertas'],
                'en_app' => [],
                'estado' => 'en_construccion',
            ],

            // ------------------------------------------------------- Operación
            'sedes' => [
                'grupo' => 'operacion', 'nombre' => 'Varias sedes',
                'descripcion' => 'Puntos de venta, fábricas y bodegas, cada una con su inventario y sus ventas.',
                'depende_de' => [],
                'permisos' => ['sedes.gestionar' => 'Crear y editar sedes'],
                'secciones' => ['Sedes', 'Traslados entre sedes'],
                'en_app' => [],
                'estado' => 'disponible',
            ],
            'inventario' => [
                'grupo' => 'operacion', 'nombre' => 'Inventario',
                'descripcion' => 'Materia prima, insumos, productos y herramientas con sus características, existencias, movimientos y alertas.',
                'depende_de' => [],
                'permisos' => ['inventario.ver' => 'Ver existencias', 'inventario.editar' => 'Crear artículos y registrar entradas, salidas y ajustes'],
                'secciones' => ['Artículos con características a la medida', 'Existencias por unidad, peso o medida', 'Entradas, salidas y ajustes', 'Alertas de existencias bajas'],
                'en_app' => ['Consultar la existencia de un producto', 'Aviso de existencias bajas'],
                'estado' => 'disponible',
            ],
            'produccion' => [
                'grupo' => 'operacion', 'nombre' => 'Producción y materiales',
                'descripcion' => 'Lo que gasta cada producto del catálogo; los materiales e insumos se descuentan del inventario al hacerlo o con cada pedido.',
                'depende_de' => ['inventario'],
                'permisos' => ['produccion.gestionar' => 'Definir los materiales de cada producto y registrar lo que se hizo'],
                'secciones' => ['Lo que gasta cada producto', 'Registrar lo que se hizo', 'Descuento con cada pedido', 'Cuántos alcanzan con lo que hay', 'Historial de producción'],
                'en_app' => ['Registrar que se hizo un producto'],
                'estado' => 'disponible',
            ],
            'compras' => [
                'grupo' => 'operacion', 'nombre' => 'Compras y proveedores',
                'descripcion' => 'Proveedores, piezas con nombre y figura, y pedidos con medidas.',
                'depende_de' => ['inventario'],
                'permisos' => ['compras.gestionar' => 'Hacer pedidos a proveedores y recibir material'],
                'secciones' => ['Proveedores', 'Piezas con figura', 'Pedidos a proveedores', 'Recibir material'],
                'en_app' => [],
                'estado' => 'en_construccion',
            ],

            // --------------------------------------------------------- Personal
            'personal' => [
                'grupo' => 'personal', 'nombre' => 'Personal',
                'descripcion' => 'Llegadas y días trabajados de cada trabajador (las tareas están en Trabajadores).',
                'depende_de' => [],
                'permisos' => ['personal.llegadas' => 'Ver llegadas y días trabajados'],
                'secciones' => ['Llegadas', 'Días trabajados', 'Pantalla de la sede'],
                'en_app' => ['Marcar llegada'],
                'estado' => 'en_construccion',
            ],
            'nomina' => [
                'grupo' => 'personal', 'nombre' => 'Pagos al personal',
                'descripcion' => 'Lo que se le paga a cada trabajador y cuándo.',
                'depende_de' => ['personal'],
                'permisos' => ['nomina.gestionar' => 'Registrar y ver pagos al personal'],
                'secciones' => ['Pagos', 'Adelantos', 'Historial por trabajador'],
                'en_app' => [],
                'estado' => 'en_construccion',
            ],

            // -------------------------------------------------------- Finanzas
            'cuentas' => [
                'grupo' => 'finanzas', 'nombre' => 'Cuentas',
                'descripcion' => 'Ingresos, gastos, compras por tercero y reportes para el contador.',
                'depende_de' => [],
                'permisos' => ['cuentas.ver' => 'Ver ingresos, gastos y reportes', 'cuentas.registrar' => 'Registrar gastos e ingresos'],
                'secciones' => ['Ingresos', 'Gastos', 'Terceros', 'Reportes', 'Información exógena'],
                'en_app' => [],
                'estado' => 'en_construccion',
            ],
            'facturacion' => [
                'grupo' => 'finanzas', 'nombre' => 'Facturación DIAN',
                'descripcion' => 'Factura y POS electrónicos con un proveedor tecnológico autorizado.',
                'depende_de' => ['cuentas'],
                'permisos' => ['facturacion.emitir' => 'Emitir facturas electrónicas'],
                'secciones' => ['Facturas', 'Resolución de numeración', 'Proveedor tecnológico'],
                'en_app' => [],
                'estado' => 'en_construccion',
            ],
        ];
    }

    /** @return array<string, mixed>|null */
    public static function get(string $clave): ?array
    {
        return self::todos()[$clave] ?? null;
    }

    public static function existe(string $clave): bool
    {
        return isset(self::todos()[$clave]);
    }

    public static function esNucleo(string $clave): bool
    {
        return (self::get($clave)['grupo'] ?? null) === 'nucleo';
    }

    /** @return string[] */
    public static function nucleo(): array
    {
        return array_keys(array_filter(self::todos(), fn ($m) => $m['grupo'] === 'nucleo'));
    }

    /** @return string[] */
    public static function opcionales(): array
    {
        return array_keys(array_filter(self::todos(), fn ($m) => $m['grupo'] !== 'nucleo'));
    }

    /** El módulo y todo lo que necesita, en orden (dependencias primero). @return string[] */
    public static function conDependencias(string $clave): array
    {
        $lista = [];
        foreach (self::get($clave)['depende_de'] ?? [] as $dep) {
            $lista = [...$lista, ...self::conDependencias($dep)];
        }

        return array_values(array_unique([...$lista, $clave]));
    }

    /** Módulos que dependen (directa o indirectamente) de este. @return string[] */
    public static function dependientes(string $clave): array
    {
        $lista = [];
        foreach (self::todos() as $otra => $m) {
            if (in_array($clave, $m['depende_de'], true)) {
                $lista = [...$lista, $otra, ...self::dependientes($otra)];
            }
        }

        return array_values(array_unique($lista));
    }

    /** Todos los permisos de módulos: clave => [modulo, descripcion]. @return array<string, array{0:string,1:string}> */
    public static function permisos(): array
    {
        $todos = [];
        foreach (self::todos() as $clave => $m) {
            foreach ($m['permisos'] as $permiso => $descripcion) {
                $todos[$permiso] = [$clave, $descripcion];
            }
        }

        return $todos;
    }

    /** @return array<string, array<string, array<string, mixed>>> módulos agrupados */
    public static function porGrupo(?array $solo = null): array
    {
        $grupos = [];
        foreach (self::todos() as $clave => $m) {
            if ($solo === null || in_array($clave, $solo, true)) {
                $grupos[$m['grupo']][$clave] = $m;
            }
        }

        return $grupos;
    }
}
