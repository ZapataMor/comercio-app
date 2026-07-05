import { CommonActions } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  ClienteDireccion,
  crearClienteDireccion,
  crearPedido,
  getClienteDirecciones,
} from '../api';
import { useAuth } from '../AuthContext';
import { useCart } from '../CartContext';
import { FadeInView, PressableScale } from '../components/anim';
import BarrioSelect from '../components/BarrioSelect';
import FieldError from '../components/FieldError';
import Icon from '../components/Icon';
import { FieldErrors, fieldErrorsFromError, messageFromError } from '../formErrors';
import { RootStackParamList } from '../navTypes';
import { c, font, radius, shadow } from '../theme';
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
  const { auth, actualizarUsuario } = useAuth();
  const cart = useCart();
  const toast = useToast();
  const [direcciones, setDirecciones] = useState<ClienteDireccion[]>([]);
  const [seleccion, setSeleccion] = useState<SeleccionUbicacion>(null);
  const [cargandoDirecciones, setCargandoDirecciones] = useState(true);
  const [nuevaDireccion, setNuevaDireccion] = useState('');
  const [nuevoBarrio, setNuevoBarrio] = useState('');
  // Telefono guardado en el perfil del cliente (se pidio al registrarse).
  const telefonoGuardado = auth?.user.telefono?.trim() || null;
  const [usarOtroTelefono, setUsarOtroTelefono] = useState(!telefonoGuardado);
  const [telefono, setTelefono] = useState('');
  const [pago, setPago] = useState('efectivo');
  const [enviando, setEnviando] = useState(false);
  const [errores, setErrores] = useState<FieldErrors>({});

  function limpiarError(campo: string) {
    setErrores(prev => {
      const next = { ...prev };
      delete next[campo];
      return next;
    });
  }

  useEffect(() => {
    let activo = true;

    async function cargarDirecciones() {
      if (!auth?.token) return;
      try {
        const lista = await getClienteDirecciones(auth.token);
        if (!activo) return;
        setDirecciones(lista);
        const principal = lista.find(d => d.es_principal) ?? lista[0];
        setSeleccion(principal?.id ?? 'nueva');
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
  }, [auth?.token, toast]);

  const ubicacionSeleccionada = useMemo(
    () => direcciones.find(d => d.id === seleccion) ?? null,
    [direcciones, seleccion],
  );

  const telefonoContacto = usarOtroTelefono ? telefono.trim() : telefonoGuardado ?? '';

  async function confirmar() {
    setErrores({});
    if (!telefonoContacto) {
      setErrores({ telefono: 'El campo telefono de contacto es obligatorio.' });
      return;
    }

    let direccionEntrega = ubicacionSeleccionada ? textoUbicacion(ubicacionSeleccionada) : '';

    if (seleccion === 'nueva') {
      const nuevosErrores: FieldErrors = {};
      if (!nuevaDireccion.trim()) nuevosErrores.nuevaDireccion = 'El campo direccion es obligatorio.';
      if (!nuevoBarrio.trim()) nuevosErrores.nuevoBarrio = 'El campo barrio es obligatorio.';
      if (Object.keys(nuevosErrores).length > 0) {
        setErrores(nuevosErrores);
        return;
      }
      direccionEntrega = textoUbicacion({
        direccion: nuevaDireccion.trim(),
        barrio: nuevoBarrio.trim(),
      });
    }

    if (!direccionEntrega) {
      setErrores({ ubicacion: 'Selecciona o agrega una ubicacion de entrega.' });
      return;
    }

    setEnviando(true);
    try {
      if (seleccion === 'nueva') {
        const guardada = await crearClienteDireccion(auth!.token, {
          direccion: nuevaDireccion.trim(),
          barrio: nuevoBarrio.trim(),
        });
        setDirecciones(prev => [guardada, ...prev]);
        setSeleccion(guardada.id);
      }

      // Se capturan antes de vaciar el carrito: se usan para rearmar la navegación.
      const negocioId = cart.negocioId!;
      const negocioNombre = cart.negocioNombre ?? '';

      await crearPedido(auth!.token, {
        negocio_id: negocioId,
        items: cart.items.map(i => ({ producto_id: i.producto_id, cantidad: i.cantidad })),
        metodo_pago: pago,
        direccion_entrega: direccionEntrega,
        telefono_contacto: telefonoContacto,
      });

      // El backend guarda este teléfono en el perfil cuando no había uno;
      // se refleja en la sesión local para que aparezca en el próximo pedido.
      if (!telefonoGuardado) {
        actualizarUsuario({ ...auth!.user, telefono: telefonoContacto });
      }

      cart.vaciar();
      toast.exito('Pedido confirmado', 'El negocio ya recibio tu pedido.');
      // Se rearma la pila para que "atrás" desde Mis pedidos lleve al catálogo
      // del negocio donde pidió, y no de vuelta al formulario de confirmación.
      navigation.dispatch(
        CommonActions.reset({
          index: 2,
          routes: [
            { name: 'Home' },
            { name: 'Negocio', params: { id: negocioId, nombre: negocioNombre } },
            { name: 'MisPedidos' },
          ],
        }),
      );
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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 16, paddingBottom: 110 }}>
      <FadeInView style={styles.resumen}>
        <View style={[styles.resumenTitulo, styles.fila]}>
          <Icon name="tienda" size={15} color={c.text} />
          <Text style={styles.resumenTitulo}>{cart.negocioNombre}</Text>
        </View>
        {cart.items.map(i => (
          <View key={i.producto_id} style={styles.linea}>
            <Text style={styles.lineaTxt}>{i.cantidad}x {i.nombre}</Text>
            <Text style={styles.lineaTxt}>{cop(i.precio * i.cantidad)}</Text>
          </View>
        ))}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValor}>{cop(cart.total)}</Text>
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
              <TouchableOpacity
                key={d.id}
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
                    {d.es_principal ? 'Direccion principal' : 'Otra ubicacion'}
                  </Text>
                  <Text style={[styles.ubicacionDetalle, activa && styles.ubicacionDetalleOn]}>
                    {textoUbicacion(d)}
                  </Text>
                </View>
              </TouchableOpacity>
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
          <TextInput
            style={styles.input}
            value={nuevaDireccion}
            onChangeText={valor => {
              setNuevaDireccion(valor);
              limpiarError('nuevaDireccion');
            }}
            placeholder="Calle, numero, referencia"
            placeholderTextColor={c.mutedSoft}
          />
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
          setTelefono(valor);
          limpiarError('telefono');
        }} placeholder="300 123 4567" placeholderTextColor={c.mutedSoft} keyboardType="phone-pad" />
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

      <PressableScale style={styles.btn} onPress={confirmar} disabled={enviando || cargandoDirecciones}>
        {enviando ? (
          <ActivityIndicator color={c.onAccent} />
        ) : (
          <Text style={styles.btnTxt}>Confirmar pedido - {cop(cart.total)}</Text>
        )}
      </PressableScale>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  resumen: { backgroundColor: c.surface, borderRadius: radius.md, padding: 16, marginBottom: 16, ...shadow.soft },
  resumenTitulo: { fontFamily: font.bold, color: c.text, marginBottom: 8 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  linea: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, gap: 12 },
  lineaTxt: { color: c.text, fontFamily: font.regular, flexShrink: 1 },
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
  nuevaBox: { marginBottom: 2 },
  pagos: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  pago: { flex: 1, borderWidth: 1, borderColor: c.borderStrong, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', gap: 4, backgroundColor: c.surface },
  pagoOn: { borderColor: c.accent, backgroundColor: c.accentSoft },
  pagoTxt: { color: c.muted, fontFamily: font.semibold },
  pagoTxtOn: { color: c.onAccent },
  btn: { backgroundColor: c.accent, borderRadius: radius.md, paddingVertical: 16, alignItems: 'center', ...shadow.gold },
  btnTxt: { color: c.onAccent, fontFamily: font.bold, fontSize: 16 },
});
