/**
 * Equipo del negocio ACTIVO: miembros e invitaciones.
 *
 * La app no permite buscar personas. Para sumar a alguien, el propietario
 * escribe su código público EXACTO (ej. #U34F4D), ve su nombre para
 * confirmar y le envía una invitación que esa persona debe aceptar.
 * Un trabajador ve el equipo y puede salirse del negocio.
 */
import { useFocusEffect } from '@react-navigation/native';
import { temasDelNegocio, useEnVivo } from '../usePolling';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Switch, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import {
  actualizarPermisosMiembro,
  PermisosNegocio,
  tienePermiso,
  cancelarInvitacion,
  getEquipo,
  InvitacionEnviada,
  invitarTrabajador,
  MiembroNegocio,
  quitarMiembro,
  resolverCodigo,
  salirDelNegocio,
} from '../api';
import { useAuth } from '../AuthContext';
import { FadeInView, PressableScale } from '../components/anim';
import { useConfirmar } from '../components/Confirmacion';
import FieldError from '../components/FieldError';
import Icon from '../components/Icon';
import { messageFromError } from '../formErrors';
import { useNegocio } from '../NegocioContext';
import { RootStackParamList } from '../navTypes';
import { font, makeStyles, radius, useTheme } from '../theme';
import { useToast } from '../Toast';

const SIN_PERMISOS: PermisosNegocio = { modificar_inventario: false, gestionar_pedidos: false, cambiar_estado: false, administrador: false };
const PERMISOS: { clave: keyof PermisosNegocio; titulo: string; detalle: string }[] = [
  { clave: 'modificar_inventario', titulo: 'Modificar inventario', detalle: 'Añadir, editar, desactivar o eliminar productos, servicios y categorías.' },
  { clave: 'gestionar_pedidos', titulo: 'Manejar pedidos', detalle: 'Aceptar, rechazar, marcar listos y seguir todo el flujo del domicilio.' },
  { clave: 'cambiar_estado', titulo: 'Abrir y cerrar el negocio', detalle: 'Cambiar el estado y confirmar el cierre del negocio.' },
  { clave: 'administrador', titulo: 'Administrador del negocio', detalle: 'Puede hacer todo, editar la información y administrar el equipo. Nunca puede modificar ni retirar al dueño.' },
];

type Props = NativeStackScreenProps<RootStackParamList, 'Equipo'>;

