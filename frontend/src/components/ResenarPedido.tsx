/**
 * Reseñas del cliente en un pedido entregado: estrellas y comentario para la
 * tienda y para cada producto. Se pueden dejar por partes (lo que aún no ha
 * probado queda sin estrellas) y corregir hasta que venza el plazo. Son
 * públicas; lo que mide si cumplieron está en CalificarPedido.
 */
import React, { useState } from 'react';
import { ActivityIndicator, Image, Text, TextInput, View } from 'react-native';
import { imagenUrl, NuevaResena, OpinionPedido, ResenaDeProducto, ResenasPedido, resenarPedido, SeguimientoPedido } from '../api';
import { useAuth } from '../AuthContext';
import { font, makeStyles, radius, useTheme } from '../theme';
import { useToast } from '../Toast';
import { FadeInView, PressableScale } from './anim';
import Icon from './Icon';
import { Estrellas, SelectorEstrellas } from './Resenas';

type Opinion = { estrellas: number | null; comentario: string };

function aOpinion(o?: OpinionPedido | null): Opinion {
  return { estrellas: o?.estrellas ?? null, comentario: o?.comentario ?? '' };
}

function comentarioDe(o: Opinion) {
  return o.comentario.trim() || null;
}

/** Lo que se envía: solo lo que tiene estrellas. */
export function armarResena(tienda: Opinion, productos: Record<number, Opinion>): NuevaResena {
  const conEstrellas = Object.entries(productos).filter(([, o]) => o.estrellas !== null);
  return {
    tienda: tienda.estrellas ? { estrellas: tienda.estrellas, comentario: comentarioDe(tienda) } : undefined,
    productos: conEstrellas.length
      ? conEstrellas.map(([id, o]) => ({
          producto_id: Number(id),
          estrellas: o.estrellas!,
          comentario: comentarioDe(o),
        }))
      : undefined,
  };
}

export default function ResenarPedido({ pedido, onGuardado }: { pedido: SeguimientoPedido; onGuardado: () => void }) {
  const resenas = pedido.resenas;
  const hayEscritas = !!resenas && (!!resenas.tienda || resenas.productos.some(p => p.estrellas !== null));
  // Mientras no haya nada escrito se muestra el formulario.
  const [editando, setEditando] = useState(false);

  if (!resenas) return null;

  if (pedido.puede_resenar && (editando || !hayEscritas)) {
    return (
      <Formulario
        pedido={pedido}
        resenas={resenas}
        onGuardado={() => {
          setEditando(false);
          onGuardado();
        }}
      />
    );
  }

  return (
    <Resumen
      negocio={pedido.negocio}
      resenas={resenas}
      editable={!!pedido.puede_resenar}
      onEditar={() => setEditando(true)}
    />
  );
}

function Formulario({
  pedido,
  resenas,
  onGuardado,
}: {
  pedido: SeguimientoPedido;
  resenas: ResenasPedido;
  onGuardado: () => void;
}) {
  const { c } = useTheme();
  const styles = useStyles();
  const { auth } = useAuth();
  const toast = useToast();
  const [tienda, setTienda] = useState<Opinion>(aOpinion(resenas.tienda));
  const [productos, setProductos] = useState<Record<number, Opinion>>(() =>
    Object.fromEntries(resenas.productos.map(p => [p.producto_id, aOpinion(p)])),
  );
  const [enviando, setEnviando] = useState(false);

  const cuerpo = armarResena(tienda, productos);
  const lista = !!cuerpo.tienda || !!cuerpo.productos;

  async function enviar() {
    setEnviando(true);
    try {
      const msg = await resenarPedido(auth!.token, pedido.id, cuerpo);
      toast.exito('Reseña publicada', msg);
      onGuardado();
    } catch (e) {
      toast.error('No se pudo publicar', e instanceof Error ? e.message : 'Error');
      setEnviando(false);
    }
  }

  return (
    <FadeInView style={styles.card}>
      <View style={styles.cabecera}>
        <Icon name="estrella" size={18} color={c.accent} />
        <Text style={styles.titulo}>Cuéntale a otros clientes</Text>
      </View>
      <Text style={styles.sub}>
        Tu reseña es pública, con tu nombre y la inicial de tu apellido. Si aún no has probado algo, déjalo sin
        estrellas: tienes hasta el {resenas.hasta}.
      </Text>

      <Campo
        titulo={`La tienda · ${pedido.negocio ?? ''}`}
        placeholder="¿Cómo te atendieron? (opcional)"
        valor={tienda}
        onChange={setTienda}
      />

      {resenas.productos.map(p => (
        <Campo
          key={p.producto_id}
          titulo={p.nombre}
          imagen={p.imagen}
          placeholder="¿Qué te pareció? (opcional)"
          valor={productos[p.producto_id]}
          onChange={o => setProductos(v => ({ ...v, [p.producto_id]: o }))}
        />
      ))}

      <PressableScale style={[styles.enviar, !lista && styles.enviarOff]} onPress={enviar} disabled={!lista || enviando}>
        {enviando ? <ActivityIndicator color={c.onBrand} /> : <Text style={styles.enviarTxt}>Publicar reseña</Text>}
      </PressableScale>
    </FadeInView>
  );
}

