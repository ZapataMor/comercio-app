/**
 * Mi Tienda — los datos del negocio activo.
 *
 *  - Vista: portada con la foto, el nombre y si está abierto; datos rápidos
 *    (tiempo de preparación y horario de hoy), ubicación y contacto, y el
 *    horario de la semana con el de hoy resaltado.
 *  - Formulario (solo el propietario): crear o editar el negocio, agrupado
 *    en secciones. También crea OTRO negocio (`nuevo`).
 */
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ClaveHorario, Coordenadas, DiaSemana, HorarioSemana, imagenUrl, Negocio } from '../api';
import { FadeInView, PressableScale } from '../components/anim';
import BarrioSelect from '../components/BarrioSelect';
import { DropdownMultiple } from '../components/Dropdown';
import EditorHorario, { DIAS, errorHorario, hora12 } from '../components/EditorHorario';
import FieldError from '../components/FieldError';
import Icon, { IconName } from '../components/Icon';
import { PuntajeResenas } from '../components/Resenas';
import SelectorImagen from '../components/SelectorImagen';
import SelectorUbicacion from '../components/SelectorUbicacion';
import { FieldErrors, fieldErrorsFromError, messageFromError } from '../formErrors';
import { useNegocio } from '../NegocioContext';
import { RootStackParamList } from '../navTypes';
import { font, makeStyles, radius, useTheme } from '../theme';
import { useToast } from '../Toast';

type Props = NativeStackScreenProps<RootStackParamList, 'MiTienda'>;

/** Tipos de negocio sugeridos. "Otro" habilita un campo de texto libre. */
const CATEGORIAS_NEGOCIO = [
  'Restaurante',
  'Panadería',
  'Ferretería',
  'Taller de carros',
  'Taller de motos',
  'Repuestos',
  'Heladería',
  'Corresponsal',
  'Droguería',
  'Papelería',
  'Minimercado',
  'Comidas rápidas',
  'Supermercado',
  'Almacén de ropa',
  'Farmacia',
  'Tecnología',
  'Café',
  'Licorería',
  'Frutería',
  'Carnicería',
  'Barbería',
  'Belleza',
  'Mascotas',
  'Otro',
];

const OPCIONES_CATEGORIA = CATEGORIAS_NEGOCIO.map(cat => ({ label: cat, value: cat }));

/** Días de la semana en el orden de `Date.getDay()` (domingo = 0). */
const SEMANA: DiaSemana[] = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab'];

/** Qué horario rige hoy: el de festivos si el servidor dice que lo es, o el del día. */
function claveDeHoy(n: Negocio): ClaveHorario {
  return n.festivo_hoy ? 'fes' : SEMANA[new Date().getDay()];
}

function categoriasDe(n: Negocio): string[] {
  return (n.categorias?.length ? n.categorias : [n.categoria]).filter((cat): cat is string => !!cat);
}

