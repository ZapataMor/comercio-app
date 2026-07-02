/**
 * Barra flotante inferior del CLIENTE: dos rectángulos ("Carrito" y
 * "Mis pedidos") con ícono + nombre, fijos en todas las vistas del cliente.
 *
 * Reglas:
 *  - Solo aparece para usuarios con rol 'usuario' y en rutas del cliente.
 *  - Dentro de "Carrito" desaparece el botón Carrito; dentro de "Mis pedidos"
 *    desaparece el botón Mis pedidos (el otro queda solo, centrado).
 *  - En Carrito la barra "sube" para no tapar el pie de Total/Pagar.
 *  - El botón Carrito es, además, el DESTINO de la animación del paquete:
 *    registra su posición y rebota cuando un paquete aterriza.
 */
import React, { useCallback, useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../AuthContext';
import { useCart } from '../CartContext';
import { navigationRef } from '../RootNavigation';
import { c, font, radius, shadow } from '../theme';
import { PressableScale } from './anim';
import { useFlyToCart } from './FlyToCart';
import Icon from './Icon';

/** Rutas del flujo cliente donde la barra queda fija. */
const RUTAS_CLIENTE = new Set([
  'Home',
  'Explorar',
  'Negocio',
  'Carrito',
  'Checkout',
  'MisPedidos',
  'PedidoDetalle',
  'Perfil',
]);

/** Altura aproximada del pie fijo de Carrito (Total + botón de pago). */
const ALTO_PIE_CARRITO = 132;

type Props = { ruta?: string };

export default function BarraCliente({ ruta }: Props) {
  const { auth } = useAuth();
  const esCliente = auth?.user.roles.includes('usuario') ?? false;

  if (!esCliente || !ruta || !RUTAS_CLIENTE.has(ruta)) {
    return null;
  }
  return <Barra ruta={ruta} />;
}

function Barra({ ruta }: { ruta: string }) {
  const insets = useSafeAreaInsets();
  const cart = useCart();
  const { registrarDestino, registrarAterrizaje } = useFlyToCart();

  const mostrarCarrito = ruta !== 'Carrito';
  const mostrarPedidos = ruta !== 'MisPedidos';
  // En Carrito la barra flota por encima del pie de Total/Pagar.
  const bottom = insets.bottom + 14 + (ruta === 'Carrito' ? ALTO_PIE_CARRITO : 0);

  // --- Destino del paquete volador: centro del botón Carrito ---
  const carritoRef = useRef<View>(null);
  const medirCarrito = useCallback(() => {
    carritoRef.current?.measureInWindow((x, y, w, h) => {
      if (Number.isFinite(x)) {
        registrarDestino({ x: x + w / 2, y: y + h / 2 });
      }
    });
  }, [registrarDestino]);

  useEffect(() => {
    if (!mostrarCarrito) {
      registrarDestino(null);
      return;
    }
    // Pequeña espera para que el layout (y el offset de la barra) se asiente.
    const t = setTimeout(medirCarrito, 60);
    return () => clearTimeout(t);
  }, [mostrarCarrito, ruta, medirCarrito, registrarDestino]);

  useEffect(() => () => registrarDestino(null), [registrarDestino]);

  // --- Rebote del carrito al aterrizar un paquete ---
  const rebote = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    registrarAterrizaje(() => {
      rebote.setValue(1);
      Animated.sequence([
        Animated.spring(rebote, { toValue: 1.18, speed: 40, bounciness: 0, useNativeDriver: true }),
        Animated.spring(rebote, { toValue: 1, speed: 20, bounciness: 14, useNativeDriver: true }),
      ]).start();
    });
    return () => registrarAterrizaje(null);
  }, [registrarAterrizaje, rebote]);

  // --- El contador late cuando cambia la cantidad ---
  const badge = useRef(new Animated.Value(1)).current;
  const primeraVez = useRef(true);
  useEffect(() => {
    if (primeraVez.current) {
      primeraVez.current = false;
      return;
    }
    badge.setValue(0.6);
    Animated.spring(badge, { toValue: 1, speed: 30, bounciness: 18, useNativeDriver: true }).start();
  }, [cart.count, badge]);

  return (
    <View style={[styles.zona, { bottom }]} pointerEvents="box-none">
      {/* La key remonta la fila cuando cambia qué botones se ven, para que
          la transición entre en escena con la animación de Entrada. */}
      <Entrada key={`${mostrarCarrito}-${mostrarPedidos}`} style={styles.fila}>
        {mostrarCarrito && (
          <Animated.View
            ref={carritoRef}
            onLayout={medirCarrito}
            style={[styles.flex1, { transform: [{ scale: rebote }] }]}>
            <PressableScale
              style={[styles.boton, styles.botonCarrito]}
              onPress={() => navigationRef.isReady() && navigationRef.navigate('Carrito')}>
              <Icon name="carrito" size={20} color={c.onAccent} strokeWidth={2} />
              <Text style={[styles.botonTxt, styles.botonTxtCarrito]}>Carrito</Text>
              {cart.count > 0 && (
                <Animated.View style={[styles.badge, { transform: [{ scale: badge }] }]}>
                  <Text style={styles.badgeTxt}>{cart.count}</Text>
                </Animated.View>
              )}
            </PressableScale>
          </Animated.View>
        )}
        {mostrarPedidos && (
          <View style={styles.flex1}>
            <PressableScale
              style={[styles.boton, styles.botonPedidos]}
              onPress={() => navigationRef.isReady() && navigationRef.navigate('MisPedidos')}>
              <Icon name="lista" size={20} color={c.onBrand} strokeWidth={2} />
              <Text style={styles.botonTxt}>Mis pedidos</Text>
            </PressableScale>
          </View>
        )}
      </Entrada>
    </View>
  );
}

/** Entra deslizándose desde abajo con fundido (al montar). */
function Entrada({ children, style }: { children: React.ReactNode; style?: object }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, {
      toValue: 1,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [a]);
  const translateY = a.interpolate({ inputRange: [0, 1], outputRange: [56, 0] });
  return (
    <Animated.View style={[style, { opacity: a, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  zona: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  fila: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    width: '100%',
    maxWidth: 460,
  },
  flex1: { flex: 1 },
  boton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 54,
    borderRadius: radius.lg,
  },
  botonCarrito: { backgroundColor: c.accent, ...shadow.gold },
  botonPedidos: { backgroundColor: c.brand, ...shadow.card },
  botonTxt: { fontFamily: font.bold, fontSize: 15, color: c.onBrand },
  botonTxtCarrito: { color: c.onAccent },
  badge: {
    position: 'absolute',
    top: -8,
    right: 14,
    minWidth: 22,
    height: 22,
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    backgroundColor: c.brand,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: c.bg,
  },
  badgeTxt: { color: c.onBrand, fontFamily: font.extra, fontSize: 11 },
});
