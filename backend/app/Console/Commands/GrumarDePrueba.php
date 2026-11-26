<?php

namespace App\Console\Commands;

use App\Gestion\Gestion;
use App\Gestion\Inventario;
use App\Gestion\Materiales;
use App\Models\Barrio;
use App\Models\InventarioArticulo;
use App\Models\Negocio;
use App\Models\PlantillaGestion;
use App\Models\Sede;
use App\Models\TipoNegocio;
use App\Models\TipoProducto;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Spatie\Permission\Models\Role;

/**
 * Negocio de prueba «Grumar», la latonería y ornamentación del señor Ismael
 * (primer cliente de Vitrina Gestión): Calle 17 con Carrera 9, esquina.
 *
 * Crea al dueño (Ismael, administrador), el negocio con su plantilla de
 * latonería y los módulos, 3 sedes (dos puntos de venta y la fábrica), 7
 * trabajadores por sede con cargo, días, permisos y tareas, ~20 productos con
 * imagen, servicios con fotos, cuentas de pago de prueba, el inventario de
 * materiales con imagen y lo que gasta cada producto, y un historial de
 * producción de las últimas semanas.
 *
 * Las imágenes salen de database/seeders/imagenes/grumar (las genera
 * scripts/generar-imagenes-grumar.py). Todo es de prueba salvo el nombre,
 * la dirección y el teléfono del negocio; las otras dos sedes tienen
 * direcciones inventadas.
 *
 * Si Grumar ya existe no hace nada; con --rehacer lo borra (con sus
 * trabajadores de prueba) y lo vuelve a crear.
 */
class GrumarDePrueba extends Command
{
    protected $signature = 'vitrina:grumar-de-prueba
        {--rehacer : Borrar Grumar y sus trabajadores de prueba y volver a crearlo}
        {--clave=1920 : Clave de 4 números de Ismael y los trabajadores}';

    protected $description = 'Crea el negocio de prueba Grumar (latonería del señor Ismael) con sedes, trabajadores, catálogo, inventario y producción';

    public const NOMBRE = 'Grumar';

    public const CORREO_DUENO = 'grumar@demo.co';

    /** Celular de la cuenta de prueba de Ismael (sigue a las de comercios-demo.txt). */
    public const CELULAR_DUENO = '3000000032';

    /** Los trabajadores usan 3300000001 en adelante. */
    public const CELULAR_TRABAJADORES = 3300000000;

    private const ORIGEN = 'database/seeders/imagenes/grumar';

    private const SEDES = [
        'principal' => ['Principal · Calle 17', 'punto_venta', 'Calle 17 con Carrera 9, esquina', 'Centro', '3008000279', true],
        'carrera10' => ['Punto de venta Carrera 10', 'punto_venta', 'Carrera 10 # 14-32 (dirección de prueba)', 'Centro', null, false],
        'fabrica' => ['Fábrica', 'fabrica', 'Calle 20 # 5-60 (dirección de prueba)', 'San José', null, false],
    ];

    /**
     * [nombre, apellidos, cargo, horario, permisos de Vitrina, permisos de módulos]
     * horario: lv = lunes a viernes, ls = lunes a sábado, ls-tarde, ...
     */
    private const TRABAJADORES = [
        'principal' => [
            ['Yaneth', 'Pushaina', 'Administradora de sede', 'ls', ['administrador'], ['equipo.tareas', 'inventario.ver', 'inventario.editar', 'caja.cerrar']],
            ['Jesús', 'Epieyú', 'Vendedor', 'ls', ['gestionar_pedidos', 'cambiar_estado'], ['inventario.ver', 'medida.cotizar']],
            ['Karina', 'Fernández', 'Vendedora', 'ls', ['gestionar_pedidos'], ['inventario.ver', 'medida.cotizar']],
            ['Luz Mery', 'Brito', 'Cajera', 'ls', ['gestionar_pedidos'], ['caja.vender']],
            ['Wilmer', 'Uriana', 'Instalador', 'lv', [], ['inventario.ver']],
            ['Deimer', 'Iguarán', 'Instalador', 'lv', [], ['inventario.ver']],
            ['Brayan', 'Arregocés', 'Ayudante de mostrador', 'ls-tarde', [], []],
        ],
        'carrera10' => [
            ['Rosmery', 'Cotes', 'Encargada de sede', 'ls', ['gestionar_pedidos', 'modificar_inventario', 'cambiar_estado'], ['equipo.tareas', 'inventario.ver', 'inventario.editar']],
            ['Hamid', 'Saleh', 'Vendedor', 'ls', ['gestionar_pedidos'], ['inventario.ver', 'medida.cotizar']],
            ['Yuleidis', 'Ipuana', 'Vendedora', 'ls-tarde', ['gestionar_pedidos'], ['inventario.ver']],
            ['Samir', 'Abdala', 'Cajero', 'ls', ['gestionar_pedidos'], ['caja.vender', 'caja.cerrar']],
            ['Edwin', 'Pana', 'Instalador', 'lv', [], ['inventario.ver']],
            ['Óscar', 'Choles', 'Instalador y medidas', 'lv', [], ['inventario.ver', 'medida.cotizar']],
            ['Kevin', 'Solano', 'Mensajero', 'ls', [], []],
        ],
        'fabrica' => [
            ['Rafael', 'Pimienta', 'Jefe de taller', 'ls', ['modificar_inventario'], ['equipo.tareas', 'inventario.ver', 'inventario.editar', 'produccion.gestionar', 'compras.gestionar']],
            ['Andrés', 'Gómez', 'Soldador', 'ls', [], ['inventario.ver', 'produccion.gestionar']],
            ['Jhon', 'Mendoza', 'Soldador', 'ls', [], ['inventario.ver', 'produccion.gestionar']],
            ['Carlos', 'Barros', 'Ornamentador', 'ls', [], ['inventario.ver']],
            ['Wilson', 'Mejía', 'Latonero', 'ls', [], ['inventario.ver']],
            ['Fredy', 'Romero', 'Pintor', 'lv', [], ['inventario.ver']],
            ['Duván', 'Epinayú', 'Ayudante de fábrica', 'lv', [], ['inventario.ver']],
        ],
    ];

