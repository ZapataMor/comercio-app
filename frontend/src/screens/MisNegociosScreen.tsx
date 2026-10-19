/**
 * Mis negocios — todos los negocios donde la persona es miembro activo
 * (propietaria o trabajadora), con el activo marcado.
 *
 * Desde aquí se:
 *  - cambia el negocio que se gestiona (el "activo"),
 *  - crea otro negocio (sin límite),
 *  - responden las invitaciones de trabajo recibidas,
 *  - comparte el código público para que otro negocio la invite.
 */
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Share, Text, TouchableOpacity, View } from 'react-native';
import { aceptarInvitacion, getInvitaciones, InvitacionRecibida, rechazarInvitacion } from '../api';
import { useAuth } from '../AuthContext';
import { FadeInView, PressableScale } from '../components/anim';
import Icon from '../components/Icon';
import { messageFromError } from '../formErrors';
import { useNegocio } from '../NegocioContext';
import { RootStackParamList } from '../navTypes';
import { font, makeStyles, radius, useTheme } from '../theme';
import { useToast } from '../Toast';

type Props = NativeStackScreenProps<RootStackParamList, 'MisNegocios'>;

export default function MisNegociosScreen({ navigation }: Props) {
  const { c } = useTheme();
  const styles = useStyles();
  const { auth } = useAuth();
  const token = auth!.token;
  const toast = useToast();
  const { negocios, negocio, codigoPublico, cargando, recargar, seleccionar } = useNegocio();

  const [invitaciones, setInvitaciones] = useState<InvitacionRecibida[]>([]);
  const [refrescando, setRefrescando] = useState(false);
  // Id de la invitación que se está respondiendo (deshabilita sus botones).
  const [respondiendo, setRespondiendo] = useState<number | null>(null);

  const cargarInvitaciones = useCallback(
    () =>
      getInvitaciones(token)
        .then(setInvitaciones)
        .catch(() => {}),
    [token],
  );

  // Al entrar: negocios e invitaciones al día (pudieron llegar por push).
  useFocusEffect(
    useCallback(() => {
      recargar();
      cargarInvitaciones();
    }, [recargar, cargarInvitaciones]),
  );

  async function refrescar() {
    setRefrescando(true);
    await Promise.all([recargar(), cargarInvitaciones()]);
    setRefrescando(false);
  }

  function abrir(id: number) {
    seleccionar(id);
    navigation.navigate('Home');
  }

  async function responder(inv: InvitacionRecibida, acepta: boolean) {
    setRespondiendo(inv.id);
    try {
      if (acepta) {
        const negocioId = await aceptarInvitacion(token, inv.id);
        await recargar();
        seleccionar(negocioId);
        toast.exito('¡Bienvenido al equipo!', `Ahora trabajas en ${inv.negocio ?? 'el negocio'}.`);
      } else {
        await rechazarInvitacion(token, inv.id);
        toast.info('Invitación rechazada', inv.negocio ?? undefined);
      }
      setInvitaciones(lista => lista.filter(i => i.id !== inv.id));
    } catch (e) {
      toast.error('No se pudo responder', messageFromError(e, 'Error'));
    } finally {
      setRespondiendo(null);
    }
  }

  function compartirCodigo() {
    if (!codigoPublico) {
      return;
    }
    Share.share({
      message: `Mi código de Vitrina es #${codigoPublico}. Úsalo para invitarme a trabajar en tu negocio.`,
    }).catch(() => {});
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refrescando} onRefresh={refrescar} colors={[c.accent]} tintColor={c.accent} />
      }>
      {invitaciones.length > 0 && (
        <FadeInView>
          <Text style={styles.seccion}>Invitaciones de trabajo</Text>
          {invitaciones.map(inv => (
            <View key={inv.id} style={styles.invitacion}>
              <Text style={styles.invNegocio}>{inv.negocio ?? 'Un negocio'}</Text>
              <Text style={styles.invSub}>
                {inv.invitado_por ? `Te invitó ${inv.invitado_por}` : 'Te invitaron'} · {inv.fecha}
              </Text>
              <View style={styles.invAcciones}>
                <TouchableOpacity
                  style={[styles.invBtn, styles.invBtnNo]}
                  onPress={() => responder(inv, false)}
                  disabled={respondiendo !== null}>
                  <Text style={styles.invBtnNoTxt}>Rechazar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.invBtn, styles.invBtnSi]}
                  onPress={() => responder(inv, true)}
                  disabled={respondiendo !== null}>
                  {respondiendo === inv.id ? (
                    <ActivityIndicator color={c.onBrand} />
                  ) : (
                    <Text style={styles.invBtnSiTxt}>Aceptar</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </FadeInView>
      )}

      <Text style={styles.seccion}>Tus negocios</Text>
      {cargando && negocios.length === 0 ? (
        <ActivityIndicator color={c.accent} style={{ marginVertical: 20 }} />
      ) : negocios.length === 0 ? (
        <View style={styles.vacioBox}>
          <Text style={styles.vacioTxt}>Aún no haces parte de ningún negocio.</Text>
        </View>
      ) : (
        negocios.map((n, i) => {
          const esActivo = n.id === negocio?.id;
          return (
            <FadeInView key={n.id} delay={i * 50}>
              <PressableScale style={[styles.item, esActivo && styles.itemActivo]} onPress={() => abrir(n.id)}>
                <Icon name="tienda" size={24} color={c.accent} style={styles.itemIcono} />
                <View style={styles.itemTexto}>
                  <Text style={styles.itemTitulo}>{n.nombre}</Text>
                  <View style={styles.fila}>
                    <Text style={styles.rol}>{n.rol === 'propietario' ? 'Propietario' : 'Trabajador'}</Text>
                    <Text style={styles.itemSub}>{n.activo ? 'Abierto' : 'Cerrado'}</Text>
                  </View>
                </View>
                {esActivo ? (
                  <Icon name="check" size={20} color={c.success} />
                ) : (
                  <Icon name="chevron" size={20} color={c.chevron} />
                )}
              </PressableScale>
            </FadeInView>
          );
        })
      )}

      <PressableScale style={styles.crearBtn} onPress={() => navigation.navigate('MiTienda', { nuevo: true })}>
        <Text style={styles.crearTxt}>+ Crear un negocio</Text>
      </PressableScale>

      {!!codigoPublico && (
        <FadeInView delay={120} style={styles.codigoCard}>
          <Text style={styles.codigoLabel}>Tu código para trabajar en otros negocios</Text>
          <Text style={styles.codigo}>#{codigoPublico}</Text>
          <Text style={styles.codigoAyuda}>
            Compártelo con el dueño de un negocio para que te invite. Nadie puede agregarte sin que aceptes.
          </Text>
          <TouchableOpacity style={styles.compartir} onPress={compartirCodigo}>
            <Text style={styles.compartirTxt}>Compartir código</Text>
          </TouchableOpacity>
        </FadeInView>
      )}
    </ScrollView>
  );
}

const useStyles = makeStyles((c, shadow) => ({
  container: { flex: 1, backgroundColor: c.bg },
  content: { padding: 20, paddingBottom: 120 },
  seccion: { fontSize: 16, fontFamily: font.displaySemi, color: c.textStrong, marginTop: 6, marginBottom: 10 },
  // Invitaciones
  invitacion: {
    backgroundColor: c.surface, borderRadius: radius.md, padding: 16, marginBottom: 12,
    borderLeftWidth: 4, borderLeftColor: c.accent, ...shadow.low,
  },
  invNegocio: { fontFamily: font.bold, fontSize: 16, color: c.textStrong },
  invSub: { color: c.muted, fontSize: 13, marginTop: 2, fontFamily: font.regular },
  invAcciones: { flexDirection: 'row', gap: 10, marginTop: 12 },
  invBtn: { flex: 1, borderRadius: radius.md, paddingVertical: 11, alignItems: 'center' },
  invBtnNo: { borderWidth: 1, borderColor: c.borderStrong },
  invBtnNoTxt: { color: c.text, fontFamily: font.semibold },
  invBtnSi: { backgroundColor: c.brand },
  invBtnSiTxt: { color: c.onBrand, fontFamily: font.bold },
  // Negocios
  item: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface,
    borderRadius: radius.lg, padding: 16, marginBottom: 12, borderWidth: 1.5, borderColor: 'transparent', ...shadow.soft,
  },
  itemActivo: { borderColor: c.accent },
  itemIcono: { marginRight: 14 },
  itemTexto: { flex: 1 },
  itemTitulo: { fontSize: 16, fontFamily: font.bold, color: c.textStrong },
  itemSub: { color: c.muted, fontSize: 13, fontFamily: font.regular },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  rol: {
    backgroundColor: c.accentSoft, color: c.goldText, fontFamily: font.bold, fontSize: 11,
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, overflow: 'hidden',
  },
  vacioBox: { backgroundColor: c.surface, borderRadius: radius.md, padding: 18, alignItems: 'center', ...shadow.low },
  vacioTxt: { color: c.muted, fontSize: 14, fontFamily: font.regular },
  crearBtn: {
    backgroundColor: c.brand, borderRadius: radius.md, paddingVertical: 14,
    alignItems: 'center', marginTop: 6, ...shadow.soft,
  },
  crearTxt: { color: c.onBrand, fontFamily: font.bold, fontSize: 15 },
  // Código público
  codigoCard: { backgroundColor: c.surface, borderRadius: radius.lg, padding: 18, marginTop: 24, alignItems: 'center', ...shadow.soft },
  codigoLabel: { color: c.muted, fontSize: 13, fontFamily: font.semibold },
  codigo: { fontSize: 28, fontFamily: font.displayExtra, color: c.textStrong, letterSpacing: 2, marginVertical: 6 },
  codigoAyuda: { color: c.muted, fontSize: 12, fontFamily: font.regular, textAlign: 'center' },
  compartir: { marginTop: 12, paddingVertical: 8, paddingHorizontal: 16 },
  compartirTxt: { color: c.goldText, fontFamily: font.bold },
}));
