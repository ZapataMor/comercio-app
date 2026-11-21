/**
 * Tutoriales de principiante: en cada pantalla, paso a paso, un recuadro sobre
 * lo que hay que mirar y una tarjeta que lo explica (ver CapaTutorial).
 *
 * - Cada tutorial se muestra solo la primera vez que la persona llega a su
 *   pantalla (se recuerda por cuenta, en este teléfono).
 * - Desde «¿No sabes cómo hacer algo?» se elige una acción (una Guia): la app
 *   lleva a la primera pantalla y muestra el tutorial de cada pantalla por la
 *   que pasa esa acción, aunque ya lo hubiera visto.
 * - Si la persona parece trabada (repite lo mismo, toca sin parar, le salen
 *   errores seguidos o se queda quieta mucho rato), aparece el botón
 *   «¿No sabes cómo hacer algo?» (ver BotonAyuda).
 *
 * Los elementos se marcan con <Objetivo id="…"> o useObjetivo('…'); los
 * tutoriales y las guías están en guias.ts.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '../AuthContext';
import { navigationRef } from '../RootNavigation';
import { GUIAS, TUTORIALES } from './guias';
import { DetectorTropiezos, suscribirTropiezos } from './tropiezos';
import { Guia, Tutorial } from './tipos';
import { EntradaObjetivo, Estado, EstadoContext, RegistroContext, TutorialActivo } from './contexto';

export { useRegistroTutorial, useTutorial } from './contexto';
export type { EntradaObjetivo, TutorialActivo } from './contexto';

const claveVistos = (userId: number) => `vitrina.tutoriales.v1.${userId}`;

/** Espera tras llegar a una pantalla (que termine la transición) antes de empezar. */
const ESPERA_INICIO = 700;
/** Lo máximo que se espera a que aparezca el primer elemento señalado. */
const ESPERA_OBJETIVO = 2500;
/** Tras mostrarse, el botón de ayuda no vuelve a salir en este tiempo. */
const PAUSA_BOTON_AYUDA = 3 * 60 * 1000;

type Pantalla = { nombre: string; params?: Record<string, unknown> };

function rutaActual(): Pantalla | null {
  if (!navigationRef.isReady()) return null;
  const r = navigationRef.getCurrentRoute();
  return r ? { nombre: r.name, params: r.params as Record<string, unknown> | undefined } : null;
}

