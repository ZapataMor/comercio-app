/**
 * Que el botón atrás (o «Cancelar», o deslizar para cerrar) no borre sin
 * preguntar lo que alguien llenó en un formulario.
 *
 *   const hayCambios = useHayCambios(JSON.stringify([nombre, precio]), abierto);
 *   const { preguntar, salirSinPreguntar } = useSalirSinGuardar(hayCambios);
 *   <Modal onRequestClose={() => preguntar(cerrar)}>
 *
 * Si la pantalla se cierra con el formulario a medias (atrás, gesto o el menú),
 * también pregunta. Tras guardar, `salirSinPreguntar()` antes de navegar.
 */
import { useNavigation } from '@react-navigation/native';
import { useCallback, useEffect, useRef } from 'react';
import { useConfirmar } from './components/Confirmacion';

/**
 * true cuando `formulario` (los campos pasados a texto) cambió desde que se
 * abrió (`abierto` pasó a true). Al cerrarse, la próxima vez se toma de nuevo.
 */
export function useHayCambios(formulario: string, abierto: boolean): boolean {
  const inicial = useRef<string | null>(null);
  useEffect(() => {
    if (!abierto) inicial.current = null;
    else if (inicial.current === null) inicial.current = formulario;
  }, [abierto, formulario]);
  return abierto && inicial.current !== null && inicial.current !== formulario;
}

export function useSalirSinGuardar(hayCambios: boolean) {
  const navigation = useNavigation();
  const confirmar = useConfirmar();
  const sinPreguntar = useRef(false);

  const preguntar = useCallback(
    (salir: () => void) => {
      if (!hayCambios) {
        salir();
        return;
      }
      confirmar({
        icono: 'alerta',
        titulo: '¿Salir sin guardar?',
        texto: 'Lo que escribiste se va a perder.',
        textoBoton: 'Salir sin guardar',
        textoCancelar: 'Seguir llenando',
        peligro: true,
        accion: salir,
      });
    },
    [hayCambios, confirmar],
  );

  useEffect(
    () =>
      navigation.addListener('beforeRemove', e => {
        if (!hayCambios || sinPreguntar.current) return;
        e.preventDefault();
        preguntar(() => {
          sinPreguntar.current = true;
          navigation.dispatch(e.data.action);
        });
      }),
    [navigation, hayCambios, preguntar],
  );

  const salirSinPreguntar = useCallback(() => {
    sinPreguntar.current = true;
  }, []);

  return { preguntar, salirSinPreguntar };
}
