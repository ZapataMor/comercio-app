import { useLectura } from '../useLectura';
/**
 * Publicar o editar una propiedad: tipo (casa en venta, casa en alquiler o
 * patio para eventos), fotos, precio, datos de la casa o del patio, qué
 * tiene, condiciones, dirección con su punto en el mapa y el contacto.
 * Lo que se pide cambia con el tipo: a un patio se le pide la capacidad, no
 * las habitaciones.
 */
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { pick, errorCodes, isErrorWithCode, types } from '@react-native-documents/picker';
import {
  Coordenadas,
  DatosPropiedad,
  getOpcionesPropiedad,
  getPropiedad,
  guardarPropiedad,
  imagenUrl,
  OpcionesPropiedad,
  TipoPropiedad,
} from '../api';
import { useAuth } from '../AuthContext';
import { PressableScale } from '../components/anim';
import BarrioSelect from '../components/BarrioSelect';
import { useConfirmar } from '../components/Confirmacion';
import CamposDireccion from '../components/CamposDireccion';
import FieldError from '../components/FieldError';
import Icon from '../components/Icon';
import { colorPropiedad } from '../components/Mapa';
import SelectorUbicacion from '../components/SelectorUbicacion';
import { FieldErrors, fieldErrorsFromError, messageFromError } from '../formErrors';
import { RootStackParamList } from '../navTypes';
import { TIPOS_PROPIEDAD } from '../propiedades';
import { font, makeStyles, radius, useTheme } from '../theme';
import { useToast } from '../Toast';

type Props = NativeStackScreenProps<RootStackParamList, 'EditarPropiedad'>;

const MAX_FOTOS = 10;

const ETIQUETA_PRECIO: Record<TipoPropiedad, string> = {
  venta: 'Precio de venta *',
  alquiler: 'Canon mensual *',
  eventos: 'Valor por evento *',
};
const ETIQUETA_CONDICIONES: Record<TipoPropiedad, { label: string; placeholder: string }> = {
  venta: { label: 'Condiciones de la venta', placeholder: 'Ej: se recibe crédito, escrituras al día, visitas con cita' },
  alquiler: { label: 'Requisitos para arrendar', placeholder: 'Ej: un mes de depósito, fiador, contrato de un año' },
  eventos: { label: 'Condiciones del alquiler', placeholder: 'Ej: valor por 8 horas, música hasta la 1 a. m., se separa con el 50 %' },
};

/** Solo dígitos, sin pasarse del largo. */
const numero = (v: string, largo: number) => v.replace(/[^0-9]/g, '').slice(0, largo);

