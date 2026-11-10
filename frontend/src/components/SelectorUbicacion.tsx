import React, { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Coordenadas } from '../api';
import { font, makeStyles, radius, useTheme } from '../theme';
import { useToast } from '../Toast';
import { miUbicacion, pedirPermisoUbicacion } from '../ubicacion';
import { PressableScale } from './anim';
import Icon, { IconName } from './Icon';
import { MAICAO, MapaRef, MapaVitrina, PinEntrega, PinNegocio, vistaDe, ZOOM } from './Mapa';

type Props = {
  valor: Coordenadas | null;
  onCambiar: (valor: Coordenadas | null) => void;
  disabled?: boolean;
  /** Qué se está ubicando: cambia los textos y el ícono del pin. */
  tipo?: Tipo;
};

type Tipo = 'negocio' | 'entrega';

const TEXTOS: Record<Tipo, { label: string; fijar: string; paraQue: string; ayuda: string; estoyAqui: string; icono: IconName }> = {
  negocio: {
    label: 'Ubicación en el mapa',
    fijar: 'Fijar en el mapa',
    paraQue: 'Así los clientes y los domiciliarios encuentran tu negocio.',
    ayuda: 'Mueve el mapa hasta que el pin quede en la puerta de tu negocio.',
    estoyAqui: 'Estoy en el negocio: usar mi ubicación',
    icono: 'tienda',
  },
  entrega: {
    label: 'Punto en el mapa (opcional)',
    fijar: 'Marcar en el mapa',
    paraQue: 'El domiciliario llega más fácil y verás en cuánto llega tu pedido.',
    ayuda: 'Mueve el mapa hasta que el pin quede en la puerta donde recibes.',
    estoyAqui: 'Estoy ahí: usar mi ubicación',
    icono: 'casa',
  },
};

/**
 * Punto en el mapa de un negocio (Mi Tienda) o de una dirección de entrega
 * (cliente). Se fija moviendo el mapa bajo un pin fijo en el centro, o con
 * "usar mi ubicación" si la persona está en el sitio.
 */
export default function SelectorUbicacion({ valor, onCambiar, disabled, tipo = 'negocio' }: Props) {
  const t = TEXTOS[tipo];
  const { c } = useTheme();
  const styles = useStyles();
  const [abierto, setAbierto] = useState(false);

  return (
    <View style={styles.bloque}>
      <Text style={styles.label}>{t.label}</Text>
      {valor ? (
        <>
          {/* Vista previa quieta: el dedo hace scroll del formulario, no del mapa. */}
          <View style={styles.preview} pointerEvents="none">
            <MapaVitrina
              style={styles.lleno}
              vistaInicial={vistaDe(valor, ZOOM.cuadra)}
              vista={vistaDe(valor, ZOOM.cuadra)}
              quieto
              recortado>
              {tipo === 'entrega' ? <PinEntrega punto={valor} /> : <PinNegocio punto={valor} nombre="Mi negocio" />}
            </MapaVitrina>
          </View>
          <View style={styles.acciones}>
            <TouchableOpacity onPress={() => setAbierto(true)} disabled={disabled} style={styles.accion}>
              <Icon name="ubicacion" size={15} color={c.goldText} />
              <Text style={styles.accionTxt}>Cambiar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onCambiar(null)} disabled={disabled} style={styles.accion}>
              <Icon name="cerrar" size={15} color={c.muted} />
              <Text style={[styles.accionTxt, { color: c.muted }]}>Quitar del mapa</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <PressableScale style={styles.vacio} onPress={() => setAbierto(true)} disabled={disabled}>
          <Icon name="ubicacion" size={22} color={c.accent} />
          <View style={{ flex: 1 }}>
            <Text style={styles.vacioTitulo}>{t.fijar}</Text>
            <Text style={styles.vacioSub}>{t.paraQue}</Text>
          </View>
          <Icon name="chevron" size={18} color={c.chevron} />
        </PressableScale>
      )}

      {abierto && (
        <ModalMapa
          tipo={tipo}
          inicial={valor}
          onCerrar={() => setAbierto(false)}
          onGuardar={punto => {
            onCambiar(punto);
            setAbierto(false);
          }}
        />
      )}
    </View>
  );
}

