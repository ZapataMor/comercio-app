/**
 * Contextos del tutorial, sin depender de la navegación: los usan <Objetivo>,
 * la capa y los botones de ayuda (el proveedor está en TutorialContext.tsx).
 */
import React, { createContext, useContext } from 'react';
import { View } from 'react-native';
import { Guia, Tutorial } from './tipos';

/** Un elemento marcado: su vista y, si está en una lista, cómo traerlo a la vista. */
export type EntradaObjetivo = {
  ref: React.RefObject<View | null>;
  desplazar?: () => Promise<void>;
};

export type Registro = {
  registrar: (id: string, entrada: EntradaObjetivo) => () => void;
  /** Vistas que no son rutas (formularios en modales): se apilan encima de la ruta. */
  entrarPantalla: (nombre: string) => () => void;
};

export type TutorialActivo = { tutorial: Tutorial; paso: number; enGuia: boolean };

export type Estado = {
  activo: TutorialActivo | null;
  /** Hay un tutorial mostrándose o por empezar: los demás avisos esperan. */
  ocupado: boolean;
  /** Guía en curso (desde la ayuda) y los tutoriales que le faltan. */
  guia: { guia: Guia; pendientes: string[] } | null;
  siguiente: () => void;
  /** Salta el paso actual sin contarlo (su elemento no está en pantalla). */
  omitirPaso: () => void;
  saltar: () => void;
  iniciarGuia: (id: string) => void;
  /** Lista de acciones («¿No sabes cómo hacer algo?»). */
  ayudaAbierta: boolean;
  abrirAyuda: () => void;
  cerrarAyuda: () => void;
  /** El botón emergente que ofrece la ayuda. */
  botonAyuda: boolean;
  cerrarBotonAyuda: () => void;
  /** Guías que le sirven a esta cuenta. */
  guias: Guia[];
  buscarObjetivo: (id: string) => EntradaObjetivo[];
};

export const RegistroContext = createContext<Registro>({
  registrar: () => () => {},
  entrarPantalla: () => () => {},
});

const noop = () => {};
export const EstadoContext = createContext<Estado>({
  activo: null,
  ocupado: false,
  guia: null,
  siguiente: noop,
  omitirPaso: noop,
  saltar: noop,
  iniciarGuia: noop,
  ayudaAbierta: false,
  abrirAyuda: noop,
  cerrarAyuda: noop,
  botonAyuda: false,
  cerrarBotonAyuda: noop,
  guias: [],
  buscarObjetivo: () => [],
});

/**
 * La vista que contiene la capa del tutorial (la raíz de la app, o la de un
 * modal). Los elementos se miden respecto de ella.
 */
export const RaizContext = createContext<React.RefObject<View | null> | null>(null);

/**
 * Dentro de la barra superior que se ve (HeaderVitrina). React Navigation
 * dibuja además una copia invisible de los botones de la barra (para su barra
 * nativa, que no usamos): ahí este contexto es false y los <Objetivo enBarra>
 * no se registran, para no señalar la copia.
 */
export const BarraVisibleContext = createContext(false);

export const useRegistroTutorial = () => useContext(RegistroContext);
export const useTutorial = () => useContext(EstadoContext);

