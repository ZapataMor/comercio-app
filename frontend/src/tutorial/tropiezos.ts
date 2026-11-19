/**
 * Señales de que alguien no sabe cómo seguir. Cuando se juntan, se le ofrece
 * el botón «¿No sabes cómo hacer algo?».
 *
 * - Errores seguidos: dos avisos de error en poco tiempo (un formulario que no
 *   pasa, un pedido que no sale).
 * - Ir y volver: entrar tres veces a la misma pantalla en un minuto.
 * - Toques sin rumbo: muchos toques muy seguidos sin cambiar de pantalla.
 * - Quietud: un buen rato en la misma pantalla sin tocar nada.
 *
 * Cualquiera puede avisar con `avisarTropiezo` (el Toast lo hace con cada
 * error) sin depender de dónde esté el proveedor del tutorial.
 */

export type Tropiezo =
  | { tipo: 'error' }
  | { tipo: 'toque' }
  | { tipo: 'pantalla'; nombre: string };

export const REGLAS = {
  errores: { cantidad: 2, ventana: 90_000 },
  pantallas: { cantidad: 3, ventana: 60_000 },
  toques: { cantidad: 10, ventana: 6_000 },
  quietud: 60_000,
};

export class DetectorTropiezos {
  alTropezar: () => void = () => {};
  private errores: number[] = [];
  private visitas: { nombre: string; t: number }[] = [];
  private toques: number[] = [];
  private ultimaActividad: number;
  private quietudAvisada = false;
  private ahora: () => number;

  constructor(ahora: () => number = Date.now) {
    this.ahora = ahora;
    this.ultimaActividad = ahora();
  }

  registrar(t: Tropiezo) {
    const ahora = this.ahora();
    if (t.tipo === 'error') {
      this.errores = [...this.errores.filter(x => ahora - x < REGLAS.errores.ventana), ahora];
      if (this.errores.length >= REGLAS.errores.cantidad) this.tropezar();
      return;
    }
    this.ultimaActividad = ahora;
    if (t.tipo === 'pantalla') {
      this.quietudAvisada = false;
      this.toques = [];
      this.visitas = [...this.visitas.filter(v => ahora - v.t < REGLAS.pantallas.ventana), { nombre: t.nombre, t: ahora }];
      if (this.visitas.filter(v => v.nombre === t.nombre).length >= REGLAS.pantallas.cantidad) this.tropezar();
      return;
    }
    this.toques = [...this.toques.filter(x => ahora - x < REGLAS.toques.ventana), ahora];
    if (this.toques.length >= REGLAS.toques.cantidad) this.tropezar();
  }

  /** Vuelve a contar la quietud desde ahora (p. ej. al volver a la app). */
  despertar() {
    this.ultimaActividad = this.ahora();
  }

  /** Se llama cada pocos segundos: ¿lleva mucho rato sin tocar nada? */
  revisarQuietud(ahora = this.ahora()) {
    if (!this.quietudAvisada && ahora - this.ultimaActividad >= REGLAS.quietud) {
      this.quietudAvisada = true;
      this.tropezar();
    }
  }

  private tropezar() {
    this.errores = [];
    this.visitas = [];
    this.toques = [];
    this.alTropezar();
  }
}

type Oyente = (t: Tropiezo) => void;
const oyentes = new Set<Oyente>();

export function suscribirTropiezos(oyente: Oyente): () => void {
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}

export function avisarTropiezo(t: Tropiezo) {
  oyentes.forEach(o => o(t));
}
