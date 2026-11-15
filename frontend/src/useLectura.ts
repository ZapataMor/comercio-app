import { DependencyList, EffectCallback, useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { alReintentarRed } from './red';

/** Reintenta solamente las cargas de datos; nunca repite acciones de escritura. */
function useRevisionLectura() {
  const [revision, setRevision] = useState(0);
  useEffect(() => alReintentarRed(() => setRevision(v => v + 1)), []);
  return revision;
}
export function useLectura(effect: EffectCallback, deps: DependencyList) {
  const revision = useRevisionLectura();
  // Las dependencias pertenecen al efecto de lectura del consumidor.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(effect, [...deps, revision]);
}
export function useLecturaEnFoco(effect: EffectCallback) {
  const revision = useRevisionLectura();
  // revision invalida el efecto aunque el callback del consumidor siga siendo el mismo.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useFocusEffect(useCallback(() => effect(), [effect, revision]));
}
