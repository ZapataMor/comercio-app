/**
 * Notificaciones tipo "toast" con estilo de la app.
 * Aparecen arriba a la derecha, de forma temporal, y se cierran solas.
 * Reemplazan a los `Alert.alert` genéricos para avisos (no para confirmaciones).
 *
 * Uso:
 *   const toast = useToast();
 *   toast.exito('Listo', 'Negocio actualizado.');
 *   toast.error('No se pudo guardar', mensaje);
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { c, font, radius } from './theme';

type Tipo = 'exito' | 'error' | 'info';

type ToastItem = { id: number; tipo: Tipo; titulo: string; mensaje?: string };

type ToastApi = {
  mostrar: (tipo: Tipo, titulo: string, mensaje?: string) => void;
  exito: (titulo: string, mensaje?: string) => void;
  error: (titulo: string, mensaje?: string) => void;
  info: (titulo: string, mensaje?: string) => void;
};

const noop = () => {};
const ToastContext = createContext<ToastApi>({
  mostrar: noop,
  exito: noop,
  error: noop,
  info: noop,
});

const DURACION = 2800; // ms visible antes de cerrarse solo

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const quitar = useCallback((id: number) => {
    setItems(prev => prev.filter(t => t.id !== id));
  }, []);

  const mostrar = useCallback((tipo: Tipo, titulo: string, mensaje?: string) => {
    const id = ++idRef.current;
    setItems(prev => [...prev, { id, tipo, titulo, mensaje }]);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      mostrar,
      exito: (t, m) => mostrar('exito', t, m),
      error: (t, m) => mostrar('error', t, m),
      info: (t, m) => mostrar('info', t, m),
    }),
    [mostrar],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <Overlay items={items} quitar={quitar} />
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

// ---------------------------------------------------------------------------

function Overlay({ items, quitar }: { items: ToastItem[]; quitar: (id: number) => void }) {
  const insets = useSafeAreaInsets();
  if (items.length === 0) {
    return null;
  }
  return (
    <View style={[styles.overlay, { top: insets.top + 8 }]} pointerEvents="none">
      {items.map(item => (
        <Tarjeta key={item.id} item={item} onClose={quitar} />
      ))}
    </View>
  );
}

const ESTILOS: Record<Tipo, { color: string; icono: string }> = {
  exito: { color: c.success, icono: '✓' },
  error: { color: c.danger, icono: '!' },
  info: { color: c.brand, icono: 'i' },
};

function Tarjeta({ item, onClose }: { item: ToastItem; onClose: (id: number) => void }) {
  const anim = useRef(new Animated.Value(0)).current; // 0 oculto, 1 visible

  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    const t = setTimeout(() => {
      Animated.timing(anim, { toValue: 0, duration: 220, useNativeDriver: true }).start(() =>
        onClose(item.id),
      );
    }, DURACION);
    return () => clearTimeout(t);
  }, [anim, item.id, onClose]);

  const estilo = ESTILOS[item.tipo];
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] });

  return (
    <Animated.View style={[styles.toast, { opacity: anim, transform: [{ translateY }] }]}>
      <View style={[styles.barra, { backgroundColor: estilo.color }]} />
      <View style={[styles.iconoBox, { backgroundColor: estilo.color }]}>
        <Text style={styles.icono}>{estilo.icono}</Text>
      </View>
      <View style={styles.texto}>
        <Text style={styles.titulo} numberOfLines={1}>
          {item.titulo}
        </Text>
        {!!item.mensaje && (
          <Text style={styles.mensaje} numberOfLines={2}>
            {item.mensaje}
          </Text>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    right: 12,
    left: 12,
    zIndex: 1000,
    alignItems: 'flex-end',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surface,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingRight: 16,
    marginBottom: 10,
    maxWidth: 360,
    minWidth: 220,
    overflow: 'hidden',
    shadowColor: '#7A5A2A',
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  barra: { width: 5, alignSelf: 'stretch' },
  iconoBox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    marginHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icono: { color: '#fff', fontWeight: '900', fontSize: 14 },
  texto: { flex: 1 },
  titulo: { color: c.textStrong, fontFamily: font.bold, fontSize: 14 },
  mensaje: { color: c.muted, fontSize: 12, marginTop: 2, fontFamily: font.regular },
});
