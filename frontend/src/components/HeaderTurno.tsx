/**
 * Botón de la topbar, entre la confiabilidad y "Mi perfil", para entrar y
 * salir de turno: una moto en un círculo verde cuando está en turno y una
 * moto apagada cuando no. Solo en turno le llegan los avisos de pedidos
 * listos para recoger.
 *
 * Para que no cambie sin querer, hay que mantenerla presionada
 * (BotonMantener). Un toque solo explica cómo se usa.
 *
 * Solo aparece para el rol domiciliario (y no si está suspendido). El Inicio,
 * que refresca cada 15 s y con cada push, le avisa el turno del servidor con
 * `publicarTurno`.
 */
import React, { useEffect, useState } from 'react';
import { cambiarTurno } from '../api';
import { useAuth } from '../AuthContext';
import { useToast } from '../Toast';
import BotonMantener from './BotonMantener';

type Turno = { enTurno: boolean; vetado: boolean; cambiando: boolean };

// Último turno conocido de la sesión y quienes lo muestran (cada pantalla
// tiene su propia topbar).
let ultimo: { token: string; turno: Turno } | null = null;
const oyentes = new Set<(t: Turno) => void>();

function publicar(token: string, cambios: Partial<Turno>) {
  const base = ultimo?.token === token ? ultimo.turno : { enTurno: false, vetado: false, cambiando: false };
  const turno = { ...base, ...cambios };
  ultimo = { token, turno };
  oyentes.forEach(o => o(turno));
}

/** Comparte el turno recién traído del servidor (viene con los disponibles). */
export function publicarTurno(token: string, enTurno: boolean, vetado: boolean) {
  // Mientras se guarda un cambio, un refresco viejo no lo debe deshacer.
  const cambiando = ultimo?.token === token && ultimo.turno.cambiando;
  publicar(token, cambiando ? { vetado } : { enTurno, vetado });
}

/** Turno del domiciliario y cómo cambiarlo; el mismo en todas las topbars. */
function useTurno() {
  const { auth } = useAuth();
  const token = auth!.token;
  const toast = useToast();
  const [turno, setTurno] = useState<Turno>(() =>
    ultimo?.token === token
      ? ultimo.turno
      : { enTurno: !!auth!.user.en_turno, vetado: false, cambiando: false },
  );

  useEffect(() => {
    oyentes.add(setTurno);
    return () => {
      oyentes.delete(setTurno);
    };
  }, []);

  async function cambiar(valor: boolean) {
    publicar(token, { enTurno: valor, cambiando: true });
    try {
      const mensaje = await cambiarTurno(token, valor);
      publicar(token, { cambiando: false });
      toast.info(valor ? 'En turno' : 'Fuera de turno', mensaje);
    } catch (e) {
      publicar(token, { enTurno: !valor, cambiando: false });
      toast.error('No se pudo cambiar', e instanceof Error ? e.message : 'Error');
    }
  }

  return { ...turno, cambiar };
}

export default function HeaderTurno() {
  const { auth } = useAuth();
  if (!auth?.user.roles.includes('domiciliario')) {
    return null;
  }
  return <BotonTurno />;
}

function BotonTurno() {
  const toast = useToast();
  const { enTurno, vetado, cambiando, cambiar } = useTurno();

  // Suspendido no puede tomar pedidos: el turno no le sirve de nada.
  if (vetado) {
    return null;
  }

  return (
    <BotonMantener
      icon="moto"
      encendido={enTurno}
      ocupado={cambiando}
      accessibilityLabel="En turno"
      onCambiar={() => cambiar(!enTurno)}
      onToque={() => toast.info('Mantenla presionada', enTurno ? 'Así sales de turno.' : 'Así entras en turno.')}
    />
  );
}
