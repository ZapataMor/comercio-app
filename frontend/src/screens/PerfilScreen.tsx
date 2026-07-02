/**
 * Mi perfil — datos PERSONALES del usuario logueado (cualquier rol).
 *
 * Aquí se gestiona la persona (nombre, email, contraseña), no el negocio:
 * para un comerciante, su tienda se administra en "Mi negocio". También es
 * el lugar de "Cerrar sesión".
 */
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { actualizarPerfil } from '../api';
import { useAuth } from '../AuthContext';
import { FadeInView, PressableScale } from '../components/anim';
import Icon from '../components/Icon';
import { RootStackParamList } from '../navTypes';
import { c, font, radius, shadow } from '../theme';
import { useToast } from '../Toast';

type Props = NativeStackScreenProps<RootStackParamList, 'Perfil'>;

export default function PerfilScreen(_props: Props) {
  const { auth, actualizarUsuario, salir } = useAuth();
  const toast = useToast();
  const user = auth!.user;

  const [nombre, setNombre] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [passActual, setPassActual] = useState('');
  const [passNueva, setPassNueva] = useState('');
  const [passConfirma, setPassConfirma] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cambiaPass = passActual.length > 0 || passNueva.length > 0 || passConfirma.length > 0;

  async function guardar() {
    if (!nombre.trim() || !email.trim()) {
      toast.error('Faltan datos', 'El nombre y el email son obligatorios.');
      return;
    }
    if (cambiaPass) {
      if (!passActual || !passNueva || !passConfirma) {
        toast.error('Contraseña incompleta', 'Llena la actual, la nueva y su confirmación.');
        return;
      }
      if (passNueva !== passConfirma) {
        toast.error('No coinciden', 'La nueva contraseña y su confirmación deben ser iguales.');
        return;
      }
      if (passNueva.length < 8) {
        toast.error('Muy corta', 'La nueva contraseña debe tener al menos 8 caracteres.');
        return;
      }
    }

    setGuardando(true);
    try {
      const actualizado = await actualizarPerfil(auth!.token, {
        name: nombre.trim(),
        email: email.trim(),
        ...(cambiaPass ? { password: passNueva, password_actual: passActual } : {}),
      });
      actualizarUsuario(actualizado);
      setPassActual('');
      setPassNueva('');
      setPassConfirma('');
      toast.exito('Perfil actualizado', 'Tus datos personales quedaron guardados.');
    } catch (e) {
      toast.error('No se pudo guardar', e instanceof Error ? e.message : 'Error');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <FadeInView style={styles.cabecera}>
        <View style={styles.avatar}>
          <Text style={styles.avatarTxt}>{user.name.trim().charAt(0).toUpperCase() || '?'}</Text>
        </View>
        <Text style={styles.nombre}>{user.name}</Text>
        <View style={styles.rolesRow}>
          {user.roles.map(r => (
            <Text key={r} style={styles.rol}>{r}</Text>
          ))}
        </View>
      </FadeInView>

      <FadeInView delay={60}>
        <Text style={styles.seccion}>Datos personales</Text>
        <View style={styles.tarjeta}>
          <Text style={styles.label}>Nombre</Text>
          <TextInput
            style={styles.input}
            value={nombre}
            onChangeText={setNombre}
            placeholder="Tu nombre"
            placeholderTextColor={c.mutedSoft}
          />
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="tu@correo.com"
            placeholderTextColor={c.mutedSoft}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>
      </FadeInView>

      <FadeInView delay={120}>
        <Text style={styles.seccion}>Cambiar contraseña</Text>
        <Text style={styles.ayuda}>Opcional: déjalo vacío para no cambiarla.</Text>
        <View style={styles.tarjeta}>
          <Text style={styles.label}>Contraseña actual</Text>
          <TextInput
            style={styles.input}
            value={passActual}
            onChangeText={setPassActual}
            placeholder="••••••••"
            placeholderTextColor={c.mutedSoft}
            secureTextEntry
          />
          <Text style={styles.label}>Nueva contraseña</Text>
          <TextInput
            style={styles.input}
            value={passNueva}
            onChangeText={setPassNueva}
            placeholder="Mínimo 8 caracteres"
            placeholderTextColor={c.mutedSoft}
            secureTextEntry
          />
          <Text style={styles.label}>Confirmar nueva contraseña</Text>
          <TextInput
            style={[styles.input, styles.inputUltimo]}
            value={passConfirma}
            onChangeText={setPassConfirma}
            placeholder="Repite la nueva contraseña"
            placeholderTextColor={c.mutedSoft}
            secureTextEntry
          />
        </View>
      </FadeInView>

      <FadeInView delay={180}>
        <PressableScale style={styles.btn} onPress={guardar} disabled={guardando}>
          {guardando ? (
            <ActivityIndicator color={c.onAccent} />
          ) : (
            <Text style={styles.btnTxt}>Guardar cambios</Text>
          )}
        </PressableScale>

        <TouchableOpacity style={styles.logout} onPress={salir}>
          <Icon name="cerrar" size={14} color={c.danger} />
          <Text style={styles.logoutTxt}>Cerrar sesión</Text>
        </TouchableOpacity>
      </FadeInView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  // Deja aire abajo para la barra flotante del cliente (Carrito/Mis pedidos).
  content: { padding: 20, paddingBottom: 120 },
  cabecera: { alignItems: 'center', marginBottom: 8 },
  avatar: {
    width: 74, height: 74, borderRadius: 37, backgroundColor: c.accent,
    alignItems: 'center', justifyContent: 'center', marginTop: 6, ...shadow.gold,
  },
  avatarTxt: { color: c.onAccent, fontFamily: font.displayExtra, fontSize: 30 },
  nombre: { fontSize: 20, fontFamily: font.display, color: c.textStrong, marginTop: 10 },
  rolesRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  rol: {
    backgroundColor: c.accentSoft, color: c.goldText, fontFamily: font.bold, fontSize: 12,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, overflow: 'hidden',
  },
  seccion: { fontSize: 16, fontFamily: font.displaySemi, color: c.textStrong, marginTop: 18, marginBottom: 8 },
  ayuda: { color: c.muted, fontSize: 12, fontFamily: font.regular, marginTop: -4, marginBottom: 8 },
  tarjeta: { backgroundColor: c.surface, borderRadius: radius.lg, padding: 16, ...shadow.soft },
  label: { fontSize: 13, fontFamily: font.semibold, color: c.text, marginBottom: 6 },
  input: {
    backgroundColor: c.bg, borderWidth: 1, borderColor: c.borderStrong, borderRadius: radius.md,
    paddingHorizontal: 14, paddingVertical: 11, marginBottom: 12, color: c.textStrong, fontFamily: font.regular,
  },
  inputUltimo: { marginBottom: 2 },
  btn: {
    backgroundColor: c.accent, borderRadius: radius.md, paddingVertical: 15,
    alignItems: 'center', marginTop: 22, ...shadow.gold,
  },
  btnTxt: { color: c.onAccent, fontFamily: font.bold, fontSize: 16 },
  logout: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: 24, paddingVertical: 8,
  },
  logoutTxt: { color: c.danger, fontFamily: font.bold },
});
