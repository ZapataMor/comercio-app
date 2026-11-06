import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useLayoutEffect, useRef, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import HeaderNegocios from '../components/HeaderNegocios';
import HeaderPerfil from '../components/HeaderPerfil';
import PanelDomiciliario, { PanelDomiciliarioRef } from '../components/PanelDomiciliario';
import { IrAExplorar, Saludo } from '../components/SaludoInicio';
import { RootStackParamList } from '../navTypes';
import { makeStyles, useTheme } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Entregas'>;

/**
 * "Mis entregas": la pantalla con la que arranca el domiciliario, aunque
 * también tenga negocios. Lleva su turno, las entregas en curso y los pedidos
 * disponibles. Si tiene negocios, el botón de la topbar lo lleva a ellos.
 */
export default function EntregasScreen({ navigation }: Props) {
  const { c } = useTheme();
  const styles = useStyles();
  const scroll = useRef<ScrollView>(null);
  const panel = useRef<PanelDomiciliarioRef>(null);
  const panelY = useRef(0);
  const [refrescando, setRefrescando] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerDerecha}>
          <HeaderNegocios />
          <HeaderPerfil />
        </View>
      ),
    });
  }, [navigation, styles]);

  async function refrescar() {
    setRefrescando(true);
    await panel.current?.recargar();
    setRefrescando(false);
  }

  return (
    <ScrollView
      ref={scroll}
      // El código de entrega se escribe aquí: el primer toque debe llegar al botón.
      keyboardShouldPersistTaps="handled"
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refrescando} onRefresh={refrescar} colors={[c.accent]} tintColor={c.accent} />
      }>
      <Saludo />
      <IrAExplorar />
      <View onLayout={e => (panelY.current = e.nativeEvent.layout.y)}>
        <PanelDomiciliario
          ref={panel}
          // Al tomar un pedido se sube hasta el panel: queda arriba, en curso.
          onTomado={() => scroll.current?.scrollTo({ y: panelY.current, animated: true })}
        />
      </View>
    </ScrollView>
  );
}

const useStyles = makeStyles(c => ({
  container: { flex: 1, backgroundColor: c.bg },
  content: { padding: 20 },
  headerDerecha: { flexDirection: 'row', alignItems: 'center', gap: 12 },
}));