export default function MiTiendaScreen({ navigation, route }: Props) {
  const { c } = useTheme();
  const styles = useStyles();
  const { negocio: negocioActivo, cargando, crear, guardar, esPropietario } = useNegocio();
  const toast = useToast();
  // `nuevo`: crear OTRO negocio (no editar el activo). Sin negocios, también se crea.
  const creando = !!route.params?.nuevo || (!cargando && !negocioActivo);
  const negocio = creando ? null : negocioActivo;

  // 'ver' = datos de solo lectura · 'editar' = formulario.
  const [modo, setModo] = useState<'ver' | 'editar'>('ver');
  const [guardando, setGuardando] = useState(false);

  // Campos del formulario.
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [categorias, setCategorias] = useState<string[]>([]);
  const [categoriaPersonalizada, setCategoriaPersonalizada] = useState('');
  // true cuando el tipo no está en la lista y se escribe a mano ("Otro").
  const [categoriaOtra, setCategoriaOtra] = useState(false);
  const [direccion, setDireccion] = useState('');
  const [barrio, setBarrio] = useState('');
  // Pin en el mapa (null = el negocio no sale en el mapa).
  const [ubicacion, setUbicacion] = useState<Coordenadas | null>(null);
  const [telefono, setTelefono] = useState('');
  const [activo, setActivo] = useState(true);
  // Tiempo promedio de preparación (minutos) que el negocio promete.
  const [tiempo, setTiempo] = useState('20');
  // Horario semanal automático (null = solo abrir/cerrar a mano).
  const [horario, setHorario] = useState<HorarioSemana | null>(null);
  // URI local de una imagen recién elegida (sin subir aún). null = sin cambios.
  const [imagenUri, setImagenUri] = useState<string | null>(null);
  const [errores, setErrores] = useState<FieldErrors>({});

  function limpiarError(campo: string) {
    setErrores(prev => {
      const next = { ...prev };
      delete next[campo];
      return next;
    });
  }

  // Al crear un negocio (el primero u otro más) se entra directo al formulario.
  useEffect(() => {
    if (creando) {
      setModo('editar');
    }
  }, [creando]);

  function empezarEdicion(n: Negocio | null) {
    setNombre(n?.nombre ?? '');
    setDescripcion(n?.descripcion ?? '');
    const cats = n ? categoriasDe(n) : [];
    const conocidas = cats.filter(cat => CATEGORIAS_NEGOCIO.includes(cat));
    const personalizada = cats.find(cat => !CATEGORIAS_NEGOCIO.includes(cat) && cat !== 'Otro') ?? '';
    setCategorias(conocidas);
    setCategoriaPersonalizada(personalizada);
    setCategoriaOtra(personalizada !== '');
    setDireccion(n?.direccion ?? '');
    setBarrio(n?.barrio ?? '');
    setUbicacion(n?.lat != null && n?.lng != null ? { lat: n.lat, lng: n.lng } : null);
    setTelefono(n?.telefono ?? '');
    setActivo(n?.activo ?? true);
    setTiempo(String(n?.tiempo_preparacion ?? 20));
    setHorario(n?.horario ?? null);
    setImagenUri(null);
    setErrores({});
    setModo('editar');
  }

  /** Lo marcado en el dropdown: las categorías de la lista y "Otro" (texto libre). */
  function cambiarCategorias(elegidas: string[]) {
    setCategorias(elegidas.filter(cat => cat !== 'Otro'));
    const otra = elegidas.includes('Otro');
    setCategoriaOtra(otra);
    if (!otra) {
      setCategoriaPersonalizada('');
    }
    limpiarError('categorias');
  }

  async function onGuardar() {
    setErrores({});
    if (!nombre.trim()) {
      setErrores({ nombre: 'El campo nombre del negocio es obligatorio.' });
      return;
    }
    const categoriasFinales = [
      ...categorias,
      ...(categoriaPersonalizada.trim() ? [categoriaPersonalizada.trim()] : []),
    ];

    if (categoriasFinales.length === 0) {
      setErrores({ categorias: 'Selecciona al menos una categoria para el negocio.' });
      return;
    }
    if (!barrio.trim()) {
      setErrores({ barrio: 'Elige el barrio donde queda el negocio.' });
      return;
    }
    const minutos = parseInt(tiempo, 10);
    if (!(minutos >= 5 && minutos <= 180)) {
      setErrores({ tiempo_preparacion: 'Pon un tiempo entre 5 y 180 minutos.' });
      return;
    }
    const errHorario = errorHorario(horario);
    if (errHorario) {
      setErrores({ horario: errHorario });
      return;
    }
    setGuardando(true);
    const eraNuevo = !negocio;
    try {
      const input = {
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        categoria: categoriasFinales[0],
        categorias: categoriasFinales,
        direccion: direccion.trim() || null,
        barrio: barrio.trim(),
        lat: ubicacion?.lat ?? null,
        lng: ubicacion?.lng ?? null,
        telefono: telefono.trim() || null,
        activo,
        tiempo_preparacion: minutos,
        horario,
      };
      // Crear deja el negocio nuevo como activo.
      await (eraNuevo ? crear : guardar)(input, imagenUri ?? undefined);
      if (eraNuevo) {
        toast.exito('Negocio creado', 'Ya puedes gestionar tu tienda.');
        navigation.navigate('Home');
      } else {
        toast.exito('Listo', 'Negocio actualizado.');
        setModo('ver');
      }
    } catch (e) {
      const campos = fieldErrorsFromError(e, { categoria: 'categorias', 'categorias.0': 'categorias' });
      if (Object.keys(campos).length > 0) {
        setErrores(campos);
      } else {
        toast.error('No se pudo guardar', messageFromError(e, 'Error'));
      }
    } finally {
      setGuardando(false);
    }
  }

  if (cargando && !negocioActivo && !route.params?.nuevo) {
    return <ActivityIndicator size="large" color={c.accent} style={{ marginTop: 40 }} />;
  }

  // ---------------- Vista de solo lectura ----------------
  if (modo === 'ver' && negocio) {
    const foto = imagenUrl(negocio.imagen);
    const hoy = claveDeHoy(negocio);
    const franjaHoy = negocio.horario?.[hoy] ?? null;
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Portada: foto, tipo de negocio, nombre y si está abierto. */}
        <FadeInView style={styles.portada}>
          {foto ? (
            <Image source={{ uri: foto }} style={styles.portadaFoto} resizeMode="cover" />
          ) : (
            <View style={[styles.portadaFoto, styles.portadaVacia]}>
              <Icon name="tienda" size={56} color={c.mutedSoft} />
            </View>
          )}
          <View style={styles.portadaVelo} />
          <View style={[styles.estado, negocio.activo ? styles.estadoAbierto : styles.estadoCerrado]}>
            <View style={[styles.estadoPunto, { backgroundColor: negocio.activo ? c.success : c.danger }]} />
            <Text style={[styles.estadoTxt, { color: negocio.activo ? c.success : c.danger }]}>
              {negocio.activo ? 'Abierto' : 'Cerrado'}
            </Text>
          </View>
          <View style={styles.portadaTexto}>
            {categoriasDe(negocio).length > 0 && (
              <Text style={styles.portadaCategoria} numberOfLines={1}>
                {categoriasDe(negocio).join(' · ')}
              </Text>
            )}
            <Text style={styles.portadaNombre} numberOfLines={2}>
              {negocio.nombre}
            </Text>
          </View>
        </FadeInView>

        {!!negocio.descripcion && (
          <FadeInView delay={40}>
            <Text style={styles.descripcion}>{negocio.descripcion}</Text>
          </FadeInView>
        )}

        {/* Datos rápidos. */}
        <FadeInView delay={80} style={styles.datos}>
          <Dato icono="reloj" valor={`~${negocio.tiempo_preparacion ?? 20} min`} etiqueta="Tiempo de preparación" />
          <Dato
            icono="calendario"
            valor={
              !negocio.horario
                ? 'A mano'
                : franjaHoy
                  ? `${hora12(franjaHoy.abre)} – ${hora12(franjaHoy.cierra)}`
                  : 'No abre'
            }
            etiqueta={!negocio.horario ? 'Sin horario automático' : negocio.festivo_hoy ? 'Hoy (festivo)' : 'Hoy'}
          />
        </FadeInView>

        <FadeInView delay={100}>
          <PressableScale
            style={styles.resenas}
            accessibilityRole="button"
            onPress={() => navigation.navigate('Resenas', { negocioId: negocio.id, titulo: negocio.nombre })}>
            <Text style={styles.resenasTxt}>Reseñas de tus clientes</Text>
            <PuntajeResenas resenas={negocio.resenas} conVacio />
            <Icon name="chevron" size={14} color={c.muted} />
          </PressableScale>
        </FadeInView>

        <FadeInView delay={120} style={styles.seccion}>
          <Text style={styles.seccionTitulo}>Ubicación y contacto</Text>
          <Fila icono="ubicacion" etiqueta="Dirección" valor={negocio.direccion} />
          <Fila
            icono="casa"
            etiqueta="Barrio"
            valor={negocio.barrio}
            vacio={esPropietario ? 'Falta: agrégalo en "Editar información"' : undefined}
          />
          <Fila
            icono="mapa"
            etiqueta="Ubicación en el mapa"
            valor={negocio.lat != null ? 'Fijada: los clientes te ven en el mapa' : null}
            vacio="Sin fijar: no apareces en el mapa"
          />
          <Fila icono="telefono" etiqueta="Teléfono" valor={negocio.telefono} ultima />
        </FadeInView>

        <FadeInView delay={160} style={styles.seccion}>
          <Text style={styles.seccionTitulo}>Horario</Text>
          {negocio.horario ? (
            DIAS.map(({ clave, nombre: dia }) => {
              const franja = negocio.horario![clave] ?? null;
              const esHoy = clave === hoy;
              return (
                <View
                  key={clave}
                  style={[styles.dia, clave === 'fes' && styles.diaFestivo, esHoy && styles.diaHoy]}>
                  <Text style={[styles.diaNombre, esHoy && styles.diaNombreHoy]}>{dia}</Text>
                  {esHoy && <Text style={styles.hoy}>Hoy</Text>}
                  <Text style={[styles.diaHoras, !franja && styles.diaCerrado]}>
                    {franja ? `${hora12(franja.abre)} – ${hora12(franja.cierra)}` : 'No abre'}
                  </Text>
                </View>
              );
            })
          ) : (
            <Text style={styles.sinHorario}>
              Sin horario automático: abres y cierras a mano con la tienda de la barra superior.
            </Text>
          )}
        </FadeInView>

        {esPropietario ? (
          <PressableScale style={styles.boton} onPress={() => empezarEdicion(negocio)}>
            <Text style={styles.botonTexto}>Editar información</Text>
          </PressableScale>
        ) : (
          <Text style={styles.notaTrabajador}>
            Eres trabajador de este negocio: solo el propietario puede editar su información.
          </Text>
        )}
      </ScrollView>
    );
  }

  // ---------------- Formulario (crear / editar) ----------------
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {!negocio && (
          <View style={styles.aviso}>
            <Text style={styles.avisoTxt}>
              {negocioActivo
                ? 'Vas a crear otro negocio. Quedarás como su propietario.'
                : 'Aún no has creado tu negocio. Complétalo para empezar a vender.'}
            </Text>
          </View>
        )}

        <View style={styles.seccion}>
          <Text style={styles.seccionTitulo}>Tu negocio</Text>
          <SelectorImagen
            label="Foto del negocio"
            uri={imagenUri ?? imagenUrl(negocio?.imagen)}
            onSelect={uri => {
              setImagenUri(uri);
              limpiarError('imagen');
            }}
            disabled={guardando}
          />
          <FieldError mensaje={errores.imagen} />

          <Text style={styles.label}>Nombre del negocio *</Text>
          <TextInput
            style={styles.input}
            value={nombre}
            onChangeText={valor => {
              setNombre(valor);
              limpiarError('nombre');
            }}
            placeholder="Ej: Panadería La Espiga"
            placeholderTextColor={c.mutedSoft}
            editable={!guardando}
          />
          <FieldError mensaje={errores.nombre} />

          <Text style={styles.label}>Categorías (tipo de negocio) *</Text>
          <DropdownMultiple
            titulo="Categorías"
            valores={[...categorias, ...(categoriaOtra ? ['Otro'] : [])]}
            opciones={OPCIONES_CATEGORIA}
            onChange={cambiarCategorias}
            placeholder="Elige una o varias"
            disabled={guardando}
          />
          {categoriaOtra && (
            <TextInput
              style={styles.input}
              value={categoriaPersonalizada}
              onChangeText={valor => {
                setCategoriaPersonalizada(valor);
                limpiarError('categorias');
              }}
              placeholder="Escribe el tipo: Licorería, Óptica…"
              placeholderTextColor={c.mutedSoft}
              editable={!guardando}
            />
          )}
          <FieldError mensaje={errores.categorias} />

          <Text style={styles.label}>Descripción</Text>
          <TextInput
            style={[styles.input, styles.area]}
            value={descripcion}
            onChangeText={valor => {
              setDescripcion(valor);
              limpiarError('descripcion');
            }}
            placeholder="¿Qué vendes?"
            placeholderTextColor={c.mutedSoft}
            multiline
            editable={!guardando}
          />
          <FieldError mensaje={errores.descripcion} />
        </View>

        <View style={styles.seccion}>
          <Text style={styles.seccionTitulo}>Ubicación y contacto</Text>
          <Text style={styles.label}>Dirección</Text>
          <TextInput
            style={styles.input}
            value={direccion}
            onChangeText={valor => {
              setDireccion(valor);
              limpiarError('direccion');
            }}
            placeholder="Calle 12 #8-30, Maicao"
            placeholderTextColor={c.mutedSoft}
            editable={!guardando}
          />
          <FieldError mensaje={errores.direccion} />

          <Text style={styles.label}>Barrio *</Text>
          <BarrioSelect
            valor={barrio}
            onSeleccionar={valor => {
              setBarrio(valor);
              limpiarError('barrio');
            }}
            placeholder="Elige el barrio del negocio"
            titulo="Barrio del negocio"
            disabled={guardando}
          />
          <FieldError mensaje={errores.barrio} />

          <SelectorUbicacion
            valor={ubicacion}
            onCambiar={valor => {
              setUbicacion(valor);
              limpiarError('lat');
            }}
            disabled={guardando}
          />
          <FieldError mensaje={errores.lat ?? errores.lng} />

          <Text style={styles.label}>Teléfono</Text>
          <TextInput
            style={styles.input}
            value={telefono}
            onChangeText={valor => {
              setTelefono(valor);
              limpiarError('telefono');
            }}
            placeholder="3001234567"
            placeholderTextColor={c.mutedSoft}
            keyboardType="phone-pad"
            editable={!guardando}
          />
          <FieldError mensaje={errores.telefono} />
        </View>

        <View style={styles.seccion}>
          <Text style={styles.seccionTitulo}>Atención</Text>
          <Text style={styles.label}>Tiempo promedio de preparación (minutos)</Text>
          <TextInput
            style={styles.input}
            value={tiempo}
            onChangeText={valor => {
              setTiempo(valor.replace(/[^0-9]/g, ''));
              limpiarError('tiempo_preparacion');
            }}
            placeholder="20"
            placeholderTextColor={c.mutedSoft}
            keyboardType="number-pad"
            maxLength={3}
            editable={!guardando}
          />
          <FieldError mensaje={errores.tiempo_preparacion} />
          <Text style={styles.ayuda}>
            Lo que tardas en tener listo un pedido. Los clientes lo ven, y si te pasas, baja tu nivel de
            confiabilidad: pon un tiempo realista.
          </Text>

          <EditorHorario
            valor={horario}
            onCambiar={h => {
              setHorario(h);
              limpiarError('horario');
            }}
            disabled={guardando}
          />
          <FieldError mensaje={errores.horario} />

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Negocio abierto</Text>
              <Text style={styles.switchSub}>
                {activo ? 'Visible para los clientes' : 'Oculto: no aparece en Explorar'}
              </Text>
            </View>
            <Switch
              value={activo}
              onValueChange={setActivo}
              disabled={guardando}
              trackColor={{ true: c.accent, false: c.switchOff }}
              thumbColor={c.switchThumb}
            />
          </View>
        </View>

        <PressableScale
          style={[styles.boton, guardando && styles.botonDisabled]}
          onPress={onGuardar}
          disabled={guardando}>
          {guardando ? (
            <ActivityIndicator color={c.onBrand} />
          ) : (
            <Text style={styles.botonTexto}>{negocio ? 'Guardar cambios' : 'Crear negocio'}</Text>
          )}
        </PressableScale>

        {negocio && (
          <TouchableOpacity onPress={() => setModo('ver')} disabled={guardando}>
            <Text style={styles.cancelar}>Cancelar</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Recuadro de dato rápido: ícono, valor grande y qué es. */
function Dato({ icono, valor, etiqueta }: { icono: IconName; valor: string; etiqueta: string }) {
  const { c } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.dato}>
      <View style={styles.datoIcono}>
        <Icon name={icono} size={18} color={c.accent} strokeWidth={2} />
      </View>
      <Text style={styles.datoValor} numberOfLines={1} adjustsFontSizeToFit>
        {valor}
      </Text>
      <Text style={styles.datoEtiqueta} numberOfLines={1}>
        {etiqueta}
      </Text>
    </View>
  );
}

