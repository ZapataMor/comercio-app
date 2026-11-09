import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useAuth } from '../AuthContext';
import { useNegocio } from '../NegocioContext';
import CatalogoServicios from '../components/CatalogoServicios';
import { PressableScale } from '../components/anim';
import { RootStackParamList } from '../navTypes';
import { font, makeStyles, radius, useTheme } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'MisServicios'>;

export default function MisServiciosScreen({ navigation }: Props) {
  const { auth } = useAuth();
  const { negocio, cargando } = useNegocio();
  const { c } = useTheme();
  const styles = useStyles();

  if (cargando && !negocio) {
    return <ActivityIndicator size="large" color={c.accent} style={styles.carga} />;
  }
  if (!negocio) {
    return <View style={styles.vacio}>
      <Text style={styles.texto}>Aún no tienes un negocio para gestionar servicios.</Text>
      <PressableScale style={styles.boton} onPress={() => navigation.navigate('MiTienda', { nuevo: true })}>
        <Text style={styles.botonTexto}>Crear mi negocio</Text>
      </PressableScale>
    </View>;
  }
  return <ScrollView style={styles.container} contentContainerStyle={styles.contenido} keyboardShouldPersistTaps="handled">
    <CatalogoServicios key={negocio.id} token={auth!.token} negocioId={negocio.id} />
  </ScrollView>;
}

const useStyles = makeStyles(c => ({
  container: { flex: 1, backgroundColor: c.bg },
  contenido: { padding: 16, paddingBottom: 40 },
  carga: { marginTop: 40 },
  vacio: { flex: 1, padding: 24, justifyContent: 'center', gap: 16, backgroundColor: c.bg },
  texto: { color: c.text, fontFamily: font.regular, textAlign: 'center' },
  boton: { padding: 14, borderRadius: radius.md, backgroundColor: c.brand, alignItems: 'center' },
  botonTexto: { color: c.onBrand, fontFamily: font.bold },
}));
