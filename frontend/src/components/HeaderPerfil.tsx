import ReembolsosPerfil from './ReembolsosPerfil';
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
 * Varias cuentas, como en Instagram (ver AuthContext): bajo la cuenta activa
 * salen las demás con la sesión abierta en el teléfono (un toque y cambia) y
 * "Agregar cuenta". Con más de una, "Cerrar sesión" sigue con otra de las
 * guardadas y aparece también "Cerrar todas las sesiones".
 *
 * Al domiciliario se le muestran al lado su nivel de confiabilidad
 * (HeaderConfiabilidad) y su turno (HeaderTurno). Quien tiene negocios ve
 * siempre, junto al ícono de usuario, el de "Mis negocios" (HeaderNegocios):
 * en el catálogo, en Explorar o en cualquier pantalla con esta topbar.
 */
import React from 'react';
import { Linking, Text, View } from 'react-native';
import { ApiError, hacerseDomiciliario, Usuario } from '../api';
import { Cuenta, useAuth } from '../AuthContext';
import { WEB_URL } from '../config';
import { messageFromError } from '../formErrors';
import { useNegocio } from '../NegocioContext';
import { abrirEntregas, navigationRef } from '../RootNavigation';
import { font, makeStyles, radius, useTheme } from '../theme';
import { useToast } from '../Toast';
import { PressableScale } from './anim';
import { useConfirmar } from './Confirmacion';
import HeaderConfiabilidad from './HeaderConfiabilidad';
import HeaderNegocios from './HeaderNegocios';
import HeaderTurno from './HeaderTurno';
import Icon, { IconName } from './Icon';
import MenuDesplegable, { OpcionMenu } from './MenuDesplegable';
import { Objetivo } from '../tutorial/Objetivo';
import { useTutorial } from '../tutorial/contexto';

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
  'AgendaNegocio',
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
  if (roles.includes('usuario')) {
    modulos.push({ titulo: 'Mis direcciones', icono: 'ubicacion', abrir: () => navigationRef.navigate('MisDirecciones') });
    // Casas en venta o alquiler y patios para eventos que publica.
    modulos.push({ titulo: 'Mis propiedades', icono: 'casa', abrir: () => navigationRef.navigate('MisPropiedades') });
  }
  if (roles.includes('domiciliario')) {
    modulos.push({ titulo: 'Mis entregas', icono: 'moto', abrir: abrirEntregas });
  }
  modulos.push({ titulo: 'Mis citas', icono: 'calendario', abrir: () => navigationRef.navigate('MisCitas') });
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

const nombreCompleto = (u: Usuario) => [u.name, u.apellidos].filter(Boolean).join(' ');
const inicial = (u: Usuario) => u.name.trim().charAt(0).toUpperCase() || '?';
/** Correo o, si se registró con el celular, el celular. */
const contacto = (u: Usuario) => u.email || u.telefono || '';