function Campo({
  titulo,
  imagen,
  placeholder,
  valor,
  onChange,
}: {
  titulo: string;
  imagen?: string | null;
  placeholder: string;
  valor: Opinion;
  onChange: (o: Opinion) => void;
}) {
  const { c } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.campo}>
      <FilaTitulo titulo={titulo} imagen={imagen} />
      <SelectorEstrellas
        etiqueta={titulo}
        valor={valor.estrellas}
        onChange={estrellas => onChange({ ...valor, estrellas })}
      />
      {valor.estrellas !== null && (
        <TextInput
          style={styles.comentario}
          value={valor.comentario}
          onChangeText={comentario => onChange({ ...valor, comentario })}
          placeholder={placeholder}
          placeholderTextColor={c.mutedSoft}
          multiline
          maxLength={500}
        />
      )}
    </View>
  );
}

function FilaTitulo({ titulo, imagen }: { titulo: string; imagen?: string | null }) {
  const styles = useStyles();
  const uri = imagenUrl(imagen);
  return (
    <View style={styles.filaTitulo}>
      {!!uri && <Image source={{ uri }} style={styles.miniatura} />}
      <Text style={styles.campoTitulo} numberOfLines={1}>{titulo}</Text>
    </View>
  );
}

/** Lo que el cliente ya publicó. */
function Resumen({
  negocio,
  resenas,
  editable,
  onEditar,
}: {
  negocio: string | null;
  resenas: ResenasPedido;
  editable: boolean;
  onEditar: () => void;
}) {
  const { c } = useTheme();
  const styles = useStyles();
  const escritos: ResenaDeProducto[] = resenas.productos.filter(p => p.estrellas !== null);
  const pendientes = resenas.productos.length - escritos.length;

  return (
    <FadeInView style={styles.card}>
      <View style={styles.cabecera}>
        <Icon name="estrella" size={18} color={c.accent} />
        <Text style={styles.titulo}>Tu reseña</Text>
      </View>
      {!!resenas.tienda && <Publicada titulo={negocio ?? 'La tienda'} opinion={resenas.tienda} />}
      {escritos.map(p => (
        <Publicada key={p.producto_id} titulo={p.nombre} imagen={p.imagen} opinion={p} />
      ))}
      {editable && (
        <PressableScale style={styles.editar} onPress={onEditar} accessibilityRole="button">
          <Text style={styles.editarTxt}>
            {pendientes > 0 || !resenas.tienda ? 'Completar o corregir' : 'Corregir'}
          </Text>
          <Icon name="chevron" size={14} color={c.goldText} />
        </PressableScale>
      )}
    </FadeInView>
  );
}

function Publicada({ titulo, imagen, opinion }: { titulo: string; imagen?: string | null; opinion: OpinionPedido }) {
  const styles = useStyles();
  return (
    <View style={styles.campo}>
      <FilaTitulo titulo={titulo} imagen={imagen} />
      <Estrellas nota={opinion.estrellas ?? 0} size={16} />
      {!!opinion.comentario && <Text style={styles.escrito}>{opinion.comentario}</Text>}
    </View>
  );
}

const useStyles = makeStyles((c, shadow) => ({
  card: {
    backgroundColor: c.surface, borderRadius: radius.md, padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: c.accentSoft, ...shadow.soft,
  },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titulo: { fontFamily: font.bold, color: c.textStrong, fontSize: 16 },
  sub: { color: c.muted, fontSize: 13, lineHeight: 18, marginTop: 4, fontFamily: font.regular },
  campo: { marginTop: 16, gap: 8 },
  filaTitulo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  miniatura: { width: 28, height: 28, borderRadius: radius.sm, backgroundColor: c.surface2 },
  campoTitulo: { flex: 1, fontFamily: font.semibold, color: c.text },
  comentario: {
    borderWidth: 1, borderColor: c.borderStrong, borderRadius: radius.sm,
    paddingHorizontal: 12, paddingVertical: 10, minHeight: 64, textAlignVertical: 'top',
    color: c.textStrong, fontFamily: font.regular,
  },
  escrito: { color: c.text, fontSize: 14, lineHeight: 20, fontFamily: font.regular },
  enviar: {
    backgroundColor: c.brand, borderRadius: radius.sm, paddingVertical: 14,
    alignItems: 'center', marginTop: 16,
  },
  enviarOff: { opacity: 0.4 },
  enviarTxt: { color: c.onBrand, fontFamily: font.bold },
  editar: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, marginTop: 12, paddingVertical: 4 },
  editarTxt: { color: c.goldText, fontFamily: font.semibold, fontSize: 14 },
}));
