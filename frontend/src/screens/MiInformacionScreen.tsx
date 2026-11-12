import CamposDireccion from '../components/CamposDireccion';
import { normalizarDireccion } from '../direccion';
import { direccionValida, errorDireccion, telefonoValido, errorTelefono } from '../direccion';
/**
 * Mi información — datos PERSONALES de la cuenta (cualquier rol).
 *
 * Se abre desde el menú de "Mi perfil" (ícono de usuario de la topbar).
 * Primero muestra la información en modo lectura y, con "Editar información",
 * pasa al formulario (datos, dirección y cambio de contraseña opcional).
 * Desde este perfil el dueño también desactiva, reactiva o elimina sus negocios.
 * Al final de la vista de lectura están "Dejar de ser domiciliario" (solo
 * para el domiciliario) y "Eliminar mi cuenta".
 */
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { actualizarPerfil, dejarDeSerDomiciliario, desactivarNegocio, eliminarCuenta, eliminarNegocio, Negocio, pedirCodigoTelefonoPerfil, Usuario, verificarTelefonoPerfil } from '../api';
import { useAuth } from '../AuthContext';
import { FadeInView, PressableScale } from '../components/anim';
import BarrioSelect from '../components/BarrioSelect';
import { useConfirmar } from '../components/Confirmacion';
import FieldError from '../components/FieldError';
import Icon, { IconName } from '../components/Icon';
import VerificarTelefono from '../components/VerificarTelefono';
import { FieldErrors, fieldErrorsFromError, messageFromError } from '../formErrors';
import { useNegocio } from '../NegocioContext';
import { RootStackParamList } from '../navTypes';
import { font, makeStyles, radius, useTheme } from '../theme';
import { useToast } from '../Toast';

type Props = NativeStackScreenProps<RootStackParamList, 'MiInformacion'>;

