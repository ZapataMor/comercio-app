/**
 * Cuentas donde el negocio activo recibe transferencias: Nequi, Daviplata,
 * Bancolombia, otro banco, una llave o solo un código QR. El cliente las ve
 * cuando el negocio acepta su pedido pagado por transferencia. Las edita el
 * propietario o un administrador; quien gestiona pedidos solo las ve.
 */
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Text, TextInput, TouchableOpacity, View } from 'react-native';
import {
  CuentaPago,
  CuentaPagoForm,
  eliminarCuentaPago,
  getCuentasPago,
  guardarCuentaPago,
  imagenUrl,
  TipoCuentaPago,
} from '../api';
import { useAuth } from '../AuthContext';
import { PressableScale } from '../components/anim';
import ChipsEleccion from '../components/ChipsEleccion';
import { useConfirmar } from '../components/Confirmacion';
import ErrorCarga from '../components/ErrorCarga';
import { ScrollTeclado } from '../components/EspacioTeclado';
import Icon from '../components/Icon';
import SelectorImagen from '../components/SelectorImagen';
import { messageFromError } from '../formErrors';
import { useNegocio } from '../NegocioContext';
import { font, makeStyles, radius, useTheme } from '../theme';
import { useToast } from '../Toast';
import { useLectura } from '../useLectura';

const TIPOS: { v: TipoCuentaPago; t: string }[] = [
  { v: 'nequi', t: 'Nequi' },
  { v: 'daviplata', t: 'Daviplata' },
  { v: 'bancolombia', t: 'Bancolombia' },
  { v: 'llave', t: 'Llave' },
  { v: 'banco', t: 'Otro banco' },
  { v: 'qr', t: 'Solo QR' },
];

const ETIQUETA_NUMERO: Record<TipoCuentaPago, string> = {
  nequi: 'Celular de Nequi',
  daviplata: 'Celular de Daviplata',
  bancolombia: 'Número de cuenta',
  banco: 'Número de cuenta',
  llave: 'Llave (celular, cédula, correo o @alias)',
  qr: 'Número o llave (opcional)',
};

const VACIO: CuentaPagoForm = { tipo: 'nequi', titular: '', numero: '', banco: '', tipo_cuenta: null };

