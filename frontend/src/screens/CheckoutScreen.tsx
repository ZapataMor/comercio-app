import FotosDireccion, { FOTOS_OBLIGATORIAS, fotosCompletas } from '../components/FotosDireccion';
import { FotosDireccion as Fotos } from '../api';
import { campoDireccionValido, limpiarTextoDireccion } from '../direccion';
import CamposDireccion from '../components/CamposDireccion';
import { normalizarDireccion } from '../direccion';
import { direccionValida, errorDireccion, telefonoValido, errorTelefono } from '../direccion';
import { useFocusEffect } from '@react-navigation/native';
import EditarDireccion from '../components/EditarDireccion';
import SelectorUbicacion from '../components/SelectorUbicacion';
import { textoCantidad } from '../cantidades';
import { CommonActions } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useEnVivo } from '../usePolling';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  ClienteDireccion,
  Coordenadas,
  crearClienteDireccion,
  getCatalogo,
  getClienteDirecciones,
  getTarifaDomicilio,
  nuevaClaveIntento,
} from '../api';
import { useAuth } from '../AuthContext';
import { useCart } from '../CartContext';
import { usePedidoPendiente } from '../PedidoPendienteContext';
import { detalleOpciones } from '../opcionesProducto';
import { FadeInView, PressableScale } from '../components/anim';
import BarrioSelect from '../components/BarrioSelect';
import { useConfirmar } from '../components/Confirmacion';
import FieldError from '../components/FieldError';
import Icon from '../components/Icon';
import { FieldErrors, fieldErrorsFromError, messageFromError } from '../formErrors';
import { RootStackParamList } from '../navTypes';
import { font, makeStyles, radius, useTheme } from '../theme';
import { useToast } from '../Toast';

type Props = NativeStackScreenProps<RootStackParamList, 'Checkout'>;
type SeleccionUbicacion = number | 'nueva' | null;

function cop(n: number) {
  return '$' + Math.round(n).toLocaleString('es-CO');
}

function textoUbicacion(ubicacion: Pick<ClienteDireccion, 'direccion' | 'barrio'>) {
  return `${ubicacion.direccion} - Barrio ${ubicacion.barrio}`;
}

