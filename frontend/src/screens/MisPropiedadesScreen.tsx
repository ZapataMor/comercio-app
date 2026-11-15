import { useLecturaEnFoco } from '../useLectura';
/**
 * «Mis propiedades» (menú del ícono de usuario): las casas y patios que la
 * persona publicó. Desde aquí publica otra, la edita, la oculta cuando se
 * vende o se alquila (y la vuelve a mostrar) o la elimina.
 */
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Image, RefreshControl, Text, View } from 'react-native';
import { cambiarDisponibilidadPropiedad, eliminarPropiedad, getMisPropiedades, imagenUrl, Propiedad } from '../api';
import { useAuth } from '../AuthContext';
import { PressableScale } from '../components/anim';
import { useConfirmar } from '../components/Confirmacion';
import Icon from '../components/Icon';
import { messageFromError } from '../formErrors';
import { RootStackParamList } from '../navTypes';
import { datosClave, periodoPrecio, pesos, tipoPropiedad } from '../propiedades';
import { font, makeStyles, radius, useTheme } from '../theme';
import { useToast } from '../Toast';
import { useEnVivo } from '../usePolling';

type Props = NativeStackScreenProps<RootStackParamList, 'MisPropiedades'>;

/** Qué se le dice al ocultarla, según el tipo. */
const TEXTO_OCULTAR = { venta: 'Ya se vendió', alquiler: 'Ya se alquiló', eventos: 'Pausar' } as const;

export default function MisPropiedadesScreen({ navigation }: Props) {
  const { c } = useTheme();
  const styles = useStyles();
  const toast = useToast();
  const confirmar = useConfirmar();
  const { auth } = useAuth();
  const token = auth!.token;
  const [propiedades, setPropiedades] = useState<Propiedad[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocupada, setOcupada] = useState<number | null>(null);

  const cargar = useCallback(
    (refresco = false) => {
      if (refresco) setRefrescando(true);
      getMisPropiedades(token)
        .then(lista => {
          setPropiedades(lista);
          setError(null);
        })
        .catch(e => setError(messageFromError(e, 'No se pudieron cargar tus propiedades.')))
        .finally(() => {
          setCargando(false);
          setRefrescando(false);
        });
    },
    [token],
  );

  // Al volver de publicar o editar, la lista ya trae el cambio.
  useLecturaEnFoco(useCallback(() => cargar(), [cargar]));
  // Lo cambiado desde otro teléfono también.
  useEnVivo(['propiedades'], () => cargar());

  async function cambiarVisible(p: Propiedad) {
    setOcupada(p.id);
    try {
      const nueva = await cambiarDisponibilidadPropiedad(token, p.id, !p.disponible);
      setPropiedades(lista => lista.map(x => (x.id === nueva.id ? nueva : x)));
      toast.exito(nueva.disponible ? 'Publicada de nuevo' : 'Propiedad oculta', nueva.disponible ? 'Los clientes ya la ven.' : 'Los clientes ya no la ven. Puedes volver a publicarla cuando quieras.');
    } catch (e) {
      toast.error('No se pudo cambiar', messageFromError(e, 'Intenta de nuevo.'));
    } finally {
      setOcupada(null);
    }
  }

  function eliminar(p: Propiedad) {
    confirmar({
      icono: 'basura',
      titulo: '¿Eliminar esta propiedad?',
      texto: `«${p.titulo}» y sus fotos se borran para siempre. Si solo se vendió o se alquiló, mejor ocúltala.`,
      textoBoton: 'Eliminar propiedad',
      peligro: true,
      accion: async () => {
        try {
          await eliminarPropiedad(token, p.id);
          setPropiedades(lista => lista.filter(x => x.id !== p.id));
          toast.exito('Propiedad eliminada');
        } catch (e) {
          toast.error('No se pudo eliminar', messageFromError(e, 'Intenta de nuevo.'));
        }
      },
    });
  }

  if (cargando) {
    return <ActivityIndicator size="large" color={c.accent} style={styles.carga} />;
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.contenido}
      data={propiedades}
      keyExtractor={p => String(p.id)}
      refreshControl={<RefreshControl refreshing={refrescando} onRefresh={() => cargar(true)} colors={[c.accent]} tintColor={c.accent} />}
      ListHeaderComponent={
        <View>
          <PressableScale style={styles.publicar} onPress={() => navigation.navigate('EditarPropiedad')}>
            <Icon name="mas" size={18} color={c.onBrand} strokeWidth={2.4} />
            <Text style={styles.publicarTxt}>Publicar una propiedad</Text>
          </PressableScale>
          <Text style={styles.ayuda}>Casas en venta, casas en alquiler y patios para eventos. Los clientes te llaman o te escriben por WhatsApp.</Text>
          {!!error && <Text style={styles.error}>{error}</Text>}
        </View>
      }
      ListEmptyComponent={
        !error ? (
          <View style={styles.vacio}>
            <Icon name="casa" size={34} color={c.chevron} />
            <Text style={styles.vacioTitulo}>Aún no has publicado nada</Text>
            <Text style={styles.vacioTxt}>Sube fotos, el precio y la ubicación, y aparecerá en «Propiedades» y en su mapa.</Text>
          </View>
        ) : null
      }
      renderItem={({ item: p }) => {
        const tipo = tipoPropiedad(p.tipo);
        const uri = imagenUrl(p.galeria[0]);
        return (
          <View style={styles.tarjeta}>
            <PressableScale style={styles.fila} scaleTo={0.98} onPress={() => navigation.navigate('Propiedad', { id: p.id, titulo: p.titulo })}>
              {uri ? (
                <Image source={{ uri }} style={styles.foto} />
              ) : (
                <View style={[styles.foto, styles.fotoVacia]}>
                  <Icon name={tipo.icono} size={24} color={c.muted} />
                </View>
              )}
              <View style={styles.lleno}>
                <View style={styles.filaEstado}>
                  <Text style={styles.tipo}>{tipo.texto}</Text>
                  <Text style={[styles.estado, p.disponible ? styles.publicada : styles.oculta]}>{p.disponible ? 'Publicada' : 'Oculta'}</Text>
                </View>
                <Text style={styles.titulo} numberOfLines={1}>{p.titulo}</Text>
                <Text style={styles.precio}>
                  {pesos(p.precio)}
                  <Text style={styles.periodo}>{periodoPrecio(p.tipo)}</Text>
                </Text>
                <Text style={styles.meta} numberOfLines={1}>{[datosClave(p), p.barrio].filter(Boolean).join(' · ')}</Text>
              </View>
            </PressableScale>
            <View style={styles.acciones}>
              <PressableScale style={styles.accion} onPress={() => navigation.navigate('EditarPropiedad', { id: p.id })}>
                <Icon name="lista" size={15} color={c.text} />
                <Text style={styles.accionTxt}>Editar</Text>
              </PressableScale>
              <PressableScale style={styles.accion} disabled={ocupada === p.id} onPress={() => cambiarVisible(p)}>
                {ocupada === p.id ? (
                  <ActivityIndicator size="small" color={c.text} />
                ) : (
                  <>
                    <Icon name={p.disponible ? 'check' : 'casa'} size={15} color={c.text} />
                    <Text style={styles.accionTxt}>{p.disponible ? TEXTO_OCULTAR[p.tipo] : 'Publicar de nuevo'}</Text>
                  </>
                )}
              </PressableScale>
              <PressableScale style={styles.borrar} onPress={() => eliminar(p)} accessibilityLabel={`Eliminar ${p.titulo}`}>
                <Icon name="basura" size={16} color={c.danger} />
              </PressableScale>
            </View>
          </View>
        );
      }}
    />
  );
}

