import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Coordenadas, getCentroBarrio } from '../api';
import { font, makeStyles, radius, useTheme } from '../theme';
import { useToast } from '../Toast';
import { distanciaMetros, miUbicacion, pedirPermisoUbicacion, permisoUbicacion } from '../ubicacion';
import { FadeInView, PressableScale } from './anim';
import Icon, { IconName } from './Icon';
import { MAICAO, MapaRef, MapaVitrina, PinEntrega, PinNegocio, vistaDe, ZOOM } from './Mapa';

type Props = {
  valor: Coordenadas | null;
  onCambiar: (valor: Coordenadas | null) => void;
  disabled?: boolean;
  /** Qué se está ubicando: cambia los textos y el ícono del pin. */
  tipo?: Tipo;
  /** Barrio ya elegido: sin punto todavía, el mapa abre ahí y no en toda la ciudad. */
  barrio?: string;
};

type Tipo = 'negocio' | 'entrega' | 'propiedad';

type Textos = {
  label: string;
  fijar: string;
  paraQue: string;
  ayuda: string;
  estoyAqui: string;
  /** Lo que falta antes de poder guardar. */
  primero: string;
  /** La pregunta final, antes de guardar el punto. */
  pregunta: string;
  icono: IconName;
};

const TEXTOS: Record<Tipo, Textos> = {
  negocio: {
    label: 'Ubicación en el mapa',
    fijar: 'Fijar en el mapa',
    paraQue: 'Así los clientes y los domiciliarios encuentran tu negocio.',
    ayuda: 'Mueve el mapa con el dedo hasta que el pin quede en la puerta de tu negocio.',
    estoyAqui: 'Estoy en el negocio: usar mi ubicación',
    primero: 'Primero mueve el mapa hasta tu negocio, o toca «Estoy en el negocio».',
    pregunta: '¿Esta es la puerta de tu negocio?',
    icono: 'tienda',
  },
  entrega: {
    label: 'Ubicación de tu casa (obligatoria)',
    fijar: 'Marcar mi casa en el mapa',
    paraQue: 'El domiciliario llega más fácil y verás en cuánto llega tu pedido.',
    ayuda: 'Mueve el mapa con el dedo hasta que el pin quede en la puerta donde recibes.',
    estoyAqui: 'Estoy en mi casa: usar mi ubicación',
    primero: 'Primero mueve el mapa hasta tu casa, o toca «Estoy en mi casa».',
    pregunta: '¿Esta es la puerta de tu casa?',
    icono: 'casa',
  },
  propiedad: {
    label: 'Ubicación en el mapa *',
    fijar: 'Marcar en el mapa',
    paraQue: 'Así sale en el mapa de propiedades y te encuentran fácil.',
    ayuda: 'Mueve el mapa con el dedo hasta que el pin quede en la entrada de la propiedad.',
    estoyAqui: 'Estoy en la propiedad: usar mi ubicación',
    primero: 'Primero mueve el mapa hasta la propiedad, o toca «Estoy en la propiedad».',
    pregunta: '¿Esta es la entrada de la propiedad?',
    icono: 'casa',
  },
};

/** Si el GPS queda a menos de esto del barrio elegido, la persona está en su barrio. */
const CERCA_DEL_BARRIO_M = 900;

/**
 * Punto en el mapa de un negocio (Mi Tienda), de una dirección de entrega
 * (cliente) o de una propiedad que se publica. Se fija moviendo el mapa bajo un pin fijo en el centro, o con
 * "usar mi ubicación" si la persona está en el sitio.
 */
