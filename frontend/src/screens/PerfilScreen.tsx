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
import BarrioSelect from '../components/BarrioSelect';
import FieldError from '../components/FieldError';
import Icon from '../components/Icon';
import { FieldErrors, fieldErrorsFromError, messageFromError } from '../formErrors';
import { RootStackParamList } from '../navTypes';
import { c, font, radius, shadow } from '../theme';
import { useToast } from '../Toast';

type Props = NativeStackScreenProps<RootStackParamList, 'Perfil'>;

export default function PerfilScreen(_props: Props) {
  const { auth, actualizarUsuario, salir } = useAuth();
  const toast = useToast();
  const user = auth!.user;

  const esCliente = user.roles.includes('usuario');

  const [nombre, setNombre] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [telefono, setTelefono] = useState(user.telefono ?? '');
  const [direccion, setDireccion] = useState(user.direccion ?? '');
  const [barrio, setBarrio] = useState(user.barrio ?? '');
  const [passActual, setPassActual] = useState('');
  const [passNueva, setPassNueva] = useState('');
  const [passConfirma, setPassConfirma] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [errores, setErrores] = useState<FieldErrors>({});

  const cambiaPass = passActual.length > 0 || passNueva.length > 0 || passConfirma.length > 0;

  function limpiarError(campo: string) {
    setErrores(prev => {
      const next = { ...prev };
      delete next[campo];
      return next;
    });
  }

  async function guardar() {
    setErrores({});
    const nuevosErrores: FieldErrors = {};
    if (!nombre.trim()) nuevosErrores.name = 'El campo nombre es obligatorio.';
    if (!email.trim()) nuevosErrores.email = 'El campo correo es obligatorio.';
    if (esCliente) {
      if (!telefono.trim()) nuevosErrores.telefono = 'El campo teléfono es obligatorio.';
      if (!direccion.trim()) nuevosErrores.direccion = 'El campo dirección es obligatorio.';
      if (!barrio.trim()) nuevosErrores.barrio = 'El campo barrio es obligatorio.';
    }
    if (Object.keys(nuevosErrores).length > 0) {
      setErrores(nuevosErrores);
      return;
    }
    if (cambiaPass) {
      const passErrores: FieldErrors = {};
      if (!passActual) passErrores.password_actual = 'El campo contrasena actual es obligatorio.';
      if (!passNueva) passErrores.password = 'El campo nueva contrasena es obligatorio.';
      if (!passConfirma) passErrores.confirmar = 'Confirma la nueva contrasena.';
      if (Object.keys(passErrores).length > 0) {
        setErrores(passErrores);
        return;
      }
      if (passNueva !== passConfirma) {
        setErrores({ confirmar: 'La nueva contrasena y su confirmacion deben ser iguales.' });
        return;
      }
      if (passNueva.length < 8) {
        setErrores({ password: 'La nueva contrasena debe tener al menos 8 caracteres.' });
        return;
      }
    }

    setGuardando(true);
    try {
      const actualizado = await actualizarPerfil(auth!.token, {
        name: nombre.trim(),
        email: email.trim(),
        ...(esCliente || telefono.trim() || direccion.trim() || barrio.trim()
          ? {
              telefono: telefono.trim(),
              direccion: direccion.trim(),
              barrio: barrio.trim(),
            }
          : {}),
        ...(cambiaPass ? { password: passNueva, password_actual: passActual } : {}),
      });
      actualizarUsuario(actualizado);
      setPassActual('');
      setPassNueva('');
      setPassConfirma('');
      toast.exito('Perfil actualizado', 'Tus datos personales quedaron guardados.');
    } catch (e) {
      const campos = fieldErrorsFromError(e, { password_confirmation: 'confirmar' });
      if (Object.keys(campos).length > 0) {
        setErrores(campos);
      } else {
        toast.error('No se pudo guardar', messageFromError(e, 'Error'));
      }
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
            onChangeText={valor => {
              setNombre(valor);
              limpiarError('name');
            }}
            placeholder="Tu nombre"
            placeholderTextColor={c.mutedSoft}
          />
          <FieldError mensaje={errores.name} />
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={valor => {
              setEmail(valor);
              limpiarError('email');
            }}
            placeholder="tu@correo.com"
            placeholderTextColor={c.mutedSoft}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <FieldError mensaje={errores.email} />
          <Text style={styles.label}>Teléfono</Text>
          <TextInput
            style={styles.input}
            value={telefono}
            onChangeText={valor => {
              setTelefono(valor);
              limpiarError('telefono');
            }}
            placeholder="Tu número de contacto"
            placeholderTextColor={c.mutedSoft}
            keyboardType="phone-pad"
          />
          <FieldError mensaje={errores.telefono} />
        </View>
      </FadeInView>

      <FadeInView delay={90}>
        <Text style={styles.seccion}>Mi dirección</Text>
        {esCliente ? (
          <Text style={styles.ayuda}>Se usa como tu ubicación principal para los pedidos.</Text>
        ) : null}
        <View style={styles.tarjeta}>
          <Text style={styles.label}>Dirección</Text>
          <TextInput
            style={styles.input}
            value={direccion}
            onChangeText={valor => {
              setDireccion(valor);
              limpiarError('direccion');
            }}
            placeholder="Calle, número, referencias"
            placeholderTextColor={c.mutedSoft}
          />
          <FieldError mensaje={errores.direccion} />
          <Text style={styles.label}>Barrio</Text>
          <BarrioSelect
            valor={barrio}
            onSeleccionar={valor => {
              setBarrio(valor);
              limpiarError('barrio');
            }}
            placeholder="Tu barrio"
          />
          <FieldError mensaje={errores.barrio} />
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
            onChangeText={valor => {
              setPassActual(valor);
              limpiarError('password_actual');
            }}
            placeholder="••••••••"
            placeholderTextColor={c.mutedSoft}
            secureTextEntry
          />
          <FieldError mensaje={errores.password_actual} />
          <Text style={styles.label}>Nueva contraseña</Text>
          <TextInput
            style={styles.input}
            value={passNueva}
            onChangeText={valor => {
              setPassNueva(valor);
              limpiarError('password');
            }}
            placeholder="Mínimo 8 caracteres"
            placeholderTextColor={c.mutedSoft}
            secureTextEntry
          />
          <FieldError mensaje={errores.password} />
          <Text style={styles.label}>Confirmar nueva contraseña</Text>
          <TextInput
            style={[styles.input, styles.inputUltimo]}
            value={passConfirma}
            onChangeText={valor => {
              setPassConfirma(valor);
              limpiarError('confirmar');
            }}
            placeholder="Repite la nueva contraseña"
            placeholderTextColor={c.mutedSoft}
            secureTextEntry
          />
          <FieldError mensaje={errores.confirmar} />
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
