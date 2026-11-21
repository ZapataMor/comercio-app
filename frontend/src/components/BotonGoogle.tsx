/**
 * Botón «Continuar con Google» y la lógica compartida por el login y el
 * registro (useEntrarConGoogle).
 *
 * Sigue las pautas de marca de Google para el botón: la «G» de colores sobre
 * fondo blanco (de día) u oscuro (de noche), borde fino y el texto
 * «Continuar con Google».
 */
import { useState } from 'react';
import { ActivityIndicator, StyleProp, Text, View, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { entrarConGoogle, PerfilGoogle } from '../api';
import { useAuth } from '../AuthContext';
import { messageFromError } from '../formErrors';
import { elegirCuentaGoogle } from '../google';
import { font, makeStyles, radius, useTheme } from '../theme';
import { PressableScale } from './anim';

/** La «G» de Google, con sus cuatro colores. */
export function LogoGoogle({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </Svg>
  );
}

type Props = {
  onPress: () => void;
  cargando?: boolean;
  disabled?: boolean;
  texto?: string;
  style?: StyleProp<ViewStyle>;
};

export default function BotonGoogle({ onPress, cargando, disabled, texto = 'Continuar con Google', style }: Props) {
  const { modo } = useTheme();
  const styles = useStyles();
  const noche = modo === 'noche';
  return (
    <PressableScale
      style={[styles.boton, noche ? styles.botonNoche : styles.botonDia, (disabled || cargando) && styles.inactivo, style]}
      scaleTo={0.97}
      onPress={onPress}
      disabled={disabled || cargando}
      accessibilityRole="button"
      accessibilityLabel={texto}
      accessibilityState={{ busy: !!cargando, disabled: !!(disabled || cargando) }}>
      <View style={styles.logo}>
        {cargando ? <ActivityIndicator size="small" color={noche ? '#E3E3E3' : '#1F1F1F'} /> : <LogoGoogle />}
      </View>
      <Text style={[styles.texto, noche ? styles.textoNoche : styles.textoDia]} numberOfLines={1}>
        {texto}
      </Text>
    </PressableScale>
  );
}

/**
 * Elegir la cuenta de Google y entrar. Si la cuenta ya existe, abre la sesión;
 * si es nueva, llama a `alSerNueva` para completar el registro (política y nombre).
 */
export function useEntrarConGoogle(alSerNueva: (idToken: string, perfil: PerfilGoogle) => void) {
  const { entrar } = useAuth();
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** `rapido`: para una cuenta recordada en «Continuar como» (ver elegirCuentaGoogle). */
  async function iniciar(rapido = false) {
    setError(null);
    setCargando(true);
    try {
      const idToken = await elegirCuentaGoogle({ rapido });
      if (!idToken) return; // cerró la ventana de Google
      const r = await entrarConGoogle(idToken);
      if (r.nuevo) {
        alSerNueva(idToken, r.perfil);
      } else {
        entrar(r.token, r.user);
      }
    } catch (e) {
      setError(messageFromError(e));
    } finally {
      setCargando(false);
    }
  }

  return { iniciar, cargando, error, setError };
}

// Colores de las pautas de marca de Google (no del tema de Vitrina).
const useStyles = makeStyles(() => ({
  boton: {
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    gap: 10,
  },
  botonDia: { backgroundColor: '#FFFFFF', borderColor: '#747775' },
  botonNoche: { backgroundColor: '#131314', borderColor: '#8E918F' },
  inactivo: { opacity: 0.7 },
  logo: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  texto: { fontFamily: font.semibold, fontSize: 15, includeFontPadding: false, flexShrink: 1 },
  textoDia: { color: '#1F1F1F' },
  textoNoche: { color: '#E3E3E3' },
}));