    private const HORARIOS = [
        'ls' => [[1, 2, 3, 4, 5, 6], '07:30', '17:30'],
        'lv' => [[1, 2, 3, 4, 5], '07:00', '16:00'],
        'ls-tarde' => [[1, 2, 3, 4, 5, 6], '12:00', '19:00'],
    ];

    /**
     * Inventario: clave => [tipo, nombre, categoría, unidad, cantidad, mínimo, costo, proveedor, características, imagen, sede]
     */
    private const ARTICULOS = [
        'tubo-1-18' => ['materia_prima', 'Tubo cuadrado 1"', 'Tubos', 'unidad', 64, 15, 52000, 'Aceros del Caribe', ['Material' => 'Hierro', 'Calibre' => '18', 'Medida' => '1 × 1 pulgada', 'Largo' => '6 m'], 'material-tubo-cuadrado.jpg', 'fabrica'],
        'tubo-1-20' => ['materia_prima', 'Tubo cuadrado 1"', 'Tubos', 'unidad', 38, 15, 44000, 'Aceros del Caribe', ['Material' => 'Hierro', 'Calibre' => '20', 'Medida' => '1 × 1 pulgada', 'Largo' => '6 m'], 'material-tubo-cuadrado.jpg', 'fabrica'],
        'tubo-34-galv' => ['materia_prima', 'Tubo cuadrado 3/4"', 'Tubos', 'unidad', 40, 12, 36000, 'Ferretería El Tornillo', ['Material' => 'Hierro galvanizado', 'Calibre' => '20', 'Medida' => '3/4 × 3/4 pulgada', 'Largo' => '6 m'], 'material-tubo-cuadrado-galvanizado.jpg', 'fabrica'],
        'tubo-2x1' => ['materia_prima', 'Tubo rectangular 2 × 1"', 'Tubos', 'unidad', 30, 10, 68000, 'Aceros del Caribe', ['Material' => 'Hierro', 'Calibre' => '18', 'Medida' => '2 × 1 pulgada', 'Largo' => '6 m'], 'material-tubo-rectangular.jpg', 'fabrica'],
        'tubo-3x1-12' => ['materia_prima', 'Tubo rectangular 3 × 1 1/2"', 'Tubos', 'unidad', 9, 8, 96000, 'Aceros del Caribe', ['Material' => 'Hierro', 'Calibre' => '16', 'Medida' => '3 × 1 1/2 pulgada', 'Largo' => '6 m'], 'material-tubo-rectangular.jpg', 'fabrica'],
        'tubo-redondo-112' => ['materia_prima', 'Tubo redondo 1 1/2"', 'Tubos', 'unidad', 16, 6, 58000, 'Aceros del Caribe', ['Material' => 'Hierro galvanizado', 'Calibre' => '18', 'Diámetro' => '1 1/2 pulgada', 'Largo' => '6 m'], 'material-tubo-redondo.jpg', 'fabrica'],
        'lamina-18' => ['materia_prima', 'Lámina lisa cold rolled', 'Láminas', 'lamina', 26, 8, 118000, 'Aceros del Caribe', ['Material' => 'Hierro', 'Calibre' => '18', 'Medida' => '1,22 × 2,44 m'], 'material-lamina-lisa.jpg', 'fabrica'],
        'lamina-20' => ['materia_prima', 'Lámina lisa cold rolled', 'Láminas', 'lamina', 18, 6, 96000, 'Aceros del Caribe', ['Material' => 'Hierro', 'Calibre' => '20', 'Medida' => '1,22 × 2,44 m'], 'material-lamina-lisa.jpg', 'fabrica'],
        'lamina-galv' => ['materia_prima', 'Lámina galvanizada', 'Láminas', 'lamina', 4, 5, 104000, 'Ferretería El Tornillo', ['Material' => 'Hierro galvanizado', 'Calibre' => '22', 'Medida' => '1 × 2 m'], 'material-lamina-galvanizada.jpg', 'fabrica'],
        'angulo-1' => ['materia_prima', 'Ángulo 1 × 1/8"', 'Perfiles', 'unidad', 34, 10, 39000, 'Aceros del Caribe', ['Material' => 'Hierro', 'Medida' => '1 × 1/8 pulgada', 'Largo' => '6 m', 'Forma' => 'L'], 'material-angulo.jpg', 'fabrica'],
        'platina-1' => ['materia_prima', 'Platina 1 × 1/8"', 'Perfiles', 'unidad', 45, 12, 21000, 'Aceros del Caribe', ['Material' => 'Hierro', 'Medida' => '1 × 1/8 pulgada', 'Largo' => '6 m'], 'material-platina.jpg', 'fabrica'],
        'varilla-12' => ['materia_prima', 'Varilla cuadrada 1/2"', 'Varillas', 'unidad', 80, 20, 18500, 'Ferretería El Tornillo', ['Material' => 'Hierro', 'Medida' => '1/2 pulgada', 'Largo' => '6 m'], 'material-varilla.jpg', 'fabrica'],
        'varilla-38' => ['materia_prima', 'Varilla redonda 3/8"', 'Varillas', 'unidad', 70, 25, 12800, 'Ferretería El Tornillo', ['Material' => 'Hierro', 'Medida' => '3/8 pulgada', 'Largo' => '6 m'], 'material-varilla.jpg', 'fabrica'],
        'vidrio-claro' => ['materia_prima', 'Vidrio claro 4 mm', 'Vidrios', 'm2', 22.5, 6, 62000, 'Vidrios La Guajira', ['Espesor' => '4 mm', 'Color' => 'Claro'], 'material-vidrio-claro.jpg', 'fabrica'],
        'vidrio-bronce' => ['materia_prima', 'Vidrio bronce 4 mm', 'Vidrios', 'm2', 3.5, 4, 78000, 'Vidrios La Guajira', ['Espesor' => '4 mm', 'Color' => 'Bronce'], 'material-vidrio-bronce.jpg', 'fabrica'],
        'policarbonato' => ['materia_prima', 'Policarbonato alveolar 6 mm', 'Cubiertas', 'lamina', 7, 2, 185000, 'Vidrios La Guajira', ['Espesor' => '6 mm', 'Color' => 'Cristal', 'Medida' => '2,10 × 5,80 m'], 'material-vidrio-claro.jpg', 'fabrica'],
        'malla' => ['materia_prima', 'Malla eslabonada', 'Mallas', 'm2', 60, 20, 16000, 'Ferretería El Tornillo', ['Material' => 'Alambre galvanizado', 'Calibre' => '12', 'Hueco' => '2 pulgadas'], 'material-varilla.jpg', 'fabrica'],
        'soldadura-6013' => ['insumo', 'Soldadura 6013 1/8"', 'Soldadura', 'kg', 18, 6, 24000, 'Soldaduras Maicao', ['Referencia' => 'E6013', 'Diámetro' => '1/8 pulgada', 'Marca' => 'West Arco'], 'material-soldadura-6013.jpg', 'fabrica'],
        'soldadura-7018' => ['insumo', 'Soldadura 7018 1/8"', 'Soldadura', 'kg', 6, 4, 29000, 'Soldaduras Maicao', ['Referencia' => 'E7018', 'Diámetro' => '1/8 pulgada', 'Uso' => 'Estructuras'], 'material-soldadura-7018.jpg', 'fabrica'],
        'disco-corte' => ['insumo', 'Disco de corte 7"', 'Discos', 'unidad', 7, 10, 6500, 'Ferretería El Tornillo', ['Medida' => '7 pulgadas', 'Uso' => 'Metal', 'Marca' => 'Norton'], 'material-disco-corte.jpg', 'fabrica'],
        'disco-pulir' => ['insumo', 'Disco de pulir 4 1/2"', 'Discos', 'unidad', 24, 8, 7800, 'Ferretería El Tornillo', ['Medida' => '4 1/2 pulgadas', 'Grano' => '60'], 'material-disco-pulir.jpg', 'fabrica'],
        'anticorrosivo' => ['insumo', 'Anticorrosivo gris', 'Pinturas', 'gal', 9, 3, 78000, 'Pinturas El Arcoíris', ['Color' => 'Gris', 'Acabado' => 'Mate', 'Presentación' => 'Galón'], 'material-anticorrosivo.jpg', 'fabrica'],
        'esmalte-negro' => ['insumo', 'Esmalte negro', 'Pinturas', 'gal', 7, 2, 92000, 'Pinturas El Arcoíris', ['Color' => 'Negro', 'Acabado' => 'Brillante', 'Presentación' => 'Galón'], 'material-esmalte-negro.jpg', 'fabrica'],
        'esmalte-blanco' => ['insumo', 'Esmalte blanco', 'Pinturas', 'gal', 1.5, 2, 92000, 'Pinturas El Arcoíris', ['Color' => 'Blanco', 'Acabado' => 'Brillante', 'Presentación' => 'Galón'], 'material-esmalte-blanco.jpg', 'fabrica'],
        'esmalte-cafe' => ['insumo', 'Esmalte café', 'Pinturas', 'gal', 4, 2, 92000, 'Pinturas El Arcoíris', ['Color' => 'Café', 'Acabado' => 'Brillante', 'Presentación' => 'Galón'], 'material-esmalte-negro.jpg', 'fabrica'],
        'thinner' => ['insumo', 'Thinner', 'Pinturas', 'gal', 6, 2, 38000, 'Pinturas El Arcoíris', ['Presentación' => 'Galón', 'Uso' => 'Limpieza y rebaje'], 'material-thinner.jpg', 'fabrica'],
        'masilla' => ['insumo', 'Masilla automotriz', 'Pinturas', 'unidad', 10, 4, 26000, 'Pinturas El Arcoíris', ['Presentación' => '1/4 de galón'], 'material-masilla.jpg', 'fabrica'],
        'bisagra' => ['insumo', 'Bisagra de cazoleta 3"', 'Herrajes', 'par', 60, 20, 4500, 'Ferretería El Tornillo', ['Medida' => '3 pulgadas', 'Material' => 'Acero'], 'material-bisagra.jpg', 'fabrica'],
        'cerradura' => ['insumo', 'Cerradura de sobreponer', 'Herrajes', 'unidad', 12, 5, 68000, 'Ferretería El Tornillo', ['Marca' => 'Segurex', 'Llaves' => '3'], 'material-cerradura.jpg', 'fabrica'],
        'rueda' => ['insumo', 'Rueda para portón corredizo', 'Herrajes', 'unidad', 10, 4, 42000, 'Ferretería El Tornillo', ['Diámetro' => '3 pulgadas', 'Canal' => 'En V'], 'material-rueda-porton.jpg', 'fabrica'],
        'tornillos' => ['insumo', 'Tornillo con chazo 1/4 × 2"', 'Herrajes', 'caja', 8, 3, 18000, 'Ferretería El Tornillo', ['Medida' => '1/4 × 2 pulgadas', 'Presentación' => 'Caja × 100'], 'material-tornillos.jpg', 'fabrica'],
        'stock-puerta' => ['producto', 'Puerta en lámina 0,90 × 2,10 m (en stock)', 'Puertas', 'unidad', 4, 2, 520000, null, ['Ancho' => '90 cm', 'Alto' => '210 cm', 'Calibre' => '18', 'Color' => 'Negro'], 'producto-puerta-lamina-negra.jpg', 'principal'],
        'stock-ventana' => ['producto', 'Ventana corrediza 1,20 × 1,00 m (en stock)', 'Ventanas', 'unidad', 3, 2, 260000, null, ['Ancho' => '120 cm', 'Alto' => '100 cm', 'Lleva' => 'Vidrio', 'Color' => 'Blanco'], 'producto-ventana-corrediza.jpg', 'carrera10'],
        'stock-reja' => ['producto', 'Reja de ventana 1,20 × 1,00 m (en stock)', 'Rejas', 'unidad', 1, 2, 210000, null, ['Ancho' => '120 cm', 'Alto' => '100 cm', 'Color' => 'Negro'], 'producto-reja-ventana-blanca.jpg', 'carrera10'],
        'pulidora' => ['herramienta', 'Pulidora 4 1/2"', 'Herramientas', 'unidad', 5, null, 289000, 'Ferretería El Tornillo', ['Marca' => 'DeWalt', 'Potencia' => '900 W'], 'material-pulidora.jpg', 'fabrica'],
        'tronzadora' => ['herramienta', 'Tronzadora 14"', 'Herramientas', 'unidad', 2, null, 790000, 'Ferretería El Tornillo', ['Marca' => 'Makita', 'Potencia' => '2.000 W'], 'material-pulidora.jpg', 'fabrica'],
        'soldador' => ['herramienta', 'Equipo de soldar', 'Herramientas', 'unidad', 3, null, 1450000, 'Soldaduras Maicao', ['Marca' => 'Lincoln', 'Amperaje' => '225 A'], 'material-equipo-soldar.jpg', 'fabrica'],
    ];