function ModalMapa({
  tipo,
  inicial,
  onCerrar,
  onGuardar,
}: {
  tipo: Tipo;
  inicial: Coordenadas | null;
  onCerrar: () => void;
  onGuardar: (punto: Coordenadas) => void;
}) {
  const t = TEXTOS[tipo];
  const { c } = useTheme();
  const styles = useStyles();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const mapa = useRef<MapaRef>(null);
  // Lo que queda bajo el pin del centro.
  const [centro, setCentro] = useState<Coordenadas>(inicial ?? MAICAO.centro);
  // Alto del panel de abajo: los créditos del mapa van justo encima.
  const [altoPanel, setAltoPanel] = useState(150);
  const [buscando, setBuscando] = useState(false);
  const [conPermiso, setConPermiso] = useState(false);

  async function usarMiUbicacion() {
    setBuscando(true);
    try {
      if (!(await pedirPermisoUbicacion())) {
        toast.error('Sin permiso', 'Activa la ubicación de Vitrina en los ajustes del celular.');
        return;
      }
      setConPermiso(true);
      const punto = await miUbicacion();
      mapa.current?.irA(punto, ZOOM.puerta);
    } catch (e) {
      toast.error('No se pudo ubicar', e instanceof Error ? e.message : 'Error');
    } finally {
      setBuscando(false);
    }
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onCerrar} statusBarTranslucent>
      <View style={styles.modal}>
        <MapaVitrina
          ref={mapa}
          style={styles.lleno}
          vistaInicial={inicial ? vistaDe(inicial, ZOOM.cuadra) : MAICAO}
          miUbicacion={conPermiso}
          creditos={{ bottom: altoPanel + 8, left: 8 }}
          onMover={setCentro}
        />

        {/* Pin fijo: el mapa se mueve debajo. La punta marca el punto exacto. */}
        <View style={styles.centroPin} pointerEvents="none">
          <View style={styles.pinGota}>
            <Icon name={t.icono} size={20} color={c.onAccent} />
          </View>
          <View style={styles.pinPunta} />
        </View>

        <View style={[styles.arriba, { top: insets.top + 12 }]}>
          <TouchableOpacity style={styles.cerrar} onPress={onCerrar} hitSlop={8}>
            <Icon name="cerrar" size={20} color={c.textStrong} />
          </TouchableOpacity>
          <View style={styles.ayuda}>
            <Text style={styles.ayudaTxt}>{t.ayuda}</Text>
          </View>
        </View>

        <View
          style={[styles.abajo, { paddingBottom: insets.bottom + 16 }]}
          onLayout={e => setAltoPanel(e.nativeEvent.layout.height)}>
          <PressableScale style={styles.secundario} onPress={usarMiUbicacion} disabled={buscando}>
            {buscando ? (
              <ActivityIndicator color={c.text} />
            ) : (
              <>
                <Icon name="ubicacion" size={16} color={c.text} />
                <Text style={styles.secundarioTxt}>{t.estoyAqui}</Text>
              </>
            )}
          </PressableScale>
          <PressableScale style={styles.primario} onPress={() => onGuardar(centro)}>
            <Text style={styles.primarioTxt}>Guardar ubicación</Text>
          </PressableScale>
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((c, shadow) => ({
  bloque: { marginBottom: 16 },
  label: { fontSize: 13, fontFamily: font.semibold, color: c.text, marginBottom: 6 },
  lleno: { flex: 1 },
  preview: { height: 130, borderRadius: radius.md, overflow: 'hidden', backgroundColor: c.surface2 },
  acciones: { flexDirection: 'row', gap: 18, marginTop: 8 },
  accion: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  accionTxt: { color: c.goldText, fontFamily: font.semibold, fontSize: 13 },
  vacio: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: c.borderStrong,
    borderRadius: radius.md,
    padding: 14,
  },
  vacioTitulo: { color: c.textStrong, fontFamily: font.semibold, fontSize: 15 },
  vacioSub: { color: c.muted, fontFamily: font.regular, fontSize: 12, marginTop: 2 },
  modal: { flex: 1, backgroundColor: c.bg },
  centroPin: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    // La punta (no el centro de la gota) queda sobre el centro del mapa.
    paddingBottom: 54,
  },
  pinGota: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: c.accent,
    borderWidth: 3,
    borderColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  pinPunta: {
    width: 0,
    height: 0,
    marginTop: -2,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: c.accent,
  },
  arriba: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cerrar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  ayuda: { flex: 1, backgroundColor: c.surface, borderRadius: radius.md, padding: 12, ...shadow.card },
  ayudaTxt: { color: c.text, fontFamily: font.medium, fontSize: 13 },
  abajo: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 10,
    backgroundColor: c.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    ...shadow.card,
  },
  secundario: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: c.borderStrong,
    borderRadius: radius.md,
    paddingVertical: 13,
  },
  secundarioTxt: { color: c.text, fontFamily: font.semibold, fontSize: 14 },
  primario: { backgroundColor: c.brand, borderRadius: radius.md, paddingVertical: 15, alignItems: 'center' },
  primarioTxt: { color: c.onBrand, fontFamily: font.bold, fontSize: 16 },
}));
