import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { AdminUsuario, cambiarRol, crearUsuario, getAdminUsuarios } from '../api';
import { useAuth } from '../AuthContext';

export default function AdminUsuariosScreen() {
  const { auth } = useAuth();
  const token = auth!.token;

  const [roles, setRoles] = useState<string[]>([]);
  const [conteos, setConteos] = useState<Record<string, number>>({});
  const [rolActual, setRolActual] = useState<string>('administrador');
  const [usuarios, setUsuarios] = useState<AdminUsuario[]>([]);
  const [cargando, setCargando] = useState(true);

  // Formulario de creación.
  const [mostrarForm, setMostrarForm] = useState(false);
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formRol, setFormRol] = useState('usuario');
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(
    (rol: string) => {
      setCargando(true);
      getAdminUsuarios(token, rol)
        .then(r => {
          setRoles(r.roles);
          setConteos(r.conteos);
          setRolActual(r.rol_actual);
          setUsuarios(r.usuarios);
        })
        .catch(e => Alert.alert('Error', e.message))
        .finally(() => setCargando(false));
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
      Alert.alert('No se pudo cambiar', e instanceof Error ? e.message : 'Error');
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
      Alert.alert('Listo', 'Usuario creado.');
    } catch (e) {
      Alert.alert('No se pudo crear', e instanceof Error ? e.message : 'Error');
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
            <TextInput style={styles.input} placeholder="Nombre" value={nombre} onChangeText={setNombre} />
            <TextInput style={styles.input} placeholder="Correo" value={email} onChangeText={setEmail}
              autoCapitalize="none" keyboardType="email-address" />
            <TextInput style={styles.input} placeholder="Contraseña (mín. 8)" value={password} onChangeText={setPassword} />
            <View style={styles.chips}>
              {roles.map(r => (
                <TouchableOpacity key={r} onPress={() => setFormRol(r)}
                  style={[styles.chip, formRol === r && styles.chipOn]}>
                  <Text style={[styles.chipTxt, formRol === r && styles.chipTxtOn]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.btn} onPress={onCrear} disabled={enviando}>
              {enviando ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnTxt}>Crear usuario</Text>}
            </TouchableOpacity>
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
        <ActivityIndicator size="large" color="#4f46e5" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={usuarios}
          keyExtractor={u => String(u.id)}
          contentContainerStyle={{ padding: 16, paddingTop: 4 }}
          ListEmptyComponent={<Text style={styles.vacio}>No hay usuarios de este tipo.</Text>}
          renderItem={({ item }) => (
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
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  formBox: { backgroundColor: '#fff', padding: 16, margin: 16, marginBottom: 8, borderRadius: 16 },
  formToggle: { color: '#4f46e5', fontWeight: '700' },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8 },
  btn: { backgroundColor: '#4f46e5', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  btnTxt: { color: '#fff', fontWeight: '700' },
  tabs: { flexGrow: 0, marginBottom: 4 },
  tab: { backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  tabOn: { backgroundColor: '#4f46e5' },
  tabTxt: { color: '#475569', fontSize: 13, fontWeight: '600' },
  tabTxtOn: { color: '#fff' },
  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
  },
  nombre: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  email: { color: '#64748b', fontSize: 13, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  chip: { backgroundColor: '#f1f5f9', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  chipOn: { backgroundColor: '#4f46e5' },
  chipTxt: { fontSize: 11, color: '#475569', fontWeight: '600' },
  chipTxtOn: { color: '#fff' },
  vacio: { textAlign: 'center', color: '#64748b', marginTop: 40 },
});