    /**
     * Catálogo: [sección, nombre, precio, descripción, etiquetas, imagen, materiales (clave => por unidad)]
     */
    private const PRODUCTOS = [
        ['Puertas', 'Puerta en lámina 0,90 × 2,10 m', 680000, 'Puerta de una hoja en lámina calibre 18 con tableros embutidos, marco en tubo de 2 × 1" y cerradura de sobreponer. Lista para instalar.', ['Calibre 18', 'Apertura derecha o izquierda', 'Anticorrosivo y esmalte'], 'producto-puerta-lamina-negra.jpg', ['tubo-2x1' => 2, 'tubo-1-18' => 1, 'lamina-18' => 1, 'bisagra' => 2, 'cerradura' => 1, 'soldadura-6013' => 0.5, 'disco-corte' => 1, 'anticorrosivo' => 0.25, 'esmalte-negro' => 0.25]],
        ['Puertas', 'Puerta en lámina café 0,90 × 2,10 m', 720000, 'Puerta de lámina con cuatro tableros horizontales y acabado en esmalte café. Ideal para la entrada de la casa.', ['Calibre 18', 'Color café', 'Con cerradura'], 'producto-puerta-lamina-cafe.jpg', ['tubo-2x1' => 2, 'tubo-1-18' => 1, 'lamina-18' => 1, 'bisagra' => 2, 'cerradura' => 1, 'soldadura-6013' => 0.5, 'disco-corte' => 1, 'anticorrosivo' => 0.25, 'esmalte-cafe' => 0.25]],
        ['Puertas', 'Puerta con vidrio y reja', 890000, 'Mitad superior en vidrio claro con reja de varilla cuadrada; mitad inferior en lámina. Da luz sin perder seguridad.', ['Vidrio claro 4 mm', 'Reja de varilla 1/2"', 'Con protector'], 'producto-puerta-vidrio-reja.jpg', ['tubo-2x1' => 2, 'lamina-18' => 0.5, 'varilla-12' => 2, 'vidrio-claro' => 0.9, 'bisagra' => 2, 'cerradura' => 1, 'soldadura-6013' => 0.6, 'disco-corte' => 1, 'anticorrosivo' => 0.25, 'esmalte-negro' => 0.25]],
        ['Puertas', 'Puerta doble 1,60 × 2,10 m', 1450000, 'Dos hojas en lámina con tres tableros cada una. Para entradas anchas, locales y garajes pequeños.', ['Dos hojas', 'Calibre 18', 'Color a elección'], 'producto-puerta-doble.jpg', ['tubo-2x1' => 4, 'tubo-1-18' => 2, 'lamina-18' => 2, 'bisagra' => 4, 'cerradura' => 1, 'soldadura-6013' => 1, 'disco-corte' => 2, 'anticorrosivo' => 0.5, 'esmalte-cafe' => 0.5]],
        ['Puertas', 'Puerta calada con diseño de rombos', 980000, 'Lámina calada con figuras de rombo que dejan pasar el aire. Diseño propio de Grumar.', ['Calada', 'Ventilación', 'Calibre 18'], 'producto-puerta-calada.jpg', ['tubo-2x1' => 2, 'lamina-18' => 1, 'platina-1' => 2, 'bisagra' => 2, 'cerradura' => 1, 'soldadura-6013' => 0.8, 'disco-corte' => 3, 'disco-pulir' => 2, 'anticorrosivo' => 0.25, 'esmalte-negro' => 0.25]],
        ['Portones', 'Portón corredizo 4,00 × 2,00 m', 3600000, 'Portón de barrotes con puntas de lanza, sobre riel y dos ruedas en V. Se puede automatizar.', ['Corredizo', 'Con riel y ruedas', 'Puntas de lanza'], 'producto-porton-corredizo.jpg', ['tubo-3x1-12' => 3, 'tubo-1-18' => 12, 'angulo-1' => 2, 'rueda' => 2, 'soldadura-7018' => 1.5, 'soldadura-6013' => 1, 'disco-corte' => 4, 'anticorrosivo' => 1, 'esmalte-negro' => 0.75]],
        ['Portones', 'Portón batiente de dos hojas 3,00 × 2,20 m', 2800000, 'Dos hojas con zócalo en lámina, barrotes y volutas decorativas. Bisagras reforzadas.', ['Dos hojas', 'Volutas', 'Zócalo en lámina'], 'producto-porton-batiente.jpg', ['tubo-3x1-12' => 2, 'tubo-2x1' => 6, 'tubo-1-18' => 8, 'lamina-18' => 2, 'platina-1' => 3, 'bisagra' => 3, 'soldadura-6013' => 1.5, 'disco-corte' => 3, 'anticorrosivo' => 0.75, 'esmalte-negro' => 0.5]],
        ['Portones', 'Portón de garaje en lamas', 3200000, 'Portón de lamas horizontales en lámina galvanizada, liso y fácil de mantener.', ['Lámina galvanizada', 'Lamas horizontales', 'Color blanco'], 'producto-porton-garaje.jpg', ['tubo-2x1' => 6, 'lamina-galv' => 4, 'angulo-1' => 2, 'bisagra' => 4, 'soldadura-6013' => 1.2, 'disco-corte' => 3, 'anticorrosivo' => 0.75, 'esmalte-blanco' => 0.75]],
        ['Ventanas', 'Ventana corrediza 1,20 × 1,00 m', 420000, 'Dos naves corredizas con vidrio claro de 4 mm y seguro interior.', ['Corrediza', 'Vidrio claro', 'Color blanco'], 'producto-ventana-corrediza.jpg', ['tubo-1-20' => 2, 'angulo-1' => 1, 'vidrio-claro' => 1.2, 'soldadura-6013' => 0.3, 'disco-corte' => 1, 'anticorrosivo' => 0.15, 'esmalte-blanco' => 0.15]],
        ['Ventanas', 'Ventana batiente 1,00 × 1,00 m', 390000, 'Dos hojas que abren hacia adentro, con travesaño y manijas.', ['Batiente', 'Dos hojas', 'Vidrio claro'], 'producto-ventana-batiente.jpg', ['tubo-1-20' => 2, 'vidrio-claro' => 1, 'bisagra' => 2, 'soldadura-6013' => 0.3, 'disco-corte' => 1, 'anticorrosivo' => 0.15, 'esmalte-negro' => 0.15]],
        ['Ventanas', 'Ventana proyectante para baño 0,60 × 0,40 m', 180000, 'Abre hacia afuera desde abajo; ventila sin dejar entrar la lluvia.', ['Proyectante', 'Para baño', 'Vidrio bronce'], 'producto-ventana-proyectante.jpg', ['tubo-34-galv' => 1, 'vidrio-bronce' => 0.25, 'bisagra' => 1, 'soldadura-6013' => 0.1, 'anticorrosivo' => 0.1]],
        ['Ventanas', 'Ventana con reja y volutas 1,20 × 1,00 m', 560000, 'Ventana de vidrio con reja de varilla y volutas al centro. Seguridad con buena presencia.', ['Con reja', 'Volutas', 'Vidrio claro'], 'producto-ventana-reja.jpg', ['tubo-1-20' => 2, 'varilla-12' => 3, 'platina-1' => 1, 'vidrio-claro' => 1.2, 'soldadura-6013' => 0.5, 'disco-corte' => 1, 'anticorrosivo' => 0.2, 'esmalte-negro' => 0.2]],
        ['Rejas y protectores', 'Reja para ventana 1,20 × 1,00 m', 350000, 'Protector de varilla cuadrada de 1/2" con marco en ángulo, para fijar a la pared.', ['Varilla 1/2"', 'Marco en ángulo', 'Color a elección'], 'producto-reja-ventana-blanca.jpg', ['angulo-1' => 1, 'varilla-12' => 5, 'platina-1' => 1, 'soldadura-6013' => 0.3, 'disco-corte' => 1, 'anticorrosivo' => 0.25, 'esmalte-blanco' => 0.15, 'tornillos' => 0.05]],
        ['Rejas y protectores', 'Reja protectora para puerta', 620000, 'Se instala delante de la puerta: barrotes, travesaños y rombo central. Con cerradura.', ['Con cerradura', 'Rombo central', 'Varilla 1/2"'], 'producto-reja-puerta.jpg', ['tubo-1-18' => 2, 'varilla-12' => 6, 'platina-1' => 1, 'bisagra' => 2, 'cerradura' => 1, 'soldadura-6013' => 0.5, 'disco-corte' => 1, 'anticorrosivo' => 0.25, 'esmalte-negro' => 0.2]],
        ['Rejas y protectores', 'Reja plegable de tijera', 950000, 'Reja que se recoge a un lado. Para locales, bodegas y vitrinas.', ['Plegable', 'Para locales', 'Galvanizada'], 'producto-reja-plegable.jpg', ['tubo-34-galv' => 4, 'platina-1' => 6, 'angulo-1' => 2, 'soldadura-6013' => 0.6, 'disco-corte' => 2, 'cerradura' => 1]],
        ['Escaleras y barandas', 'Baranda para escalera (metro lineal)', 260000, 'Pasamanos en tubo redondo con balaustres de varilla. Precio por metro lineal.', ['Por metro', 'Tubo redondo', 'Balaustres de varilla'], 'producto-baranda.jpg', ['tubo-redondo-112' => 0.3, 'varilla-12' => 1.2, 'platina-1' => 0.3, 'soldadura-6013' => 0.3, 'disco-pulir' => 1, 'anticorrosivo' => 0.1, 'esmalte-negro' => 0.1]],
        ['Escaleras y barandas', 'Escalera recta metálica', 2400000, 'Escalera de un tramo con zancas en tubo, peldaños en lámina antideslizante y pasamanos.', ['Un tramo', 'Peldaños en lámina', 'Con pasamanos'], 'producto-escalera-recta.jpg', ['tubo-3x1-12' => 3, 'lamina-18' => 2, 'angulo-1' => 4, 'tubo-redondo-112' => 1, 'varilla-12' => 4, 'soldadura-7018' => 1.5, 'disco-corte' => 4, 'anticorrosivo' => 0.75, 'esmalte-negro' => 0.5]],
        ['Escaleras y barandas', 'Escalera de caracol', 4800000, 'Escalera en espiral con columna central y pasamanos curvo. Ahorra espacio en terrazas y locales.', ['Caracol', 'Columna central', 'A la medida'], 'producto-escalera-caracol.jpg', ['tubo-redondo-112' => 3, 'lamina-18' => 3, 'angulo-1' => 4, 'varilla-12' => 8, 'soldadura-7018' => 2.5, 'disco-corte' => 6, 'disco-pulir' => 4, 'anticorrosivo' => 1, 'esmalte-negro' => 0.75]],
        ['Estructuras', 'Cerramiento en malla (metro lineal)', 145000, 'Postes en tubo, marco superior e inferior y malla eslabonada galvanizada. Precio por metro.', ['Por metro', 'Malla galvanizada', 'Postes cada 2 m'], 'producto-cerramiento.jpg', ['tubo-1-18' => 0.5, 'malla' => 2, 'soldadura-6013' => 0.2, 'anticorrosivo' => 0.1]],
        ['Estructuras', 'Marquesina en policarbonato', 1850000, 'Techo para entrada o garaje con estructura en tubo y cubierta de policarbonato alveolar.', ['Policarbonato 6 mm', 'Estructura en tubo', 'A la medida'], 'producto-marquesina.jpg', ['tubo-2x1' => 6, 'tubo-1-18' => 4, 'policarbonato' => 1, 'soldadura-6013' => 1, 'disco-corte' => 2, 'tornillos' => 0.3, 'anticorrosivo' => 0.5, 'esmalte-negro' => 0.25]],
        ['Estructuras', 'Base para tanque de agua', 520000, 'Base reforzada en ángulo con riostras para tanques de hasta 1.000 litros.', ['Hasta 1.000 L', 'Ángulo reforzado', 'Anticorrosivo'], 'producto-base-tanque.jpg', ['angulo-1' => 4, 'platina-1' => 2, 'soldadura-6013' => 0.6, 'disco-corte' => 1, 'anticorrosivo' => 0.25]],
    ];

