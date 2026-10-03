/**
 * Mi perfil — menú de la cuenta del usuario logueado (cualquier rol).
 *
 * Desde aquí se abre:
 *  - "Mi información": ver y modificar los datos personales de la cuenta,
 *  - "Mis negocios": los negocios propios o donde trabaja.
 * También es el lugar de "Cerrar sesión".
 */
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../AuthContext';
import { FadeInView, PressableScale } from '../components/anim';
import Icon from '../components/Icon';
import { useNegocio } from '../NegocioContext';
import { RootStackParamList } from '../navTypes';
import { font, makeStyles, radius, useTheme } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Perfil'>;

export default function PerfilScreen({ navigation }: Props) {
  const { c } = useTheme();
  const styles = useStyles();
  const { auth, salir } = useAuth();
  const user = auth!.user;
  const { negocios, codigoPublico } = useNegocio();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <FadeInView style={styles.cabecera}>
        <View style={styles.avatar}>
          <Text style={styles.avatarTxt}>{user.name.trim().charAt(0).toUpperCase() || '?'}</Text>
        </View>
        <Text style={styles.nombre}>{user.name}</Text>
        <Text style={styles.email}>{user.email}</Text>
        <View style={styles.rolesRow}>
          {user.roles.map(r => (
            <Text key={r} style={styles.rol}>{r}</Text>
          ))}
        </View>
      </FadeInView>

      {/* Datos personales de la cuenta: ver y modificar. */}
      <FadeInView delay={30}>
        <PressableScale style={styles.item} onPress={() => navigation.navigate('MiInformacion')}>
          <Icon name="usuario" size={24} color={c.accent} />
          <View style={styles.itemTexto}>
            <Text style={styles.itemTitulo}>Mi información</Text>
            <Text style={styles.itemSub}>Nombre, correo, teléfono, dirección y contraseña</Text>
          </View>
          <Icon name="chevron" size={20} color={c.chevron} />
        </PressableScale>
      </FadeInView>

      {/* Cualquier persona puede tener negocios o trabajar en otros. */}
      <FadeInView delay={60}>
        <PressableScale style={styles.item} onPress={() => navigation.navigate('MisNegocios')}>
          <Icon name="tienda" size={24} color={c.accent} />
          <View style={styles.itemTexto}>
            <Text style={styles.itemTitulo}>Mis negocios</Text>
            <Text style={styles.itemSub}>
              {negocios.length > 0
                ? `${negocios.length} negocio${negocios.length > 1 ? 's' : ''} · invitaciones`
                : 'Crea tu negocio o únete a uno'}
              {codigoPublico ? ` · Tu código #${codigoPublico}` : ''}
            </Text>
          </View>
          <Icon name="chevron" size={20} color={c.chevron} />
        </PressableScale>
      </FadeInView>

      <FadeInView delay={90}>
        <TouchableOpacity style={styles.logout} onPress={salir}>
          <Icon name="cerrar" size={14} color={c.danger} />
          <Text style={styles.logoutTxt}>Cerrar sesión</Text>
        </TouchableOpacity>
      </FadeInView>
    </ScrollView>
  );
}

const useStyles = makeStyles((c, shadow) => ({
  container: { flex: 1, backgroundColor: c.bg },
  // Deja aire abajo para la barra flotante del cliente (Carrito/Mis pedidos).
  content: { padding: 20, paddingBottom: 120 },
  cabecera: { alignItems: 'center', marginBottom: 18 },
  avatar: {
    width: 74, height: 74, borderRadius: 37, backgroundColor: c.accent,
    alignItems: 'center', justifyContent: 'center', marginTop: 6, ...shadow.gold,
  },
  avatarTxt: { color: c.onAccent, fontFamily: font.displayExtra, fontSize: 30 },
  nombre: { fontSize: 20, fontFamily: font.display, color: c.textStrong, marginTop: 10 },
  email: { fontSize: 13, fontFamily: font.regular, color: c.muted, marginTop: 2 },
  rolesRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  rol: {
    backgroundColor: c.accentSoft, color: c.goldText, fontFamily: font.bold, fontSize: 12,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, overflow: 'hidden',
  },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: c.surface,
    borderRadius: radius.lg, padding: 16, marginBottom: 12, ...shadow.soft,
  },
  itemTexto: { flex: 1 },
  itemTitulo: { fontSize: 16, fontFamily: font.bold, color: c.textStrong },
  itemSub: { color: c.muted, fontSize: 13, marginTop: 2, fontFamily: font.regular },
  logout: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: 16, paddingVertical: 8,
  },
  logoutTxt: { color: c.danger, fontFamily: font.bold },
}));
