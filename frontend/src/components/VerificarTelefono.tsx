/**
 * Confirmar un celular con el código de 6 números que llega por WhatsApp.
 *
 * Paso 1: escribe su número → `pedir` envía el código.
 * Paso 2: escribe el código → `verificar` lo confirma (registro o Mi información).
 *
 * Mientras el backend no envía WhatsApp de verdad (WHATSAPP_DRIVER=log), en
 * local la respuesta trae `codigo_prueba` y aquí se muestra.
 */
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { CodigoEnviado } from '../api';
import { telefonoValido, errorTelefono } from '../direccion';
import { FieldErrors, fieldErrorsFromError, messageFromError } from '../formErrors';
import { font, makeStyles, radius, useTheme } from '../theme';
import FieldError from './FieldError';
import Icon from './Icon';

type Props = {
  telefonoInicial?: string;
  pedir: (telefono: string) => Promise<CodigoEnviado>;
  /** Lanza el error del backend si el código no sirve. */
  verificar: (telefono: string, codigo: string) => Promise<void>;
  /** Texto del botón del paso 1. */
  textoEnviar?: string;
};

/** 3001234567 → 300 123 4567 */
export function formatoCelular(telefono: string): string {
  return telefono.replace(/^(\d{3})(\d{3})(\d{4})$/, '$1 $2 $3');
}