    /** [nombre, minutos, precio, descripción, imágenes] */
    private const SERVICIOS = [
        ['Visita para tomar medidas', 60, 0, 'Vamos a tu casa o local, tomamos las medidas y te dejamos la cotización. Sin costo dentro de Maicao.', ['servicio-medidas.jpg']],
        ['Instalación de puertas y ventanas', 120, 80000, 'Instalamos lo que fabricamos o lo que ya tienes: anclaje, nivel, sellado y pintura de retoque.', ['servicio-instalacion.jpg']],
        ['Soldadura y reparaciones', 90, 60000, 'Arreglamos bisagras, marcos, rejas y portones caídos o partidos, en el taller o a domicilio.', ['servicio-soldadura.jpg', 'servicio-reparacion.jpg']],
        ['Pintura con anticorrosivo', 120, 90000, 'Lijamos, aplicamos anticorrosivo y esmalte a puertas, rejas y portones para que no se oxiden.', ['servicio-pintura.jpg']],
        ['Mantenimiento de portones corredizos', 90, 70000, 'Cambio de ruedas, alineación del riel y engrase para que el portón corra suave.', ['servicio-portones.jpg']],
        ['Diseño a la medida', 45, 0, 'Nos cuentas la idea, te mostramos el boceto con medidas y materiales, y te cotizamos sin compromiso.', ['servicio-diseno.jpg']],
    ];

