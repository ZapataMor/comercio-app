import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { AdminUsuario, cambiarRol, crearUsuario, getAdminUsuarios, reactivarUsuario, suspenderUsuario } from '../api';
import { useAuth } from '../AuthContext';
import { FadeInView, PressableScale } from '../components/anim';
import FieldError from '../components/FieldError';
import Icon from '../components/Icon';
import MotivoCancelacion from '../components/MotivoCancelacion';
import { FieldErrors, fieldErrorsFromError, messageFromError } from '../formErrors';
import { font, makeStyles, radius, useTheme } from '../theme';
import { useToast } from '../Toast';

export default function AdminUsuariosScreen() {
  const { c } = useTheme();
  const styles = useStyles();
  const { auth } = useAuth();
  const token = auth!.token;
  const toast = useToast();

  const [roles, setRoles] = useState<string[]>([]);
  const [conteos, setConteos] = useState<Record<string, number>>({});
  const [rolActual, setRolActual] = useState<string>('administrador');
  const [usuarios, setUsuarios] = useState<AdminUsuario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);

  // Formulario de creación.
  const [mostrarForm, setMostrarForm] = useState(false);
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formRol, setFormRol] = useState('usuario');
  const [enviando, setEnviando] = useState(false);
  const [errores, setErrores] = useState<FieldErrors>({});

  function limpiarError(campo: string) {
    setErrores(prev => {
      const next = { ...prev };
      delete next[campo];
      return next;
    });
  }

  // Búsqueda por nombre/correo y paginación (30 por página).
  const [buscar, setBuscar] = useState('');
  const [pagina, setPagina] = useState(1);
  const [hayMas, setHayMas] = useState(false);
  const [cargandoMas, setCargandoMas] = useState(false);
  // Suspender cuenta: a quién y si se está enviando.
  const [aSuspender, setASuspender] = useState<AdminUsuario | null>(null);
  const [suspendiendo, setSuspendiendo] = useState(false);

  // 'carga' = otra pestaña o búsqueda (ruedita en la lista); 'refresco' =
  // deslizar hacia abajo; 'silencioso' = tras suspender, reactivar, cambiar
  // el rol o crear, la lista se actualiza en su sitio sin taparla.
  const cargar = useCallback(
    (rol: string, modo: 'carga' | 'refresco' | 'silencioso' = 'carga', texto = '') => {
      if (modo === 'carga') setCargando(true);
      if (modo === 'refresco') setRefrescando(true);
      getAdminUsuarios(token, rol, texto, 1)
        .then(r => {
          setRoles(r.roles);
          setConteos(r.conteos);
          setRolActual(r.rol_actual);
          setUsuarios(r.usuarios);
          setPagina(1);
          setHayMas(r.pagina < r.ultima_pagina);
        })
        .catch(e => toast.error('Error', e.message))
        .finally(() => {
          setCargando(false);
          setRefrescando(false);
        });
    },
    [token, toast],
  );

  useEffect(() => {
    cargar('administrador');
  }, [cargar]);

  // Busca 350 ms después de dejar de escribir.
  const primeraVez = React.useRef(true);
  useEffect(() => {
    if (primeraVez.current) {
      primeraVez.current = false;
      return;
    }
    const t = setTimeout(() => cargar(rolActual, 'carga', buscar), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buscar]);

  async function cargarMas() {
    if (!hayMas || cargandoMas || cargando) return;
    setCargandoMas(true);
    try {
      const r = await getAdminUsuarios(token, rolActual, buscar, pagina + 1);
      setUsuarios(prev => [...prev, ...r.usuarios.filter(u => !prev.some(v => v.id === u.id))]);
      setPagina(r.pagina);
      setHayMas(r.pagina < r.ultima_pagina);
    } catch {
      // Se reintenta al volver a llegar al final.
    } finally {
      setCargandoMas(false);
    }
  }

  async function confirmarSuspension(motivo: string) {
    if (!aSuspender) return;
    if (!motivo) {
      toast.error('Falta el motivo', 'Elige o escribe por qué se suspende la cuenta.');
      return;
    }
    setSuspendiendo(true);
    try {
      toast.exito('Cuenta suspendida', await suspenderUsuario(token, aSuspender.id, motivo));
      setASuspender(null);
      cargar(rolActual, 'silencioso', buscar);
    } catch (e) {
      toast.error('No se pudo suspender', messageFromError(e, 'Error'));
    } finally {
      setSuspendiendo(false);
    }
  }

  async function onReactivar(u: AdminUsuario) {
    try {
      toast.exito('Cuenta reactivada', await reactivarUsuario(token, u.id));
      cargar(rolActual, 'silencioso', buscar);
    } catch (e) {
      toast.error('No se pudo reactivar', messageFromError(e, 'Error'));
    }
  }

  async function onCambiarRol(u: AdminUsuario, nuevo: string) {
    if (u.rol === nuevo) return;
    try {
      await cambiarRol(token, u.id, nuevo);
      cargar(rolActual, 'silencioso', buscar);
    } catch (e) {
      toast.error('No se pudo cambiar', e instanceof Error ? e.message : 'Error');
    }
  }

  async function onCrear() {
    setErrores({});
    const nuevosErrores: FieldErrors = {};
    if (!nombre.trim()) nuevosErrores.name = 'El campo nombre es obligatorio.';
    if (!email.trim()) nuevosErrores.email = 'El campo correo es obligatorio.';
    if (!password) nuevosErrores.password = 'El campo contrasena es obligatorio.';
    if (!formRol) nuevosErrores.rol = 'Selecciona un rol.';
    if (Object.keys(nuevosErrores).length > 0) {
      setErrores(nuevosErrores);
      return;
    }

    setEnviando(true);
    try {
      await crearUsuario(token, { name: nombre, email, password, rol: formRol });
      setNombre('');
      setEmail('');
      setPassword('');
      setErrores({});
      setMostrarForm(false);
      cargar(formRol, 'silencioso');
      toast.exito('Listo', 'Usuario creado.');
    } catch (e) {
      const campos = fieldErrorsFromError(e);
      if (Object.keys(campos).length > 0) {
        setErrores(campos);
      } else {
        toast.error('No se pudo crear', messageFromError(e, 'Error'));
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <View style={styles.container}>
      {/* Crear usuario */}
      <View style={styles.formBox}>
        <TouchableOpacity onPress={() => setMostrarForm(v => !v)}>
          <Text style={styles.formToggle}>{mostrarForm ? '− Cerrar' : '+ Crear usuario'}</Text>
        </TouchableOpacity>
        {mostrarForm && (
          <View style={{ marginTop: 10 }}>
            <TextInput style={styles.input} placeholder="Nombre" placeholderTextColor={c.mutedSoft} value={nombre} onChangeText={valor => {
              setNombre(valor);
              limpiarError('name');
            }} />
            <FieldError mensaje={errores.name} />
            <TextInput style={styles.input} placeholder="Correo" placeholderTextColor={c.mutedSoft} value={email} onChangeText={valor => {
              setEmail(valor);
              limpiarError('email');
            }}
              autoCapitalize="none" keyboardType="email-address" />
            <FieldError mensaje={errores.email} />
            <TextInput style={styles.input} placeholder="Contraseña (mín. 8)" placeholderTextColor={c.mutedSoft} value={password} onChangeText={valor => {
              setPassword(valor);
              limpiarError('password');
            }} />
            <FieldError mensaje={errores.password} />
            <View style={styles.chips}>
              {roles.map(r => (
                <TouchableOpacity key={r} onPress={() => {
                  setFormRol(r);
                  limpiarError('rol');
                }}
                  style={[styles.chip, formRol === r && styles.chipOn]}>
                  <Text style={[styles.chipTxt, formRol === r && styles.chipTxtOn]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <FieldError mensaje={errores.rol} />
            <PressableScale style={styles.btn} onPress={onCrear} disabled={enviando}>
              {enviando ? <ActivityIndicator color={c.onBrand} /> : <Text style={styles.btnTxt}>Crear usuario</Text>}
            </PressableScale>
          </View>
        )}
      </View>

      {/* Pestañas por tipo */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={roles}
        keyExtractor={r => r}
        style={styles.tabs}
        contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => cargar(item, 'carga', buscar)}
            style={[styles.tab, item === rolActual && styles.tabOn]}>
            <Text style={[styles.tabTxt, item === rolActual && styles.tabTxtOn]}>
              {item} {conteos[item] ?? 0}
            </Text>
          </TouchableOpacity>
        )}
      />

      <View style={styles.buscador}>
        <Icon name="lupa" size={18} color={c.muted} />
        <TextInput
          style={styles.buscadorInput}
          value={buscar}
          onChangeText={setBuscar}
          placeholder="Buscar por nombre o correo"
          placeholderTextColor={c.mutedSoft}
          autoCapitalize="none"
        />
      </View>

      {/* Lista */}
      {cargando ? (
        <ActivityIndicator size="large" color={c.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={usuarios}
          keyExtractor={u => String(u.id)}
          contentContainerStyle={{ padding: 16, paddingTop: 4 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refrescando}
              onRefresh={() => cargar(rolActual, 'refresco', buscar)}
              colors={[c.accent]}
              tintColor={c.accent}
            />
          }
          onEndReached={cargarMas}
          onEndReachedThreshold={0.4}
          ListFooterComponent={cargandoMas ? <ActivityIndicator color={c.accent} style={{ marginVertical: 16 }} /> : null}
          ListEmptyComponent={<Text style={styles.vacio}>No hay usuarios de este tipo.</Text>}
          renderItem={({ item, index }) => (
            <FadeInView delay={Math.min(index, 8) * 40}>
              <View style={[styles.card, item.suspendido && styles.cardSuspendida]}>
                <Text style={styles.nombre}>{item.name}</Text>
                <Text style={styles.email}>{item.email}</Text>
                {item.suspendido && (
                  <Text style={styles.suspendida}>
                    Suspendida{item.motivo_suspension ? `: ${item.motivo_suspension}` : ''}
                  </Text>
                )}
                <View style={styles.chips}>
                  {roles.map(r => (
                    <TouchableOpacity key={r} onPress={() => onCambiarRol(item, r)}
                      style={[styles.chip, item.rol === r && styles.chipOn]}>
                      <Text style={[styles.chipTxt, item.rol === r && styles.chipTxtOn]}>{r}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {item.id !== auth!.user.id && (
                  <TouchableOpacity
                    onPress={() => (item.suspendido ? onReactivar(item) : setASuspender(item))}
                    hitSlop={6}>
                    <Text style={item.suspendido ? styles.reactivar : styles.suspender}>
                      {item.suspendido ? 'Reactivar cuenta' : 'Suspender cuenta'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </FadeInView>
          )}
        />
      )}

      <MotivoCancelacion
        visible={aSuspender !== null}
        titulo="Suspender cuenta"
        explicacion={`${aSuspender?.name ?? 'Esta persona'} no podrá iniciar sesión y se cerrarán sus sesiones. Puedes reactivarla después.`}
        motivos={['Pedidos falsos', 'Mal trato', 'Fraude o estafa', 'Suplantación']}
        textoBoton="Suspender"
        enviando={suspendiendo}
        onCerrar={() => setASuspender(null)}
        onConfirmar={confirmarSuspension}
      />
    </View>
  );
}

const useStyles = makeStyles((c, shadow) => ({
  container: { flex: 1, backgroundColor: c.bg },
  formBox: { backgroundColor: c.surface, padding: 16, margin: 16, marginBottom: 8, borderRadius: radius.lg, ...shadow.low },
  formToggle: { color: c.goldText, fontFamily: font.bold },
  input: { borderWidth: 1, borderColor: c.borderStrong, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8, color: c.textStrong, fontFamily: font.regular },
  btn: { backgroundColor: c.brand, borderRadius: radius.sm, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  btnTxt: { color: c.onBrand, fontFamily: font.bold },
  tabs: { flexGrow: 0, marginBottom: 4 },
  tab: { backgroundColor: c.surface, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8, ...shadow.low },
  tabOn: { backgroundColor: c.brand },
  tabTxt: { color: c.muted, fontSize: 13, fontFamily: font.semibold },
  tabTxtOn: { color: c.onBrand },
  card: {
    backgroundColor: c.surface, borderRadius: radius.md, padding: 14, marginBottom: 10, ...shadow.low,
  },
  nombre: { fontSize: 15, fontFamily: font.bold, color: c.textStrong },
  email: { color: c.muted, fontSize: 13, marginTop: 2, fontFamily: font.regular },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  chip: { backgroundColor: c.surface2, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  chipOn: { backgroundColor: c.accent },
  chipTxt: { fontSize: 11, color: c.muted, fontFamily: font.semibold },
  chipTxtOn: { color: c.onAccent },
  vacio: { textAlign: 'center', color: c.muted, marginTop: 40, fontFamily: font.regular },
  buscador: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.surface, borderRadius: radius.md,
    paddingHorizontal: 12, marginHorizontal: 16, marginTop: 4, marginBottom: 8, ...shadow.low,
  },
  buscadorInput: { flex: 1, paddingVertical: 10, fontSize: 15, color: c.textStrong, fontFamily: font.regular },
  cardSuspendida: { borderLeftWidth: 4, borderLeftColor: c.danger },
  suspendida: { color: c.danger, fontSize: 12, fontFamily: font.semibold, marginTop: 4 },
  suspender: { color: c.danger, fontSize: 13, fontFamily: font.semibold, marginTop: 10 },
  reactivar: { color: c.success, fontSize: 13, fontFamily: font.semibold, marginTop: 10 },
}));