export default function EquipoScreen({ navigation }: Props) {
  const { c } = useTheme();
  const styles = useStyles();
  const { auth } = useAuth();
  const token = auth!.token;
  const toast = useToast();
  const confirmar = useConfirmar();
  const { negocio, esPropietario, recargar } = useNegocio();
  const negocioId = negocio?.id ?? null;
  const administra = tienePermiso(negocio, 'administrador');
  const [permisosInvitacion, setPermisosInvitacion] = useState<PermisosNegocio>({ ...SIN_PERMISOS });
  const [seleccionado, setSeleccionado] = useState<MiembroNegocio | null>(null);
  const [permisos, setPermisos] = useState<PermisosNegocio>({ ...SIN_PERMISOS });
  const [guardando, setGuardando] = useState(false);

  const [miembros, setMiembros] = useState<MiembroNegocio[]>([]);
  const [pendientes, setPendientes] = useState<InvitacionEnviada[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);

  // Invitar por código: primero se resuelve el nombre y luego se confirma.
  const [codigo, setCodigo] = useState('');
  const [encontrado, setEncontrado] = useState<{ name: string; codigo_publico: string } | null>(null);
  const [errorCodigo, setErrorCodigo] = useState<string | undefined>();
  const [buscando, setBuscando] = useState(false);
  const [invitando, setInvitando] = useState(false);

  useEffect(() => {
    setSeleccionado(null);
    setCodigo('');
    setEncontrado(null);
    setErrorCodigo(undefined);
    setPermisosInvitacion({ ...SIN_PERMISOS });
    setMiembros([]);
    setPendientes([]);
    setCargando(true);
  }, [negocioId]);

  const cargar = useCallback(async () => {
    if (!negocioId) {
      setCargando(false);
      return;
    }
    try {
      const equipo = await getEquipo(token, negocioId);
      setMiembros(equipo.miembros);
      setPendientes(equipo.pendientes);
    } catch (e) {
      toast.error('No se pudo cargar el equipo', messageFromError(e, 'Error'));
    } finally {
      setCargando(false);
    }
  }, [negocioId, token, toast]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );
  // En vivo: alguien acepta o rechaza la invitación, sale del equipo o cambian sus permisos.
  useEnVivo(temasDelNegocio(['equipo'], negocioId), cargar);

  async function refrescar() {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  }

  async function buscar() {
    if (!negocioId) {
      return;
    }
    setErrorCodigo(undefined);
    setEncontrado(null);
    if (!codigo.trim()) {
      setErrorCodigo('Escribe el código que te compartió la persona.');
      return;
    }
    setBuscando(true);
    try {
      setEncontrado(await resolverCodigo(token, negocioId, codigo));
    } catch (e) {
      setErrorCodigo(messageFromError(e, 'No se pudo buscar el código.'));
    } finally {
      setBuscando(false);
    }
  }

  async function invitar() {
    if (!negocioId || !encontrado) {
      return;
    }
    setInvitando(true);
    try {
      const mensaje = await invitarTrabajador(token, negocioId, encontrado.codigo_publico, permisosInvitacion);
      setPermisosInvitacion({ ...SIN_PERMISOS });
      toast.exito('Invitación enviada', mensaje);
      setCodigo('');
      setEncontrado(null);
      cargar();
    } catch (e) {
      setErrorCodigo(messageFromError(e, 'No se pudo invitar.'));
    } finally {
      setInvitando(false);
    }
  }

  function onCancelarInvitacion(inv: InvitacionEnviada) {
    if (!negocioId) {
      return;
    }
    confirmar({
      icono: 'cerrar',
      titulo: '¿Cancelar la invitación?',
      texto: `${inv.nombre ?? 'Esta persona'} ya no podrá unirse a ${negocio?.nombre ?? 'tu negocio'} con ella.`,
      textoBoton: 'Cancelar invitación',
      textoCancelar: 'Volver',
      peligro: true,
      accion: async () => {
        try {
          await cancelarInvitacion(token, negocioId, inv.id);
          setPendientes(lista => lista.filter(i => i.id !== inv.id));
        } catch (e) {
          toast.error('No se pudo cancelar', messageFromError(e, 'Error'));
        }
      },
    });
  }

  function onQuitar(m: MiembroNegocio) {
    if (!negocioId) {
      return;
    }
    confirmar({
      icono: 'usuarios',
      titulo: `¿Quitar a ${m.name} del equipo?`,
      texto: `Ya no podrá gestionar ${negocio?.nombre ?? 'el negocio'}.`,
      textoBoton: 'Quitar del equipo',
      textoCancelar: 'Cancelar',
      peligro: true,
      accion: async () => {
        try {
          await quitarMiembro(token, negocioId, m.id);
          toast.exito('Listo', `${m.name} ya no hace parte del negocio.`);
          setMiembros(lista => lista.filter(x => x.id !== m.id));
          setSeleccionado(null);
          await recargar();
        } catch (e) {
          toast.error('No se pudo quitar', messageFromError(e, 'Error'));
        }
      },
    });
  }

  function onSalir() {
    if (!negocioId) {
      return;
    }
    confirmar({
      icono: 'salir',
      titulo: '¿Salir del negocio?',
      texto: `Dejarás de trabajar en ${negocio?.nombre ?? 'este negocio'}. Para volver, tendrán que invitarte otra vez.`,
      textoBoton: 'Salir del negocio',
      textoCancelar: 'Cancelar',
      peligro: true,
      accion: async () => {
        try {
          await salirDelNegocio(token, negocioId);
          await recargar();
          toast.exito('Saliste del negocio', negocio?.nombre);
          navigation.navigate('MisNegocios');
        } catch (e) {
          toast.error('No se pudo salir', messageFromError(e, 'Error'));
        }
      },
    });
  }

  function selectorPermisos(valor: PermisosNegocio, cambiar: (p: PermisosNegocio) => void, editable: boolean) {
    return <View>{PERMISOS.map(p => <View key={p.clave} style={styles.permiso}>
      <View style={{ flex: 1 }}><Text style={styles.miembroNombre}>{p.titulo}</Text><Text style={styles.ayuda}>{p.detalle}</Text></View>
      <Switch accessibilityLabel={p.titulo} value={valor.administrador || valor[p.clave]} disabled={!editable || (valor.administrador && p.clave !== 'administrador')} onValueChange={v => cambiar({ ...valor, [p.clave]: v })} />
    </View>)}</View>;
  }

  async function guardarPermisos() {
    if (!seleccionado || !negocioId) return;
    setGuardando(true);
    try {
      await actualizarPermisosMiembro(token, negocioId, seleccionado.id, permisos);
      setSeleccionado(null);
      await Promise.all([cargar(), recargar()]);
      toast.exito('Permisos actualizados');
    } catch (e) {
      toast.error('No se pudieron guardar los permisos', messageFromError(e));
    } finally { setGuardando(false); }
  }

  if (!negocio) {
    return (
      <View style={styles.centro}>
        <Text style={styles.vacioTxt}>Primero elige o crea un negocio.</Text>
      </View>
    );
  }

  if (cargando) {
    return <ActivityIndicator size="large" color={c.accent} style={{ marginTop: 40 }} />;
  }

  return (
    <>
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl refreshing={refrescando} onRefresh={refrescar} colors={[c.accent]} tintColor={c.accent} />
      }>
      {administra && <TouchableOpacity onPress={() => navigation.navigate('AgendaNegocio', { negocioId: negocioId! })}>
        <Text style={styles.vacioTxt}>Antes de retirar a un trabajador con citas, reasígnalas en la agenda. Abrir agenda →</Text>
      </TouchableOpacity>}
      <Text style={styles.negocio}>{negocio.nombre}</Text>

      {administra && (
        <FadeInView style={styles.tarjeta}>
          <Text style={styles.tarjetaTitulo}>Invitar a un trabajador</Text>
          <Text style={styles.ayuda}>
            Pídele su código (lo ve en "Mis negocios"). Recibirá la invitación y debe aceptarla.
          </Text>
          <View style={styles.filaCodigo}>
            <TextInput
              style={styles.input}
              value={codigo}
              onChangeText={v => {
                setCodigo(v);
                setEncontrado(null);
                setErrorCodigo(undefined);
              }}
              placeholder="#U34F4D"
              placeholderTextColor={c.mutedSoft}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!buscando && !invitando}
              onSubmitEditing={buscar}
            />
            <TouchableOpacity style={styles.buscarBtn} onPress={buscar} disabled={buscando || invitando}>
              {buscando ? <ActivityIndicator color={c.onBrand} /> : <Icon name="lupa" size={18} color={c.onBrand} />}
            </TouchableOpacity>
          </View>
          <FieldError mensaje={errorCodigo} />

          {encontrado && (
            <View style={styles.confirmar}>
              <Text style={styles.confirmarTxt}>
                ¿Invitar a <Text style={styles.confirmarNombre}>{encontrado.name}</Text>?
              </Text>
              {selectorPermisos(permisosInvitacion, setPermisosInvitacion, !invitando)}
              <PressableScale style={styles.invitarBtn} onPress={invitar} disabled={invitando}>
                {invitando ? (
                  <ActivityIndicator color={c.onBrand} />
                ) : (
                  <Text style={styles.invitarTxt}>Enviar invitación</Text>
                )}
              </PressableScale>
            </View>
          )}
        </FadeInView>
      )}

      <Text style={styles.seccion}>Miembros ({miembros.length})</Text>
      {miembros.map((m, i) => (
        <FadeInView key={m.id} delay={i * 40}><TouchableOpacity accessibilityRole="button" accessibilityLabel={`Ver información y permisos de ${m.name}`} style={styles.miembro} onPress={() => { setSeleccionado(m); setPermisos(m.permisos ?? { ...SIN_PERMISOS }); }}>
          <Icon name="usuario" size={20} color={c.accent} style={styles.miembroIcono} />
          <View style={styles.miembroTexto}>
            <Text style={styles.miembroNombre}>
              {m.name}
              {m.es_yo ? ' (tú)' : ''}
            </Text>
            <Text style={styles.miembroRol}>
              {m.rol === 'propietario' ? 'Propietario' : m.permisos?.administrador ? 'Administrador' : 'Trabajador'}
              {m.activo ? '' : ' · Suspendido'}
            </Text>
          </View>
          {administra && m.rol !== 'propietario' && (
            <TouchableOpacity onPress={() => onQuitar(m)} hitSlop={8}>
              <Icon name="basura" size={18} color={c.danger} />
            </TouchableOpacity>
          )}
        </TouchableOpacity></FadeInView>
      ))}

      {administra && pendientes.length > 0 && (
        <>
          <Text style={styles.seccion}>Invitaciones pendientes</Text>
          {pendientes.map(inv => (
            <View key={inv.id} style={styles.miembro}>
              <Icon name="reloj" size={20} color={c.muted} style={styles.miembroIcono} />
              <View style={styles.miembroTexto}>
                <Text style={styles.miembroNombre}>{inv.nombre ?? 'Persona invitada'}</Text>
                <Text style={styles.miembroRol}>Enviada el {inv.fecha}</Text>
              </View>
              <TouchableOpacity onPress={() => onCancelarInvitacion(inv)} hitSlop={8}>
                <Icon name="cerrar" size={18} color={c.danger} />
              </TouchableOpacity>
            </View>
          ))}
        </>
      )}

      {!esPropietario && (
        <TouchableOpacity style={styles.salir} onPress={onSalir}>
          <Text style={styles.salirTxt}>Salir del negocio</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
    <Modal visible={!!seleccionado} transparent animationType="fade" onRequestClose={() => { if (!guardando) setSeleccionado(null); }}>
      <View style={styles.fondoModal}>
        <ScrollView style={styles.modal} contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
          <Text style={styles.tarjetaTitulo}>{seleccionado?.name}</Text>
          <Text style={styles.ayuda}>{seleccionado?.rol === 'propietario' ? 'Propietario' : seleccionado?.permisos?.administrador ? 'Administrador' : 'Trabajador'} · {seleccionado?.activo ? 'Activo' : 'Suspendido'}</Text>
          {!!seleccionado?.codigo_publico && <Text style={styles.ayuda}>Código: #{seleccionado.codigo_publico}</Text>}
          <Text style={styles.seccion}>Permisos</Text>
          {selectorPermisos(permisos, setPermisos, administra && seleccionado?.rol !== 'propietario' && !guardando)}
          {administra && seleccionado?.rol !== 'propietario' && <TouchableOpacity disabled={guardando} style={styles.invitarBtn} onPress={guardarPermisos}>
            {guardando ? <ActivityIndicator color={c.onBrand} /> : <Text style={styles.invitarTxt}>Guardar permisos</Text>}
          </TouchableOpacity>}
          <TouchableOpacity disabled={guardando} style={styles.salir} onPress={() => setSeleccionado(null)}><Text style={styles.vacioTxt}>Cerrar</Text></TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
    </>
  );
}

const useStyles = makeStyles((c, shadow) => ({
  fondoModal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modal: { flexGrow: 0, maxHeight: '90%', backgroundColor: c.surface, borderRadius: radius.lg },
  permiso: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  container: { flex: 1, backgroundColor: c.bg },
  content: { padding: 20, paddingBottom: 60 },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg, padding: 20 },
  negocio: { fontSize: 20, fontFamily: font.display, color: c.textStrong, marginBottom: 14 },
  tarjeta: { backgroundColor: c.surface, borderRadius: radius.lg, padding: 16, ...shadow.soft },
  tarjetaTitulo: { fontSize: 15, fontFamily: font.bold, color: c.textStrong },
  ayuda: { color: c.muted, fontSize: 12, fontFamily: font.regular, marginTop: 4, marginBottom: 12 },
  // marginBottom: FieldError se sube 10px asumiendo el margen de un input.
  filaCodigo: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  input: {
    flex: 1, borderWidth: 1, borderColor: c.borderStrong, borderRadius: radius.md,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 16, color: c.textStrong,
    fontFamily: font.semibold, letterSpacing: 1,
  },
  buscarBtn: {
    backgroundColor: c.brand, borderRadius: radius.md, width: 48,
    alignItems: 'center', justifyContent: 'center',
  },
  confirmar: { borderTopWidth: 1, borderTopColor: c.border, marginTop: 12, paddingTop: 12 },
  confirmarTxt: { color: c.text, fontSize: 15, fontFamily: font.regular },
  confirmarNombre: { fontFamily: font.bold, color: c.textStrong },
  invitarBtn: { backgroundColor: c.brand, borderRadius: radius.md, paddingVertical: 13, alignItems: 'center', marginTop: 10 },
  invitarTxt: { color: c.onBrand, fontFamily: font.bold, fontSize: 15 },
  seccion: { fontSize: 16, fontFamily: font.displaySemi, color: c.textStrong, marginTop: 22, marginBottom: 10 },
  miembro: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface,
    borderRadius: radius.md, padding: 14, marginBottom: 10, ...shadow.low,
  },
  miembroIcono: { marginRight: 12 },
  miembroTexto: { flex: 1 },
  miembroNombre: { fontFamily: font.bold, color: c.textStrong, fontSize: 15 },
  miembroRol: { color: c.muted, fontSize: 13, marginTop: 2, fontFamily: font.regular },
  vacioTxt: { color: c.muted, fontSize: 14, fontFamily: font.regular },
  salir: { marginTop: 28, alignItems: 'center', paddingVertical: 8 },
  salirTxt: { color: c.danger, fontFamily: font.bold },
}));
