/**
 * Barra de Explorar, como la de Instagram: una píldora flotante abajo con los
 * tres catálogos (Productos, Servicios y Propiedades), solo con íconos, y al
 * final "Mi perfil" (la inicial de la persona), que despliega hacia arriba
 * el mismo menú de la topbar (MenuDesplegable). El activo lleva una píldora
 * suave detrás; tocar otro catálogo lo cambia.
 *
 * Mientras la lista se desplaza la barra se encoge (sin volverse
 * transparente) y al quedarse quieta vuelve a su tamaño: ver
 * encogerAlDesplazar. Las listas avisan con `useDesplazarCatalogo()`.
 *
 * Flota sobre el contenido (Explorar es bordeABorde en App.tsx): las listas
 * dejan abajo `espacioAbajo` para que lo último no quede tapado. Con el
 * teclado abierto (escribiendo en el buscador) se esconde.
 */
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Animated, Keyboard, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../AuthContext';
import { avisarDesplazamiento, encogida } from '../encogerAlDesplazar';
import { SeccionCatalogo } from '../navTypes';
import { font, makeStyles, radius, useTheme } from '../theme';
import { Objetivo } from '../tutorial/Objetivo';
import { useOpcionesPerfil } from './HeaderPerfil';
import Icon, { IconName } from './Icon';
import MenuDesplegable from './MenuDesplegable';

export const SECCIONES: { valor: SeccionCatalogo; titulo: string; icono: IconName }[] = [
  { valor: 'productos', titulo: 'Productos', icono: 'bolsa' },
  { valor: 'servicios', titulo: 'Servicios', icono: 'herramientas' },
  { valor: 'propiedades', titulo: 'Propiedades', icono: 'casa' },
];

/** Alto de la barra y su distancia al borde de abajo (sobre el área segura). */
export const ALTO_BARRA_CATALOGO = 64;
export const MARGEN_BARRA_CATALOGO = 10;

/** Tamaño de la barra encogida (al desplazarse) respecto del normal. */
const ESCALA_ENCOGIDA = 0.84;

type Desplazamiento = { alDesplazar: () => void; espacioAbajo: number };
const DesplazamientoContexto = createContext<Desplazamiento>({ alDesplazar: avisarDesplazamiento, espacioAbajo: 0 });
export const ProveedorDesplazamiento = DesplazamientoContexto.Provider;

/** Para las listas de Explorar: su onScroll y el aire que dejan abajo. */
export function useDesplazarCatalogo() {
  return useContext(DesplazamientoContexto);
}

export default function BarraCatalogo({
  seccion,
  onCambiar,
  abajo,
}: {
  seccion: SeccionCatalogo;
  onCambiar: (seccion: SeccionCatalogo) => void;
  /** Distancia al borde de abajo de la pantalla. */
  abajo: number;
}) {
  const { c } = useTheme();
  const styles = useStyles();
  const teclado = useTecladoAbierto();
  if (teclado) return null;

  const escala = encogida.interpolate({ inputRange: [0, 1], outputRange: [1, ESCALA_ENCOGIDA] });
  // Encoge hacia abajo: el borde inferior se queda en su sitio.
  const bajar = encogida.interpolate({
    inputRange: [0, 1],
    outputRange: [0, (ALTO_BARRA_CATALOGO * (1 - ESCALA_ENCOGIDA)) / 2],
  });

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.zona, { bottom: abajo, transform: [{ translateY: bajar }, { scale: escala }] }]}>
      <Objetivo id="catalogo.selector" style={styles.barra} accessibilityRole="tablist">
        <View style={[StyleSheet.absoluteFill, styles.fondo]} />
        {SECCIONES.map(s => {
          const activa = s.valor === seccion;
          return (
            <Pressable
              key={s.valor}
              style={styles.pestana}
              accessibilityRole="tab"
              accessibilityLabel={s.titulo}
              accessibilityState={{ selected: activa }}
              onPress={() => !activa && onCambiar(s.valor)}>
              <View style={styles.marca}>
                <FondoActivo visible={activa} />
                <Icon name={s.icono} size={26} color={c.textStrong} strokeWidth={activa ? 2.4 : 1.9} />
              </View>
            </Pressable>
          );
        })}
        <Objetivo id="perfil.menu" style={styles.pestanaPerfil}>
          <PestanaPerfil />
        </Objetivo>
      </Objetivo>
    </Animated.View>
  );
}

/**
 * "Mi perfil": la inicial de la persona. Despliega hacia arriba el menú de la
 * cuenta, angosto como el de la topbar; el ícono queda nítido encima del
 * desenfoque (MenuDesplegable dibuja ahí una copia de este botón).
 */
function PestanaPerfil() {
  const styles = useStyles();
  const opciones = useOpcionesPerfil();
  return (
    <MenuDesplegable
      icono="usuario"
      etiqueta="Mi perfil"
      renglones={opciones}
      haciaArriba
      estilo={styles.pestanaPerfil}
      boton={(abierto, onPress) => <BotonPerfil abierto={abierto} onPress={onPress} />}
    />
  );
}

function BotonPerfil({ abierto, onPress }: { abierto: boolean; onPress: () => void }) {
  const { c } = useTheme();
  const styles = useStyles();
  const { auth } = useAuth();
  const inicial = auth?.user.name.trim().charAt(0).toUpperCase() || '?';
  return (
    <Pressable
      style={styles.pestana}
      accessibilityRole="button"
      accessibilityLabel="Mi perfil"
      accessibilityState={{ expanded: abierto }}
      onPress={onPress}>
      <View style={styles.marca}>
        <FondoActivo visible={abierto} />
        <View style={[styles.avatar, { borderColor: abierto ? c.textStrong : 'transparent' }]}>
          <Text style={styles.avatarTxt}>{inicial}</Text>
        </View>
      </View>
    </Pressable>
  );
}

/**
 * La píldora suave detrás del ícono activo. Siempre está montada y solo se
 * muestra u oculta: si el fondo se le agrega a una vista que ya estaba en
 * pantalla, Android (RN 0.86) la dibuja sin las esquinas redondeadas.
 */
function FondoActivo({ visible }: { visible: boolean }) {
  const styles = useStyles();
  return <View pointerEvents="none" style={[styles.fondoActivo, { opacity: visible ? 1 : 0 }]} />;
}

function useTecladoAbierto() {
  const [abierto, setAbierto] = useState(() => Keyboard.isVisible());
  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const subs = [
      Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', () => setAbierto(true)),
      Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setAbierto(false)),
    ];
    return () => subs.forEach(sub => sub.remove());
  }, []);
  return abierto;
}

const useStyles = makeStyles((c, shadow) => ({
  zona: { position: 'absolute', left: 20, right: 20, alignItems: 'center' },
  barra: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: 420,
    height: ALTO_BARRA_CATALOGO,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
  },
  fondo: {
    borderRadius: radius.pill,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    ...shadow.card,
  },
  pestana: { flex: 1, alignItems: 'center', justifyContent: 'center', height: '100%' },
  pestanaPerfil: { flex: 1, height: '100%' },
  marca: {
    width: 72,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Radio exacto (la mitad del alto): con radius.pill (999) algunos
  // teléfonos dibujan la píldora con esquinas rectas.
  fondoActivo: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 24,
    backgroundColor: c.surface2,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    // Con el menú abierto el borde se pinta: un aro como el de la foto de
    // perfil en Instagram (el ancho va siempre, por lo mismo que FondoActivo).
    borderWidth: 2,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTxt: { color: c.onAccent, fontFamily: font.displayExtra, fontSize: 14 },
}));