export default function VerificarTelefono({ telefonoInicial = '', pedir, verificar, textoEnviar = 'Enviar código por WhatsApp' }: Props) {
  const { c } = useTheme();
  const styles = useStyles();
  const [paso, setPaso] = useState<'numero' | 'codigo'>('numero');
  const [telefono, setTelefono] = useState(telefonoInicial);
  const [codigo, setCodigo] = useState('');
  const [codigoPrueba, setCodigoPrueba] = useState<string | null>(null);
  const [espera, setEspera] = useState(0);
  const [errores, setErrores] = useState<FieldErrors>({});
  const [cargando, setCargando] = useState(false);
  const reloj = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cuenta regresiva para poder pedir otro código.
  useEffect(() => {
    if (espera <= 0) return;
    reloj.current = setInterval(() => setEspera(s => (s <= 1 ? 0 : s - 1)), 1000);
    return () => {
      if (reloj.current) clearInterval(reloj.current);
    };
  }, [espera > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  async function enviar() {
    if (!telefonoValido(telefono)) {
      setErrores({ telefono: errorTelefono });
      return;
    }
    setCargando(true);
    setErrores({});
    try {
      const r = await pedir(telefono);
      setCodigoPrueba(r.codigo_prueba ?? null);
      setEspera(r.espera ?? 60);
      setCodigo('');
      setPaso('codigo');
    } catch (e) {
      const mensaje = fieldErrorsFromError(e).telefono ?? messageFromError(e);
      // Si falló al reenviar, el mensaje se ve en el paso del código.
      setErrores(paso === 'codigo' ? { codigo: mensaje } : { telefono: mensaje });
    } finally {
      setCargando(false);
    }
  }

  async function confirmar() {
    if (!/^\d{6}$/.test(codigo)) {
      setErrores({ codigo: 'El código tiene 6 números.' });
      return;
    }
    setCargando(true);
    setErrores({});
    try {
      await verificar(telefono, codigo);
    } catch (e) {
      const campos = fieldErrorsFromError(e);
      setErrores({ codigo: campos.codigo ?? campos.telefono ?? messageFromError(e) });
    } finally {
      setCargando(false);
    }
  }

  if (paso === 'numero') {
    return (
      <View>
        <Text style={styles.label}>Celular</Text>
        <View style={styles.fila}>
          <Text style={styles.prefijo}>+57</Text>
          <TextInput
            style={[styles.input, styles.inputTelefono]}
            value={telefono}
            onChangeText={v => {
              setTelefono(v.replace(/\D/g, '').slice(0, 10));
              setErrores({});
            }}
            keyboardType="number-pad"
            maxLength={10}
            placeholder="3001234567"
            placeholderTextColor={c.mutedSoft}
            textContentType="telephoneNumber"
            autoComplete="tel"
            editable={!cargando}
            accessibilityLabel="Número de celular"
          />
        </View>
        <FieldError mensaje={errores.telefono} />
        <Text style={styles.ayuda}>Te enviaremos un código de 6 números por WhatsApp.</Text>
        <TouchableOpacity style={[styles.boton, cargando && styles.botonDisabled]} onPress={enviar} disabled={cargando}>
          {cargando ? <ActivityIndicator color={c.onBrand} /> : <Text style={styles.botonTxt}>{textoEnviar}</Text>}
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View>
      <Text style={styles.texto}>
        Escribe el código que te enviamos por WhatsApp al <Text style={styles.fuerte}>{formatoCelular(telefono)}</Text>.
      </Text>
      {codigoPrueba ? (
        <View style={styles.prueba}>
          <Icon name="alerta" size={16} color={c.goldText} />
          <Text style={styles.pruebaTxt}>
            Modo prueba (WhatsApp sin configurar): tu código es <Text style={styles.fuerte}>{codigoPrueba}</Text>
          </Text>
        </View>
      ) : null}
      <TextInput
        style={[styles.input, styles.inputCodigo]}
        value={codigo}
        onChangeText={v => {
          setCodigo(v.replace(/\D/g, '').slice(0, 6));
          setErrores({});
        }}
        keyboardType="number-pad"
        maxLength={6}
        placeholder="000000"
        placeholderTextColor={c.mutedSoft}
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        editable={!cargando}
        autoFocus
        accessibilityLabel="Código de 6 números"
      />
      <FieldError mensaje={errores.codigo} />
      <TouchableOpacity style={[styles.boton, cargando && styles.botonDisabled]} onPress={confirmar} disabled={cargando}>
        {cargando ? <ActivityIndicator color={c.onBrand} /> : <Text style={styles.botonTxt}>Confirmar</Text>}
      </TouchableOpacity>
      <View style={styles.enlaces}>
        <TouchableOpacity onPress={enviar} disabled={cargando || espera > 0}>
          <Text style={[styles.enlace, espera > 0 && styles.enlaceApagado]}>
            {espera > 0 ? `Reenviar en ${espera} s` : 'Reenviar código'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            setPaso('numero');
            setErrores({});
          }}
          disabled={cargando}>
          <Text style={styles.enlace}>Cambiar número</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c, shadow) => ({
  label: { fontSize: 13, fontFamily: font.semibold, color: c.text, marginBottom: 6 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  prefijo: {
    fontSize: 16, fontFamily: font.semibold, color: c.text, paddingHorizontal: 12, paddingVertical: 12,
    borderWidth: 1, borderColor: c.borderStrong, borderRadius: radius.md, backgroundColor: c.bg,
  },
  input: {
    borderWidth: 1, borderColor: c.borderStrong, borderRadius: radius.md, paddingHorizontal: 14,
    paddingVertical: 12, fontSize: 16, fontFamily: font.regular, color: c.textStrong,
  },
  inputTelefono: { flex: 1 },
  inputCodigo: { fontSize: 24, letterSpacing: 8, textAlign: 'center', fontFamily: font.bold, marginTop: 4 },
  ayuda: { fontSize: 12, color: c.muted, fontFamily: font.regular, marginTop: 8 },
  texto: { fontSize: 14, fontFamily: font.regular, color: c.text, lineHeight: 20, marginBottom: 12 },
  fuerte: { fontFamily: font.bold, color: c.textStrong },
  prueba: {
    flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: c.accentSoft,
    borderRadius: radius.sm, padding: 10, marginBottom: 12,
  },
  pruebaTxt: { flex: 1, fontSize: 12.5, fontFamily: font.regular, color: c.text },
  boton: {
    backgroundColor: c.brand, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center',
    marginTop: 14, ...shadow.soft,
  },
  botonDisabled: { opacity: 0.7 },
  botonTxt: { color: c.onBrand, fontFamily: font.bold, fontSize: 15 },
  enlaces: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  enlace: { color: c.goldText, fontFamily: font.semibold, fontSize: 13 },
  enlaceApagado: { color: c.mutedSoft },
}));