export default function CheckoutScreen({ navigation }: Props) {
  const { c } = useTheme();
  const styles = useStyles();
  const { auth, actualizarUsuario } = useAuth();
  const cart = useCart();
  const envio = usePedidoPendiente();
  const toast = useToast();
  const pedirConfirmacion = useConfirmar();
  const [direcciones, setDirecciones] = useState<ClienteDireccion[]>([]);
  const [seleccion, setSeleccion] = useState<SeleccionUbicacion>(null);
  const [cargandoDirecciones, setCargandoDirecciones] = useState(true);
  const [nuevaDireccion, setNuevaDireccion] = useState('');
  const [nuevoBarrio, setNuevoBarrio] = useState('');
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [fotos, setFotos] = useState<Fotos>({});
  const [nuevoPunto, setNuevoPunto] = useState<Coordenadas | null>(null);
  const [editandoDireccion, setEditandoDireccion] = useState<ClienteDireccion | null>(null);
  // Telefono guardado en el perfil del cliente (se pidio al registrarse).
  const telefonoGuardado = auth?.user.telefono?.trim() || null;
  const [usarOtroTelefono, setUsarOtroTelefono] = useState(!telefonoGuardado);
  const [telefono, setTelefono] = useState('');
  const [pago, setPago] = useState('efectivo');
  const [enviando, setEnviando] = useState(false);
  const [errores, setErrores] = useState<FieldErrors>({});
  // Tarifa vigente del domicilio (la confirma el servidor al crear el pedido).
  const [domicilio, setDomicilio] = useState<number | null>(null);
  const [tarifaFallo, setTarifaFallo] = useState(false);
  const totalConDomicilio = cart.total + (domicilio ?? 0);
  // Un mismo intento de compra conserva su clave aunque se reintente por un
  // corte de red: el servidor devuelve el pedido ya creado en vez de duplicarlo.
  const claveIntento = useRef(nuevaClaveIntento());
  const navegando = useRef<number | null>(null);
  const confirmadoAlEntrar = useRef(envio.confirmado?.id);
  const consumirConfirmado = envio.consumirConfirmado;

  useEffect(() => {
    const p = envio.confirmado;
    if (!p || navegando.current === p.id) return;
    consumirConfirmado();
    if (p.id === confirmadoAlEntrar.current) return;
    navegando.current = p.id;
    navigation.dispatch(CommonActions.reset({ index: 2, routes: [
      { name: 'Explorar' },
      { name: 'MisPedidos' },
      { name: 'PedidoDetalle', params: { id: p.id } },
    ] }));
  }, [envio.confirmado, navigation, consumirConfirmado]);

  const cargarTarifa = useCallback(() => {
    if (!auth?.token) return;
    setTarifaFallo(false);
    getTarifaDomicilio(auth.token)
      .then(setDomicilio)
      .catch(() => {
        setDomicilio(null);
        setTarifaFallo(true);
      });
  }, [auth?.token]);

  useEffect(cargarTarifa, [cargarTarifa]);
  useEnVivo(['ajustes'], cargarTarifa);

  function limpiarError(campo: string) {
    setErrores(prev => {
      const next = { ...prev };
      delete next[campo];
      return next;
    });
  }

  useFocusEffect(useCallback(() => {
    let activo = true;

    async function cargarDirecciones() {
      if (!auth?.token) return;
      try {
        const lista = await getClienteDirecciones(auth.token);
        if (!activo) return;
        setDirecciones(lista);
        const principal = lista.find(d => d.es_principal) ?? lista[0];
        setSeleccion(prev => prev === 'nueva' || lista.some(d => d.id === prev) ? prev : principal?.id ?? 'nueva');
      } catch (e) {
        if (activo) {
          setSeleccion('nueva');
          toast.error('Ubicaciones no disponibles', e instanceof Error ? e.message : 'Intenta de nuevo.');
        }
      } finally {
        if (activo) setCargandoDirecciones(false);
      }
    }

    cargarDirecciones();
    return () => {
      activo = false;
    };
  }, [auth?.token, toast]));

  const ubicacionSeleccionada = useMemo(
    () => direcciones.find(d => d.id === seleccion) ?? null,
    [direcciones, seleccion],
  );

  const telefonoContacto = usarOtroTelefono ? telefono.trim() : telefonoGuardado ?? '';

  async function confirmar() {
    if (enviando || envio.pendiente || envio.cargando) return;
    setErrores({});
    if (!cart.items.length || (cart.venceEn != null && cart.venceEn <= Date.now())) {
      toast.info('El carrito venció', 'Los productos permanecen una hora. Agrega de nuevo los que quieras pedir.');
      navigation.navigate('Carrito');
      return;
    }
    if (cart.cambiosPrecio?.length) return;
    // Sin la tarifa el total estaría incompleto: no se confirma a ciegas.
    if (domicilio == null) {
      toast.error('Falta el costo del domicilio', 'No pudimos consultarlo. Revisa tu conexión e inténtalo de nuevo.');
      cargarTarifa();
      return;
    }
    if (!telefonoValido(telefonoContacto)) {
      setErrores({ telefono: errorTelefono });
      return;
    }

    let direccionEntrega = ubicacionSeleccionada?.direccion ?? '';

    if (seleccion === 'nueva') {
      const nuevosErrores: FieldErrors = {};
      if (!direccionValida(nuevaDireccion)) nuevosErrores.nuevaDireccion = errorDireccion;
      if (!campoDireccionValido(nuevoBarrio)) nuevosErrores.nuevoBarrio = 'El campo barrio es obligatorio.';
      if (!nuevoPunto) nuevosErrores.ubicacion = 'Marca tu casa en el mapa.';
      if (!fotosCompletas(fotos)) nuevosErrores.ubicacion = 'Añade las tres fotos de referencia.';
      if (Object.keys(nuevosErrores).length > 0) {
        setErrores(nuevosErrores);
        return;
      }
      direccionEntrega = normalizarDireccion(nuevaDireccion);
    }

    if (seleccion !== 'nueva' && ubicacionSeleccionada && (!direccionValida(ubicacionSeleccionada.direccion) || !campoDireccionValido(ubicacionSeleccionada.barrio) || ubicacionSeleccionada.lat == null || ubicacionSeleccionada.lng == null || !fotosCompletas(ubicacionSeleccionada.fotos))) {
      setEditandoDireccion(ubicacionSeleccionada);
      setErrores({ ubicacion: FOTOS_OBLIGATORIAS ? 'Completa la dirección, el mapa y las tres fotos antes de pedir.' : 'Completa la dirección y el mapa antes de pedir.' });
      return;
    }
    if (!direccionEntrega) {
      setErrores({ ubicacion: 'Selecciona o agrega una ubicacion de entrega.' });
      return;
    }

    // Se pregunta en este momento: la pantalla pudo llevar un rato abierta. Sin
    // red no se detiene el pedido: el servidor decide al crearlo.
    setEnviando(true);
    const negocio = await getCatalogo(auth!.token, cart.negocioId!)
      .then(r => r.negocio)
      .catch(() => null);
    setEnviando(false);

    if (negocio?.minutos_para_cerrar != null) {
      pedirConfirmacion({
        icono: 'reloj',
        titulo: 'La tienda cierra pronto',
        texto: `${negocio.nombre} cierra en ${negocio.minutos_para_cerrar} min. Es posible que tu pedido se cancele automáticamente porque la tienda cerrará pronto.`,
        textoBoton: 'Pedir de todos modos',
        textoCancelar: 'Volver',
        accion: () => enviarPedido(direccionEntrega),
      });
      return;
    }

    await enviarPedido(direccionEntrega);
  }

  async function enviarPedido(direccionEntrega: string) {
    setEnviando(true);
    try {
      // De la dirección elegida sale el punto en el mapa que se copia al pedido.
      let direccionId = typeof seleccion === 'number' ? seleccion : null;
      if (seleccion === 'nueva') {
        const guardada = await crearClienteDireccion(auth!.token, {
          nombre: nuevoNombre.trim() || null,
          direccion: normalizarDireccion(nuevaDireccion),
          barrio: nuevoBarrio.trim(),
          fotos,
          lat: nuevoPunto?.lat ?? null,
          lng: nuevoPunto?.lng ?? null,
        });
        setDirecciones(prev => [guardada, ...prev]);
        setSeleccion(guardada.id);
        direccionId = guardada.id;
      }

      // Se capturan antes de vaciar el carrito: se usan para rearmar la navegación.
      const negocioId = cart.negocioId!;
      const negocioNombre = cart.negocioNombre ?? '';

      await envio.enviar({
        negocio_id: negocioId,
        items: cart.items.map(i => ({ producto_id: i.producto_id, cantidad: i.cantidad, precio_token: i.precio_token, ...i.opciones })),
        metodo_pago: pago,
        direccion_entrega: direccionEntrega,
        direccion_id: direccionId,
        telefono_contacto: telefonoContacto,
        clave_intento: claveIntento.current,
        total_esperado: totalConDomicilio,
      }, negocioNombre);

      // El backend guarda este teléfono en el perfil cuando no había uno;
      // se refleja en la sesión local para que aparezca en el próximo pedido.
      if (!telefonoGuardado) {
        actualizarUsuario({ ...auth!.user, telefono: telefonoContacto });
      }

    } catch (e) {
      const campos = fieldErrorsFromError(e, {
        direccion: 'nuevaDireccion',
        barrio: 'nuevoBarrio',
        direccion_entrega: 'ubicacion',
        telefono_contacto: 'telefono',
        metodo_pago: 'pago',
      });
      if (Object.keys(campos).length > 0) {
        setErrores(campos);
      } else {
        toast.error('No se pudo confirmar', messageFromError(e, 'Error'));
      }
    } finally {
      setEnviando(false);
    }
  }

  if (envio.cargando || envio.pendiente) {
    return <View style={[styles.container, { padding: 24, justifyContent: 'center' }]}>
      {envio.errorCarga ? <>
        <Text style={styles.resumenTitulo}>No se pudieron consultar tus envíos guardados</Text>
        <Text style={styles.lineaTxt}>Necesitamos recuperar el estado del envío anterior antes de confirmar otro pedido.</Text>
        <TouchableOpacity onPress={envio.recargar}><Text style={styles.reintentar}>Reintentar</Text></TouchableOpacity>
      </> :
      envio.pendiente?.error ? <>
        <Text style={styles.resumenTitulo}>El pedido no fue aceptado</Text>
        <Text style={styles.lineaTxt}>{envio.pendiente.error}</Text>
        <TouchableOpacity style={styles.btn} onPress={async () => {
          await envio.revisar();
          claveIntento.current = nuevaClaveIntento();
          cargarTarifa();
          if (!cart.items.length) navigation.navigate('Carrito');
        }}><Text style={styles.btnTxt}>Revisar pedido</Text></TouchableOpacity>
      </> : <>
        <ActivityIndicator color={c.accent} size="large" />
        <Text style={styles.resumenTitulo}>{envio.cargando ? 'Comprobando envíos guardados' : 'Enviando tu pedido'}</Text>
        <Text style={styles.lineaTxt}>Si se fue el internet, lo enviaremos al recuperar la conexión. Este intento queda guardado aunque cierres la app. Te avisaremos cuando el comercio lo reciba.</Text>
      </>}
    </View>;
  }

  return (
    <>
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
      <FadeInView style={styles.resumen}>
        <View style={[styles.resumenTitulo, styles.fila]}>
          <Icon name="tienda" size={15} color={c.text} />
          <Text style={styles.resumenTitulo}>{cart.negocioNombre}</Text>
        </View>
        {cart.items.map(i => {
          const detalle = detalleOpciones(i.opciones);
          return (
            <View key={i.linea} style={styles.linea}>
              <View style={styles.lineaProducto}>
                <Text style={styles.lineaTxt}>{textoCantidad(i)} {i.nombre}</Text>
                {!!detalle && <Text style={styles.lineaDetalle}>{detalle}</Text>}
              </View>
              <Text style={styles.lineaTxt}>{cop(i.precio * i.cantidad)}</Text>
            </View>
          );
        })}
        <View style={styles.subtotalRow}>
          <Text style={styles.lineaTxt}>Productos</Text>
          <Text style={styles.lineaTxt}>{cop(cart.total)}</Text>
        </View>
        <View style={styles.linea}>
          <Text style={styles.lineaTxt}>Domicilio</Text>
          <Text style={styles.lineaTxt}>{domicilio == null ? (tarifaFallo ? 'Sin consultar' : '…') : cop(domicilio)}</Text>
        </View>
        {tarifaFallo && (
          <TouchableOpacity onPress={cargarTarifa} accessibilityRole="button">
            <Text style={styles.reintentar}>No pudimos consultar el domicilio. Toca para reintentar.</Text>
          </TouchableOpacity>
        )}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total a pagar</Text>
          <Text style={styles.totalValor}>{domicilio == null ? 'Pendiente de tarifa' : cop(totalConDomicilio)}</Text>
        </View>
      </FadeInView>

      <Text style={styles.label}>Ubicacion de entrega</Text>
      {cargandoDirecciones ? (
        <View style={styles.cargandoUbicaciones}>
          <ActivityIndicator color={c.accent} />
        </View>
      ) : (
        <View style={styles.ubicaciones}>
          {direcciones.map(d => {
            const activa = seleccion === d.id;
            return (
              <View key={d.id}>
              <TouchableOpacity
                style={[styles.ubicacion, activa && styles.ubicacionOn]}
                onPress={() => {
                  setSeleccion(d.id);
                  limpiarError('ubicacion');
                }}>
                <View style={styles.ubicacionIcono}>
                  <Icon name={activa ? 'check' : 'ubicacion'} size={18} color={activa ? c.onAccent : c.muted} />
                </View>
                <View style={styles.ubicacionTexto}>
                  <Text style={[styles.ubicacionTitulo, activa && styles.ubicacionTituloOn]}>
                    {d.nombre || (d.es_principal ? 'Direccion principal' : 'Otra ubicacion')}
                  </Text>
                  <Text style={[styles.ubicacionDetalle, activa && styles.ubicacionDetalleOn]}>
                    {textoUbicacion(d)}
                  </Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setEditandoDireccion(d)} accessibilityLabel={`Editar ${d.nombre || d.direccion}`}><Text style={styles.editarDireccion}>Editar dirección</Text></TouchableOpacity>
              </View>
            );
          })}

          <TouchableOpacity
            style={[styles.ubicacion, seleccion === 'nueva' && styles.ubicacionOn]}
            onPress={() => {
              setSeleccion('nueva');
              limpiarError('ubicacion');
            }}>
            <View style={styles.ubicacionIcono}>
              <Icon name={seleccion === 'nueva' ? 'check' : 'ubicacion'} size={18} color={seleccion === 'nueva' ? c.onAccent : c.muted} />
            </View>
            <View style={styles.ubicacionTexto}>
              <Text style={[styles.ubicacionTitulo, seleccion === 'nueva' && styles.ubicacionTituloOn]}>
                Agregar otra ubicacion
              </Text>
              <Text style={[styles.ubicacionDetalle, seleccion === 'nueva' && styles.ubicacionDetalleOn]}>
                Guardala para usarla en otros pedidos.
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      )}
      <FieldError mensaje={errores.ubicacion} />

      {seleccion === 'nueva' ? (
        <View style={styles.nuevaBox}>
          <TextInput style={styles.input} value={nuevoNombre} onChangeText={v => setNuevoNombre(limpiarTextoDireccion(v))} maxLength={80} placeholder="Nombre opcional: Mi casa, Trabajo…" placeholderTextColor={c.mutedSoft} />
          <Text style={styles.lineaDetalle}>Solo tú verás este nombre.</Text>
          <CamposDireccion value={nuevaDireccion} onChangeText={setNuevaDireccion} />
          <FieldError mensaje={errores.nuevaDireccion} />
          <BarrioSelect
            valor={nuevoBarrio}
            onSeleccionar={nombre => {
              setNuevoBarrio(nombre);
              limpiarError('nuevoBarrio');
            }}
            placeholder="Barrio"
          />
          <FieldError mensaje={errores.nuevoBarrio} />
          <View style={styles.nuevoMapa}>
            <SelectorUbicacion tipo="entrega" valor={nuevoPunto} onCambiar={setNuevoPunto} disabled={enviando} />
            <FotosDireccion fotos={fotos} onChange={setFotos} token={auth!.token} disabled={enviando} />
            <FieldError mensaje={errores.foto_frente ?? errores.foto_izquierda ?? errores.foto_derecha} />
          </View>
        </View>
      ) : null}

      <Text style={styles.label}>Telefono de contacto</Text>
      <View style={styles.ubicaciones}>
        {telefonoGuardado ? (
          <TouchableOpacity
            style={[styles.ubicacion, !usarOtroTelefono && styles.ubicacionOn]}
            onPress={() => {
              setUsarOtroTelefono(false);
              limpiarError('telefono');
            }}>
            <View style={styles.ubicacionIcono}>
              <Icon name={!usarOtroTelefono ? 'check' : 'telefono'} size={18} color={!usarOtroTelefono ? c.onAccent : c.muted} />
            </View>
            <View style={styles.ubicacionTexto}>
              <Text style={[styles.ubicacionTitulo, !usarOtroTelefono && styles.ubicacionTituloOn]}>
                Mi telefono
              </Text>
              <Text style={[styles.ubicacionDetalle, !usarOtroTelefono && styles.ubicacionDetalleOn]}>
                {telefonoGuardado}
              </Text>
            </View>
          </TouchableOpacity>
        ) : null}

        {telefonoGuardado ? (
          <TouchableOpacity
            style={[styles.ubicacion, usarOtroTelefono && styles.ubicacionOn]}
            onPress={() => {
              setUsarOtroTelefono(true);
              limpiarError('telefono');
            }}>
            <View style={styles.ubicacionIcono}>
              <Icon name={usarOtroTelefono ? 'check' : 'telefono'} size={18} color={usarOtroTelefono ? c.onAccent : c.muted} />
            </View>
            <View style={styles.ubicacionTexto}>
              <Text style={[styles.ubicacionTitulo, usarOtroTelefono && styles.ubicacionTituloOn]}>
                Usar otro numero
              </Text>
              <Text style={[styles.ubicacionDetalle, usarOtroTelefono && styles.ubicacionDetalleOn]}>
                Solo para este pedido.
              </Text>
            </View>
          </TouchableOpacity>
        ) : null}
      </View>

      {usarOtroTelefono ? (
        <TextInput style={styles.input} value={telefono} onChangeText={valor => {
          setTelefono(valor.replace(/[^0-9]/g, '').slice(0, 10));
          limpiarError('telefono');
        }} placeholder="3001234567" placeholderTextColor={c.mutedSoft} keyboardType="number-pad" maxLength={10} />
      ) : null}
      <FieldError mensaje={errores.telefono} />

      <Text style={styles.label}>Forma de pago</Text>
      <View style={styles.pagos}>
        {[
          { v: 'efectivo', t: 'Efectivo', icon: 'efectivo' as const },
          { v: 'transferencia', t: 'Transferencia', icon: 'banco' as const },
        ].map(op => (
          <TouchableOpacity
            key={op.v}
            style={[styles.pago, pago === op.v && styles.pagoOn]}
            onPress={() => {
              setPago(op.v);
              limpiarError('pago');
            }}>
            <Icon name={op.icon} size={20} color={pago === op.v ? c.onAccent : c.muted} />
            <Text style={[styles.pagoTxt, pago === op.v && styles.pagoTxtOn]}>{op.t}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <FieldError mensaje={errores.pago} />

      <PressableScale style={styles.btn} onPress={confirmar} disabled={enviando || cargandoDirecciones || domicilio == null || cart.items.length === 0 || !!cart.cambiosPrecio?.length}>
        {enviando ? (
          <ActivityIndicator color={c.onAccent} />
        ) : (
          <Text style={styles.btnTxt}>
            {domicilio == null ? 'Confirmar pedido' : `Confirmar pedido - ${cop(totalConDomicilio)}`}
          </Text>
        )}
      </PressableScale>
    </ScrollView>
    {editandoDireccion && <EditarDireccion key={editandoDireccion.id} direccion={editandoDireccion} onCerrar={() => setEditandoDireccion(null)} onGuardada={d => {
      setDirecciones(prev => prev.map(v => v.id === d.id ? d : v));
      setEditandoDireccion(null);
    }} />}
    </>
  );
}

const useStyles = makeStyles((c, shadow) => ({
  container: { flex: 1, backgroundColor: c.bg },
  resumen: { backgroundColor: c.surface, borderRadius: radius.md, padding: 16, marginBottom: 16, ...shadow.soft },
  resumenTitulo: { fontFamily: font.bold, color: c.text, marginBottom: 8 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  linea: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, gap: 12 },
  lineaTxt: { color: c.text, fontFamily: font.regular, flexShrink: 1 },
  lineaProducto: { flex: 1, marginRight: 12 },
  reintentar: { color: c.danger, fontFamily: font.regular, fontSize: 13, paddingVertical: 6 },
  lineaDetalle: { color: c.muted, fontSize: 12, lineHeight: 17, marginTop: 1, fontFamily: font.regular },
  subtotalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, paddingBottom: 3, borderTopWidth: 1, borderTopColor: c.border },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: c.border },
  totalLabel: { fontFamily: font.bold, color: c.textStrong },
  totalValor: { fontFamily: font.extra, color: c.textStrong },
  label: { fontSize: 13, fontFamily: font.semibold, color: c.text, marginBottom: 6, marginTop: 6 },
  input: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.borderStrong, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12, color: c.textStrong, fontFamily: font.regular },
  cargandoUbicaciones: { backgroundColor: c.surface, borderRadius: radius.md, padding: 18, marginBottom: 12, alignItems: 'center' },
  ubicaciones: { gap: 10, marginBottom: 12 },
  ubicacion: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: c.borderStrong, borderRadius: radius.md, padding: 12, backgroundColor: c.surface },
  ubicacionOn: { borderColor: c.accent, backgroundColor: c.accentSoft },
  ubicacionIcono: { width: 24, alignItems: 'center' },
  ubicacionTexto: { flex: 1 },
  ubicacionTitulo: { color: c.textStrong, fontFamily: font.bold, fontSize: 14 },
  ubicacionTituloOn: { color: c.onAccent },
  ubicacionDetalle: { color: c.muted, fontFamily: font.regular, fontSize: 12, marginTop: 2 },
  ubicacionDetalleOn: { color: c.onAccent },
  editarDireccion: { color: c.accent, fontFamily: font.semibold, paddingVertical: 10, paddingHorizontal: 12 },
  nuevaBox: { marginBottom: 2 },
  nuevoMapa: { marginTop: 10 },
  pagos: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  pago: { flex: 1, borderWidth: 1, borderColor: c.borderStrong, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', gap: 4, backgroundColor: c.surface },
  pagoOn: { borderColor: c.accent, backgroundColor: c.accentSoft },
  pagoTxt: { color: c.muted, fontFamily: font.semibold },
  pagoTxtOn: { color: c.onAccent },
  btn: { backgroundColor: c.accent, borderRadius: radius.md, paddingVertical: 16, alignItems: 'center', ...shadow.gold },
  btnTxt: { color: c.onAccent, fontFamily: font.bold, fontSize: 16 },
}));