export default function MiInformacionScreen(_props: Props) {
  const { c } = useTheme();
  const styles = useStyles();
  const { auth, actualizarUsuario, salir } = useAuth();
  const toast = useToast();
  const confirmar = useConfirmar();
  const user = auth!.user;
  const { codigoPublico, negocios, recargar } = useNegocio();
  const [gestionandoNegocio, setGestionandoNegocio] = useState<number | null>(null);

  function gestionarNegocio(n: Negocio, eliminar: boolean) {
    const desactivar = !n.desactivado;
    confirmar({
      icono: eliminar ? 'basura' : 'tienda',
      titulo: eliminar ? `¿Eliminar ${n.nombre}?` : `¿${desactivar ? 'Desactivar' : 'Reactivar'} ${n.nombre}?`,
      texto: eliminar
        ? 'Se borrarán definitivamente todos los datos del negocio: productos, servicios, citas, reseñas, equipo e imágenes, y ya no podrás ver sus pedidos. Los clientes y domiciliarios conservan su historial. No se puede deshacer. Primero debes terminar o cancelar los pedidos activos; las entregas en camino deben finalizar. Se avisará a los clientes con citas futuras.'
        : desactivar
          ? 'Dejará de aparecer a los clientes y no recibirá nuevos pedidos ni solicitudes de cita. Se conservarán todos sus datos y podrás reactivarlo desde aquí. Debes seguir atendiendo los pedidos y las citas existentes.'
          : 'El negocio volverá a aparecer a los clientes con su catálogo y su horario habitual.',
      textoBoton: eliminar ? 'Eliminar definitivamente' : desactivar ? 'Desactivar temporalmente' : 'Reactivar negocio',
      textoCancelar: 'Cancelar',
      peligro: eliminar,
      accion: async () => {
        setGestionandoNegocio(n.id);
        try {
          if (eliminar) await eliminarNegocio(auth!.token, n.id);
          else await desactivarNegocio(auth!.token, n.id, desactivar);
          await recargar();
          toast.exito(eliminar ? 'Negocio eliminado definitivamente' : desactivar ? 'Negocio desactivado' : 'Negocio reactivado');
        } catch (e) {
          toast.error('No se pudo cambiar el negocio', messageFromError(e));
        } finally {
          setGestionandoNegocio(null);
        }
      },
    });
  }

  const esCliente = user.roles.includes('usuario');
  const esDomiciliario = user.roles.includes('domiciliario');

  // 'ver' = solo lectura · 'editar' = formulario.
  const [modo, setModo] = useState<'ver' | 'editar'>('ver');

  const [nombre, setNombre] = useState(user.name);
  const [apellidos, setApellidos] = useState(user.apellidos ?? '');
  const [email, setEmail] = useState(user.email ?? '');
  const [telefono, setTelefono] = useState(user.telefono ?? '');
  const [direccion, setDireccion] = useState(user.direccion ?? '');
  const [barrio, setBarrio] = useState(user.barrio ?? '');
  const [passActual, setPassActual] = useState('');
  const [passNueva, setPassNueva] = useState('');
  const [passConfirma, setPassConfirma] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [errores, setErrores] = useState<FieldErrors>({});

  const cambiaPass = passActual.length > 0 || passNueva.length > 0 || passConfirma.length > 0;

  // Verificar el celular con un código por WhatsApp.
  const [verificandoCelular, setVerificandoCelular] = useState(false);

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

  /** "Dejar de ser domiciliario": sigue siendo cliente; se puede volver desde el menú. */
  function confirmarDejarDomiciliario() {
    confirmar({
      icono: 'moto',
      titulo: '¿Dejar de ser domiciliario?',
      texto:
        'Ya no podrás tomar pedidos ni te llegarán sus avisos. Sigues siendo cliente y puedes volver ' +
        'a serlo cuando quieras desde el menú de tu cuenta.',
      textoBoton: 'Dejar de serlo',
      textoCancelar: 'Cancelar',
      peligro: true,
      accion: async () => {
        try {
          const r = await dejarDeSerDomiciliario(auth!.token);
          actualizarUsuario(r.user);
          toast.exito('Listo', 'Ya no eres domiciliario. Sigues siendo cliente.');
        } catch (e) {
          toast.error('No se pudo cambiar', messageFromError(e, 'Error'));
        }
      },
    });
  }

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
    setEmail(u.email ?? '');
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
    // Sin correo, la cuenta entra con su celular verificado (si no lo cambia).
    const conservaCelular = !!user.telefono_verificado && telefono === (user.telefono ?? '');
    if (!email.trim() && !conservaCelular) nuevosErrores.email = 'El campo correo es obligatorio.';
    if (telefono && !telefonoValido(telefono)) nuevosErrores.telefono = errorTelefono;
    if (direccion && !direccionValida(direccion)) nuevosErrores.direccion = errorDireccion;
    if (esCliente) {
      if (!telefonoValido(telefono)) nuevosErrores.telefono = errorTelefono;
      if (!direccionValida(direccion)) nuevosErrores.direccion = errorDireccion;
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
      if (passNueva.length < 5) {
        setErrores({ password: 'La nueva contrasena debe tener al menos 5 caracteres.' });
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
              direccion: normalizarDireccion(direccion),
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
            <View style={styles.celularEstado}>
              {user.telefono_verificado ? (
                <>
                  <Icon name="check" size={15} color={c.success} />
                  <Text style={[styles.celularEstadoTxt, { color: c.success }]}>
                    Verificado por WhatsApp: puedes entrar con tu celular.
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.celularEstadoTxt}>
                    Sin verificar. Verifícalo para entrar y recuperar tu contraseña con el celular.
                  </Text>
                  <TouchableOpacity onPress={() => setVerificandoCelular(true)} hitSlop={8}>
                    <Text style={styles.celularVerificar}>Verificar</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
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

        {negocios.filter(n => n.rol === 'propietario').length > 0 && (
          <FadeInView delay={100}>
            <Text style={styles.seccion}>Mis negocios</Text>
            {negocios.filter(n => n.rol === 'propietario').map(n => (
              <View key={n.id} style={[styles.tarjeta, styles.tarjetaNegocio]}>
                <Text style={styles.datoValor}>{n.nombre}</Text>
                <Text style={styles.datoEtiqueta}>
                  {n.desactivado ? 'Desactivado · Oculto para los clientes' : 'Visible para los clientes'}
                </Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  disabled={gestionandoNegocio !== null}
                  onPress={() => gestionarNegocio(n, false)}>
                  <Text style={styles.dejarTxt}>{n.desactivado ? 'Reactivar negocio' : 'Desactivar temporalmente'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  disabled={gestionandoNegocio !== null}
                  onPress={() => gestionarNegocio(n, true)}>
                  <Text style={styles.eliminarTxt}>Eliminar negocio definitivamente</Text>
                </TouchableOpacity>
              </View>
            ))}
          </FadeInView>
        )}

        <FadeInView delay={120}>
          <PressableScale style={styles.btn} onPress={empezarEdicion}>
            <Text style={styles.btnTxt}>Editar información</Text>
          </PressableScale>
          {esDomiciliario && (
            <TouchableOpacity onPress={confirmarDejarDomiciliario} hitSlop={8}>
              <Text style={styles.dejarTxt}>Dejar de ser domiciliario</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => setEliminando(true)} hitSlop={8}>
            <Text style={styles.eliminarTxt}>Eliminar mi cuenta</Text>
          </TouchableOpacity>
        </FadeInView>

        <Modal
          visible={verificandoCelular}
          transparent
          animationType="fade"
          onRequestClose={() => setVerificandoCelular(false)}>
          <KeyboardAvoidingView
            style={styles.modalFondo}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.modalCaja}>
              <Text style={styles.modalTitulo}>Verificar mi celular</Text>
              <VerificarTelefono
                telefonoInicial={user.telefono ?? ''}
                pedir={tel => pedirCodigoTelefonoPerfil(auth!.token, tel)}
                verificar={async (tel, codigo) => {
                  const actualizado = await verificarTelefonoPerfil(auth!.token, tel, codigo);
                  actualizarUsuario(actualizado);
                  cargarCampos(actualizado);
                  setVerificandoCelular(false);
                  toast.exito('Celular verificado', 'Ya puedes entrar con tu número de celular.');
                }}
              />
              <TouchableOpacity onPress={() => setVerificandoCelular(false)}>
                <Text style={styles.celularCancelar}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Modal>

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
                style={styles.inputModal}
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
            <Text style={styles.label}>{user.telefono_verificado ? 'Correo (opcional)' : 'Correo'}</Text>
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
                setTelefono(valor.replace(/[^0-9]/g, '').slice(0, 10));
                limpiarError('telefono');
              }}
              placeholder="Tu número de contacto"
              placeholderTextColor={c.mutedSoft}
              keyboardType="number-pad" maxLength={10}
              editable={!guardando}
            />
            <FieldError mensaje={errores.telefono} />
            {user.telefono_verificado && telefono !== (user.telefono ?? '') ? (
              <Text style={styles.ayuda}>
                El número nuevo queda sin verificar: después de guardar, verifícalo desde Mi información.
              </Text>
            ) : null}
          </View>
        </FadeInView>

        <FadeInView delay={60}>
          <Text style={styles.seccion}>Mi dirección</Text>
          <View style={styles.tarjeta}>
            <Text style={styles.label}>Dirección</Text>
            <CamposDireccion value={direccion} onChangeText={valor => { setDireccion(valor); limpiarError('direccion'); }} editable={!guardando} />
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
              placeholder="Mínimo 5 caracteres"
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
  tarjetaNegocio: { marginBottom: 12 },
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
  // Dejar de ser domiciliario (se puede volver: no va en rojo)
  dejarTxt: { textAlign: 'center', color: c.muted, fontFamily: font.semibold, fontSize: 13, marginTop: 22 },
  // Eliminar mi cuenta
  eliminarTxt: { textAlign: 'center', color: c.danger, fontFamily: font.semibold, fontSize: 13, marginTop: 22 },
  celularEstado: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: c.border,
  },
  celularEstadoTxt: { flex: 1, fontSize: 12.5, fontFamily: font.regular, color: c.muted, lineHeight: 18 },
  celularVerificar: { color: c.goldText, fontFamily: font.bold, fontSize: 13 },
  celularCancelar: { textAlign: 'center', color: c.muted, fontFamily: font.semibold, marginTop: 16 },
  modalFondo: { flex: 1, backgroundColor: c.scrim, justifyContent: 'center', padding: 24 },
  modalCaja: { backgroundColor: c.surface, borderRadius: radius.xl, padding: 22, ...shadow.card },
  modalTitulo: { fontSize: 18, fontFamily: font.display, color: c.textStrong, marginBottom: 8 },
  modalTexto: { fontSize: 13, fontFamily: font.regular, color: c.text, lineHeight: 19, marginBottom: 14 },
  inputModal: {
    borderWidth: 1, borderColor: c.borderStrong, borderRadius: radius.md, paddingHorizontal: 14,
    paddingVertical: 12, fontSize: 16, fontFamily: font.regular, color: c.textStrong, marginBottom: 6,
  },
  // El texto usa `surface` (claro de día, oscuro de noche) porque `danger`
  // también cambia de tono por modo y así conserva el contraste.
  botonPeligro: {
    backgroundColor: c.danger, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', marginTop: 8,
  },
  botonDeshabilitado: { opacity: 0.7 },
  botonPeligroTxt: { color: c.surface, fontFamily: font.bold, fontSize: 15 },
}));
