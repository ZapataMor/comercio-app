/**
 * Botón "Mi perfil" de la topbar (parte superior derecha), visible para
 * TODOS los roles. Solo muestra el ícono de la persona; al tocarlo despliega
 * justo debajo (MenuDesplegable) el menú de la cuenta PERSONAL (la persona,
 * no el negocio): recuadros pequeños con "Mi información", "Mis negocios" y
 * "Privacidad", y al final "Cerrar sesión". Estando en sus negocios, en vez
 * de "Mis negocios" ve "Comprar", que lo lleva a Explorar. El domiciliario
 * tiene además "Mis entregas", y al cliente que aún no lo es se le ofrece
 * "Ser domiciliario" en un recuadro destacado.
 *
 * Al domiciliario se le muestran al lado su nivel de confiabilidad
 * (HeaderConfiabilidad) y su turno (HeaderTurno).
 */
import React from 'react';
import { Linking, Text, View } from 'react-native';
import { ApiError, hacerseDomiciliario } from '../api';
import { useAuth } from '../AuthContext';
import { WEB_URL } from '../config';
import { messageFromError } from '../formErrors';
import { useNegocio } from '../NegocioContext';
import { abrirEntregas, navigationRef } from '../RootNavigation';
import { font, makeStyles, radius } from '../theme';
import { useToast } from '../Toast';
import { useConfirmar } from './Confirmacion';
import HeaderConfiabilidad from './HeaderConfiabilidad';
import HeaderTurno from './HeaderTurno';
import { IconName } from './Icon';
import MenuDesplegable, { OpcionMenu } from './MenuDesplegable';

type Modulo = {
  titulo: string;
  icono: IconName;
  abrir: () => void;
  /** Línea pequeña bajo el título (solo en el recuadro destacado). */
  detalle?: string;
  destacado?: boolean;
};

/** Pantallas de la gestión de un negocio (además del Inicio con su panel). */
const RUTAS_NEGOCIO = new Set([
  'MisNegocios',
  'MiTienda',
  'MisProductos',
  'Equipo',
  'PedidosNegocio',
  'ComercioPedidoDetalle',
]);

/** ¿Está ahora en alguno de sus negocios? */
function enSusNegocios(tieneNegocios: boolean): boolean {
  const ruta = navigationRef.isReady() ? navigationRef.getCurrentRoute()?.name : undefined;
  // El Inicio es la administración del negocio si tiene alguno; si no, es el
  // del administrador.
  return !!ruta && (RUTAS_NEGOCIO.has(ruta) || (ruta === 'Home' && tieneNegocios));
}

/** Módulos del menú según la cuenta y la pantalla en la que está. */
function modulosPara(roles: string[], enNegocio: boolean, serDomiciliario: () => void): Modulo[] {
  const modulos: Modulo[] = [
    { titulo: 'Mi información', icono: 'usuario', abrir: () => navigationRef.navigate('MiInformacion') },
    // En sus negocios, el atajo es volver a comprar (Explorar es del cliente).
    enNegocio && roles.includes('usuario')
      ? { titulo: 'Comprar', icono: 'bolsa', abrir: () => navigationRef.navigate('Explorar') }
      : { titulo: 'Mis negocios', icono: 'tienda', abrir: () => navigationRef.navigate('MisNegocios') },
  ];
  if (roles.includes('domiciliario')) {
    modulos.push({ titulo: 'Mis entregas', icono: 'moto', abrir: abrirEntregas });
  }
  // Política de privacidad: página pública del servidor.
  modulos.push({ titulo: 'Privacidad', icono: 'escudo', abrir: () => Linking.openURL(`${WEB_URL}/privacidad`) });
  if (roles.includes('usuario') && !roles.includes('domiciliario')) {
    modulos.push({
      titulo: 'Ser domiciliario',
      detalle: 'Lleva pedidos de los negocios a los clientes',
      icono: 'moto',
      abrir: serDomiciliario,
      destacado: true,
    });
  }
  return modulos;
}

export default function HeaderPerfil() {
  const styles = useStyles();
  const { auth, actualizarUsuario, salir } = useAuth();
  const { negocios } = useNegocio();
  const toast = useToast();
  const confirmar = useConfirmar();
  const user = auth?.user;

  /** "Ser domiciliario": se confirma y, ya activo, lleva a "Mis entregas". */
  function serDomiciliario() {
    confirmar({
      icono: 'moto',
      titulo: '¿Quieres ser domiciliario?',
      texto: 'Lleva pedidos de los negocios a los clientes de tu ciudad.',
      puntos: [
        { icono: 'usuario', texto: 'Sigues siendo cliente: puedes comprar como siempre.' },
        { icono: 'moto', texto: 'Mantén presionada la moto de arriba para entrar en turno y recibir pedidos.' },
        { icono: 'escudo', texto: 'Tu confiabilidad sube cuando entregas a tiempo.' },
      ],
      textoBoton: 'Quiero ser domiciliario',
      accion: activarDomiciliario,
    });
  }

  async function activarDomiciliario() {
    if (!auth) return;
    try {
      const r = await hacerseDomiciliario(auth.token);
      actualizarUsuario(r.user);
      toast.exito('¡Ya eres domiciliario!', 'Mantén presionada la moto para entrar en turno.');
      if (navigationRef.isReady()) abrirEntregas();
    } catch (e) {
      // Sin teléfono no se activa: lo lleva a donde lo agrega.
      if (e instanceof ApiError && e.status === 422) {
        toast.info('Falta tu teléfono', 'Agrégalo aquí y vuelve a intentarlo.');
        if (navigationRef.isReady()) navigationRef.navigate('MiInformacion');
        return;
      }
      toast.error('No se pudo activar', messageFromError(e, 'Error'));
    }
  }

  return (
    <View style={styles.fila}>
      <HeaderConfiabilidad />
      <HeaderTurno />
      <MenuDesplegable
        icono="usuario"
        etiqueta="Mi perfil"
        renglones={elegir => [
          !!user && (
            <View style={styles.cabecera}>
              <View style={styles.avatar}>
                <Text style={styles.avatarTxt}>{user.name.trim().charAt(0).toUpperCase() || '?'}</Text>
              </View>
              <View style={styles.cabeceraTexto}>
                <Text style={styles.nombre} numberOfLines={1}>
                  {[user.name, user.apellidos].filter(Boolean).join(' ')}
                </Text>
                <Text style={styles.email} numberOfLines={1}>
                  {user.email}
                </Text>
              </View>
            </View>
          ),
          ...modulosPara(user?.roles ?? [], enSusNegocios(negocios.length > 0), serDomiciliario).map(m => (
            <OpcionMenu
              icono={m.icono}
              titulo={m.titulo}
              detalle={m.detalle}
              variante={m.destacado ? 'destacado' : undefined}
              onPress={() => elegir(m.abrir)}
            />
          )),
          <OpcionMenu icono="salir" titulo="Cerrar sesión" variante="peligro" onPress={() => elegir(salir)} />,
        ]}
      />
    </View>
  );
}

const useStyles = makeStyles(c => ({
  fila: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4, paddingBottom: 2 },
  avatar: {
    width: 36, height: 36, borderRadius: radius.pill, backgroundColor: c.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarTxt: { color: c.onAccent, fontFamily: font.displayExtra, fontSize: 15 },
  cabeceraTexto: { flex: 1 },
  nombre: { fontSize: 14, fontFamily: font.bold, color: c.textStrong },
  email: { fontSize: 12, fontFamily: font.regular, color: c.muted, marginTop: 1 },
}));