export default function HeaderPerfil() {
  const styles = useStyles();
  const { c } = useTheme();
  const { auth, cuentas, actualizarUsuario, cambiarCuenta, agregarCuenta, salir, salirDeTodas } = useAuth();
  const { negocios } = useNegocio();
  const toast = useToast();
  const confirmar = useConfirmar();
  const { abrirAyuda } = useTutorial();
  const user = auth?.user;
  // Las demás cuentas con la sesión abierta en este teléfono (la más reciente primero).
  const otras = cuentas.filter(cuenta => cuenta.user.id !== user?.id);

  function cambiarA(cuenta: Cuenta) {
    cambiarCuenta(cuenta.user.id);
    toast.info('Cambiaste de cuenta', `Ahora estás como ${nombreCompleto(cuenta.user)}.`);
  }

  function cerrarSesion() {
    const siguiente = salir();
    if (siguiente) {
      toast.info('Sesión cerrada', `Sigues como ${nombreCompleto(siguiente.user)}.`);
    }
  }

  function cerrarTodas() {
    confirmar({
      icono: 'salir',
      titulo: '¿Cerrar todas las sesiones?',
      texto:
        `Saldrás de las ${cuentas.length} cuentas abiertas en este teléfono. ` +
        'Para volver a entrar a cada una necesitarás su contraseña.',
      textoBoton: 'Cerrar todas',
      textoCancelar: 'Cancelar',
      peligro: true,
      accion: salirDeTodas,
    });
  }

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
      <HeaderNegocios />
      <Objetivo id="perfil.menu" enBarra>
      <MenuDesplegable
        icono="usuario"
        etiqueta="Mi perfil"
        renglones={elegir => [
          !!user && (
            <View style={styles.cabecera}>
              <View style={styles.avatar}>
                <Text style={styles.avatarTxt}>{inicial(user)}</Text>
              </View>
              <View style={styles.cabeceraTexto}>
                <Text style={styles.nombre} numberOfLines={1}>
                  {nombreCompleto(user)}
                </Text>
                <Text style={styles.email} numberOfLines={1}>
                  {contacto(user)}
                </Text>
              </View>
              {/* con varias cuentas, marca cuál es la activa */}
              {otras.length > 0 && <Icon name="check" size={18} color={c.success} strokeWidth={2} />}
            </View>
          ),
          ...otras.map(cuenta => (
            <PressableScale
              style={styles.cuenta}
              accessibilityRole="button"
              accessibilityLabel={`Cambiar a la cuenta de ${nombreCompleto(cuenta.user)}`}
              onPress={() => elegir(() => cambiarA(cuenta))}>
              <View style={[styles.avatar, styles.avatarOtra]}>
                <Text style={[styles.avatarTxt, styles.avatarOtraTxt]}>{inicial(cuenta.user)}</Text>
              </View>
              <View style={styles.cabeceraTexto}>
                <Text style={styles.cuentaNombre} numberOfLines={1}>
                  {nombreCompleto(cuenta.user)}
                </Text>
                <Text style={styles.email} numberOfLines={1}>
                  {contacto(cuenta.user)}
                </Text>
              </View>
            </PressableScale>
          )),
          <OpcionMenu icono="mas" titulo="Agregar cuenta" onPress={() => elegir(agregarCuenta)} />,
          ...modulosPara(user?.roles ?? [], enSusNegocios(negocios.length > 0), serDomiciliario).map(m => (
            <OpcionMenu
              icono={m.icono}
              titulo={m.titulo}
              detalle={m.detalle}
              variante={m.destacado ? 'destacado' : undefined}
              onPress={() => elegir(m.abrir)}
            />
          )),
          negocios.length > 0 && <ReembolsosPerfil />,
          // Guías paso a paso (la misma lista de «¿No sabes cómo hacer algo?»).
          <OpcionMenu icono="ayuda" titulo="¿Cómo se usa?" detalle="Guías paso a paso" onPress={() => elegir(abrirAyuda)} />,
          <OpcionMenu
            icono="salir"
            titulo="Cerrar sesión"
            detalle={otras.length > 0 ? `Sigues como ${otras[0].user.name.trim()}` : undefined}
            variante="peligro"
            onPress={() => elegir(cerrarSesion)}
          />,
          otras.length > 0 && (
            <OpcionMenu
              icono="salir"
              titulo="Cerrar todas las sesiones"
              variante="peligro"
              onPress={() => elegir(cerrarTodas)}
            />
          ),
        ]}
      />
      </Objetivo>
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
  // Otra cuenta guardada: renglón como las opciones del menú, con su inicial.
  cuenta: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 10,
    borderRadius: radius.md, backgroundColor: c.bg, borderWidth: 1, borderColor: c.border,
  },
  avatarOtra: { width: 30, height: 30, backgroundColor: c.accentSoft },
  avatarOtraTxt: { color: c.textStrong, fontSize: 13 },
  cuentaNombre: { fontSize: 14, fontFamily: font.semibold, color: c.textStrong },
}));
