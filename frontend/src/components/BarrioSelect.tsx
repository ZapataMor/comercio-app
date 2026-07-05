import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Barrio, getBarrios } from '../api';
import Icon from './Icon';
import { c, font, radius, shadow } from '../theme';

/** Quita tildes y baja a minúsculas para comparar/buscar sin acentos. */
function normalizar(texto: string): string {
  // NFD separa las tildes en caracteres combinantes (U+0300–U+036F) y aquí se eliminan.
  const RANGO_TILDES = new RegExp('[\\u0300-\\u036f]', 'g');
  return texto.toLowerCase().normalize('NFD').replace(RANGO_TILDES, '');
}

type Props = {
  /** Barrio elegido (o escrito a mano). Cadena vacía = sin elegir. */
  valor: string;
  onSeleccionar: (barrio: string) => void;
  disabled?: boolean;
  placeholder?: string;
};

/**
 * Selector de barrio de Maicao: abre un modal con la lista oficial de barrios
 * y una barra de búsqueda. Si el barrio no aparece, el usuario puede usar el
 * texto que escribió: se envía tal cual y queda como sugerencia para que el
 * administrador lo apruebe (mientras tanto solo lo ve ese usuario).
 */
export default function BarrioSelect({ valor, onSeleccionar, disabled, placeholder = 'Elige tu barrio' }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [barrios, setBarrios] = useState<Barrio[] | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    if (!abierto || barrios !== null) return;
    getBarrios()
      .then(setBarrios)
      .catch(e => setErrorCarga(e.message ?? 'No se pudo cargar la lista de barrios.'));
  }, [abierto, barrios]);

  const filtrados = useMemo(() => {
    if (!barrios) return [];
    const q = normalizar(busqueda.trim());
    if (!q) return barrios;
    return barrios.filter(b => normalizar(b.nombre).includes(q));
  }, [barrios, busqueda]);

  // Ofrecer "añadir" solo si escribió algo que no coincide exacto con la lista.
  const textoNuevo = busqueda.trim();
  const existeExacto = useMemo(
    () => !!barrios?.some(b => normalizar(b.nombre) === normalizar(textoNuevo)),
    [barrios, textoNuevo],
  );

  function elegir(nombre: string) {
    onSeleccionar(nombre);
    setAbierto(false);
    setBusqueda('');
  }

  return (
    <>
      <TouchableOpacity
        style={styles.campo}
        onPress={() => setAbierto(true)}
        disabled={disabled}
        activeOpacity={0.7}>
        <Text style={valor ? styles.campoTexto : styles.campoPlaceholder}>
          {valor || placeholder}
        </Text>
        <Icon name="chevron" size={18} color={c.chevron} />
      </TouchableOpacity>

      <Modal visible={abierto} animationType="slide" transparent onRequestClose={() => setAbierto(false)}>
        <View style={styles.fondo}>
          <View style={styles.hoja}>
            <View style={styles.encabezado}>
              <Text style={styles.titulo}>Tu barrio</Text>
              <TouchableOpacity onPress={() => setAbierto(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={styles.cerrar}>Cerrar</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.buscador}
              value={busqueda}
              onChangeText={setBusqueda}
              placeholder="Buscar barrio..."
              placeholderTextColor={c.mutedSoft}
              autoCorrect={false}
            />

            {errorCarga ? (
              <Text style={styles.error}>{errorCarga}</Text>
            ) : barrios === null ? (
              <ActivityIndicator color={c.accent} style={{ marginTop: 30 }} />
            ) : (
              <FlatList
                data={filtrados}
                keyExtractor={b => String(b.id)}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.fila} onPress={() => elegir(item.nombre)}>
                    <Text style={[styles.filaTexto, item.nombre === valor && styles.filaTextoOn]}>
                      {item.nombre}
                    </Text>
                    {item.nombre === valor ? <Icon name="check" size={18} color={c.accent} /> : null}
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <Text style={styles.vacio}>No encontramos ese barrio en la lista.</Text>
                }
                ListFooterComponent={
                  textoNuevo && !existeExacto ? (
                    <TouchableOpacity style={styles.agregar} onPress={() => elegir(textoNuevo)}>
                      <Text style={styles.agregarTexto}>Usar «{textoNuevo}»</Text>
                      <Text style={styles.agregarNota}>
                        Tu barrio no está en la lista. Puedes pedir con este nombre y quedará
                        pendiente de que el administrador lo añada.
                      </Text>
                    </TouchableOpacity>
                  ) : null
                }
              />
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  campo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: c.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 16,
    backgroundColor: c.surface,
  },
  campoTexto: { fontSize: 16, fontFamily: font.regular, color: c.textStrong, flex: 1 },
  campoPlaceholder: { fontSize: 16, fontFamily: font.regular, color: c.mutedSoft, flex: 1 },
  fondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  hoja: {
    backgroundColor: c.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: 20,
    maxHeight: '80%',
    minHeight: '55%',
    ...shadow.card,
  },
  encabezado: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  titulo: { fontSize: 18, fontFamily: font.display, color: c.textStrong },
  cerrar: { color: c.goldText, fontFamily: font.semibold, fontSize: 14 },
  buscador: {
    borderWidth: 1,
    borderColor: c.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: font.regular,
    color: c.textStrong,
    marginBottom: 10,
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  filaTexto: { fontSize: 15, fontFamily: font.regular, color: c.text },
  filaTextoOn: { fontFamily: font.bold, color: c.accent },
  vacio: { textAlign: 'center', color: c.muted, fontFamily: font.regular, marginTop: 18, fontSize: 14 },
  agregar: {
    marginTop: 14,
    backgroundColor: c.accentSoft,
    borderRadius: radius.md,
    padding: 14,
  },
  agregarTexto: { fontFamily: font.bold, fontSize: 15, color: c.onAccent },
  agregarNota: { fontFamily: font.regular, fontSize: 12, color: c.onAccent, marginTop: 4 },
  error: {
    backgroundColor: c.dangerSoft,
    color: c.danger,
    fontFamily: font.medium,
    padding: 10,
    borderRadius: radius.sm,
    marginTop: 10,
    fontSize: 13,
  },
});