    /** Tareas de ejemplo: [sede, posición del trabajador, título, detalle, días desde hoy, urgente] */
    private const TAREAS = [
        ['fabrica', 1, 'Soldar el portón corredizo de la Calle 15', 'Barrotes y puntas de lanza; el cliente lo recoge el viernes.', 0, true],
        ['fabrica', 2, 'Armar dos puertas en lámina negra', 'Para reponer las de la sede principal.', 1, false],
        ['fabrica', 3, 'Volutas para la ventana del barrio San José', null, 2, false],
        ['fabrica', 5, 'Pintar 3 rejas de ventana', 'Anticorrosivo y esmalte blanco.', 0, false],
        ['fabrica', 6, 'Cortar 20 tubos de 1" a 1,10 m', null, 0, false],
        ['principal', 4, 'Instalar puerta con vidrio y reja', 'Barrio Centro, llamar antes de llegar.', 1, false],
        ['principal', 5, 'Visita para medir escalera de caracol', 'Terraza de un segundo piso.', 2, false],
        ['principal', 1, 'Llamar a los clientes con cotización pendiente', null, 0, false],
        ['carrera10', 4, 'Cambiar ruedas del portón de la bodega', null, 0, true],
        ['carrera10', 5, 'Tomar medidas de 4 ventanas corredizas', 'Conjunto residencial, apartamento 302.', 3, false],
    ];