/** Renglón de una sección: ícono, etiqueta y valor (o el texto de vacío). */
function Fila({
  icono,
  etiqueta,
  valor,
  vacio = 'Sin especificar',
  ultima,
}: {
  icono: IconName;
  etiqueta: string;
  valor: string | null | undefined;
  vacio?: string;
  ultima?: boolean;
}) {
  const { c } = useTheme();
  const styles = useStyles();
  return (
    <View style={[styles.fila, !ultima && styles.filaBorde]}>
      <View style={styles.filaIcono}>
        <Icon name={icono} size={17} color={c.accent} strokeWidth={2} />
      </View>
      <View style={styles.filaTexto}>
        <Text style={styles.filaEtiqueta}>{etiqueta}</Text>
        <Text style={[styles.filaValor, !valor && styles.filaVacia]}>{valor || vacio}</Text>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c, shadow) => ({
  container: { flex: 1, backgroundColor: c.bg },
  content: { padding: 20, paddingBottom: 40 },
  aviso: { backgroundColor: c.warningSoft, borderRadius: radius.md, padding: 12, marginBottom: 16 },
  avisoTxt: { color: c.warning, fontSize: 13, fontFamily: font.medium },
  // Portada
  portada: { height: 210, borderRadius: radius.xl, overflow: 'hidden', backgroundColor: c.surface2, ...shadow.card },
  portadaFoto: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, width: '100%', height: '100%' },
  portadaVacia: { alignItems: 'center', justifyContent: 'center' },
  portadaVelo: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(31,27,22,0.42)' },
  portadaTexto: { position: 'absolute', left: 18, right: 18, bottom: 16 },
  portadaCategoria: {
    color: 'rgba(255,255,255,0.86)', fontSize: 12, fontFamily: font.semibold, letterSpacing: 0.6,
    textTransform: 'uppercase', marginBottom: 4,
  },
  portadaNombre: { color: '#FFFFFF', fontSize: 26, lineHeight: 32, fontFamily: font.displayExtra },
  estado: {
    position: 'absolute', top: 14, right: 14, flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill,
  },
  estadoAbierto: { backgroundColor: c.successSoft },
  estadoCerrado: { backgroundColor: c.dangerSoft },
  estadoPunto: { width: 7, height: 7, borderRadius: radius.pill },
  estadoTxt: { fontSize: 12, fontFamily: font.bold },
  descripcion: { color: c.text, fontSize: 15, lineHeight: 22, fontFamily: font.regular, marginTop: 16 },
  // Datos rápidos
  datos: { flexDirection: 'row', gap: 12, marginTop: 16 },
  dato: { flex: 1, backgroundColor: c.surface, borderRadius: radius.lg, padding: 14, ...shadow.soft },
  datoIcono: {
    width: 32, height: 32, borderRadius: radius.sm, backgroundColor: c.accentSoft,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  datoValor: { fontSize: 16, fontFamily: font.display, color: c.textStrong },
  datoEtiqueta: { fontSize: 12, fontFamily: font.regular, color: c.muted, marginTop: 2 },
  // Secciones (vista y formulario)
  seccion: { backgroundColor: c.surface, borderRadius: radius.lg, padding: 18, marginTop: 16, ...shadow.soft },
  seccionTitulo: { fontSize: 16, fontFamily: font.displaySemi, color: c.textStrong, marginBottom: 12 },
  resenas: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.surface,
    borderRadius: radius.lg, paddingHorizontal: 18, paddingVertical: 15, marginTop: 16, ...shadow.soft,
  },
  resenasTxt: { flex: 1, color: c.textStrong, fontFamily: font.semibold, fontSize: 14 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  filaBorde: { borderBottomWidth: 1, borderBottomColor: c.border },
  filaIcono: {
    width: 34, height: 34, borderRadius: radius.sm, backgroundColor: c.accentSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  filaTexto: { flex: 1 },
  filaEtiqueta: { fontSize: 12, fontFamily: font.semibold, color: c.muted },
  filaValor: { fontSize: 15, fontFamily: font.medium, color: c.textStrong, marginTop: 1 },
  filaVacia: { color: c.mutedSoft, fontFamily: font.regular, fontStyle: 'italic' },
  // Horario de la semana
  dia: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, paddingHorizontal: 10, borderRadius: radius.sm },
  diaFestivo: { marginTop: 6, borderTopWidth: 1, borderTopColor: c.border, borderRadius: 0, paddingTop: 13 },
  diaHoy: { backgroundColor: c.accentSoft, borderRadius: radius.sm, borderTopColor: 'transparent' },
  diaNombre: { fontSize: 14, fontFamily: font.medium, color: c.text },
  diaNombreHoy: { fontFamily: font.bold, color: c.textStrong },
  hoy: {
    fontSize: 10.5, fontFamily: font.bold, color: c.onAccent, backgroundColor: c.accent, overflow: 'hidden',
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.pill,
  },
  diaHoras: { flex: 1, textAlign: 'right', fontSize: 14, fontFamily: font.semibold, color: c.textStrong },
  diaCerrado: { color: c.mutedSoft, fontFamily: font.regular },
  sinHorario: { fontSize: 14, lineHeight: 20, fontFamily: font.regular, color: c.muted },
  // Formulario
  label: { fontSize: 13, fontFamily: font.semibold, color: c.text, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: c.borderStrong, borderRadius: radius.md,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, marginBottom: 16, color: c.textStrong, fontFamily: font.regular,
  },
  area: { minHeight: 80, textAlignVertical: 'top' },
  switchRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  switchSub: { color: c.mutedSoft, fontSize: 12, marginTop: 2, fontFamily: font.regular },
  boton: { backgroundColor: c.brand, borderRadius: radius.md, paddingVertical: 15, alignItems: 'center', marginTop: 24, ...shadow.soft },
  botonDisabled: { opacity: 0.7 },
  botonTexto: { color: c.onBrand, fontFamily: font.bold, fontSize: 16 },
  cancelar: { textAlign: 'center', color: c.muted, fontFamily: font.semibold, marginTop: 14 },
  notaTrabajador: { textAlign: 'center', color: c.muted, fontFamily: font.regular, fontSize: 13, marginTop: 18 },
  ayuda: { color: c.mutedSoft, fontSize: 12, marginTop: -8, marginBottom: 16, fontFamily: font.regular },
}));
