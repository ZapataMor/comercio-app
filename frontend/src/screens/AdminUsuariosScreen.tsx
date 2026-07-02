import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { AdminUsuario, cambiarRol, crearUsuario, getAdminUsuarios } from '../api';
import { useAuth } from '../AuthContext';
import { FadeInView, PressableScale } from '../components/anim';
import { c, font, radius, shadow } from '../theme';
import { useToast } from '../Toast';

export default function AdminUsuariosScreen() {
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

  const cargar = useCallback(
    (rol: string, refresco = false) => {
      refresco ? setRefrescando(true) : setCargando(true);
      getAdminUsuarios(token, rol)
        .then(r => {
          setRoles(r.roles);
          setConteos(r.conteos);
          setRolActual(r.rol_actual);
          setUsuarios(r.usuarios);
        })
        .catch(e => toast.error('Error', e.message))
        .finally(() => {
          setCargando(false);
          setRefrescando(false);
        });
    },
    [token],
  );

  useEffect(() => {
    cargar('administrador');
  }, [cargar]);

  async function onCambiarRol(u: AdminUsuario, nuevo: string) {
    if (u.rol === nuevo) return;
    try {
      await cambiarRol(token, u.id, nuevo);
      cargar(rolActual);
    } catch (e) {
      toast.error('No se pudo cambiar', e instanceof Error ? e.message : 'Error');
    }
  }

  async function onCrear() {
    setEnviando(true);
    try {
      await crearUsuario(token, { name: nombre, email, password, rol: formRol });
      setNombre('');
      setEmail('');
      setPassword('');
      setMostrarForm(false);
      cargar(formRol);
      toast.exito('Listo', 'Usuario creado.');
    } catch (e) {
      toast.error('No se pudo crear', e instanceof Error ? e.message : 'Error');
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
            <TextInput style={styles.input} placeholder="Nombre" placeholderTextColor={c.mutedSoft} value={nombre} onChangeText={setNombre} />
            <TextInput style={styles.input} placeholder="Correo" placeholderTextColor={c.mutedSoft} value={email} onChangeText={setEmail}
              autoCapitalize="none" keyboardType="email-address" />
            <TextInput style={styles.input} placeholder="Contraseña (mín. 8)" placeholderTextColor={c.mutedSoft} value={password} onChangeText={setPassword} />
            <View style={styles.chips}>
              {roles.map(r => (
                <TouchableOpacity key={r} onPress={() => setFormRol(r)}
                  style={[styles.chip, formRol === r && styles.chipOn]}>
                  <Text style={[styles.chipTxt, formRol === r && styles.chipTxtOn]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
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
          <TouchableOpacity onPress={() => cargar(item)}
            style={[styles.tab, item === rolActual && styles.tabOn]}>
            <Text style={[styles.tabTxt, item === rolActual && styles.tabTxtOn]}>
              {item} {conteos[item] ?? 0}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* Lista */}
      {cargando ? (
        <ActivityIndicator size="large" color={c.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={usuarios}
          keyExtractor={u => String(u.id)}
          contentContainerStyle={{ padding: 16, paddingTop: 4 }}
          refreshControl={
            <RefreshControl
              refreshing={refrescando}
              onRefresh={() => cargar(rolActual, true)}
              colors={[c.accent]}
              tintColor={c.accent}
            />
          }
          ListEmptyComponent={<Text style={styles.vacio}>No hay usuarios de este tipo.</Text>}
          renderItem={({ item, index }) => (
            <FadeInView delay={Math.min(index, 8) * 40}>
              <View style={styles.card}>
                <Text style={styles.nombre}>{item.name}</Text>
                <Text style={styles.email}>{item.email}</Text>
                <View style={styles.chips}>
                  {roles.map(r => (
                    <TouchableOpacity key={r} onPress={() => onCambiarRol(item, r)}
                      style={[styles.chip, item.rol === r && styles.chipOn]}>
                      <Text style={[styles.chipTxt, item.rol === r && styles.chipTxtOn]}>{r}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </FadeInView>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
});