    public function handle(): int
    {
        $clave = (string) $this->option('clave');
        if (! preg_match('/\A\d{4}\z/', $clave)) {
            $this->error('--clave debe ser de 4 números.');

            return self::FAILURE;
        }
        if (! is_dir(base_path(self::ORIGEN))) {
            $this->error('Faltan las imágenes: corre python -I scripts/generar-imagenes-grumar.py');

            return self::FAILURE;
        }

        $existente = Negocio::where('nombre', self::NOMBRE)->first();
        if ($existente && ! $this->option('rehacer')) {
            $this->warn('Grumar ya existe (id '.$existente->id.'). Usa --rehacer para borrarlo y crearlo de nuevo.');

            return self::SUCCESS;
        }
        if ($existente) {
            $this->borrar($existente);
        }

        $pin = Hash::make($clave);
        $negocio = DB::transaction(function () use ($pin) {
            $dueno = $this->dueno($pin);
            $negocio = $this->negocio($dueno);
            $sedes = $this->sedes($negocio);
            $trabajadores = $this->trabajadores($negocio, $sedes, $pin);
            $this->tareas($negocio, $trabajadores, $sedes);
            $articulos = $this->inventario($negocio, $sedes, $dueno, $trabajadores);
            $productos = $this->catalogo($negocio, $articulos);
            $this->servicios($negocio);
            $this->cuentas($negocio);
            $this->produccion($negocio, $productos, $trabajadores['fabrica']);

            return $negocio;
        });

        $this->info('Listo: «Grumar» (id '.$negocio->id.') con 3 sedes, 21 trabajadores, '.count(self::PRODUCTOS).' productos, '
            .count(self::SERVICIOS).' servicios y '.count(self::ARTICULOS).' artículos en el inventario.');
        $this->line('Ismael entra con el celular '.self::CELULAR_DUENO.' y la clave '.$clave.' (o '.self::CORREO_DUENO.' / password123).');
        $this->line('Trabajadores: '.(self::CELULAR_TRABAJADORES + 1).' a '.(self::CELULAR_TRABAJADORES + 21).', misma clave.');

        return self::SUCCESS;
    }

    // ------------------------------------------------------------- Partes

    private function dueno(string $pin): User
    {
        $dueno = User::where('email', self::CORREO_DUENO)->first() ?? new User;
        // Nadie más con ese celular.
        User::where('telefono', self::CELULAR_DUENO)->whereKeyNot($dueno->id ?? 0)->update(['telefono' => null, 'telefono_verificado_at' => null]);
        $dueno->forceFill([
            'name' => 'Ismael', 'email' => self::CORREO_DUENO, 'password' => Hash::make('password123'),
            'telefono' => self::CELULAR_DUENO, 'telefono_verificado_at' => now(), 'pin' => $pin, 'pin_fallidos' => 0, 'pin_bloqueado_at' => null,
        ])->save();
        $dueno->syncRoles(User::rolesDelTipo('usuario'));

        return $dueno;
    }