/** `listo`: terminó el splash (antes no se muestra nada). */
export function TutorialProvider({ children, listo }: { children: React.ReactNode; listo: boolean }) {
  const { auth, porCompletar } = useAuth();
  const user = auth?.user ?? null;
  // Antes de la app («Crea tu clave», «Completa tu cuenta») no se ofrece ayuda.
  const antesDeLaApp = !!user && (user.tiene_pin === false || porCompletar === user.id);
  const antesDeLaAppRef = useRef(antesDeLaApp);
  antesDeLaAppRef.current = antesDeLaApp;

  // --- Elementos marcados -------------------------------------------------
  const objetivos = useRef(new Map<string, EntradaObjetivo[]>());
  const registrar = useCallback((id: string, entrada: EntradaObjetivo) => {
    const lista = objetivos.current.get(id) ?? [];
    objetivos.current.set(id, [...lista, entrada]);
    return () => {
      const actual = objetivos.current.get(id) ?? [];
      const resto = actual.filter(e => e !== entrada);
      if (resto.length) objetivos.current.set(id, resto);
      else objetivos.current.delete(id);
    };
  }, []);
  // El más reciente primero: la pantalla de arriba de la pila se montó después.
  const buscarObjetivo = useCallback((id: string) => [...(objetivos.current.get(id) ?? [])].reverse(), []);

  // --- Pantalla actual ----------------------------------------------------
  const [ruta, setRuta] = useState<Pantalla | null>(null);
  const [virtuales, setVirtuales] = useState<string[]>([]);
  useEffect(() => {
    const actualizar = () => {
      const r = rutaActual();
      setRuta(prev => (prev?.nombre === r?.nombre && prev?.params === r?.params ? prev : r));
    };
    const quitar = navigationRef.addListener('state', actualizar);
    // Respaldo: el contenedor se rearma al cambiar de cuenta.
    const timer = setInterval(actualizar, 1000);
    actualizar();
    return () => {
      quitar?.();
      clearInterval(timer);
    };
  }, []);
  const entrarPantalla = useCallback((nombre: string) => {
    setVirtuales(prev => [...prev, nombre]);
    return () =>
      setVirtuales(prev => {
        const i = prev.lastIndexOf(nombre);
        return i < 0 ? prev : [...prev.slice(0, i), ...prev.slice(i + 1)];
      });
  }, []);
  const pantalla = useMemo<Pantalla | null>(
    () => (virtuales.length ? { nombre: virtuales[virtuales.length - 1] } : ruta),
    [virtuales, ruta],
  );

  // --- Tutoriales vistos (por cuenta) ------------------------------------
  const [vistos, setVistos] = useState<Set<string> | null>(null);
  useEffect(() => {
    setVistos(null);
    if (!user) return;
    let vigente = true;
    AsyncStorage.getItem(claveVistos(user.id))
      .then(v => {
        if (!vigente) return;
        let lista: unknown = [];
        try {
          lista = v ? JSON.parse(v) : [];
        } catch {
          lista = [];
        }
        setVistos(new Set(Array.isArray(lista) ? lista.filter(x => typeof x === 'string') : []));
      })
      .catch(() => vigente && setVistos(new Set()));
    return () => {
      vigente = false;
    };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const marcarVisto = useCallback(
    (id: string) => {
      if (!user) return;
      setVistos(prev => {
        const nuevo = new Set(prev ?? []);
        nuevo.add(id);
        AsyncStorage.setItem(claveVistos(user.id), JSON.stringify([...nuevo])).catch(() => {});
        return nuevo;
      });
    },
    [user],
  );

  // --- Tutorial activo y guía ----------------------------------------------
  const [activo, setActivo] = useState<TutorialActivo | null>(null);
  const [guia, setGuia] = useState<{ guia: Guia; pendientes: string[] } | null>(null);
  const [esperando, setEsperando] = useState(false);

  // Al salir de la cuenta o cambiar de cuenta, se apaga todo.
  useEffect(() => {
    setActivo(null);
    setGuia(null);
  }, [user?.id]);

  // Si la persona se va de la pantalla, el tutorial de esa pantalla se cierra
  // (sin darlo por visto: volverá a salir).
  useEffect(() => {
    if (activo && pantalla?.nombre !== activo.tutorial.pantalla) setActivo(null);
  }, [pantalla?.nombre, activo]);

  const candidato = useMemo((): { tutorial: Tutorial; enGuia: boolean } | null => {
    if (!listo || !user || !pantalla || !vistos) return null;
    const ctx = { user, params: pantalla.params };
    const aplica = (t: Tutorial) => t.pantalla === pantalla.nombre && (t.cuando?.(ctx) ?? true);
    if (guia) {
      const t = TUTORIALES.find(x => guia.pendientes.includes(x.id) && aplica(x));
      if (t) return { tutorial: t, enGuia: true };
    }
    const t = TUTORIALES.find(x => x.auto !== false && !vistos.has(x.id) && aplica(x));
    return t ? { tutorial: t, enGuia: false } : null;
  }, [listo, user, pantalla, vistos, guia]);

  // La pantalla al momento de cada intento (no la del cierre del efecto).
  const pantallaRef = useRef(pantalla);
  pantallaRef.current = pantalla;

  // Arranca el candidato cuando la pantalla se asienta y su primer elemento ya está.
  useEffect(() => {
    if (activo || !candidato) {
      setEsperando(false);
      return;
    }
    setEsperando(true);
    const nombre = pantalla?.nombre;
    const primero = candidato.tutorial.pasos.find(p => p.objetivo)?.objetivo;
    const inicio = Date.now();
    let timer: ReturnType<typeof setTimeout>;
    const intentar = () => {
      if (pantallaRef.current?.nombre !== nombre) return;
      const hay = !primero || objetivos.current.has(primero);
      if (hay || Date.now() - inicio > ESPERA_OBJETIVO) {
        setActivo({ tutorial: candidato.tutorial, paso: 0, enGuia: candidato.enGuia });
        setEsperando(false);
        return;
      }
      timer = setTimeout(intentar, 150);
    };
    timer = setTimeout(intentar, ESPERA_INICIO);
    return () => clearTimeout(timer);
  }, [candidato, activo]); // eslint-disable-line react-hooks/exhaustive-deps

  const activoRef = useRef(activo);
  activoRef.current = activo;

  const terminar = useCallback(
    (completo: boolean) => {
      const prev = activoRef.current;
      if (!prev) return;
      activoRef.current = null;
      setActivo(null);
      marcarVisto(prev.tutorial.id);
      if (!prev.enGuia) return;
      setGuia(g => {
        if (!g) return g;
        if (!completo) return null; // «Saltar» dentro de una guía la termina.
        const pendientes = g.pendientes.filter(id => id !== prev.tutorial.id);
        return pendientes.length ? { ...g, pendientes } : null;
      });
    },
    [marcarVisto],
  );

  const avanzar = useCallback(() => {
    const prev = activoRef.current;
    if (!prev) return;
    if (prev.paso + 1 >= prev.tutorial.pasos.length) {
      terminar(true);
      return;
    }
    const nuevo = { ...prev, paso: prev.paso + 1 };
    activoRef.current = nuevo;
    setActivo(nuevo);
  }, [terminar]);

  const saltar = useCallback(() => terminar(false), [terminar]);

  const iniciarGuia = useCallback(
    (id: string) => {
      const g = GUIAS.find(x => x.id === id);
      if (!g || !user) return;
      setAyudaAbierta(false);
      setBotonAyuda(false);
      setActivo(null);
      setGuia({ guia: g, pendientes: [...g.tutoriales] });
      if (navigationRef.isReady()) g.ir(user);
    },
    [user],
  );

  // --- Ayuda: lista de acciones y botón emergente ---------------------------
  const [ayudaAbierta, setAyudaAbierta] = useState(false);
  const [botonAyuda, setBotonAyuda] = useState(false);
  const ultimoBoton = useRef(0);
  const ocupadoRef = useRef(false);
  ocupadoRef.current = !!activo || esperando || ayudaAbierta;

  const ofrecerAyuda = useCallback(() => {
    if (!user || antesDeLaAppRef.current || ocupadoRef.current || AppState.currentState !== 'active') return;
    if (Date.now() - ultimoBoton.current < PAUSA_BOTON_AYUDA) return;
    ultimoBoton.current = Date.now();
    setBotonAyuda(true);
  }, [user]);

  const detector = useRef<DetectorTropiezos | null>(null);
  if (!detector.current) detector.current = new DetectorTropiezos();
  useEffect(() => {
    detector.current!.alTropezar = ofrecerAyuda;
  }, [ofrecerAyuda]);
  useEffect(() => suscribirTropiezos(t => detector.current!.registrar(t)), []);
  useEffect(() => {
    if (pantalla?.nombre) detector.current!.registrar({ tipo: 'pantalla', nombre: pantalla.nombre });
  }, [pantalla?.nombre]);
  // Quieto mucho rato en la misma pantalla (sin contar el tiempo fuera de la app
  // ni el que pasa leyendo un tutorial).
  useEffect(() => {
    if (!user || !listo) return;
    const timer = setInterval(() => {
      if (ocupadoRef.current) detector.current!.despertar();
      else detector.current!.revisarQuietud(Date.now());
    }, 5000);
    const sub = AppState.addEventListener('change', e => e === 'active' && detector.current!.despertar());
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [user, listo]);

  const guias = useMemo(() => (user ? GUIAS.filter(g => g.para(user)) : []), [user]);

  const registro = useMemo(() => ({ registrar, entrarPantalla }), [registrar, entrarPantalla]);
  const estado = useMemo<Estado>(
    () => ({
      activo,
      ocupado: !!activo || esperando || !!candidato,
      guia,
      siguiente: avanzar,
      omitirPaso: avanzar,
      saltar,
      iniciarGuia,
      ayudaAbierta,
      abrirAyuda: () => {
        setBotonAyuda(false);
        setAyudaAbierta(true);
      },
      cerrarAyuda: () => setAyudaAbierta(false),
      botonAyuda: botonAyuda && !activo && !ayudaAbierta,
      cerrarBotonAyuda: () => setBotonAyuda(false),
      guias,
      buscarObjetivo,
    }),
    [activo, esperando, candidato, guia, avanzar, saltar, iniciarGuia, ayudaAbierta, botonAyuda, guias, buscarObjetivo],
  );

  return (
    <RegistroContext.Provider value={registro}>
      <EstadoContext.Provider value={estado}>{children}</EstadoContext.Provider>
    </RegistroContext.Provider>
  );
}
