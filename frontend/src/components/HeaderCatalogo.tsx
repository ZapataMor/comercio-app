/**
 * Junto al ícono de usuario en Explorar: el catálogo que se está viendo
 * (Productos, Servicios o Propiedades). Al tocarlo despliega las tres
 * opciones, como el menú del perfil, y la elegida cambia el catálogo.
 */
import React from 'react';
import { View } from 'react-native';
import { SeccionCatalogo } from '../navTypes';
import { makeStyles } from '../theme';
import HeaderPerfil from './HeaderPerfil';
import { IconName } from './Icon';
import MenuDesplegable, { OpcionMenu } from './MenuDesplegable';
import { Objetivo } from '../tutorial/Objetivo';

export const SECCIONES: { valor: SeccionCatalogo; titulo: string; detalle: string; icono: IconName }[] = [
  { valor: 'productos', titulo: 'Productos', detalle: 'Comida, mercado, ropa y más', icono: 'bolsa' },
  { valor: 'servicios', titulo: 'Servicios', detalle: 'Peluquerías, talleres y citas', icono: 'herramientas' },
  { valor: 'propiedades', titulo: 'Propiedades', detalle: 'Casas en venta, alquiler y patios', icono: 'casa' },
];

export default function HeaderCatalogo({
  seccion,
  onCambiar,
}: {
  seccion: SeccionCatalogo;
  onCambiar: (seccion: SeccionCatalogo) => void;
}) {
  const styles = useStyles();
  const actual = SECCIONES.find(s => s.valor === seccion) ?? SECCIONES[0];
  return (
    <View style={styles.fila}>
      <Objetivo id="catalogo.selector" enBarra>
      <MenuDesplegable
        icono={actual.icono}
        texto={actual.titulo}
        enTopbar
        etiqueta={`Catálogo: ${actual.titulo}. Cambiar de catálogo`}
        ancho={260}
        renglones={elegir =>
          SECCIONES.map(s => (
            <OpcionMenu
              key={s.valor}
              icono={s.icono}
              titulo={s.titulo}
              detalle={s.detalle}
              activa={s.valor === seccion}
              onPress={() => elegir(() => s.valor !== seccion && onCambiar(s.valor))}
            />
          ))
        }
      />
      </Objetivo>
      <HeaderPerfil />
    </View>
  );
}

const useStyles = makeStyles(() => ({
  fila: { flexDirection: 'row', alignItems: 'center', gap: 10 },
}));
