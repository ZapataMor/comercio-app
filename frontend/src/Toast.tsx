/**
 * Notificaciones tipo "toast" con estilo de la app.
 * Aparecen a la derecha, justo debajo de la topbar (para no tapar sus botones),
 * de forma temporal: su borde se llena de izquierda a derecha como una barra de
 * carga y, al llenarse, se cierran solas. También se quitan deslizándolas
 * hacia la derecha (ver AvisoTemporal).
 * Reemplazan a los `Alert.alert` genéricos para avisos; las confirmaciones van
 * con `useConfirmar` (components/Confirmacion).
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
import { Animated, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colores, font, makeStyles, radius, useTheme } from './theme';
import AvisoTemporal from './components/AvisoTemporal';
import { ALTO_CONTENIDO_HEADER, altoBarraEstado } from './components/HeaderVitrina';
import { avisarTropiezo } from './tutorial/tropiezos';

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

/** ms visible antes de cerrarse solo (lo que tarda en llenarse el borde). */
export const DURACION_TOAST = 4000;

/**
 * Cuánto se queda un aviso: el mínimo para los cortos y más tiempo para los
 * largos, para que alcance a leerse completo (unos 15 caracteres por segundo).
 */
export function duracionToast(titulo: string, mensaje?: string) {
  const letras = titulo.length + (mensaje?.length ?? 0);
  return Math.min(9000, Math.max(DURACION_TOAST, 1500 + letras * 65));
}


export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const quitar = useCallback((id: number) => {
    setItems(prev => prev.filter(t => t.id !== id));
  }, []);

  const mostrar = useCallback((tipo: Tipo, titulo: string, mensaje?: string) => {
    const id = ++idRef.current;
    setItems(prev => [...prev, { id, tipo, titulo, mensaje }]);
    // Errores seguidos: quizá no sabe cómo seguir (se le ofrece la ayuda).
    if (tipo === 'error') avisarTropiezo({ tipo: 'error' });
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
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  if (items.length === 0) {
    return null;
  }
  return (
    // box-none: los toques entre avisos pasan a la pantalla; sobre un aviso, lo deslizan.
    <View style={[styles.overlay, { top: altoBarraEstado(insets.top) + ALTO_CONTENIDO_HEADER + 8 }]} pointerEvents="box-none">
      {items.map(item => (
        <Tarjeta key={item.id} item={item} onClose={quitar} />
      ))}
    </View>
  );
}

function estilosToast(c: Colores): Record<Tipo, { color: string; icono: string }> {
  return {
    exito: { color: c.success, icono: '✓' },
    error: { color: c.danger, icono: '!' },
    info: { color: c.brand, icono: 'i' },
  };
}

function Tarjeta({ item, onClose }: { item: ToastItem; onClose: (id: number) => void }) {
  const { c } = useTheme();
  const styles = useStyles();
  const anim = useRef(new Animated.Value(0)).current; // 0 oculto, 1 visible

  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }, [anim]);

  // Se llenó el borde: se desvanece. Deslizado: ya salió de la pantalla.
  const cerrar = (motivo: 'tiempo' | 'deslizado') => {
    if (motivo === 'deslizado') {
      onClose(item.id);
      return;
    }
    Animated.timing(anim, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => onClose(item.id));
  };

  const estilo = estilosToast(c)[item.tipo];
  const translateY = useRef(anim.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] })).current;

  return (
    <Animated.View style={[styles.envoltura, { opacity: anim, transform: [{ translateY }] }]}>
     <AvisoTemporal
      duracion={duracionToast(item.titulo, item.mensaje)}
      onCerrar={cerrar}
      color={estilo.color}
      radio={radius.md}
      style={styles.toast}
      contenidoStyle={styles.contenido}>
      <View style={[styles.barra, { backgroundColor: estilo.color }]} />
      <View style={[styles.iconoBox, { backgroundColor: estilo.color }]}>
        <Text style={styles.icono}>{estilo.icono}</Text>
      </View>
      <View style={styles.texto}>
        {/* Sin cortar: el aviso crece hacia abajo hasta mostrar todo el texto. */}
        <Text style={styles.titulo} numberOfLines={3}>
          {item.titulo}
        </Text>
        {!!item.mensaje && (
          <Text style={styles.mensaje} numberOfLines={6}>
            {item.mensaje}
          </Text>
        )}
      </View>
     </AvisoTemporal>
    </Animated.View>
  );
}

const useStyles = makeStyles((c, shadow) => ({
  overlay: {
    position: 'absolute',
    right: 12,
    left: 12,
    zIndex: 1000,
    alignItems: 'flex-end',
  },
  // Todo el ancho disponible (hasta 440 en tabletas): con un ancho fijo
  // pequeño el texto quedaba cortado en «...».
  envoltura: { marginBottom: 10, width: '100%', maxWidth: 440 },
  toast: {
    ...shadow.card,
    shadowRadius: 14,
    elevation: 6,
  },
  contenido: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingRight: 16,
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
  icono: { color: c.onBrand, fontWeight: '900', fontSize: 14 },
  texto: { flex: 1 },
  titulo: { color: c.textStrong, fontFamily: font.bold, fontSize: 15, lineHeight: 20 },
  mensaje: { color: c.text, fontSize: 14, lineHeight: 19, marginTop: 2, fontFamily: font.regular },
}));
