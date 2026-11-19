/**
 * Aviso emergente para el cliente al que le falta información para pedir
 * (hoy, la dirección: ya no se pide al registrarse). Sale una vez por cada
 * vez que se abre la app, al llegar a Explorar, y lleva a completarla.
 *
 * Si hay un tutorial en pantalla, espera a que termine.
 *
 * Qué información se exige está en REQUISITOS_CLIENTE: agregar o quitar uno
 * ahí basta para cambiar lo que se pide.
 */
import { useEffect, useRef } from 'react';
import { Usuario } from '../api';
import { useAuth } from '../AuthContext';
import { navigationRef } from '../RootNavigation';
import { useTutorial } from '../tutorial/contexto';
import { useConfirmar } from './Confirmacion';
import { IconName } from './Icon';

type Requisito = {
  icono: IconName;
  /** Lo que se le dice que falta. */
  texto: string;
  cumple: (u: Usuario) => boolean;
  /** Pantalla donde se completa. */
  completar: () => void;
};

export const REQUISITOS_CLIENTE: Requisito[] = [
  {
    icono: 'ubicacion',
    texto: 'Tu dirección de entrega, para saber a dónde llevar tus pedidos.',
    cumple: u => !!u.direccion?.trim(),
    completar: () => navigationRef.navigate('MisDirecciones'),
  },
];

/** Lo que le falta al cliente para poder hacer pedidos. */
export function faltantesCliente(u: Usuario): Requisito[] {
  return REQUISITOS_CLIENTE.filter(r => !r.cumple(u));
}

export default function AvisoCompletarInfo({ ruta, listo }: { ruta?: string; listo: boolean }) {
  const { auth } = useAuth();
  const confirmar = useConfirmar();
  const { ocupado } = useTutorial();
  // Una vez por cuenta mientras la app siga abierta.
  const avisado = useRef<number | null>(null);
  const user = auth?.user;

  useEffect(() => {
    if (!listo || ocupado || !user || ruta !== 'Explorar' || avisado.current === user.id) return;
    if (!user.roles.includes('usuario')) return;
    const faltan = faltantesCliente(user);
    if (faltan.length === 0) return;
    // Un instante para que Explorar termine de aparecer.
    const t = setTimeout(() => {
      // Si ya se fue de Explorar (p. ej. tocó una notificación), espera a que vuelva.
      if (!navigationRef.isReady() || navigationRef.getCurrentRoute()?.name !== 'Explorar') return;
      avisado.current = user.id;
      confirmar({
        icono: faltan[0].icono,
        titulo: 'Completa tu información',
        texto: 'Para poder hacer pedidos necesitamos:',
        puntos: faltan.map(f => ({ icono: f.icono, texto: f.texto })),
        textoBoton: 'Completar ahora',
        textoCancelar: 'Ahora no',
        accion: () => {
          if (navigationRef.isReady()) faltan[0].completar();
        },
      });
    }, 600);
    return () => clearTimeout(t);
  }, [listo, ocupado, user, ruta, confirmar]);

  return null;
}
