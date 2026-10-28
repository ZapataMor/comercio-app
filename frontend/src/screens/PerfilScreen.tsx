/**
 * Mi perfil — menú de la cuenta del usuario logueado (cualquier rol).
 *
 * Desde aquí se abre:
 *  - "Mi información": ver y modificar los datos personales de la cuenta,
 *  - "Mis negocios": los negocios propios o donde trabaja.
 *  - La política de privacidad (página pública del servidor).
 * También es el lugar de "Cerrar sesión" y "Eliminar mi cuenta".
 */
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { eliminarCuenta } from '../api';
import { useAuth } from '../AuthContext';
import { FadeInView, PressableScale } from '../components/anim';
import FieldError from '../components/FieldError';
import Icon from '../components/Icon';
import { WEB_URL } from '../config';
import { messageFromError } from '../formErrors';
import { useNegocio } from '../NegocioContext';
import { RootStackParamList } from '../navTypes';
import { font, makeStyles, radius, useTheme } from '../theme';
import { useToast } from '../Toast';

type Props = NativeStackScreenProps<RootStackParamList, 'Perfil'>;

export default function PerfilScreen({ navigation }: Props) {
  const { c } = useTheme();
  const styles = useStyles();
  const { auth, salir } = useAuth();
  const toast = useToast();
  const user = auth!.user;
  const { negocios, codigoPublico } = useNegocio();

  // "Eliminar mi cuenta": se confirma escribiendo la contraseña.
  const [eliminando, setEliminando] = useState(false);
  const [clave, setClave] = useState('');
  const [errorClave, setErrorClave] = useState<string | undefined>();
  const [enviando, setEnviando] = useState(false);

  function cerrarEliminar() {
    if (enviando) return;
    setEliminando(false);
    setClave('');
    setErrorClave(undefined);
  }

  async function confirmarEliminar() {
    if (!clave) {
      setErrorClave('Escribe tu contraseña para confirmar.');
      return;
    }
    setEnviando(true);
    try {
      await eliminarCuenta(auth!.token, clave);
      setEliminando(false);
      toast.exito('Cuenta eliminada', 'Gracias por haber usado Vitrina.');
      salir();
    } catch (e) {
      setErrorClave(messageFromError(e, 'No se pudo eliminar la cuenta.'));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <FadeInView style={styles.cabecera}>
        <View style={styles.avatar}>
          <Text style={styles.avatarTxt}>{user.name.trim().charAt(0).toUpperCase() || '?'}</Text>
        </View>
        <Text style={styles.nombre}>{[user.name, user.apellidos].filter(Boolean).join(' ')}</Text>
        <Text style={styles.email}>{user.email}</Text>
        <View style={styles.rolesRow}>
          {user.roles.map(r => (
            <Text key={r} style={styles.rol}>{r}</Text>
          ))}
        </View>
      </FadeInView>

      {/* Datos personales de la cuenta: ver y modificar. */}
      <FadeInView delay={30}>
        <PressableScale style={styles.item} onPress={() => navigation.navigate('MiInformacion')}>
          <Icon name="usuario" size={24} color={c.accent} />
          <View style={styles.itemTexto}>
            <Text style={styles.itemTitulo}>Mi información</Text>
            <Text style={styles.itemSub}>Nombre, correo, teléfono, dirección y contraseña</Text>
          </View>
          <Icon name="chevron" size={20} color={c.chevron} />
        </PressableScale>
      </FadeInView>

      {/* Cualquier persona puede tener negocios o trabajar en otros. */}
      <FadeInView delay={60}>
        <PressableScale style={styles.item} onPress={() => navigation.navigate('MisNegocios')}>
          <Icon name="tienda" size={24} color={c.accent} />
          <View style={styles.itemTexto}>
            <Text style={styles.itemTitulo}>Mis negocios</Text>
            <Text style={styles.itemSub}>
              {negocios.length > 0
                ? `${negocios.length} negocio${negocios.length > 1 ? 's' : ''} · invitaciones`
                : 'Crea tu negocio o únete a uno'}
              {codigoPublico ? ` · Tu código #${codigoPublico}` : ''}
            </Text>
          </View>
          <Icon name="chevron" size={20} color={c.chevron} />
        </PressableScale>
      </FadeInView>

      <FadeInView delay={75}>
        <PressableScale style={styles.item} onPress={() => Linking.openURL(`${WEB_URL}/privacidad`)}>
          <Icon name="escudo" size={24} color={c.accent} />
          <View style={styles.itemTexto}>
            <Text style={styles.itemTitulo}>Privacidad</Text>
            <Text style={styles.itemSub}>Cómo usamos y protegemos tus datos</Text>
          </View>
          <Icon name="chevron" size={20} color={c.chevron} />
        </PressableScale>
      </FadeInView>

      {/* Empuja "Cerrar sesión" a la parte inferior de la vista. */}
      <View style={styles.espaciador} />

      <FadeInView delay={90}>
        <TouchableOpacity style={styles.logout} onPress={salir}>
          <Text style={styles.logoutTxt}>Cerrar sesión</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setEliminando(true)} hitSlop={8}>
          <Text style={styles.eliminarTxt}>Eliminar mi cuenta</Text>
        </TouchableOpacity>
      </FadeInView>

      <Modal visible={eliminando} transparent animationType="fade" onRequestClose={cerrarEliminar}>
        <KeyboardAvoidingView
          style={styles.modalFondo}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalCaja}>
            <Text style={styles.modalTitulo}>Eliminar mi cuenta</Text>
            <Text style={styles.modalTexto}>
              Se borran tu nombre, correo, teléfono, direcciones y sesiones. Los pedidos ya hechos se
              conservan sin tus datos. Si eres el único dueño de un negocio, se cierra y deja de verse.
              No se puede deshacer.
            </Text>
            <TextInput
              style={styles.input}
              value={clave}
              onChangeText={v => {
                setClave(v);
                setErrorClave(undefined);
              }}
              secureTextEntry
              placeholder="Tu contraseña"
              placeholderTextColor={c.mutedSoft}
              editable={!enviando}
              autoFocus
            />
            <FieldError mensaje={errorClave} />
            <TouchableOpacity
              style={[styles.botonPeligro, enviando && styles.botonDeshabilitado]}
              onPress={confirmarEliminar}
              disabled={enviando}>
              {enviando ? (
                <ActivityIndicator color={c.surface} />
              ) : (
                <Text style={styles.botonPeligroTxt}>Eliminar definitivamente</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={cerrarEliminar} disabled={enviando}>
              <Text style={styles.cancelar}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

const useStyles = makeStyles((c, shadow) => ({
  container: { flex: 1, backgroundColor: c.bg },
  // Deja aire abajo para la barra flotante del cliente (Carrito/Mis pedidos).
  // flexGrow: el contenido ocupa toda la altura para que el espaciador funcione.
  content: { flexGrow: 1, padding: 20, paddingBottom: 120 },
  espaciador: { flex: 1, minHeight: 24 },
  cabecera: { alignItems: 'center', marginBottom: 18 },
  avatar: {
    width: 74, height: 74, borderRadius: 37, backgroundColor: c.accent,
    alignItems: 'center', justifyContent: 'center', marginTop: 6, ...shadow.gold,
  },
  avatarTxt: { color: c.onAccent, fontFamily: font.displayExtra, fontSize: 30 },
  nombre: { fontSize: 20, fontFamily: font.display, color: c.textStrong, marginTop: 10 },
  email: { fontSize: 13, fontFamily: font.regular, color: c.muted, marginTop: 2 },
  rolesRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  rol: {
    backgroundColor: c.accentSoft, color: c.goldText, fontFamily: font.bold, fontSize: 12,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, overflow: 'hidden',
  },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: c.surface,
    borderRadius: radius.lg, padding: 16, marginBottom: 12, ...shadow.soft,
  },
  itemTexto: { flex: 1 },
  itemTitulo: { fontSize: 16, fontFamily: font.bold, color: c.textStrong },
  itemSub: { color: c.muted, fontSize: 13, marginTop: 2, fontFamily: font.regular },
  // Recuadro rojo. El texto usa `surface` (claro de día, oscuro de noche) porque
  // `danger` también cambia de tono por modo y así conserva el contraste.
  // alignSelf: 'center' → el recuadro se ajusta al ancho del texto.
  logout: {
    alignSelf: 'center', backgroundColor: c.danger, borderRadius: radius.md,
    paddingVertical: 9, paddingHorizontal: 18, ...shadow.soft,
  },
  logoutTxt: { color: c.surface, fontFamily: font.bold, fontSize: 14 },
  eliminarTxt: { textAlign: 'center', color: c.danger, fontFamily: font.semibold, fontSize: 13, marginTop: 16 },
  modalFondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 },
  modalCaja: { backgroundColor: c.surface, borderRadius: radius.xl, padding: 22, ...shadow.card },
  modalTitulo: { fontSize: 18, fontFamily: font.display, color: c.textStrong, marginBottom: 8 },
  modalTexto: { fontSize: 13, fontFamily: font.regular, color: c.text, lineHeight: 19, marginBottom: 14 },
  input: {
    borderWidth: 1, borderColor: c.borderStrong, borderRadius: radius.md, paddingHorizontal: 14,
    paddingVertical: 12, fontSize: 16, fontFamily: font.regular, color: c.textStrong, marginBottom: 6,
  },
  botonPeligro: {
    backgroundColor: c.danger, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', marginTop: 8,
  },
  botonDeshabilitado: { opacity: 0.7 },
  botonPeligroTxt: { color: c.surface, fontFamily: font.bold, fontSize: 15 },
  cancelar: { textAlign: 'center', color: c.muted, fontFamily: font.semibold, marginTop: 14 },
}));
