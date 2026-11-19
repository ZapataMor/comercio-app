/**
 * Botón "Mis negocios" de la topbar, justo antes de "Mi perfil" (lo pone
 * HeaderPerfil, así sale en todas las pantallas con el ícono de usuario). Al tocarlo despliega (como el menú de "Mi perfil") la lista
 * de los negocios de la persona, con el que gestiona ahora marcado; tocar
 * otro lo deja como negocio activo y el Inicio pasa a administrarlo.
 *
 * Solo aparece si la persona tiene algún negocio.
 */
import React from 'react';
import { Text } from 'react-native';
import { useNegocio } from '../NegocioContext';
import { navigationRef } from '../RootNavigation';
import { font, makeStyles } from '../theme';
import MenuDesplegable, { OpcionMenu } from './MenuDesplegable';
import { Objetivo } from '../tutorial/Objetivo';

export default function HeaderNegocios() {
  const styles = useStyles();
  const { negocios, negocio, seleccionar } = useNegocio();

  if (negocios.length === 0) {
    return null;
  }

  function abrir(id: number) {
    seleccionar(id);
    if (navigationRef.getCurrentRoute()?.name !== 'Home') {
      navigationRef.navigate('Home');
    }
  }

  return (
    <Objetivo id="negocios.selector" enBarra>
    <MenuDesplegable
      icono="negocios"
      etiqueta="Mis negocios"
      ancho={260}
      renglones={elegir => [
        <Text style={styles.titulo}>Tus negocios</Text>,
        ...negocios.map(n => (
          <OpcionMenu
            icono="tienda"
            titulo={n.nombre}
            detalle={`${n.rol === 'propietario' ? 'Propietario' : 'Trabajador'} · ${n.estado_texto ?? (n.activo ? 'Abierto' : 'Cerrado')}`}
            activa={n.id === negocio?.id}
            onPress={() => elegir(() => abrir(n.id))}
          />
        )),
      ]}
    />
    </Objetivo>
  );
}

const useStyles = makeStyles(c => ({
  titulo: { fontSize: 13, fontFamily: font.bold, color: c.muted, paddingHorizontal: 4, paddingTop: 2 },
}));