const useStyles = makeStyles((c, shadow) => ({
  container: { flex: 1, backgroundColor: c.bg },
  contenido: { padding: 16, paddingBottom: 40 },
  carga: { flex: 1, backgroundColor: c.bg },
  lleno: { flex: 1 },
  publicar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: c.brand, borderRadius: radius.md, paddingVertical: 15, ...shadow.soft,
  },
  publicarTxt: { color: c.onBrand, fontFamily: font.bold, fontSize: 16 },
  ayuda: { color: c.muted, fontFamily: font.regular, fontSize: 13, lineHeight: 19, marginTop: 10, marginBottom: 6 },
  error: { color: c.danger, backgroundColor: c.dangerSoft, padding: 12, borderRadius: radius.sm, marginTop: 10, fontFamily: font.medium },
  vacio: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 48, gap: 6 },
  vacioTitulo: { color: c.textStrong, fontFamily: font.semibold, fontSize: 16, marginTop: 6 },
  vacioTxt: { color: c.muted, fontFamily: font.regular, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  tarjeta: { backgroundColor: c.surface, borderRadius: radius.lg, padding: 12, marginTop: 14, ...shadow.soft },
  fila: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  foto: { width: 92, height: 92, borderRadius: radius.md, backgroundColor: c.surface2 },
  fotoVacia: { alignItems: 'center', justifyContent: 'center' },
  filaEstado: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  tipo: { flex: 1, color: c.muted, fontFamily: font.semibold, fontSize: 11.5, textTransform: 'uppercase', letterSpacing: 0.5 },
  estado: { fontFamily: font.bold, fontSize: 11, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, overflow: 'hidden' },
  publicada: { backgroundColor: c.successSoft, color: c.success },
  oculta: { backgroundColor: c.surface2, color: c.muted },
  titulo: { color: c.textStrong, fontFamily: font.semibold, fontSize: 15, marginTop: 3 },
  precio: { color: c.textStrong, fontFamily: font.display, fontSize: 16, marginTop: 2 },
  periodo: { color: c.muted, fontFamily: font.medium, fontSize: 12 },
  meta: { color: c.muted, fontFamily: font.regular, fontSize: 12.5, marginTop: 2 },
  acciones: { flexDirection: 'row', gap: 8, marginTop: 12 },
  accion: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1, borderColor: c.borderStrong, borderRadius: radius.md, paddingVertical: 10,
  },
  accionTxt: { color: c.text, fontFamily: font.semibold, fontSize: 13 },
  borrar: {
    width: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: c.dangerSoft,
  },
}));
