import { telefonoValido, errorTelefono } from '../direccion';
/**
 * Mi información — datos PERSONALES de la cuenta (cualquier rol).
 *
 * Se abre desde el menú de "Mi perfil" (ícono de usuario de la topbar).
 * Primero muestra la información en modo lectura y, con "Editar información",
 * pasa al formulario (nombre, apellidos, correo y teléfono de contacto).
 * Desde este perfil el dueño también desactiva, reactiva o elimina sus negocios.
 * Al final de la vista de lectura están "Dejar de ser domiciliario" (solo
 * para el domiciliario) y "Eliminar mi cuenta".
 *
 * Clave de 4 números: «Cambiar mi clave» (pide la actual). Las acciones
 * delicadas la piden antes (usePedirClave): cambiar el celular verificado
 * (con el que se entra), desconectar Google y eliminar la cuenta.
 *
 * Google: aquí se conecta (para entrar con un toque y recuperar la clave) o
 * se desconecta (solo con el celular verificado: sin él no podría volver a
 * entrar desde otro teléfono).
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
import { actualizarPerfil, comprobarClave, conectarGoogle, dejarDeSerDomiciliario, desconectarGoogle, desactivarNegocio, eliminarCuenta, eliminarNegocio, Negocio, pedirCodigoTelefonoPerfil, Usuario, verificarTelefonoPerfil } from '../api';
import { useAuth } from '../AuthContext';
import { FadeInView, PressableScale } from '../components/anim';
import BotonGoogle, { LogoGoogle } from '../components/BotonGoogle';
import CambiarClaveModal from '../components/CambiarClaveModal';
import CampoPin from '../components/CampoPin';
import { usePedirClave } from '../components/PedirClave';
import { useConfirmar } from '../components/Confirmacion';
import FieldError from '../components/FieldError';
import Icon, { IconName } from '../components/Icon';
import VerificarTelefono from '../components/VerificarTelefono';
import { FieldErrors, fieldErrorsFromError, messageFromError } from '../formErrors';
import { elegirCuentaGoogle, googleDisponible } from '../google';
import { useNegocio } from '../NegocioContext';
import { RootStackParamList } from '../navTypes';
import { font, makeStyles, radius, useTheme } from '../theme';
import { useToast } from '../Toast';
import { EspacioTecladoModal } from '../components/EspacioTeclado';
import { DesplazableTutorial, Objetivo, useDesplazableTutorial } from '../tutorial/Objetivo';

type Props = NativeStackScreenProps<RootStackParamList, 'MiInformacion'>;

export default function MiInformacionScreen(_props: Props) {
  const { c } = useTheme();
  const styles = useStyles();
  const { auth, actualizarUsuario, salir } = useAuth();
  // El tutorial baja hasta «Editar información».
  const tutorialScroll = useDesplazableTutorial();
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
  // Modal de la clave para las acciones delicadas, y «Cambiar mi clave».
  const pedirClave = usePedirClave();
  const [cambiandoClave, setCambiandoClave] = useState(false);
  const mostrarGoogle = !!user.google || googleDisponible();
  const [cambiandoGoogle, setCambiandoGoogle] = useState(false);

  async function conectarCuentaGoogle() {
    setCambiandoGoogle(true);
    try {
      const idToken = await elegirCuentaGoogle();
      if (!idToken) return;
      const r = await conectarGoogle(auth!.token, idToken);
      actualizarUsuario(r.user);
      toast.exito('Google conectado', 'Ya puedes entrar con tu cuenta de Google.');
    } catch (e) {
      toast.error('No se pudo conectar Google', messageFromError(e));
    } finally {
      setCambiandoGoogle(false);
    }
  }

  function confirmarDesconectarGoogle() {
    pedirClave.pedir({
      titulo: '¿Desconectar Google?',
      texto: 'Ya no podrás entrar con tu cuenta de Google: entrarás con tu celular y tu clave. Escribe tu clave para confirmar.',
      textoBoton: 'Desconectar',
      peligro: true,
      accion: async pin => {
        const r = await desconectarGoogle(auth!.token, pin);
        actualizarUsuario(r.user);
        toast.exito('Google desconectado');
      },
    });
  }

  // Cambiar el celular verificado: primero la clave, luego el código al número nuevo.
  const [pinCelular, setPinCelular] = useState<string | null>(null);
  function cambiarCelular() {
    pedirClave.pedir({
      titulo: 'Cambiar mi celular',
      texto: 'Con tu celular entras a Vitrina. Escribe tu clave y luego te enviaremos un código por WhatsApp al número nuevo.',
      textoBoton: 'Continuar',
      accion: async pin => {
        await comprobarClave(auth!.token, pin);
        setPinCelular(pin);
        // Un modal se cierra y el otro se abre: con una pausa no se pisan.
        setTimeout(() => setVerificandoCelular(true), 350);
      },
    });
  }

  function cerrarVerificarCelular() {
    setVerificandoCelular(false);
    setPinCelular(null);
  }

  // 'ver' = solo lectura · 'editar' = formulario.
  const [modo, setModo] = useState<'ver' | 'editar'>('ver');

  const [nombre, setNombre] = useState(user.name);
  const [apellidos, setApellidos] = useState(user.apellidos ?? '');
  const [email, setEmail] = useState(user.email ?? '');
  const [telefono, setTelefono] = useState(user.telefono ?? '');
  const [guardando, setGuardando] = useState(false);
  const [errores, setErrores] = useState<FieldErrors>({});

  // Verificar el celular con un código por WhatsApp.
  const [verificandoCelular, setVerificandoCelular] = useState(false);

  // "Eliminar mi cuenta": se confirma con la clave de 4 números.
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
    if (clave.length !== 4) {
      setErrorClave('Escribe tu clave de 4 números para confirmar.');
      return;
    }
    setEnviando(true);
    try {
      await eliminarCuenta(auth!.token, clave);
      setEliminando(false);
      toast.exito('Cuenta eliminada', 'Gracias por haber usado Vitrina.');
      salir();
    } catch (e) {
      setClave('');
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
    if (!email.trim() && !conservaCelular && !user.google) nuevosErrores.email = 'El campo correo es obligatorio.';
    if (telefono && !telefonoValido(telefono)) nuevosErrores.telefono = errorTelefono;
    if (esCliente && !telefonoValido(telefono)) nuevosErrores.telefono = errorTelefono;
    if (Object.keys(nuevosErrores).length > 0) {
      setErrores(nuevosErrores);
      return;
    }
    setGuardando(true);
    try {
      const actualizado = await actualizarPerfil(auth!.token, {
        name: nombre.trim(),
        apellidos: apellidos.trim(),
        email: email.trim(),
        // La dirección se maneja en "Mis direcciones".
        ...(esCliente || telefono.trim() ? { telefono: telefono.trim() } : {}),
      });
      actualizarUsuario(actualizado);
      cargarCampos(actualizado);
      setModo('ver');
      toast.exito('Información actualizada', 'Tus datos personales quedaron guardados.');
    } catch (e) {
      const campos = fieldErrorsFromError(e);
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
      <DesplazableTutorial value={tutorialScroll.valor}>
      <ScrollView ref={tutorialScroll.scrollRef} onScroll={tutorialScroll.onScroll} scrollEventThrottle={32} style={styles.container} contentContainerStyle={styles.content}>
        <FadeInView>
          <Text style={styles.seccion}>Datos personales</Text>
          <View style={styles.tarjeta}>
            <Objetivo id="info.datos">
            <Dato icono="usuario" etiqueta="Nombre(s)" valor={user.name} />
            <Dato icono="usuarios" etiqueta="Apellidos" valor={user.apellidos} />
            <Dato icono="lista" etiqueta="Correo" valor={user.email} />
            </Objetivo>
            <Objetivo id="info.telefono">
            <Dato icono="telefono" etiqueta="Teléfono" valor={user.telefono} ultimo />
            <View style={styles.celularEstado}>
              {user.telefono_verificado ? (
                <>
                  <Icon name="check" size={15} color={c.success} />
                  <Text style={[styles.celularEstadoTxt, { color: c.success }]}>
                    Verificado por WhatsApp: entras con tu celular y tu clave.
                  </Text>
                  <TouchableOpacity onPress={cambiarCelular} hitSlop={8}>
                    <Text style={styles.celularVerificar}>Cambiar</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.celularEstadoTxt}>
                    Sin verificar. Verifícalo para entrar y recuperar tu clave con el celular.
                  </Text>
                  <TouchableOpacity onPress={() => setVerificandoCelular(true)} hitSlop={8}>
                    <Text style={styles.celularVerificar}>Verificar</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
            </Objetivo>
          </View>
        </FadeInView>

        <FadeInView delay={60}>
          <Text style={styles.seccion}>Seguridad</Text>
          <View style={styles.tarjeta}>
            <Dato
              icono="candado"
              etiqueta="Clave de 4 números"
              valor="••••"
              ultimo
            />
            <TouchableOpacity accessibilityRole="button" onPress={() => setCambiandoClave(true)} hitSlop={8}>
              <Text style={styles.dejarTxt}>Cambiar mi clave</Text>
            </TouchableOpacity>
          </View>
        </FadeInView>

        {(!!codigoPublico || mostrarGoogle) && (
          <FadeInView delay={90}>
            <Text style={styles.seccion}>Cuenta</Text>
            {!!codigoPublico && (
              <View style={styles.tarjeta}>
                <Dato
                  icono="etiqueta"
                  etiqueta="Código público (para que un negocio te invite)"
                  valor={`#${codigoPublico}`}
                  ultimo
                />
              </View>
            )}
            {mostrarGoogle && (
              <View style={[styles.tarjeta, !!codigoPublico && styles.tarjetaSiguiente]}>
                <View style={styles.googleFila}>
                  <LogoGoogle size={20} />
                  <View style={styles.googleTexto}>
                    <Text style={styles.datoValor}>{user.google ? 'Google conectado' : 'Entrar con Google'}</Text>
                    <Text style={styles.datoEtiqueta}>
                      {user.google
                        ? user.telefono_verificado
                          ? 'Puedes entrar con tu cuenta de Google o con tu celular, siempre con tu clave.'
                          : 'Entras con Google y tu clave. Verifica tu celular para entrar también con tu número.'
                        : 'Conéctala para entrar con un toque y para recuperar tu clave si cambias de número.'}
                    </Text>
                  </View>
                </View>
                {user.google ? (
                  // Sin celular verificado no podría volver a entrar desde otro teléfono.
                  !!user.telefono_verificado && (
                    <TouchableOpacity accessibilityRole="button" onPress={confirmarDesconectarGoogle} hitSlop={8}>
                      <Text style={styles.dejarTxt}>Desconectar Google</Text>
                    </TouchableOpacity>
                  )
                ) : (
                  <BotonGoogle
                    texto="Conectar con Google"
                    onPress={conectarCuentaGoogle}
                    cargando={cambiandoGoogle}
                    style={styles.googleBoton}
                  />
                )}
              </View>
            )}
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
          <Objetivo id="info.editar">
          <PressableScale style={styles.btn} onPress={empezarEdicion}>
            <Text style={styles.btnTxt}>Editar información</Text>
          </PressableScale>
          </Objetivo>
          {esDomiciliario && (
            <TouchableOpacity onPress={confirmarDejarDomiciliario} hitSlop={8}>
              <Text style={styles.dejarTxt}>Dejar de ser domiciliario</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => setEliminando(true)} hitSlop={8}>
            <Text style={styles.eliminarTxt}>Eliminar mi cuenta</Text>
          </TouchableOpacity>
        </FadeInView>

        {pedirClave.modal}
        <CambiarClaveModal
          visible={cambiandoClave}
          token={auth!.token}
          onCerrar={() => setCambiandoClave(false)}
          onListo={actualizado => {
            actualizarUsuario(actualizado);
            setCambiandoClave(false);
            toast.exito('Clave cambiada', 'Desde ahora entras con tu clave nueva.');
          }}
        />

        <Modal
          visible={verificandoCelular}
          transparent
          animationType="fade"
          onRequestClose={cerrarVerificarCelular}>
          <EspacioTecladoModal style={styles.modalFondo}>
            <View style={styles.modalCaja}>
              <Text style={styles.modalTitulo}>{pinCelular ? 'Cambiar mi celular' : 'Verificar mi celular'}</Text>
              <VerificarTelefono
                telefonoInicial={pinCelular ? '' : user.telefono ?? ''}
                pedir={tel => pedirCodigoTelefonoPerfil(auth!.token, tel, pinCelular ?? undefined)}
                verificar={async (tel, codigo) => {
                  const actualizado = await verificarTelefonoPerfil(auth!.token, tel, codigo);
                  actualizarUsuario(actualizado);
                  cargarCampos(actualizado);
                  cerrarVerificarCelular();
                  toast.exito('Celular verificado', 'Desde ahora entras con este número y tu clave.');
                }}
              />
              <TouchableOpacity onPress={cerrarVerificarCelular}>
                <Text style={styles.celularCancelar}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </EspacioTecladoModal>
        </Modal>

        <Modal visible={eliminando} transparent animationType="fade" onRequestClose={cerrarEliminar}>
          <EspacioTecladoModal style={styles.modalFondo}>
            <View style={styles.modalCaja}>
              <Text style={styles.modalTitulo}>Eliminar mi cuenta</Text>
              <Text style={styles.modalTexto}>
                Se borran tu nombre, correo, teléfono, direcciones y sesiones. Los pedidos ya hechos se
                conservan sin tus datos. Si eres el único dueño de un negocio, se cierra y deja de verse.
                No se puede deshacer.
              </Text>
              <Text style={styles.modalTexto}>Para confirmar, escribe tu clave de 4 números.</Text>
              <CampoPin
                value={clave}
                onChangeText={v => {
                  setClave(v);
                  setErrorClave(undefined);
                }}
                editable={!enviando}
                conError={!!errorClave}
                autoFocus
                accessibilityLabel="Tu clave de 4 números"
                style={styles.pinModal}
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
          </EspacioTecladoModal>
        </Modal>
      </ScrollView>
      </DesplazableTutorial>
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
            <Text style={styles.label}>{user.telefono_verificado || user.google ? 'Correo (opcional)' : 'Correo'}</Text>
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
              editable={!guardando && !user.telefono_verificado}
            />
            <FieldError mensaje={errores.telefono} />
            {user.telefono_verificado ? (
              <Text style={styles.ayuda}>
                Es tu celular verificado, con el que entras: se cambia con «Cambiar» en Mi información (te pediremos
                tu clave y un código de WhatsApp).
              </Text>
            ) : null}
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
  // Google conectado o por conectar
  tarjetaSiguiente: { marginTop: 10 },
  googleFila: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  googleTexto: { flex: 1 },
  googleBoton: { marginTop: 14 },
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
  pinModal: { marginTop: 4 },
}));