    private function negocio(User $dueno): Negocio
    {
        $negocio = $dueno->negocio()->create(['nombre' => self::NOMBRE]);
        $dia = fn (string $abre, string $cierra, ?array $almuerzo = null) => array_filter([
            'abre' => $abre, 'cierra' => $cierra,
            'almuerzo' => $almuerzo ? ['inicio' => $almuerzo[0], 'fin' => $almuerzo[1]] : null,
        ]);
        $semana = $dia('07:30', '18:00', ['12:00', '13:30']);
        $negocio->forceFill([
            'descripcion' => "Latonería y ornamentación en Maicao. Fabricamos puertas, ventanas, portones, rejas, escaleras y estructuras en hierro, en stock y a la medida, con fábrica propia.\nVisítanos en la Calle 17 con Carrera 9, esquina.",
            'nombres_alternos' => ['latonería', 'ornamentación', 'herrería', 'puertas metálicas'],
            'categoria' => 'Latonería y ornamentación',
            'direccion' => 'Calle 17 con Carrera 9, esquina',
            'barrio' => 'Centro',
            'telefono' => '3008000279',
            'lat' => 11.3806, 'lng' => -72.2398,
            'horario' => [
                'lun' => $semana, 'mar' => $semana, 'mie' => $semana, 'jue' => $semana, 'vie' => $semana,
                'sab' => $dia('07:30', '13:00'), 'dom' => null, 'fes' => null,
            ],
            'tiempo_preparacion' => 30,
            'activo' => true,
            'imagen' => $this->imagen('negocio-portada.jpg', 'negocios/grumar-portada.jpg'),
        ])->save();
        Barrio::registrarSiEsNuevo('Centro');
        $negocio->miembros()->syncWithoutDetaching([$dueno->id => ['rol' => Negocio::ROL_PROPIETARIO, 'activo' => true]]);
        $negocio->tiposNegocio()->sync(collect(['Latonería y ornamentación', 'Construcción'])->map(
            fn (string $nombre) => TipoNegocio::firstOrCreate(['slug' => Str::slug($nombre)], ['nombre' => $nombre])->id,
        ));

        Gestion::activar($negocio);
        $plantilla = PlantillaGestion::where('slug', 'latoneria-y-ornamentacion')->first();
        if ($plantilla) {
            Gestion::aplicarPlantilla($negocio, $plantilla, $dueno);
        }
        Gestion::definirModulos($negocio, [...Gestion::opcionalesEncendidos($negocio), 'sedes', 'inventario', 'produccion'], $dueno);

        return $negocio->fresh();
    }

    /** @return array<string, Sede> */
    private function sedes(Negocio $negocio): array
    {
        $sedes = [];
        $principal = $negocio->sedes()->orderByDesc('principal')->first();
        foreach (self::SEDES as $clave => [$nombre, $tipo, $direccion, $barrio, $telefono, $esPrincipal]) {
            $datos = ['nombre' => $nombre, 'tipo' => $tipo, 'direccion' => $direccion, 'barrio' => $barrio, 'telefono' => $telefono, 'factura' => true, 'principal' => $esPrincipal, 'activa' => true];
            $sedes[$clave] = $esPrincipal && $principal ? tap($principal)->update($datos) : $negocio->sedes()->create($datos);
        }

        return $sedes;
    }

    /** @return array<string, array<int, User>> */
    private function trabajadores(Negocio $negocio, array $sedes, string $pin): array
    {
        $rol = Role::findOrCreate('usuario', 'web');
        $todos = [];
        $n = 0;
        foreach (self::TRABAJADORES as $sede => $lista) {
            foreach ($lista as $i => [$nombre, $apellidos, $cargo, $turno, $vitrina, $modulos]) {
                $n++;
                $telefono = (string) (self::CELULAR_TRABAJADORES + $n);
                $user = User::where('telefono', $telefono)->first() ?? new User;
                $user->forceFill([
                    'name' => $nombre, 'apellidos' => $apellidos, 'telefono' => $telefono, 'telefono_verificado_at' => now(),
                    'pin' => $pin, 'pin_fallidos' => 0, 'pin_bloqueado_at' => null,
                ])->save();
                if (! $user->hasRole('usuario')) {
                    $user->assignRole($rol);
                }
                [$dias, $entrada, $salida] = self::HORARIOS[$turno];
                $negocio->miembros()->attach($user->id, [
                    'rol' => Negocio::ROL_TRABAJADOR, 'activo' => true, 'cargo' => $cargo, 'sede_id' => $sedes[$sede]->id,
                    'horario' => json_encode(collect($dias)->mapWithKeys(fn ($d) => [(string) $d => ['entrada' => $entrada, 'salida' => $salida]])->all()),
                    ...collect(Negocio::PERMISOS)->mapWithKeys(fn ($p) => [$p => in_array($p, $vitrina, true)])->all(),
                    'created_at' => now()->subDays(20 + $n * 9), 'updated_at' => now(),
                ]);
                Gestion::guardarPermisos($negocio, $user, array_values(array_intersect($modulos, array_keys(Gestion::permisosAsignables($negocio)))));
                $todos[$sede][$i] = $user;
            }
        }

        return $todos;
    }

    private function tareas(Negocio $negocio, array $trabajadores, array $sedes): void
    {
        foreach (self::TAREAS as [$sede, $i, $titulo, $detalle, $dias, $urgente]) {
            $negocio->tareas()->create([
                'user_id' => $trabajadores[$sede][$i]->id, 'creada_por' => $negocio->user_id, 'sede_id' => $sedes[$sede]->id,
                'titulo' => $titulo, 'descripcion' => $detalle, 'fecha' => today()->addDays($dias), 'urgente' => $urgente,
            ]);
        }
    }

    /** @return array<string, InventarioArticulo> */
    private function inventario(Negocio $negocio, array $sedes, User $dueno, array $trabajadores): array
    {
        $articulos = [];
        $jefe = $trabajadores['fabrica'][0];
        $i = 0;
        foreach (self::ARTICULOS as $clave => [$tipo, $nombre, $categoria, $unidad, $cantidad, $minimo, $costo, $proveedor, $rasgos, $imagen, $sede]) {
            $i++;
            $a = $negocio->articulosInventario()->create([
                'tipo' => $tipo, 'nombre' => $nombre, 'categoria' => $categoria, 'unidad' => $unidad,
                'minimo' => $minimo, 'costo' => $costo, 'proveedor' => $proveedor, 'sede_id' => $sedes[$sede]->id,
                'referencia' => sprintf('GR-%03d', $i),
                'caracteristicas' => collect($rasgos)->map(fn ($v, $k) => ['nombre' => $k, 'valor' => $v])->values()->all(),
                'imagen' => $this->imagen($imagen, 'inventario/grumar/'.$imagen),
            ]);
            // Existencia inicial de hace un mes, y alguna compra después.
            // Lo que se cuenta por unidades va en números enteros; kilos, galones o m², con un decimal.
            $redondear = fn (float $c) => in_array($unidad, ['kg', 'g', 'lb', 'm', 'cm', 'm2', 'l', 'ml', 'gal'], true) ? round($c, 1) : ceil($c);
            $this->mover($a, 'entrada', $redondear($cantidad * 1.6 + 2), $dueno, 'Existencia inicial', 30);
            if ($i % 4 === 0) {
                $this->mover($a, 'entrada', max(1, $redondear($cantidad * 0.4)), $jefe, 'Compra a '.($proveedor ?? 'proveedor'), 12);
            }
            $articulos[$clave] = $a->fresh();
        }

        return $articulos;
    }

