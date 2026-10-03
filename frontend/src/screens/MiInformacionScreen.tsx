/**
 * Mi información — datos PERSONALES de la cuenta (cualquier rol).
 *
 * Se abre desde "Mi perfil". Primero muestra la información en modo lectura
 * y, con "Editar información", pasa al formulario (datos, dirección y cambio
 * de contraseña opcional). Es la persona, no el negocio: los negocios se
 * administran en "Mis negocios".
 */
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { actualizarPerfil, Usuario } from '../api';
import { useAuth } from '../AuthContext';
import { FadeInView, PressableScale } from '../components/anim';
import BarrioSelect from '../components/BarrioSelect';
import FieldError from '../components/FieldError';
import Icon, { IconName } from '../components/Icon';
import { FieldErrors, fieldErrorsFromError, messageFromError } from '../formErrors';
import { useNegocio } from '../NegocioContext';
import { RootStackParamList } from '../navTypes';
import { font, makeStyles, radius, useTheme } from '../theme';
import { useToast } from '../Toast';

type Props = NativeStackScreenProps<RootStackParamList, 'MiInformacion'>;

export default function MiInformacionScreen(_props: Props) {
  const { c } = useTheme();
  const styles = useStyles();
  const { auth, actualizarUsuario } = useAuth();
  const toast = useToast();
  const user = auth!.user;
  const { codigoPublico } = useNegocio();

  const esCliente = user.roles.includes('usuario');

  // 'ver' = solo lectura · 'editar' = formulario.
  const [modo, setModo] = useState<'ver' | 'editar'>('ver');

  const [nombre, setNombre] = useState(user.name);
  const [apellidos, setApellidos] = useState(user.apellidos ?? '');
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

  /** Carga en el formulario los datos guardados de la cuenta. */
  function cargarCampos(u: Usuario) {
    setNombre(u.name);
    setApellidos(u.apellidos ?? '');
    setEmail(u.email);
    setTelefono(u.telefono ?? '');
    setDireccion(u.direccion ?? '');
    setBarrio(u.barrio ?? '');
    setPassActual('');
    setPassNueva('');
    setPassConfirma('');
    setErrores({});
  }

  function empezarEdicion() {
    cargarCampos(user);
    setModo('editar');
  }

  function cancelar() {
    cargarCampos(user);
    setModo('ver');
  }

  async function guardar() {
    setErrores({});
    const nuevosErrores: FieldErrors = {};
    if (!nombre.trim()) nuevosErrores.name = 'El campo nombre es obligatorio.';
    if (!apellidos.trim()) nuevosErrores.apellidos = 'El campo apellidos es obligatorio.';
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
        apellidos: apellidos.trim(),
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
      cargarCampos(actualizado);
      setModo('ver');
      toast.exito('Información actualizada', 'Tus datos personales quedaron guardados.');
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

  // ---------------- Vista de solo lectura ----------------
  if (modo === 'ver') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <FadeInView>
          <Text style={styles.seccion}>Datos personales</Text>
          <View style={styles.tarjeta}>
            <Dato icono="usuario" etiqueta="Nombre(s)" valor={user.name} />
            <Dato icono="usuarios" etiqueta="Apellidos" valor={user.apellidos} />
            <Dato icono="lista" etiqueta="Correo" valor={user.email} />
            <Dato icono="telefono" etiqueta="Teléfono" valor={user.telefono} ultimo />
          </View>
        </FadeInView>

        <FadeInView delay={60}>
          <Text style={styles.seccion}>Mi dirección</Text>
          {esCliente ? (
            <Text style={styles.ayuda}>Se usa como tu ubicación principal para los pedidos.</Text>
          ) : null}
          <View style={styles.tarjeta}>
            <Dato icono="ubicacion" etiqueta="Dirección" valor={user.direccion} />
            <Dato icono="casa" etiqueta="Barrio" valor={user.barrio} ultimo />
          </View>
        </FadeInView>

        {!!codigoPublico && (
          <FadeInView delay={90}>
            <Text style={styles.seccion}>Cuenta</Text>
            <View style={styles.tarjeta}>
              <Dato
                icono="etiqueta"
                etiqueta="Código público (para que un negocio te invite)"
                valor={`#${codigoPublico}`}
                ultimo
              />
            </View>
          </FadeInView>
        )}

        <FadeInView delay={120}>
          <PressableScale style={styles.btn} onPress={empezarEdicion}>
            <Text style={styles.btnTxt}>Editar información</Text>
          </PressableScale>
        </FadeInView>
      </ScrollView>
    );
  }

  // ---------------- Formulario de edición ----------------
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <FadeInView>
          <Text style={styles.seccion}>Datos personales</Text>
          <View style={styles.tarjeta}>
            <Text style={styles.label}>Nombre(s)</Text>
            <TextInput
              style={styles.input}
              value={nombre}
              onChangeText={valor => {
                setNombre(valor);
                limpiarError('name');
              }}
              placeholder="Ej: Ana María"
              placeholderTextColor={c.mutedSoft}
              autoCapitalize="words"
              editable={!guardando}
            />
            <FieldError mensaje={errores.name} />
            <Text style={styles.label}>Apellidos</Text>
            <TextInput
              style={styles.input}
              value={apellidos}
              onChangeText={valor => {
                setApellidos(valor);
                limpiarError('apellidos');
              }}
              placeholder="Ej: Pérez Gómez"
              placeholderTextColor={c.mutedSoft}
              autoCapitalize="words"
              editable={!guardando}
            />
            <FieldError mensaje={errores.apellidos} />
            <Text style={styles.label}>Correo</Text>
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
              editable={!guardando}
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
              editable={!guardando}
            />
            <FieldError mensaje={errores.telefono} />
          </View>
        </FadeInView>

        <FadeInView delay={60}>
          <Text style={styles.seccion}>Mi dirección</Text>
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
              editable={!guardando}
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
              disabled={guardando}
            />
            <FieldError mensaje={errores.barrio} />
          </View>
        </FadeInView>

        <FadeInView delay={90}>
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
              editable={!guardando}
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
              editable={!guardando}
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
              editable={!guardando}
            />
            <FieldError mensaje={errores.confirmar} />
          </View>
        </FadeInView>

        <FadeInView delay={120}>
          <PressableScale style={styles.btn} onPress={guardar} disabled={guardando}>
            {guardando ? (
              <ActivityIndicator color={c.onAccent} />
            ) : (
              <Text style={styles.btnTxt}>Guardar cambios</Text>
            )}
          </PressableScale>
          <TouchableOpacity onPress={cancelar} disabled={guardando}>
            <Text style={styles.cancelar}>Cancelar</Text>
          </TouchableOpacity>
        </FadeInView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Fila ícono + etiqueta + valor de la vista de solo lectura. */