export default function CuentasPagoScreen() {
  const { c } = useTheme();
  const styles = useStyles();
  const { auth } = useAuth();
  const token = auth!.token;
  const { negocio } = useNegocio();
  const toast = useToast();
  const confirmar = useConfirmar();
  const [cuentas, setCuentas] = useState<CuentaPago[]>([]);
  const [puedeEditar, setPuedeEditar] = useState(false);
  const [maximo, setMaximo] = useState(6);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // null: sin formulario; 0: cuenta nueva; otro: la que se edita.
  const [editando, setEditando] = useState<number | null>(null);
  const [form, setForm] = useState<CuentaPagoForm>(VACIO);
  const [qrActual, setQrActual] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    if (!negocio) return;
    try {
      const d = await getCuentasPago(token, negocio.id);
      setCuentas(d.cuentas);
      setPuedeEditar(d.puede_editar);
      setMaximo(d.maximo);
      setError(null);
    } catch (e) {
      setError(messageFromError(e));
    } finally {
      setCargando(false);
    }
  }, [negocio, token]);

  useLectura(() => { cargar(); }, [cargar]);

  function abrir(cuenta?: CuentaPago) {
    setEditando(cuenta?.id ?? 0);
    setQrActual(cuenta?.qr ?? null);
    setForm(cuenta
      ? { tipo: cuenta.tipo, titular: cuenta.titular, numero: cuenta.numero ?? '', banco: cuenta.banco ?? '', tipo_cuenta: cuenta.tipo_cuenta }
      : { ...VACIO, titular: negocio?.nombre ?? '' });
  }

  async function guardar() {
    if (!negocio || editando === null) return;
    setGuardando(true);
    try {
      await guardarCuentaPago(token, negocio.id, form, editando || undefined);
      toast.exito(editando ? 'Cuenta actualizada' : 'Cuenta guardada', 'Tus clientes la verán al pagar por transferencia.');
      setEditando(null);
      await cargar();
    } catch (e) {
      toast.error('No se pudo guardar', messageFromError(e));
    } finally {
      setGuardando(false);
    }
  }

  function eliminar(cuenta: CuentaPago) {
    if (!negocio) return;
    confirmar({
      icono: 'basura',
      titulo: `¿Eliminar ${cuenta.nombre}?`,
      texto: cuentas.length === 1
        ? 'Es tu única cuenta: tus clientes ya no podrán elegir pagar por transferencia.'
        : 'Los clientes dejarán de verla. Los pedidos ya pagados conservan sus datos.',
      textoBoton: 'Eliminar',
      peligro: true,
      accion: async () => {
        try {
          await eliminarCuentaPago(token, negocio.id, cuenta.id);
          toast.exito('Cuenta eliminada');
          await cargar();
        } catch (e) {
          toast.error('No se pudo eliminar', messageFromError(e));
        }
      },
    });
  }

  if (!negocio) return <ErrorCarga mensaje="Elige primero uno de tus negocios." />;
  if (cargando) return <ActivityIndicator size="large" color={c.accent} style={{ marginTop: 40 }} />;
  if (error) return <ErrorCarga mensaje={error} />;

  const conCuenta = form.tipo === 'bancolombia' || form.tipo === 'banco';
  const numerico = ['nequi', 'daviplata', 'bancolombia', 'banco'].includes(form.tipo);
  const tipoTexto = TIPOS.find(t => t.v === form.tipo)?.t;

  return (
    <ScrollTeclado style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <View style={styles.aviso}>
        <Icon name="banco" size={18} color={c.goldText} />
        <View style={{ flex: 1 }}>
          <Text style={styles.avisoTitulo}>Cómo funciona</Text>
          <Text style={styles.avisoTxt}>
            Cuando aceptes un pedido pagado por transferencia, el cliente verá estas cuentas, te pagará y te avisará en la app.
          </Text>
          <Text style={styles.avisoTxt}>
            <Text style={styles.negrita}>Es tu responsabilidad revisar en tu banco que el dinero llegó completo</Text> antes de confirmar el pago y preparar el pedido.
          </Text>
          <Text style={styles.avisoTxt}>Al recoger, entrégale al domiciliario el valor del domicilio: el cliente te lo pagó en la transferencia.</Text>
        </View>
      </View>

      {cuentas.length === 0 && editando === null && (
        <Text style={styles.vacio}>
          Aún no tienes cuentas: tus clientes solo pueden pagar en efectivo.{puedeEditar ? ' Agrega una para recibir transferencias.' : ''}
        </Text>
      )}

      {cuentas.map(cuenta => (
        <View key={cuenta.id} style={styles.card}>
          <View style={styles.fila}>
            <Icon name={cuenta.tipo === 'qr' ? 'imagen' : 'banco'} size={18} color={c.goldText} />
            <Text style={styles.cuentaNombre}>{cuenta.nombre}</Text>
          </View>
          <Text style={styles.linea}>A nombre de {cuenta.titular}</Text>
          {!!cuenta.numero && (
            <Text style={styles.numero}>
              {cuenta.numero}
              {cuenta.tipo_cuenta ? <Text style={styles.linea}>  · {cuenta.tipo_cuenta === 'ahorros' ? 'ahorros' : 'corriente'}</Text> : null}
            </Text>
          )}
          {!!cuenta.qr && <Image source={{ uri: imagenUrl(cuenta.qr) }} style={styles.qr} resizeMode="contain" />}
          {puedeEditar && (
            <View style={styles.acciones}>
              <TouchableOpacity onPress={() => abrir(cuenta)} style={styles.accion}><Text style={styles.accionTxt}>Editar</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => eliminar(cuenta)} style={styles.accion}><Text style={[styles.accionTxt, { color: c.danger }]}>Eliminar</Text></TouchableOpacity>
            </View>
          )}
        </View>
      ))}

      {puedeEditar && editando === null && cuentas.length < maximo && (
        <PressableScale style={styles.btn} onPress={() => abrir()}>
          <Text style={styles.btnTxt}>Agregar cuenta</Text>
        </PressableScale>
      )}
      {!puedeEditar && <Text style={styles.vacio}>Solo el propietario o un administrador del negocio puede cambiar estas cuentas.</Text>}

      {editando !== null && (
        <View style={[styles.card, styles.formCard]}>
          <Text style={styles.formTitulo}>{editando ? 'Editar cuenta' : 'Nueva cuenta'}</Text>
          <ChipsEleccion
            titulo="¿Dónde recibes?"
            opciones={TIPOS.map(t => t.t)}
            valor={tipoTexto}
            onChange={t => setForm(f => ({ ...f, tipo: TIPOS.find(x => x.t === t)!.v }))}
          />
          {form.tipo === 'banco' && (
            <>
              <Text style={styles.label}>Banco</Text>
              <TextInput style={styles.input} value={form.banco ?? ''} onChangeText={v => setForm(f => ({ ...f, banco: v }))}
                placeholder="Banco de Bogotá, Davivienda…" placeholderTextColor={c.mutedSoft} maxLength={60} />
            </>
          )}
          <Text style={styles.label}>{ETIQUETA_NUMERO[form.tipo]}</Text>
          <TextInput style={styles.input} value={form.numero ?? ''} onChangeText={v => setForm(f => ({ ...f, numero: v }))}
            keyboardType={numerico ? 'number-pad' : 'default'} autoCapitalize="none" autoCorrect={false}
            placeholder={numerico ? '3001234567' : '@mitienda'} placeholderTextColor={c.mutedSoft} maxLength={60} />
          {conCuenta && (
            <ChipsEleccion
              titulo="Tipo de cuenta"
              opciones={['Ahorros', 'Corriente']}
              valor={form.tipo_cuenta === 'ahorros' ? 'Ahorros' : form.tipo_cuenta === 'corriente' ? 'Corriente' : undefined}
              onChange={v => setForm(f => ({ ...f, tipo_cuenta: v === 'Ahorros' ? 'ahorros' : 'corriente' }))}
            />
          )}
          <Text style={styles.label}>A nombre de</Text>
          <TextInput style={styles.input} value={form.titular} onChangeText={v => setForm(f => ({ ...f, titular: v }))}
            placeholder="Como aparece en el banco" placeholderTextColor={c.mutedSoft} maxLength={100} />
          <Text style={styles.ayuda}>El cliente lo compara con el nombre que le muestra su banco antes de transferir.</Text>
          <View style={{ marginTop: 12 }}>
            <SelectorImagen
              uri={form.qrUri ?? (form.quitar_qr ? undefined : imagenUrl(qrActual))}
              onSelect={uri => setForm(f => ({ ...f, qrUri: uri, quitar_qr: false }))}
              label={form.tipo === 'qr' ? 'Imagen del código QR' : 'Código QR (opcional)'}
              disabled={guardando}
            />
          </View>
          {(!!form.qrUri || (!!qrActual && !form.quitar_qr)) && form.tipo !== 'qr' && (
            <TouchableOpacity onPress={() => setForm(f => ({ ...f, qrUri: undefined, quitar_qr: true }))}>
              <Text style={[styles.accionTxt, { color: c.danger }]}>Quitar código QR</Text>
            </TouchableOpacity>
          )}
          <PressableScale style={styles.btn} onPress={guardar} disabled={guardando}>
            {guardando ? <ActivityIndicator color={c.onBrand} /> : <Text style={styles.btnTxt}>Guardar cuenta</Text>}
          </PressableScale>
          <TouchableOpacity onPress={() => setEditando(null)} disabled={guardando} style={styles.cancelar}>
            <Text style={styles.cancelarTxt}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollTeclado>
  );
}