export default function EditarPropiedadScreen({ navigation, route }: Props) {
  const id = route.params?.id;
  const { c } = useTheme();
  const styles = useStyles();
  const toast = useToast();
  const { auth } = useAuth();
  const token = auth!.token;
  const user = auth!.user;

  const [cargando, setCargando] = useState(!!id);
  const [opciones, setOpciones] = useState<OpcionesPropiedad | null>(null);
  const [tipo, setTipo] = useState<TipoPropiedad>('venta');
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [precio, setPrecio] = useState('');
  const [negociable, setNegociable] = useState(false);
  const [habitaciones, setHabitaciones] = useState('');
  const [banos, setBanos] = useState('');
  const [area, setArea] = useState('');
  const [estrato, setEstrato] = useState<number | null>(null);
  const [capacidad, setCapacidad] = useState('');
  const [caracteristicas, setCaracteristicas] = useState<string[]>([]);
  const [condiciones, setCondiciones] = useState('');
  const [direccion, setDireccion] = useState('');
  const [barrio, setBarrio] = useState('');
  const [ubicacion, setUbicacion] = useState<Coordenadas | null>(null);
  const [contactoNombre, setContactoNombre] = useState([user.name, user.apellidos].filter(Boolean).join(' '));
  const [contactoTelefono, setContactoTelefono] = useState(user.telefono ?? '');
  const [disponible, setDisponible] = useState(true);
  const [galeria, setGaleria] = useState<string[]>([]);
  const [nuevas, setNuevas] = useState<string[]>([]);
  const [guardando, setGuardando] = useState(false);
  // Fotos enviadas de cuántas, mientras se sube (con datos móviles tarda).
  const [avance, setAvance] = useState<{ hechas: number; total: number } | null>(null);
  const [errores, setErrores] = useState<FieldErrors>({});

  const [propiedadCargada, setPropiedadCargada] = useState<number | null>(null);
  useLectura(() => {
    navigation.setOptions({ title: id ? 'Editar propiedad' : 'Publicar propiedad' });
    getOpcionesPropiedad(token).then(setOpciones).catch(() => {});
    if (!id || propiedadCargada === id) return;
    getPropiedad(token, id)
      .then(p => {
        setPropiedadCargada(id);
        setTipo(p.tipo);
        setTitulo(p.titulo);
        setDescripcion(p.descripcion);
        setPrecio(String(p.precio));
        setNegociable(p.negociable);
        setHabitaciones(p.habitaciones != null ? String(p.habitaciones) : '');
        setBanos(p.banos != null ? String(p.banos) : '');
        setArea(p.area_m2 != null ? String(p.area_m2) : '');
        setEstrato(p.estrato);
        setCapacidad(p.capacidad != null ? String(p.capacidad) : '');
        setCaracteristicas(p.caracteristicas);
        setCondiciones(p.condiciones ?? '');
        setDireccion(p.direccion);
        setBarrio(p.barrio);
        setUbicacion({ lat: p.lat, lng: p.lng });
        setContactoNombre(p.contacto_nombre);
        setContactoTelefono(p.contacto_telefono);
        setDisponible(p.disponible);
        setGaleria(p.galeria);
      })
      .catch(e => {
        toast.error('No se pudo abrir', messageFromError(e, 'Intenta de nuevo.'));
        navigation.goBack();
      })
      .finally(() => setCargando(false));
  }, [id, token, navigation, toast, propiedadCargada]);

  // Un «atrás» de más no bota las fotos y los datos: si hay cambios, se pregunta.
  const confirmar = useConfirmar();
  const formulario = JSON.stringify([
    tipo, titulo, descripcion, precio, negociable, habitaciones, banos, area, estrato, capacidad, caracteristicas,
    condiciones, direccion, barrio, ubicacion, contactoNombre, contactoTelefono, disponible, galeria, nuevas,
  ]);
  const formularioInicial = useRef<string | null>(null);
  const salirSinPreguntar = useRef(false);
  useEffect(() => {
    if (!cargando && formularioInicial.current === null) formularioInicial.current = formulario;
  }, [cargando, formulario]);
  const hayCambios = formularioInicial.current !== null && formulario !== formularioInicial.current;
  useEffect(
    () =>
      navigation.addListener('beforeRemove', e => {
        if (!hayCambios || salirSinPreguntar.current) return;
        e.preventDefault();
        confirmar({
          icono: 'alerta',
          titulo: id ? '¿Salir sin guardar los cambios?' : '¿Salir sin publicar?',
          texto: id ? 'Los cambios que hiciste se pierden.' : 'Las fotos y los datos que llenaste se pierden.',
          textoBoton: 'Salir sin guardar',
          peligro: true,
          accion: () => {
            salirSinPreguntar.current = true;
            navigation.dispatch(e.data.action);
          },
        });
      }),
    [navigation, hayCambios, confirmar, id],
  );

  const esPatio = tipo === 'eventos';
  const listaCaracteristicas = opciones?.caracteristicas[tipo] ?? [];
  const maxFotos = opciones?.max_fotos ?? MAX_FOTOS;
  const totalFotos = galeria.length + nuevas.length;

  function limpiar(campo: string) {
    if (errores[campo]) setErrores(({ [campo]: _, ...resto }) => resto);
  }

  function cambiarTipo(nuevo: TipoPropiedad) {
    if (nuevo === tipo) return;
    setTipo(nuevo);
    // Las características de una casa no son las de un patio.
    const validas = opciones?.caracteristicas[nuevo];
    setCaracteristicas(lista => (validas ? lista.filter(x => validas.includes(x)) : []));
    setErrores({});
  }

  async function agregarFotos() {
    try {
      const archivos = await pick({ type: [types.images], allowMultiSelection: true });
      const uris = archivos.map(a => a.uri).filter(Boolean);
      setNuevas(lista => [...lista, ...uris].slice(0, Math.max(0, maxFotos - galeria.length)));
      limpiar('imagenes');
    } catch (e) {
      if (isErrorWithCode(e) && e.code === errorCodes.OPERATION_CANCELED) return;
    }
  }

  function quitarFoto(i: number) {
    if (i < galeria.length) setGaleria(lista => lista.filter((_, j) => j !== i));
    else setNuevas(lista => lista.filter((_, j) => j !== i - galeria.length));
  }

  /** Pone la foto de primera: es la portada del listado y del mapa. */
  function portada(i: number) {
    if (i === 0) return;
    if (i < galeria.length) {
      setGaleria(lista => [lista[i], ...lista.filter((_, j) => j !== i)]);
    } else {
      // Una foto nueva no puede ir antes de las guardadas sin subirse: pasa a ser la primera de las nuevas.
      const k = i - galeria.length;
      setNuevas(lista => [lista[k], ...lista.filter((_, j) => j !== k)]);
      if (galeria.length > 0) toast.info('Guarda primero', 'La foto nueva queda de primera entre las nuevas. Quita las anteriores si quieres que sea la portada.');
    }
  }

  function validar(): FieldErrors {
    const e: FieldErrors = {};
    if (totalFotos === 0) e.imagenes = 'Añade al menos una foto.';
    if (!titulo.trim()) e.titulo = 'Escribe un título corto.';
    if (!descripcion.trim()) e.descripcion = 'Describe la propiedad.';
    if (!precio || Number(precio) < 1) e.precio = 'Escribe el precio en pesos.';
    if (!esPatio && habitaciones === '') e.habitaciones = 'Indica cuántas habitaciones tiene.';
    if (!esPatio && banos === '') e.banos = 'Indica cuántos baños tiene.';
    if (esPatio && !capacidad) e.capacidad = 'Indica cuántas personas caben.';
    if (!direccion.includes(' #') || /#\s*$/.test(direccion)) e.direccion = 'Escribe la calle o carrera y el número.';
    if (!barrio.trim()) e.barrio = 'Elige el barrio.';
    if (!ubicacion) e.lat = 'Marca la ubicación en el mapa.';
    if (!contactoNombre.trim()) e.contacto_nombre = 'Escribe a nombre de quién llaman.';
    if (!/^3\d{9}$/.test(contactoTelefono)) e.contacto_telefono = 'El celular debe tener 10 números y empezar por 3.';
    return e;
  }

  async function guardar() {
    if (guardando) return;
    const e = validar();
    setErrores(e);
    if (Object.keys(e).length) {
      toast.error('Revisa el formulario', Object.values(e)[0]);
      return;
    }
    const datos: DatosPropiedad = {
      tipo,
      titulo: titulo.trim(),
      descripcion: descripcion.trim(),
      precio: Number(precio),
      negociable,
      direccion,
      barrio,
      lat: ubicacion!.lat,
      lng: ubicacion!.lng,
      habitaciones: esPatio ? null : Number(habitaciones),
      banos: esPatio ? null : Number(banos),
      area_m2: area ? Number(area) : null,
      estrato: esPatio ? null : estrato,
      capacidad: esPatio ? Number(capacidad) : null,
      caracteristicas,
      condiciones: condiciones.trim() || null,
      contacto_nombre: contactoNombre.trim(),
      contacto_telefono: contactoTelefono,
      galeria,
      disponible,
    };
    setGuardando(true);
    try {
      const { propiedad: p, fotosFallidas } = await guardarPropiedad(token, datos, id, nuevas, (hechas, total) =>
        setAvance({ hechas, total }),
      );
      if (fotosFallidas > 0) {
        toast.info(
          id ? 'Cambios guardados, faltan fotos' : 'Publicada, faltan fotos',
          `${fotosFallidas === 1 ? 'Una foto no se pudo subir' : `${fotosFallidas} fotos no se pudieron subir`}. Añádelas de nuevo desde «Editar».`,
        );
      } else {
        toast.exito(id ? 'Cambios guardados' : '¡Propiedad publicada!', id ? undefined : 'Ya aparece en Propiedades y en su mapa.');
      }
      salirSinPreguntar.current = true;
      navigation.replace('Propiedad', { id: p.id, titulo: p.titulo });
    } catch (err) {
      setErrores(fieldErrorsFromError(err));
      toast.error('No se pudo guardar', messageFromError(err, 'Intenta de nuevo.'));
    } finally {
      setGuardando(false);
      setAvance(null);
    }
  }

  if (cargando) {
    return <ActivityIndicator size="large" color={c.accent} style={styles.carga} />;
  }

  const condicionesTxt = ETIQUETA_CONDICIONES[tipo];

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.contenido} keyboardShouldPersistTaps="handled">
        <View style={styles.seccion}>
          <Text style={styles.seccionTitulo}>¿Qué vas a publicar?</Text>
          <View style={styles.tipos}>
            {TIPOS_PROPIEDAD.map(t => {
              const activo = t.valor === tipo;
              return (
                <Pressable
                  key={t.valor}
                  style={[styles.tipo, activo && { borderColor: colorPropiedad(c, t.valor), backgroundColor: c.accentSoft }]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: activo }}
                  disabled={guardando}
                  onPress={() => cambiarTipo(t.valor)}>
                  <Icon name={t.icono} size={24} color={activo ? colorPropiedad(c, t.valor) : c.muted} strokeWidth={2} />
                  <Text style={[styles.tipoTxt, activo && styles.tipoTxtActivo]}>{t.texto}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.seccion}>
          <Text style={styles.seccionTitulo}>Fotos</Text>
          <Text style={styles.ayuda}>Hasta {maxFotos}. La primera es la portada: tócala en otra para cambiarla. Muestra fachada, sala, cocina, cuartos y patio.</Text>
          <View style={styles.fotos}>
            {[...galeria.map(g => imagenUrl(g)!), ...nuevas].map((uri, i) => (
              <View key={`${uri}-${i}`} style={styles.fotoCaja}>
                <Pressable onPress={() => portada(i)} accessibilityLabel={i === 0 ? 'Foto de portada' : `Poner la foto ${i + 1} de portada`}>
                  <Image source={{ uri }} style={styles.foto} />
                  {i === 0 && <Text style={styles.portada}>Portada</Text>}
                </Pressable>
                <TouchableOpacity style={styles.quitar} disabled={guardando} onPress={() => quitarFoto(i)} hitSlop={6} accessibilityLabel={`Quitar la foto ${i + 1}`}>
                  <Icon name="cerrar" size={13} color="#FFFFFF" strokeWidth={2.6} />
                </TouchableOpacity>
              </View>
            ))}
            {totalFotos < maxFotos && (
              <PressableScale style={[styles.foto, styles.agregarFoto]} disabled={guardando} onPress={agregarFotos} accessibilityLabel="Añadir fotos">
                <Icon name="imagen" size={22} color={c.accent} />
                <Text style={styles.agregarTxt}>Añadir</Text>
              </PressableScale>
            )}
          </View>
          <FieldError mensaje={errores.imagenes} />
        </View>

        <View style={styles.seccion}>
          <Text style={styles.seccionTitulo}>Información</Text>
          <Text style={styles.label}>Título *</Text>
          <TextInput
            style={styles.input}
            value={titulo}
            onChangeText={v => { setTitulo(v); limpiar('titulo'); }}
            maxLength={120}
            editable={!guardando}
            placeholder={esPatio ? 'Ej: Patio La Ceiba con kiosco' : 'Ej: Casa esquinera de dos plantas'}
            placeholderTextColor={c.mutedSoft}
          />
          <FieldError mensaje={errores.titulo} />

          <Text style={styles.label}>{ETIQUETA_PRECIO[tipo]}</Text>
          <View style={styles.precioFila}>
            <Text style={styles.signo}>$</Text>
            <TextInput
              style={[styles.input, styles.lleno]}
              value={precio ? Number(precio).toLocaleString('es-CO') : ''}
              onChangeText={v => { setPrecio(numero(v, 12)); limpiar('precio'); }}
              keyboardType="number-pad"
              editable={!guardando}
              placeholder={tipo === 'venta' ? '250.000.000' : tipo === 'alquiler' ? '900.000' : '500.000'}
              placeholderTextColor={c.mutedSoft}
            />
          </View>
          <FieldError mensaje={errores.precio} />
          <View style={styles.switchFila}>
            <View style={styles.lleno}>
              <Text style={styles.switchTxt}>Precio negociable</Text>
              <Text style={styles.switchSub}>Le dice al cliente que puede proponerte otro precio.</Text>
            </View>
            <Switch value={negociable} onValueChange={setNegociable} disabled={guardando} accessibilityLabel="Precio negociable" />
          </View>

          <Text style={styles.label}>Descripción *</Text>
          <TextInput
            style={[styles.input, styles.area]}
            value={descripcion}
            onChangeText={v => { setDescripcion(v); limpiar('descripcion'); }}
            multiline
            maxLength={5000}
            editable={!guardando}
            placeholder={esPatio ? 'Cómo es el espacio, para qué eventos sirve, qué incluye…' : 'Cómo es la casa, en qué estado está, qué hay cerca…'}
            placeholderTextColor={c.mutedSoft}
          />
          <FieldError mensaje={errores.descripcion} />
        </View>

        <View style={styles.seccion}>
          <Text style={styles.seccionTitulo}>{esPatio ? 'El patio' : 'La casa'}</Text>
          {esPatio ? (
            <View style={styles.dosColumnas}>
              <Campo label="Capacidad (personas) *" valor={capacidad} error={errores.capacidad} editable={!guardando}
                onCambiar={v => { setCapacidad(numero(v, 5)); limpiar('capacidad'); }} placeholder="150" />
              <Campo label="Área (m²)" valor={area} error={errores.area_m2} editable={!guardando}
                onCambiar={v => { setArea(numero(v, 5)); limpiar('area_m2'); }} placeholder="500" />
            </View>
          ) : (
            <>
              <View style={styles.dosColumnas}>
                <Campo label="Habitaciones *" valor={habitaciones} error={errores.habitaciones} editable={!guardando}
                  onCambiar={v => { setHabitaciones(numero(v, 2)); limpiar('habitaciones'); }} placeholder="3" />
                <Campo label="Baños *" valor={banos} error={errores.banos} editable={!guardando}
                  onCambiar={v => { setBanos(numero(v, 2)); limpiar('banos'); }} placeholder="2" />
              </View>
              <Campo label="Área (m²)" valor={area} error={errores.area_m2} editable={!guardando}
                onCambiar={v => { setArea(numero(v, 5)); limpiar('area_m2'); }} placeholder="120" />
              <Text style={styles.label}>Estrato</Text>
              <View style={styles.chips}>
                {[1, 2, 3, 4, 5, 6].map(n => (
                  <Pressable key={n} style={[styles.chipEstrato, estrato === n && styles.chipActivo]} disabled={guardando}
                    accessibilityRole="radio" accessibilityState={{ selected: estrato === n }} onPress={() => setEstrato(estrato === n ? null : n)}>
                    <Text style={[styles.chipTxt, estrato === n && styles.chipTxtActivo]}>{n}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          {listaCaracteristicas.length > 0 && (
            <>
              <Text style={[styles.label, styles.separado]}>{esPatio ? '¿Qué incluye?' : 'Características'}</Text>
              <View style={styles.chips}>
                {listaCaracteristicas.map(car => {
                  const activa = caracteristicas.includes(car);
                  return (
                    <Pressable key={car} style={[styles.chip, activa && styles.chipActivo]} disabled={guardando}
                      accessibilityRole="checkbox" accessibilityState={{ checked: activa }}
                      onPress={() => setCaracteristicas(lista => (activa ? lista.filter(x => x !== car) : [...lista, car]))}>
                      {activa && <Icon name="check" size={13} color={c.onBrand} strokeWidth={2.6} />}
                      <Text style={[styles.chipTxt, activa && styles.chipTxtActivo]}>{car}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          <Text style={[styles.label, styles.separado]}>{condicionesTxt.label}</Text>
          <TextInput
            style={[styles.input, styles.area]}
            value={condiciones}
            onChangeText={setCondiciones}
            multiline
            maxLength={3000}
            editable={!guardando}
            placeholder={condicionesTxt.placeholder}
            placeholderTextColor={c.mutedSoft}
          />
          <FieldError mensaje={errores.condiciones} />
        </View>

        <View style={styles.seccion}>
          <Text style={styles.seccionTitulo}>Ubicación</Text>
          <CamposDireccion value={direccion} onChangeText={v => { setDireccion(v); limpiar('direccion'); }} editable={!guardando} />
          <FieldError mensaje={errores.direccion} />
          <Text style={[styles.label, styles.separado]}>Barrio *</Text>
          <BarrioSelect valor={barrio} onSeleccionar={v => { setBarrio(v); limpiar('barrio'); }} placeholder="Elige el barrio" titulo="Barrio de la propiedad" disabled={guardando} />
          <FieldError mensaje={errores.barrio} />
          <View style={styles.separado} />
          <SelectorUbicacion tipo="propiedad" valor={ubicacion} onCambiar={v => { setUbicacion(v); limpiar('lat'); }} disabled={guardando} barrio={barrio} />
          <FieldError mensaje={errores.lat ?? errores.lng} />
        </View>

        <View style={styles.seccion}>
          <Text style={styles.seccionTitulo}>Contacto</Text>
          <Text style={styles.ayuda}>Los clientes te llaman o te escriben por WhatsApp a este número.</Text>
          <Text style={styles.label}>Nombre *</Text>
          <TextInput style={styles.input} value={contactoNombre} onChangeText={v => { setContactoNombre(v); limpiar('contacto_nombre'); }}
            maxLength={100} editable={!guardando} placeholder="A nombre de quién llaman" placeholderTextColor={c.mutedSoft} />
          <FieldError mensaje={errores.contacto_nombre} />
          <Text style={styles.label}>Celular / WhatsApp *</Text>
          <TextInput style={styles.input} value={contactoTelefono} onChangeText={v => { setContactoTelefono(numero(v, 10)); limpiar('contacto_telefono'); }}
            keyboardType="number-pad" maxLength={10} editable={!guardando} placeholder="3001234567" placeholderTextColor={c.mutedSoft} />
          <FieldError mensaje={errores.contacto_telefono} />
          {!!id && (
            <View style={styles.switchFila}>
              <View style={styles.lleno}>
                <Text style={styles.switchTxt}>Visible para los clientes</Text>
                <Text style={styles.switchSub}>Apágalo cuando se venda, se alquile o quieras pausarla.</Text>
              </View>
              <Switch value={disponible} onValueChange={setDisponible} disabled={guardando} accessibilityLabel="Visible para los clientes" />
            </View>
          )}
        </View>

        <PressableScale style={[styles.boton, guardando && styles.botonOcupado]} disabled={guardando} onPress={guardar}>
          {guardando ? (
            <View style={styles.subiendo}>
              <ActivityIndicator color={c.onBrand} />
              {!!avance?.total && (
                <Text style={styles.botonTxt}>
                  Subiendo foto {Math.min(avance.hechas + 1, avance.total)} de {avance.total}…
                </Text>
              )}
            </View>
          ) : (
            <Text style={styles.botonTxt}>{id ? 'Guardar cambios' : 'Publicar propiedad'}</Text>
          )}
        </PressableScale>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Campo({
  label,
  valor,
  onCambiar,
  error,
  editable,
  placeholder,
}: {
  label: string;
  valor: string;
  onCambiar: (v: string) => void;
  error?: string;
  editable: boolean;
  placeholder: string;
}) {
  const { c } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.lleno}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} value={valor} onChangeText={onCambiar} keyboardType="number-pad" editable={editable}
        placeholder={placeholder} placeholderTextColor={c.mutedSoft} accessibilityLabel={label} />
      <FieldError mensaje={error} />
    </View>
  );
}

const useStyles = makeStyles((c, shadow) => ({
  container: { flex: 1, backgroundColor: c.bg },
  contenido: { padding: 16, paddingBottom: 48 },
  carga: { flex: 1, backgroundColor: c.bg },
  lleno: { flex: 1 },
  seccion: { backgroundColor: c.surface, borderRadius: radius.lg, padding: 18, marginBottom: 16, ...shadow.soft },
  seccionTitulo: { fontSize: 16, fontFamily: font.displaySemi, color: c.textStrong, marginBottom: 12 },
  ayuda: { color: c.muted, fontFamily: font.regular, fontSize: 12.5, lineHeight: 18, marginTop: -4, marginBottom: 12 },
  label: { fontSize: 13, fontFamily: font.semibold, color: c.text, marginBottom: 6 },
  separado: { marginTop: 14 },
  input: {
    borderWidth: 1, borderColor: c.borderStrong, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 16, marginBottom: 8, color: c.textStrong, fontFamily: font.regular,
  },
  area: { minHeight: 96, textAlignVertical: 'top' },
  tipos: { flexDirection: 'row', gap: 8 },
  tipo: {
    flex: 1, alignItems: 'center', gap: 6, paddingVertical: 14, paddingHorizontal: 6, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: c.border, backgroundColor: c.bg,
  },
  tipoTxt: { color: c.muted, fontFamily: font.semibold, fontSize: 12.5, textAlign: 'center' },
  tipoTxtActivo: { color: c.textStrong },
  fotos: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  fotoCaja: { position: 'relative' },
  foto: { width: 92, height: 92, borderRadius: radius.md, backgroundColor: c.surface2 },
  portada: {
    position: 'absolute', left: 6, bottom: 6, color: '#FFFFFF', backgroundColor: 'rgba(15,13,10,0.62)',
    fontFamily: font.semibold, fontSize: 10.5, paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.pill, overflow: 'hidden',
  },
  quitar: {
    position: 'absolute', right: -6, top: -6, width: 24, height: 24, borderRadius: 12, backgroundColor: c.danger,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: c.surface,
  },
  agregarFoto: { alignItems: 'center', justifyContent: 'center', gap: 4, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.borderStrong, backgroundColor: c.bg },
  agregarTxt: { color: c.goldText, fontFamily: font.semibold, fontSize: 12 },
  precioFila: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  signo: { color: c.textStrong, fontFamily: font.display, fontSize: 20, marginTop: 11 },
  switchFila: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6, marginBottom: 14 },
  switchTxt: { color: c.textStrong, fontFamily: font.semibold, fontSize: 14 },
  switchSub: { color: c.muted, fontFamily: font.regular, fontSize: 12, marginTop: 1 },
  dosColumnas: { flexDirection: 'row', gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: radius.pill, borderWidth: 1, borderColor: c.borderStrong,
  },
  chipEstrato: { width: 44, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: c.borderStrong },
  chipActivo: { backgroundColor: c.brand, borderColor: c.brand },
  chipTxt: { color: c.text, fontFamily: font.medium, fontSize: 13 },
  chipTxtActivo: { color: c.onBrand, fontFamily: font.semibold },
  boton: { backgroundColor: c.brand, borderRadius: radius.md, paddingVertical: 16, alignItems: 'center', ...shadow.soft },
  botonOcupado: { opacity: 0.85 },
  subiendo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  botonTxt: { color: c.onBrand, fontFamily: font.bold, fontSize: 16 },
}));
