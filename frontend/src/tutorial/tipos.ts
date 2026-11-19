import { Usuario } from '../api';
import { IconName } from '../components/Icon';

/** Un paso: un recuadro sobre un elemento y una tarjeta que lo explica. */
export type PasoTutorial = {
  /**
   * Elemento señalado (el `id` de un <Objetivo>). Sin él, la tarjeta sale en
   * el centro, sin recuadro ni flecha (bienvenidas, cierres).
   * Si el elemento no está en pantalla (p. ej. la lista aún está vacía), el
   * paso se salta.
   */
  objetivo?: string;
  titulo: string;
  texto: string;
};

/** Lo que el tutorial sabe al decidir si aplica. */
export type ContextoTutorial = {
  user: Usuario;
  /** Parámetros de la ruta actual. */
  params?: Record<string, unknown>;
};

/** Los pasos de UNA pantalla. */
export type Tutorial = {
  id: string;
  /**
   * Pantalla donde se muestra: el nombre de la ruta («Explorar») o el de una
   * vista que no es ruta, como un formulario en un modal («EditarDireccion»,
   * ver <PantallaTutorial>).
   */
  pantalla: string;
  /** La pantalla es un modal: la capa se dibuja dentro de él (<PantallaTutorial>). */
  enModal?: boolean;
  /**
   * `true` (por defecto): se muestra solo, la primera vez que la persona llega
   * a esa pantalla. `false`: solo cuando lo pide desde la ayuda.
   */
  auto?: boolean;
  /** Si aplica a esta persona y a esta pantalla (rol, parámetros…). */
  cuando?: (ctx: ContextoTutorial) => boolean;
  pasos: PasoTutorial[];
};

/**
 * Una acción de la lista «¿No sabes cómo hacer algo?»: lleva a la primera
 * pantalla y, en cada pantalla por la que pasa la acción, muestra su tutorial
 * (aunque ya lo hubiera visto).
 */
export type Guia = {
  id: string;
  titulo: string;
  detalle: string;
  icono: IconName;
  /** Para quién aparece en la lista. */
  para: (user: Usuario) => boolean;
  /** Lleva a la pantalla donde empieza. */
  ir: (user: Usuario) => void;
  /** Tutoriales por los que pasa, en orden. */
  tutoriales: string[];
};