const useStyles = makeStyles((c, shadow) => ({
  container: { flex: 1, backgroundColor: c.bg },
  aviso: { flexDirection: 'row', gap: 10, backgroundColor: c.accentSoft, borderRadius: radius.md, padding: 14, marginBottom: 16 },
  avisoTitulo: { fontFamily: font.bold, color: c.textStrong, fontSize: 15 },
  avisoTxt: { color: c.text, fontFamily: font.regular, fontSize: 13, lineHeight: 19, marginTop: 6 },
  negrita: { fontFamily: font.bold },
  vacio: { color: c.muted, fontFamily: font.regular, fontSize: 14, lineHeight: 20, textAlign: 'center', marginVertical: 12 },
  card: { backgroundColor: c.surface, borderRadius: radius.md, padding: 16, marginBottom: 12, ...shadow.soft },
  formCard: { borderWidth: 1.5, borderColor: c.accent },
  formTitulo: { fontFamily: font.bold, color: c.textStrong, fontSize: 17, marginBottom: 10 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cuentaNombre: { flex: 1, fontFamily: font.bold, color: c.textStrong, fontSize: 16 },
  linea: { color: c.muted, fontFamily: font.regular, fontSize: 13, marginTop: 4 },
  numero: { color: c.textStrong, fontFamily: font.bold, fontSize: 17, marginTop: 6 },
  qr: { width: 120, height: 120, marginTop: 10, borderRadius: radius.sm, backgroundColor: c.surface2 },
  acciones: { flexDirection: 'row', gap: 18, marginTop: 12 },
  accion: { paddingVertical: 4 },
  accionTxt: { color: c.goldText, fontFamily: font.bold, fontSize: 14, marginTop: 4 },
  label: { fontSize: 13, fontFamily: font.semibold, color: c.text, marginBottom: 6, marginTop: 6 },
  input: {
    borderWidth: 1, borderColor: c.borderStrong, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 11,
    color: c.textStrong, fontFamily: font.regular, fontSize: 15, backgroundColor: c.surface, marginBottom: 8,
  },
  ayuda: { color: c.muted, fontFamily: font.regular, fontSize: 12, lineHeight: 17 },
  btn: { backgroundColor: c.brand, borderRadius: radius.md, paddingVertical: 15, alignItems: 'center', marginTop: 14, ...shadow.soft },
  btnTxt: { color: c.onBrand, fontFamily: font.bold, fontSize: 16 },
  cancelar: { alignItems: 'center', paddingVertical: 12 },
  cancelarTxt: { color: c.muted, fontFamily: font.semibold, fontSize: 14 },
}));
