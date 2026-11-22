/**
 * Botones flotantes del CLIENTE: dos círculos solo con ícono ("Carrito" y
 * "Mis pedidos") abajo a la izquierda, fijos en todas las vistas del cliente.
 * En Explorar van encima de la barra de catálogos (BarraCatalogo).
 *
 * Reglas:
 *  - Solo aparece para usuarios con rol 'usuario' y en rutas del cliente. El
 *    Inicio del comerciante (Home) y "Mis entregas" no lo son: quien también es
 *    cliente la ve al pasar a Explorar.
 *  - En "Carrito", "Confirmar pedido" (Checkout) y "Mis pedidos" la barra no
 *    se muestra: son pasos de compra/consulta y sobraría un botón flotante.
 *  - Viendo servicios (en Explorar o en una tienda) o propiedades tampoco se
 *    muestra: ahí no se compra nada, los servicios se agendan como citas.
 *  - En el Seguimiento de un pedido no va "Mis pedidos" (la flecha de atrás ya
 *    lleva allí), y "Carrito" solo si tiene productos.
 *  - En el Mapa tampoco: ahí estorba ver los negocios.
 *  - El botón Carrito es, además, el DESTINO de la animación del paquete:
 *    registra su posición y rebota cuando un paquete aterriza.
 */
import React, { useCallback, useEffect, useRef } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../AuthContext';
import { useCart } from '../CartContext';
import { SeccionCatalogo } from '../navTypes';
import { navigationRef } from '../RootNavigation';
import { font, makeStyles, radius, useTheme } from '../theme';
import { Objetivo } from '../tutorial/Objetivo';
import { PressableScale } from './anim';
import { ALTO_BARRA_CATALOGO } from './BarraCatalogo';
import { useFlyToCart } from './FlyToCart';
import Icon from './Icon';

/** Rutas del flujo cliente donde la barra queda fija. */
const RUTAS_CLIENTE = new Set([
  'Explorar',
  'Negocio',
  'PedidoDetalle',
]);

/** Diámetro de los botones y su distancia al borde inferior (sobre el área segura). */
export const ALTO_BARRA_CLIENTE = 54;
export const MARGEN_BARRA_CLIENTE = 14;

type Props = { ruta?: string; seccion?: SeccionCatalogo };

export default function BarraCliente({ ruta, seccion }: Props) {
  const { auth } = useAuth();
  const esCliente = auth?.user.roles.includes('usuario') ?? false;

  if (!esCliente || !ruta || !RUTAS_CLIENTE.has(ruta) || seccion === 'servicios' || seccion === 'propiedades') {
    return null;
  }
  return <Barra ruta={ruta} />;
}

function Barra({ ruta }: { ruta: string }) {
  const { c } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const cart = useCart();
  const { registrarDestino, registrarAterrizaje } = useFlyToCart();

  const enSeguimiento = ruta === 'PedidoDetalle';
  const mostrarCarrito = !enSeguimiento || cart.count > 0;
  const mostrarPedidos = !enSeguimiento;
  const bottom = insets.bottom + MARGEN_BARRA_CLIENTE + (ruta === 'Explorar' ? ALTO_BARRA_CATALOGO : 0);

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
            style={{ transform: [{ scale: rebote }] }}>
            <Objetivo id="barra.carrito">
              <PressableScale
                style={[styles.boton, styles.botonCarrito]}
                scaleTo={0.9}
                accessibilityRole="button"
                accessibilityLabel={cart.count > 0 ? `Carrito, ${cart.count} en total` : 'Carrito'}
                onPress={() => navigationRef.isReady() && navigationRef.navigate('Carrito')}>
                <Icon name="carrito" size={24} color={c.onAccent} strokeWidth={2} />
              </PressableScale>
            </Objetivo>
            {cart.count > 0 && (
              <Animated.View pointerEvents="none" style={[styles.badge, { transform: [{ scale: badge }] }]}>
                <Text style={styles.badgeTxt}>{cart.count}</Text>
              </Animated.View>
            )}
          </Animated.View>
        )}
        {mostrarPedidos && (
          <Objetivo id="barra.pedidos">
            <PressableScale
              style={[styles.boton, styles.botonPedidos]}
              scaleTo={0.9}
              accessibilityRole="button"
              accessibilityLabel="Mis pedidos"
              onPress={() => navigationRef.isReady() && navigationRef.navigate('MisPedidos')}>
              <Icon name="lista" size={24} color={c.onBrand} strokeWidth={2} />
            </PressableScale>
          </Objetivo>
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

const useStyles = makeStyles((c, shadow) => ({
  // Abajo a la izquierda: deja libre el resto del ancho para ver la lista.
  zona: { position: 'absolute', left: 20 },
  fila: { flexDirection: 'row', gap: 12 },
  boton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: ALTO_BARRA_CLIENTE,
    height: ALTO_BARRA_CLIENTE,
    borderRadius: radius.pill,
  },
  botonCarrito: { backgroundColor: c.accent, ...shadow.gold },
  botonPedidos: { backgroundColor: c.brand, ...shadow.card },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
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
}));
