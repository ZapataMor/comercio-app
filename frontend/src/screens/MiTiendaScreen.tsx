import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { imagenUrl, Negocio } from '../api';
import { FadeInView, PressableScale } from '../components/anim';
import FieldError from '../components/FieldError';
import SelectorImagen from '../components/SelectorImagen';
import { FieldErrors, fieldErrorsFromError, messageFromError } from '../formErrors';
import { useNegocio } from '../NegocioContext';
import { RootStackParamList } from '../navTypes';
import { c, font, radius, shadow } from '../theme';
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

export default function MiTiendaScreen({ navigation }: Props) {
  const { negocio, cargando, guardar } = useNegocio();
  const toast = useToast();

  // 'ver' = tarjeta de solo lectura · 'editar' = formulario.
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
  const [telefono, setTelefono] = useState('');
  const [activo, setActivo] = useState(true);
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

  // Si el comerciante aún no tiene negocio, se entra directo al formulario.
  useEffect(() => {
    if (!cargando && !negocio) {
      setModo('editar');
    }
  }, [cargando, negocio]);

  function empezarEdicion(n: Negocio | null) {
    setNombre(n?.nombre ?? '');
    setDescripcion(n?.descripcion ?? '');
    const cats = n?.categorias?.length ? n.categorias : n?.categoria ? [n.categoria] : [];
    const conocidas = cats.filter(cat => CATEGORIAS_NEGOCIO.includes(cat));
    const personalizada = cats.find(cat => !CATEGORIAS_NEGOCIO.includes(cat) && cat !== 'Otro') ?? '';
    setCategorias(conocidas);
    setCategoriaPersonalizada(personalizada);
    setCategoriaOtra(personalizada !== '');
    setDireccion(n?.direccion ?? '');
    setTelefono(n?.telefono ?? '');
    setActivo(n?.activo ?? true);
    setImagenUri(null);
    setErrores({});
    setModo('editar');
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
    setGuardando(true);
    const eraNuevo = !negocio;
    try {
      await guardar(
        {
          nombre: nombre.trim(),
          descripcion: descripcion.trim() || null,
          categoria: categoriasFinales[0],
          categorias: categoriasFinales,
          direccion: direccion.trim() || null,
          telefono: telefono.trim() || null,
          activo,
        },
        imagenUri ?? undefined,
      );
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

  if (cargando && !negocio) {
    return <ActivityIndicator size="large" color={c.accent} style={{ marginTop: 40 }} />;
  }

  // ---------------- Vista de solo lectura (tarjeta) ----------------
  if (modo === 'ver' && negocio) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <FadeInView style={styles.card}>
          {!!imagenUrl(negocio.imagen) && (
            <Image source={{ uri: imagenUrl(negocio.imagen) }} style={styles.fotoNegocio} resizeMode="cover" />
          )}
          <View style={styles.cardHead}>
            <Text style={styles.negocioNombre}>{negocio.nombre}</Text>
            <Text style={[styles.estado, negocio.activo ? styles.abierto : styles.cerrado]}>
              {negocio.activo ? 'Abierto' : 'Cerrado'}
            </Text>
          </View>

          <Campo
            etiqueta="Categorías"
            valor={(negocio.categorias?.length ? negocio.categorias : [negocio.categoria])
              .filter(Boolean)
              .join(', ')}
          />
          <Campo etiqueta="Descripción" valor={negocio.descripcion} />
          <Campo etiqueta="Dirección" valor={negocio.direccion} />
          <Campo etiqueta="Teléfono" valor={negocio.telefono} />
        </FadeInView>

        <PressableScale style={styles.boton} onPress={() => empezarEdicion(negocio)}>
          <Text style={styles.botonTexto}>Editar información</Text>
        </PressableScale>
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
              Aún no has creado tu negocio. Complétalo para empezar a vender.
            </Text>
          </View>
        )}

        <View style={styles.card}>
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
          <View style={styles.chips}>
            {CATEGORIAS_NEGOCIO.map(cat => {
              const activa =
                cat === 'Otro' ? categoriaOtra : categorias.includes(cat);
              return (
                <TouchableOpacity
                  key={cat}
                  style={[styles.chip, activa && styles.chipActiva]}
                  disabled={guardando}
                  onPress={() => {
                    if (cat === 'Otro') {
                        setCategoriaOtra(prev => !prev);
                        if (categoriaOtra) {
                          setCategoriaPersonalizada('');
                        }
                        limpiarError('categorias');
                      } else {
                        setCategorias(prev =>
                          prev.includes(cat) ? prev.filter(item => item !== cat) : [...prev, cat],
                        );
                        limpiarError('categorias');
                      }
                    }}>
                  <Text style={[styles.chipTxt, activa && styles.chipTxtActiva]}>{cat}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {categoriaOtra && (
            <TextInput
              style={styles.input}
              value={categoriaPersonalizada}
              onChangeText={valor => {
                setCategoriaPersonalizada(valor);
                limpiarError('categorias');
              }}
              placeholder="Ej: Licorería, Óptica…"
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
              trackColor={{ true: c.accent, false: '#D8D0C4' }}
              thumbColor={c.surface}
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

/** Fila etiqueta + valor para la tarjeta de solo lectura. */
function Campo({ etiqueta, valor }: { etiqueta: string; valor: string | null }) {
  return (
    <View style={styles.campo}>
      <Text style={styles.campoEtiqueta}>{etiqueta}</Text>
      <Text style={[styles.campoValor, !valor && styles.campoVacio]}>{valor || 'Sin especificar'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  content: { padding: 20 },
  aviso: { backgroundColor: c.warningSoft, borderRadius: radius.md, padding: 12, marginBottom: 16 },
  avisoTxt: { color: c.warning, fontSize: 13, fontFamily: font.medium },
  card: { backgroundColor: c.surface, borderRadius: radius.lg, padding: 20, ...shadow.soft },
  fotoNegocio: { width: '100%', height: 170, borderRadius: radius.md, marginBottom: 14, backgroundColor: c.surface2 },
  // Tarjeta de solo lectura
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  negocioNombre: { fontSize: 20, fontFamily: font.extra, color: c.textStrong, flex: 1, marginRight: 10 },
  estado: { fontSize: 12, fontFamily: font.bold, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, overflow: 'hidden' },
  abierto: { backgroundColor: c.successSoft, color: c.success },
  cerrado: { backgroundColor: c.dangerSoft, color: c.danger },
  campo: { borderTopWidth: 1, borderTopColor: c.border, paddingVertical: 10 },
  campoEtiqueta: { fontSize: 12, fontFamily: font.semibold, color: c.mutedSoft, marginBottom: 2 },
  campoValor: { fontSize: 15, color: c.textStrong, fontFamily: font.regular },
  campoVacio: { color: c.mutedSoft, fontStyle: 'italic' },
  // Formulario
  label: { fontSize: 13, fontFamily: font.semibold, color: c.text, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: c.borderStrong, borderRadius: radius.md,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, marginBottom: 16, color: c.textStrong, fontFamily: font.regular,
  },
  area: { minHeight: 80, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: {
    borderWidth: 1, borderColor: c.borderStrong, borderRadius: radius.pill,
    paddingHorizontal: 12, paddingVertical: 7, backgroundColor: c.surface,
  },
  chipActiva: { backgroundColor: c.brand, borderColor: c.brand },
  chipTxt: { fontSize: 13, fontFamily: font.semibold, color: c.text },
  chipTxtActiva: { color: c.onBrand },
  switchRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  switchSub: { color: c.mutedSoft, fontSize: 12, marginTop: 2, fontFamily: font.regular },
  boton: { backgroundColor: c.brand, borderRadius: radius.md, paddingVertical: 15, alignItems: 'center', marginTop: 20, ...shadow.soft },
  botonDisabled: { opacity: 0.7 },
  botonTexto: { color: c.onBrand, fontFamily: font.bold, fontSize: 16 },
  cancelar: { textAlign: 'center', color: c.muted, fontFamily: font.semibold, marginTop: 14 },
});