    /** @return array<int, \App\Models\Producto> */
    private function catalogo(Negocio $negocio, array $articulos): array
    {
        $tipo = TipoProducto::where('slug', 'otro')->value('id');
        $productos = [];
        foreach (self::PRODUCTOS as [$seccion, $nombre, $precio, $descripcion, $etiquetas, $imagen, $materiales]) {
            $categoria = $negocio->categorias()->firstOrCreate(['nombre' => $seccion]);
            $p = $negocio->productos()->create([
                'nombre' => $nombre, 'descripcion' => $descripcion, 'precio' => $precio,
                'tipo_venta' => 'cantidad', 'unidad_medida' => 'unidad', 'disponible' => true,
                'categoria_id' => $categoria->id, 'tipo_producto_id' => $tipo, 'atributos' => $etiquetas,
            ]);
            $p->forceFill(['imagen' => $this->imagen($imagen, 'productos/grumar/'.$imagen)])->saveQuietly();
            Materiales::guardar($p, collect($materiales)->mapWithKeys(fn ($c, $k) => [$articulos[$k]->id => $c])->all(), 'fabricar');
            $productos[] = $p;
        }

        return $productos;
    }

    private function servicios(Negocio $negocio): void
    {
        foreach (self::SERVICIOS as [$nombre, $minutos, $precio, $descripcion, $fotos]) {
            $s = $negocio->servicios()->create([
                'nombre' => $nombre, 'descripcion' => $descripcion, 'duracion_minutos' => $minutos,
                'precio' => $precio ?: null, 'permite_citas' => true, 'disponible' => true,
            ]);
            $s->forceFill(['galeria' => array_map(fn ($f) => $this->imagen($f, 'servicios/grumar/'.$f), $fotos)])->save();
        }
    }

    /** Cuentas de prueba: no son reales. */
    private function cuentas(Negocio $negocio): void
    {
        $negocio->cuentasPago()->create(['tipo' => 'nequi', 'numero' => self::CELULAR_DUENO, 'titular' => 'Ismael (cuenta de prueba)', 'orden' => 1]);
        $negocio->cuentasPago()->create(['tipo' => 'bancolombia', 'numero' => '000-000000-00', 'tipo_cuenta' => 'ahorros', 'titular' => 'Grumar (cuenta de prueba)', 'orden' => 2]);
        $negocio->cuentasPago()->create(['tipo' => 'llave', 'numero' => '@grumarprueba', 'titular' => 'Grumar (cuenta de prueba)', 'orden' => 3]);
        $qr = $negocio->cuentasPago()->create(['tipo' => 'qr', 'titular' => 'Grumar (QR de prueba)', 'orden' => 4]);
        $qr->forceFill(['qr' => $this->imagen('cuenta-qr-prueba.png', 'cuentas-pago/grumar-qr-prueba.png')])->save();
    }

    /** Lo que se hizo en las últimas tres semanas. */
    private function produccion(Negocio $negocio, array $productos, array $fabrica): void
    {
        $plan = [[0, 2, 20], [8, 3, 18], [12, 1, 15], [2, 1, 13], [9, 2, 11], [5, 1, 9], [0, 1, 7], [15, 4, 6], [6, 1, 4], [13, 2, 3], [8, 2, 2], [19, 6, 1], [3, 1, 0]];
        $notas = ['Para reponer la vitrina', 'Pedido del señor Pérez', 'Obra en el barrio San José', null, 'Cliente de Paraguachón', null, 'Para la sede Carrera 10'];
        foreach ($plan as $k => [$i, $cantidad, $dias]) {
            $quien = $fabrica[$k % 3];
            $p = Materiales::registrar($productos[$i], $cantidad, $quien, $notas[$k % count($notas)], true);
            $cuando = now()->subDays($dias)->setTime(9 + $k % 7, ($k * 13) % 60);
            $p->forceFill(['created_at' => $cuando, 'updated_at' => $cuando])->saveQuietly();
            $p->movimientos()->update(['created_at' => $cuando, 'updated_at' => $cuando]);
        }
    }

    // -------------------------------------------------------------- Apoyo

    private function mover(InventarioArticulo $articulo, string $tipo, float $cantidad, ?User $quien, string $nota, int $diasAtras): void
    {
        $m = Inventario::mover($articulo, $tipo, round($cantidad, 3), $quien, $nota);
        $cuando = now()->subDays($diasAtras)->setTime(8 + ($m->id % 8), ($m->id * 7) % 60);
        $m->forceFill(['created_at' => $cuando, 'updated_at' => $cuando])->saveQuietly();
    }

    /** Copia una imagen de prueba al disco público y devuelve su ruta. */
    private function imagen(string $archivo, string $destino): string
    {
        Storage::disk('public')->put($destino, file_get_contents(base_path(self::ORIGEN.'/'.$archivo)));

        return $destino;
    }

    private function borrar(Negocio $negocio): void
    {
        DB::transaction(function () use ($negocio) {
            $desde = (string) (self::CELULAR_TRABAJADORES + 1);
            $hasta = (string) (self::CELULAR_TRABAJADORES + 99);
            $ids = User::whereBetween('telefono', [$desde, $hasta])->pluck('id');
            $negocio->productos()->withTrashed()->get()->each->forceDelete();
            $negocio->delete();
            DB::table('personal_access_tokens')->where('tokenable_type', User::class)->whereIn('tokenable_id', $ids)->delete();
            DB::table('model_has_roles')->where('model_type', User::class)->whereIn('model_id', $ids)->delete();
            User::whereIn('id', $ids)->delete();
        });
        foreach (['productos/grumar', 'servicios/grumar', 'inventario/grumar'] as $carpeta) {
            Storage::disk('public')->deleteDirectory($carpeta);
        }
        $this->line('Se borró el Grumar anterior y sus trabajadores de prueba.');
    }
}