function Dato({
  icono,
  etiqueta,
  valor,
  ultimo,
}: {
  icono: IconName;
  etiqueta: string;
  valor?: string | null;
  ultimo?: boolean;
}) {
  const { c } = useTheme();
  const styles = useStyles();
  return (
    <View style={[styles.dato, ultimo && styles.datoUltimo]}>
      <Icon name={icono} size={18} color={c.accent} />
      <View style={styles.datoTexto}>
        <Text style={styles.datoEtiqueta}>{etiqueta}</Text>
        <Text style={[styles.datoValor, !valor && styles.datoVacio]}>{valor || 'Sin especificar'}</Text>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c, shadow) => ({
  container: { flex: 1, backgroundColor: c.bg },
  content: { padding: 20, paddingBottom: 40 },
  seccion: { fontSize: 16, fontFamily: font.displaySemi, color: c.textStrong, marginTop: 14, marginBottom: 8 },
  ayuda: { color: c.muted, fontSize: 12, fontFamily: font.regular, marginTop: -4, marginBottom: 8 },
  tarjeta: { backgroundColor: c.surface, borderRadius: radius.lg, padding: 16, ...shadow.soft },
  // Vista de solo lectura
  dato: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingBottom: 12, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: c.border,
  },
  datoUltimo: { paddingBottom: 0, marginBottom: 0, borderBottomWidth: 0 },
  datoTexto: { flex: 1 },
  datoEtiqueta: { fontSize: 12, fontFamily: font.semibold, color: c.mutedSoft },
  datoValor: { fontSize: 15, fontFamily: font.regular, color: c.textStrong, marginTop: 2 },
  datoVacio: { color: c.mutedSoft, fontStyle: 'italic' },
  // Formulario
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
  cancelar: { textAlign: 'center', color: c.muted, fontFamily: font.semibold, marginTop: 14 },
}));