export default function SelectorUbicacion({ valor, onCambiar, disabled, tipo = 'negocio', barrio }: Props) {
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
              {tipo === 'negocio' ? <PinNegocio punto={valor} nombre="Mi negocio" /> : <PinEntrega punto={valor} nombre={tipo === 'propiedad' ? 'Mi propiedad' : undefined} />}
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
          barrio={barrio}
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
  barrio,
  onCerrar,
  onGuardar,
}: {
  tipo: Tipo;
  inicial: Coordenadas | null;
  barrio?: string;
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
  // Sin punto todavía, el mapa no se guarda tal como abre: la persona tiene que
  // moverlo hasta su puerta o decir que está ahí. Editando uno, ya lo eligió.
  const [elegido, setElegido] = useState(!!inicial);
  const [avisarPrimero, setAvisarPrimero] = useState(false);
  const [preguntando, setPreguntando] = useState(false);
  // Mientras se ubica al abrir, el mapa espera (no salta de la ciudad al barrio).
  const [ubicando, setUbicando] = useState(!inicial);
  const tocado = useRef(false);

  // Sin punto: abre cerca, ya acercado a las calles. Primero en el barrio
  // elegido; si el GPS dice que la persona está en ese barrio (o no hay
  // barrio), en donde está. Si nada de eso se sabe, en el centro de Maicao.
  useEffect(() => {
    if (inicial) return;
    let vigente = true;
    (async () => {
      const [enBarrio, aqui] = await Promise.all([
        barrio?.trim() ? getCentroBarrio(barrio.trim()) : Promise.resolve(null),
        (async () => {
          try {
            if ((await permisoUbicacion(false)) === 'denegado' && !(await pedirPermisoUbicacion())) return null;
            if (vigente) setConPermiso(true);
            return await miUbicacion();
          } catch {
            return null;
          }
        })(),
      ]);
      if (!vigente) return;
      setUbicando(false);
      // Si la persona ya movió el mapa mientras tanto, no se le quita de donde lo dejó.
      if (tocado.current) return;
      const destino =
        aqui && (!enBarrio || distanciaMetros(aqui, enBarrio) <= CERCA_DEL_BARRIO_M)
          ? { punto: aqui, zoom: ZOOM.puerta }
          : enBarrio
            ? { punto: enBarrio, zoom: ZOOM.barrio }
            : { punto: MAICAO.centro, zoom: ZOOM.zona };
      mapa.current?.irA(destino.punto, destino.zoom);
    })();
    return () => {
      vigente = false;
    };
  }, [inicial, barrio]);

  async function usarMiUbicacion() {
    setBuscando(true);
    try {
      if (!(await pedirPermisoUbicacion())) {
        toast.error('Sin permiso', 'Activa la ubicación de Vitrina en los ajustes del celular.');
        return;
      }
      setConPermiso(true);
      const punto = await miUbicacion();
      tocado.current = true;
      mapa.current?.irA(punto, ZOOM.puerta);
      setElegido(true);
      setAvisarPrimero(false);
    } catch (e) {
      toast.error('No se pudo ubicar', e instanceof Error ? e.message : 'Revisa que la ubicación del celular esté encendida.');
    } finally {
      setBuscando(false);
    }
  }

  function guardar() {
    if (!elegido) {
      setAvisarPrimero(true);
      return;
    }
    setPreguntando(true);
  }

  return (
    <Modal visible animationType="slide" onRequestClose={() => (preguntando ? setPreguntando(false) : onCerrar())} statusBarTranslucent>
      <View style={styles.modal}>
        <MapaVitrina
          ref={mapa}
          style={styles.lleno}
          vistaInicial={inicial ? vistaDe(inicial, ZOOM.cuadra) : vistaDe(MAICAO.centro, ZOOM.zona)}
          miUbicacion={conPermiso}
          creditos={{ bottom: altoPanel + 8, left: 8 }}
          onMover={setCentro}
          onArrastrar={() => {
            tocado.current = true;
            setElegido(true);
            setAvisarPrimero(false);
          }}
        />

        {/* Pin fijo: el mapa se mueve debajo. La punta marca el punto exacto. */}
        <View style={styles.centroPin} pointerEvents="none">
          <View style={styles.pinGota}>
            <Icon name={t.icono} size={20} color={c.onAccent} />
          </View>
          <View style={styles.pinPunta} />
        </View>

        <View style={[styles.arriba, { top: insets.top + 12 }]}>
          <TouchableOpacity
            style={styles.cerrar}
            onPress={onCerrar}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Cerrar el mapa sin guardar">
            <Icon name="cerrar" size={20} color={c.textStrong} />
          </TouchableOpacity>
          <View style={styles.ayuda}>
            <Text style={styles.ayudaTxt}>{t.ayuda}</Text>
            {ubicando && (
              <View style={styles.ubicando}>
                <ActivityIndicator size="small" color={c.accent} />
                <Text style={styles.ubicandoTxt}>Buscando dónde estás…</Text>
              </View>
            )}
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
          {avisarPrimero && (
            <FadeInView style={styles.primero} duration={160}>
              <Icon name="alerta" size={16} color={c.warning} />
              <Text style={styles.primeroTxt}>{t.primero}</Text>
            </FadeInView>
          )}
          {/* Sin elegir se ve apagado; tocarlo igual explica qué falta. */}
          <PressableScale
            style={[styles.primario, !elegido && styles.primarioOff]}
            onPress={guardar}
            accessibilityRole="button"
            accessibilityState={{ disabled: !elegido }}
            accessibilityHint={elegido ? undefined : t.primero}>
            <Text style={styles.primarioTxt}>Guardar ubicación</Text>
          </PressableScale>
        </View>

        {preguntando && (
          <View style={styles.preguntaFondo}>
            <FadeInView style={[styles.pregunta, { marginBottom: insets.bottom + 16 }]} duration={180}>
              <View style={styles.preguntaIcono}>
                <Icon name={t.icono} size={22} color={c.onAccent} />
              </View>
              <Text style={styles.preguntaTitulo}>{t.pregunta}</Text>
              <Text style={styles.preguntaTexto}>
                {tipo === 'entrega'
                  ? 'El domiciliario va a llegar justo al punto donde está el pin.'
                  : 'Se guardará justo el punto donde está el pin.'}
              </Text>
              <PressableScale style={styles.preguntaSi} onPress={() => onGuardar(centro)}>
                <Text style={styles.primarioTxt}>Sí, es aquí</Text>
              </PressableScale>
              <PressableScale style={styles.preguntaNo} onPress={() => setPreguntando(false)}>
                <Text style={styles.preguntaNoTxt}>No, voy a moverlo</Text>
              </PressableScale>
            </FadeInView>
          </View>
        )}
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((c, shadow) => ({
  bloque: { marginBottom: 16 },
  label: { fontSize: 14, fontFamily: font.semibold, color: c.text, marginBottom: 6 },
  lleno: { flex: 1 },
  preview: { height: 130, borderRadius: radius.md, overflow: 'hidden', backgroundColor: c.surface2 },
  acciones: { flexDirection: 'row', gap: 18, marginTop: 8 },
  accion: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 40 },
  accionTxt: { color: c.goldText, fontFamily: font.semibold, fontSize: 14 },
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
  vacioSub: { color: c.muted, fontFamily: font.regular, fontSize: 13, marginTop: 2 },
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
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  ayuda: { flex: 1, backgroundColor: c.surface, borderRadius: radius.md, padding: 12, ...shadow.card },
  ayudaTxt: { color: c.text, fontFamily: font.medium, fontSize: 14, lineHeight: 20 },
  ubicando: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  ubicandoTxt: { color: c.muted, fontFamily: font.medium, fontSize: 13 },
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
  secundarioTxt: { color: c.text, fontFamily: font.semibold, fontSize: 15 },
  primero: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
    borderRadius: radius.sm,
    backgroundColor: c.warningSoft,
  },
  primeroTxt: { flex: 1, color: c.warning, fontFamily: font.semibold, fontSize: 14, lineHeight: 19 },
  primario: { backgroundColor: c.brand, borderRadius: radius.md, paddingVertical: 15, alignItems: 'center' },
  primarioOff: { opacity: 0.45 },
  primarioTxt: { color: c.onBrand, fontFamily: font.bold, fontSize: 16 },
  preguntaFondo: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    backgroundColor: c.scrim,
  },
  pregunta: { backgroundColor: c.surface, borderRadius: radius.lg, padding: 20, ...shadow.card },
  preguntaIcono: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.accent,
    marginBottom: 12,
  },
  preguntaTitulo: { color: c.textStrong, fontFamily: font.display, fontSize: 20, lineHeight: 26 },
  preguntaTexto: { color: c.text, fontFamily: font.regular, fontSize: 15, lineHeight: 21, marginTop: 6 },
  preguntaSi: {
    marginTop: 18,
    backgroundColor: c.brand,
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: 'center',
  },
  preguntaNo: {
    marginTop: 10,
    backgroundColor: c.surface2,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  preguntaNoTxt: { color: c.textStrong, fontFamily: font.semibold, fontSize: 15 },
}));
