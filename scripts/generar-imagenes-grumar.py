# Genera las imágenes de prueba del negocio Grumar (latonería y ornamentación):
# productos, materiales del inventario, servicios y la fachada del negocio.
# Se dibujan aquí mismo (sin descargar nada) y quedan en
# backend/database/seeders/imagenes/grumar/, de donde las copia
# `php artisan vitrina:grumar-de-prueba`.
#
# Uso: python -I scripts/generar-imagenes-grumar.py
import math
import os
import random
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SALIDA = os.path.join(RAIZ, 'backend', 'database', 'seeders', 'imagenes', 'grumar')
FUENTES = os.path.join(RAIZ, 'backend', 'public', 'fonts')
os.makedirs(SALIDA, exist_ok=True)

S = 2  # se dibuja al doble y se reduce: bordes suaves
W, H = 1000, 800

METAL = {
    'negro': ((40, 39, 37), (78, 76, 72), (22, 21, 20)),
    'gris': ((104, 110, 116), (150, 156, 162), (70, 74, 80)),
    'blanco': ((226, 226, 222), (250, 250, 248), (176, 176, 170)),
    'cafe': ((92, 64, 44), (130, 94, 66), (60, 40, 28)),
    'verde': ((44, 70, 58), (74, 106, 90), (28, 46, 38)),
    'galvanizado': ((168, 174, 178), (206, 212, 216), (128, 134, 140)),
}
VIDRIO = (176, 208, 220)
DORADO = (199, 154, 59)


def fuente(nombre, tam):
    try:
        return ImageFont.truetype(os.path.join(FUENTES, nombre), tam * S)
    except OSError:
        return ImageFont.load_default()


# ------------------------------------------------------------------ Fondo
def lienzo(w=W, h=H, pared=((246, 241, 233), (231, 222, 209)), piso=((214, 203, 188), (198, 186, 170)), horizonte=0.78):
    img = Image.new('RGB', (w * S, h * S))
    d = ImageDraw.Draw(img)
    hz = int(h * S * horizonte)
    for y in range(hz):
        t = y / hz
        d.line([(0, y), (w * S, y)], fill=tuple(int(pared[0][i] + (pared[1][i] - pared[0][i]) * t) for i in range(3)))
    for y in range(hz, h * S):
        t = (y - hz) / max(1, h * S - hz)
        d.line([(0, y), (w * S, y)], fill=tuple(int(piso[0][i] + (piso[1][i] - piso[0][i]) * t) for i in range(3)))
    # Luz suave arriba a la izquierda.
    luz = Image.new('L', img.size, 0)
    ImageDraw.Draw(luz).ellipse([-w * S * 0.3, -h * S * 0.5, w * S * 0.7, h * S * 0.6], fill=60)
    luz = luz.filter(ImageFilter.GaussianBlur(160 * S))
    img = Image.composite(Image.new('RGB', img.size, (255, 252, 246)), img, luz)
    return img, hz


def sombra(img, caja, fuerza=110, desenfoque=28):
    x0, y0, x1, y1 = [v * S for v in caja]
    capa = Image.new('L', img.size, 0)
    ImageDraw.Draw(capa).ellipse([x0, y0, x1, y1], fill=fuerza)
    capa = capa.filter(ImageFilter.GaussianBlur(desenfoque * S))
    return Image.composite(Image.new('RGB', img.size, (60, 50, 40)), img, capa)


def guardar(img, nombre, w=W, h=H):
    img = img.resize((w, h), Image.LANCZOS)
    img.save(os.path.join(SALIDA, nombre), 'JPEG', quality=86, optimize=True, progressive=True)
    print(nombre)


# ------------------------------------------------------------- Primitivas
def R(*v):
    return [x * S for x in v]


def barra(d, x0, y0, x1, y1, color='negro'):
    """Rectángulo de metal con brillo arriba/izquierda y sombra abajo/derecha."""
    base, luz, osc = METAL[color]
    x0, x1 = min(x0, x1), max(x0, x1)
    y0, y1 = min(y0, y1), max(y0, y1)
    d.rectangle(R(x0, y0, x1, y1), fill=base)
    g = max(1, min(x1 - x0, y1 - y0) * 0.22)
    if x1 - x0 < y1 - y0:  # vertical
        d.rectangle(R(x0, y0, x0 + g, y1), fill=luz)
        d.rectangle(R(x1 - g * 0.7, y0, x1, y1), fill=osc)
    else:
        d.rectangle(R(x0, y0, x1, y0 + g), fill=luz)
        d.rectangle(R(x0, y1 - g * 0.7, x1, y1), fill=osc)


def marco(d, x0, y0, x1, y1, t, color='negro'):
    barra(d, x0, y0, x1, y0 + t, color)
    barra(d, x0, y1 - t, x1, y1, color)
    barra(d, x0, y0, x0 + t, y1, color)
    barra(d, x1 - t, y0, x1, y1, color)


def lamina(d, x0, y0, x1, y1, color='negro', paneles=None):
    base, luz, osc = METAL[color]
    d.rectangle(R(x0, y0, x1, y1), fill=base)
    if paneles:
        cols, filas = paneles
        m = 14
        aw = (x1 - x0 - m * (cols + 1)) / cols
        ah = (y1 - y0 - m * (filas + 1)) / filas
        for c in range(cols):
            for f in range(filas):
                px = x0 + m + c * (aw + m)
                py = y0 + m + f * (ah + m)
                d.rectangle(R(px, py, px + aw, py + ah), fill=osc)
                d.rectangle(R(px + 3, py + 3, px + aw, py + ah), fill=base)
                d.line(R(px + 3, py + ah, px + aw, py + ah), fill=luz, width=2 * S)
                d.line(R(px + aw, py + 3, px + aw, py + ah), fill=luz, width=2 * S)


def vidrio(img, x0, y0, x1, y1, tinte=VIDRIO):
    capa = Image.new('RGBA', img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(capa)
    d.rectangle(R(x0, y0, x1, y1), fill=tinte + (215,))
    w = x1 - x0
    for k, (a, b) in enumerate([(0.12, 0.30), (0.38, 0.46)]):
        d.polygon(R(x0 + w * a, y1, x0 + w * b, y1, x0 + w * (b + 0.45), y0, x0 + w * (a + 0.45), y0), fill=(255, 255, 255, 70 - k * 25))
    capa = capa.crop((x0 * S, y0 * S, x1 * S, y1 * S))
    img.paste(capa, (int(x0 * S), int(y0 * S)), capa)


def manija(d, x, y, vertical=True):
    if vertical:
        d.rounded_rectangle(R(x - 5, y - 34, x + 5, y + 34), radius=5 * S, fill=DORADO)
        d.rectangle(R(x - 2, y - 30, x, y + 30), fill=(232, 200, 120))
    else:
        d.rounded_rectangle(R(x - 30, y - 5, x + 30, y + 5), radius=5 * S, fill=DORADO)


def punta(d, x, y, ancho, color='negro'):
    base, luz, _ = METAL[color]
    d.polygon(R(x - ancho, y, x + ancho, y, x, y - ancho * 2.2), fill=base)
    d.line(R(x - ancho, y, x, y - ancho * 2.2), fill=luz, width=2 * S)


def voluta(d, cx, cy, r, color='negro', espejo=False):
    base, luz, _ = METAL[color]
    s = -1 if espejo else 1
    for k in range(3):
        rr = r * (1 - k * 0.3)
        caja = R(cx - rr, cy - rr, cx + rr, cy + rr)
        d.arc(caja, 200 if not espejo else -20, 470 if not espejo else 250, fill=base, width=int(5 * S))
    d.ellipse(R(cx - 5, cy - 5, cx + 5, cy + 5), fill=base)


def pie_sombra(img, x0, x1, y):
    return sombra(img, (x0 - 40, y - 18, x1 + 40, y + 22))


# -------------------------------------------------------------- Productos
def producto(nombre, dibujo, **kw):
    img, hz = lienzo()
    piso = hz / S + 8
    img = dibujo(img, piso, **kw)
    guardar(img, nombre)


def puerta_lamina(img, piso, color='negro', paneles=(2, 3)):
    x0, x1, y0 = 360, 640, piso - 560
    img = pie_sombra(img, x0, x1, piso)
    d = ImageDraw.Draw(img)
    marco(d, x0 - 22, y0 - 22, x1 + 22, piso, 22, color)
    lamina(d, x0, y0, x1, piso, color, paneles)
    manija(d, x1 - 34, y0 + 300)
    for yy in (y0 + 70, piso - 90):
        d.rectangle(R(x0 - 26, yy, x0 - 16, yy + 40), fill=DORADO)
    return img


def puerta_vidrio_reja(img, piso, color='negro'):
    x0, x1, y0 = 360, 640, piso - 560
    img = pie_sombra(img, x0, x1, piso)
    d = ImageDraw.Draw(img)
    marco(d, x0 - 22, y0 - 22, x1 + 22, piso, 22, color)
    vidrio(img, x0, y0, x1, y0 + 330)
    d = ImageDraw.Draw(img)
    for i in range(1, 7):
        xx = x0 + i * (x1 - x0) / 7
        barra(d, xx - 5, y0, xx + 5, y0 + 330, color)
    barra(d, x0, y0 + 160, x1, y0 + 172, color)
    lamina(d, x0, y0 + 330, x1, piso, color, (2, 1))
    manija(d, x1 - 34, y0 + 360)
    return img


def puerta_doble(img, piso, color='cafe'):
    x0, x1, y0 = 290, 710, piso - 560
    img = pie_sombra(img, x0, x1, piso)
    d = ImageDraw.Draw(img)
    marco(d, x0 - 22, y0 - 22, x1 + 22, piso, 22, color)
    mid = (x0 + x1) / 2
    lamina(d, x0, y0, mid - 3, piso, color, (1, 3))
    lamina(d, mid + 3, y0, x1, piso, color, (1, 3))
    d.line(R(mid, y0, mid, piso), fill=METAL[color][2], width=6 * S)
    manija(d, mid - 26, y0 + 300)
    manija(d, mid + 26, y0 + 300)
    return img


def puerta_calada(img, piso, color='negro'):
    x0, x1, y0 = 360, 640, piso - 560
    img = pie_sombra(img, x0, x1, piso)
    d = ImageDraw.Draw(img)
    marco(d, x0 - 22, y0 - 22, x1 + 22, piso, 22, color)
    lamina(d, x0, y0, x1, piso, color)
    fondo = (236, 226, 212)
    for f in range(5):
        for c in range(3):
            cx = x0 + 47 + c * 93
            cy = y0 + 60 + f * 106
            d.polygon(R(cx, cy - 34, cx + 30, cy, cx, cy + 34, cx - 30, cy), fill=fondo)
            d.polygon(R(cx, cy - 20, cx + 17, cy, cx, cy + 20, cx - 17, cy), fill=METAL[color][0])
    manija(d, x1 - 30, y0 + 300)
    return img


def porton_corredizo(img, piso, color='negro'):
    x0, x1, y0 = 120, 880, piso - 430
    img = pie_sombra(img, x0, x1, piso)
    d = ImageDraw.Draw(img)
    barra(d, x0 - 30, piso - 8, x1 + 30, piso + 2, 'gris')
    marco(d, x0, y0, x1, piso - 30, 20, color)
    barra(d, x0, y0 + 150, x1, y0 + 166, color)
    for i in range(1, 26):
        xx = x0 + i * (x1 - x0) / 26
        barra(d, xx - 5, y0 + 20, xx + 5, piso - 50, color)
        punta(d, xx, y0, 9, color)
    for xx in (x0 + 90, x1 - 90):
        d.ellipse(R(xx - 22, piso - 46, xx + 22, piso - 2), fill=METAL['gris'][0])
        d.ellipse(R(xx - 8, piso - 32, xx + 8, piso - 16), fill=METAL['gris'][1])
    return img


def porton_batiente(img, piso, color='negro'):
    x0, x1, y0 = 150, 850, piso - 470
    img = pie_sombra(img, x0, x1, piso)
    d = ImageDraw.Draw(img)
    barra(d, x0 - 40, y0 - 40, x0, piso, color)
    barra(d, x1, y0 - 40, x1 + 40, piso, color)
    mid = (x0 + x1) / 2
    for a, b in ((x0 + 8, mid - 4), (mid + 4, x1 - 8)):
        marco(d, a, y0, b, piso - 10, 18, color)
        lamina(d, a + 18, piso - 210, b - 18, piso - 28, color, (2, 1))
        barra(d, a, piso - 228, b, piso - 210, color)
        n = 9
        for i in range(1, n):
            xx = a + i * (b - a) / n
            barra(d, xx - 5, y0 + 18, xx + 5, piso - 228, color)
        voluta(d, a + (b - a) * 0.5 - 40, y0 + 80, 28, color)
        voluta(d, a + (b - a) * 0.5 + 40, y0 + 80, 28, color, True)
    manija(d, mid - 20, piso - 260)
    return img


def porton_garaje(img, piso, color='blanco'):
    x0, x1, y0 = 170, 830, piso - 480
    img = pie_sombra(img, x0, x1, piso)
    d = ImageDraw.Draw(img)
    marco(d, x0 - 24, y0 - 24, x1 + 24, piso, 24, 'gris')
    base, luz, osc = METAL[color]
    d.rectangle(R(x0, y0, x1, piso), fill=base)
    n = 12
    for i in range(n):
        yy = y0 + i * (piso - y0) / n
        d.line(R(x0, yy, x1, yy), fill=osc, width=3 * S)
        d.line(R(x0, yy + 4, x1, yy + 4), fill=luz, width=2 * S)
    manija(d, (x0 + x1) / 2, piso - 40, vertical=False)
    return img


def ventana_corrediza(img, piso, color='blanco'):
    x0, x1, y0, y1 = 230, 770, piso - 520, piso - 150
    d = ImageDraw.Draw(img)
    d.rectangle(R(x0 - 50, y0 - 50, x1 + 50, y1 + 60), fill=(222, 212, 198))
    d.rectangle(R(x0 - 60, y1 + 40, x1 + 60, y1 + 62), fill=(206, 194, 178))
    marco(d, x0, y0, x1, y1, 22, color)
    mid = (x0 + x1) / 2
    vidrio(img, x0 + 22, y0 + 22, mid + 20, y1 - 22)
    vidrio(img, mid - 20, y0 + 22, x1 - 22, y1 - 22, (186, 214, 226))
    d = ImageDraw.Draw(img)
    marco(d, x0 + 22, y0 + 22, mid + 20, y1 - 22, 12, color)
    marco(d, mid - 20, y0 + 22, x1 - 22, y1 - 22, 12, color)
    manija(d, mid - 40, (y0 + y1) / 2)
    return img


def ventana_reja(img, piso, color='negro', volutas=True):
    x0, x1, y0, y1 = 260, 740, piso - 540, piso - 140
    d = ImageDraw.Draw(img)
    d.rectangle(R(x0 - 50, y0 - 50, x1 + 50, y1 + 60), fill=(222, 212, 198))
    d.rectangle(R(x0 - 60, y1 + 40, x1 + 60, y1 + 62), fill=(206, 194, 178))
    vidrio(img, x0, y0, x1, y1)
    d = ImageDraw.Draw(img)
    marco(d, x0, y0, x1, y1, 18, color)
    for i in range(1, 9):
        xx = x0 + i * (x1 - x0) / 9
        barra(d, xx - 5, y0 + 18, xx + 5, y1 - 18, color)
    barra(d, x0, y0 + 120, x1, y0 + 132, color)
    barra(d, x0, y1 - 132, x1, y1 - 120, color)
    if volutas:
        for k in range(4):
            cx = x0 + 60 + k * (x1 - x0 - 120) / 3
            voluta(d, cx, (y0 + y1) / 2, 30, color, k % 2 == 1)
    return img


def ventana_batiente(img, piso, color='negro'):
    x0, x1, y0, y1 = 280, 720, piso - 530, piso - 150
    d = ImageDraw.Draw(img)
    d.rectangle(R(x0 - 50, y0 - 50, x1 + 50, y1 + 60), fill=(222, 212, 198))
    d.rectangle(R(x0 - 60, y1 + 40, x1 + 60, y1 + 62), fill=(206, 194, 178))
    mid = (x0 + x1) / 2
    for a, b in ((x0, mid), (mid, x1)):
        vidrio(img, a, y0, b, y1)
        d = ImageDraw.Draw(img)
        marco(d, a, y0, b, y1, 16, color)
        barra(d, a, (y0 + y1) / 2 - 6, b, (y0 + y1) / 2 + 6, color)
    manija(d, mid - 22, (y0 + y1) / 2 + 40)
    manija(d, mid + 22, (y0 + y1) / 2 + 40)
    return img


def ventana_proyectante(img, piso, color='gris'):
    x0, x1, y0, y1 = 300, 700, piso - 480, piso - 210
    d = ImageDraw.Draw(img)
    d.rectangle(R(x0 - 50, y0 - 50, x1 + 50, y1 + 60), fill=(222, 212, 198))
    d.rectangle(R(x0 - 60, y1 + 40, x1 + 60, y1 + 62), fill=(206, 194, 178))
    marco(d, x0, y0, x1, y1, 18, color)
    # Hoja abierta hacia afuera (se ve más baja y ancha abajo).
    capa = Image.new('RGBA', img.size, (0, 0, 0, 0))
    dc = ImageDraw.Draw(capa)
    dc.polygon(R(x0 + 18, y0 + 18, x1 - 18, y0 + 18, x1 + 10, y1 + 10, x0 - 10, y1 + 10), fill=VIDRIO + (220,))
    img.paste(capa, (0, 0), capa)
    d = ImageDraw.Draw(img)
    base = METAL[color][0]
    d.line(R(x0 + 18, y0 + 18, x0 - 10, y1 + 10, x1 + 10, y1 + 10, x1 - 18, y0 + 18), fill=base, width=12 * S)
    d.line(R(x0 + 40, y1 - 30, x0 + 10, y1 + 6), fill=METAL['gris'][2], width=5 * S)
    d.line(R(x1 - 40, y1 - 30, x1 - 10, y1 + 6), fill=METAL['gris'][2], width=5 * S)
    return img


def reja_puerta(img, piso, color='negro'):
    x0, x1, y0 = 350, 650, piso - 570
    img = pie_sombra(img, x0, x1, piso)
    d = ImageDraw.Draw(img)
    marco(d, x0, y0, x1, piso, 20, color)
    for i in range(1, 7):
        xx = x0 + i * (x1 - x0) / 7
        barra(d, xx - 5, y0 + 20, xx + 5, piso - 20, color)
    for yy in (y0 + 140, y0 + 300, y0 + 460):
        barra(d, x0, yy, x1, yy + 12, color)
    cx, cy = (x0 + x1) / 2, y0 + 220
    d.polygon(R(cx, cy - 60, cx + 60, cy, cx, cy + 60, cx - 60, cy), outline=METAL[color][0], width=10 * S)
    manija(d, x1 - 34, y0 + 330)
    d.rectangle(R(x1 - 52, y0 + 360, x1 - 20, y0 + 400), fill=METAL['gris'][0])
    return img


def reja_plegable(img, piso, color='gris'):
    x0, x1, y0 = 240, 760, piso - 540
    img = pie_sombra(img, x0, x1, piso)
    d = ImageDraw.Draw(img)
    barra(d, x0 - 20, y0 - 20, x1 + 20, y0, color)
    barra(d, x0 - 20, piso - 14, x1 + 20, piso, color)
    n = 10
    base = METAL[color][0]
    for i in range(n + 1):
        xx = x0 + i * (x1 - x0) / n
        barra(d, xx - 6, y0, xx + 6, piso - 14, color)
    for i in range(n):
        a = x0 + i * (x1 - x0) / n
        b = x0 + (i + 1) * (x1 - x0) / n
        for k in range(4):
            ya = y0 + k * (piso - y0) / 4
            yb = y0 + (k + 1) * (piso - y0) / 4
            d.line(R(a, ya, b, yb), fill=base, width=6 * S)
            d.line(R(a, yb, b, ya), fill=base, width=6 * S)
    return img


def baranda(img, piso, color='negro'):
    x0, x1 = 140, 860
    y0, y1 = piso - 160, piso - 470  # sube hacia la derecha
    d = ImageDraw.Draw(img)
    # Escalones de fondo.
    n = 8
    for i in range(n):
        a = x0 + i * (x1 - x0) / n
        top = piso - (i + 1) * (piso - (y1 + 80)) / n
        d.rectangle(R(a, top, a + (x1 - x0) / n + 2, piso), fill=(208, 196, 180) if i % 2 else (214, 202, 186))
        d.line(R(a, top, a + (x1 - x0) / n, top), fill=(240, 232, 220), width=3 * S)
    base = METAL[color][0]
    d.line(R(x0, y0 - 120, x1, y1 - 120), fill=base, width=16 * S)
    d.line(R(x0, y0 - 128, x1, y1 - 128), fill=METAL[color][1], width=4 * S)
    for i in range(0, 17):
        t = i / 16
        xx = x0 + t * (x1 - x0)
        top = y0 - 120 + t * (y1 - y0)
        bot = piso - (min(n - 1, int(t * n)) + 1) * (piso - (y1 + 80)) / n
        grosor = 9 if i % 4 == 0 else 5
        barra(d, xx - grosor, top, xx + grosor, bot, color)
    return img


def escalera_recta(img, piso, color='negro'):
    img = pie_sombra(img, 200, 820, piso)
    d = ImageDraw.Draw(img)
    n = 9
    x0, y0, x1, y1 = 230, piso, 790, piso - 420
    base = METAL[color][0]
    d.line(R(x0, y0, x1, y1), fill=base, width=22 * S)
    d.line(R(x0 + 60, y0, x1 + 60, y1), fill=METAL[color][2], width=22 * S)
    for i in range(1, n):
        t = i / n
        xx = x0 + t * (x1 - x0)
        yy = y0 + t * (y1 - y0)
        d.rectangle(R(xx - 30, yy - 10, xx + 100, yy + 6), fill=(150, 112, 78))
        d.line(R(xx - 30, yy - 10, xx + 100, yy - 10), fill=(186, 146, 106), width=3 * S)
    d.line(R(x0 + 20, y0 - 220, x1 + 20, y1 - 220), fill=base, width=12 * S)
    for i in range(0, n + 1, 2):
        t = i / n
        xx = x0 + 20 + t * (x1 - x0)
        yy = y0 + t * (y1 - y0)
        barra(d, xx - 5, yy - 220, xx + 5, yy - 10, color)
    return img


def escalera_caracol(img, piso, color='negro'):
    cx = 500
    img = pie_sombra(img, 300, 700, piso)
    d = ImageDraw.Draw(img)
    top = piso - 580
    barra(d, cx - 12, top, cx + 12, piso, color)
    n = 11
    for i in range(n):
        ang = i * 0.75
        y = piso - 40 - i * (piso - top - 60) / n
        dx = math.cos(ang) * 200
        dy = math.sin(ang) * 40
        col = (156, 118, 82) if math.sin(ang) > 0 else (130, 96, 66)
        d.polygon(R(cx, y, cx + dx, y + dy - 12, cx + math.cos(ang + 0.6) * 200, y + math.sin(ang + 0.6) * 40 - 12), fill=col)
        barra(d, cx + dx - 4, y + dy - 120, cx + dx + 4, y + dy - 10, color)
    pts = []
    for i in range(n * 4):
        ang = i * 0.75 / 4
        y = piso - 40 - (i / 4) * (piso - top - 60) / n
        pts += [cx + math.cos(ang) * 200, y + math.sin(ang) * 40 - 120]
    d.line(R(*pts), fill=METAL[color][0], width=10 * S)
    return img


def cerramiento(img, piso, color='verde'):
    x0, x1, y0 = 100, 900, piso - 420
    img = pie_sombra(img, x0, x1, piso)
    # Malla en una capa recortada al marco.
    malla = Image.new('RGBA', img.size, (0, 0, 0, 0))
    dm = ImageDraw.Draw(malla)
    base = METAL['galvanizado'][2] + (255,)
    paso = 34
    for k in range(-20, 40):
        a = x0 + k * paso
        dm.line(R(a, y0, a + (piso - y0), piso), fill=base, width=2 * S)
        dm.line(R(a, piso, a + (piso - y0), y0), fill=base, width=2 * S)
    malla = malla.crop((x0 * S, y0 * S, x1 * S, piso * S))
    img.paste(malla, (int(x0 * S), int(y0 * S)), malla)
    d = ImageDraw.Draw(img)
    for xx in (x0, x0 + 400, x1):
        barra(d, xx - 14, y0 - 30, xx + 14, piso, color)
    barra(d, x0, y0, x1, y0 + 14, color)
    barra(d, x0, piso - 40, x1, piso - 26, color)
    return img


def marquesina(img, piso, color='negro'):
    img = pie_sombra(img, 160, 840, piso)
    d = ImageDraw.Draw(img)
    for xx in (220, 780):
        barra(d, xx - 14, piso - 400, xx + 14, piso, color)
    capa = Image.new('RGBA', img.size, (0, 0, 0, 0))
    dc = ImageDraw.Draw(capa)
    dc.polygon(R(150, piso - 470, 850, piso - 470, 880, piso - 390, 120, piso - 390), fill=(214, 232, 240, 190))
    img.paste(capa, (0, 0), capa)
    d = ImageDraw.Draw(img)
    for i in range(8):
        a = 150 + i * 100
        d.line(R(a, piso - 470, a - 30 + i * 8.5, piso - 390), fill=METAL[color][0], width=6 * S)
    barra(d, 120, piso - 400, 880, piso - 386, color)
    barra(d, 150, piso - 476, 850, piso - 464, color)
    for xx in (220, 780):
        d.line(R(xx, piso - 330, xx + (90 if xx < 500 else -90), piso - 396), fill=METAL[color][0], width=8 * S)
    return img


def base_tanque(img, piso, color='negro'):
    img = pie_sombra(img, 280, 720, piso)
    d = ImageDraw.Draw(img)
    for xx in (320, 680):
        barra(d, xx - 12, piso - 300, xx + 12, piso, color)
    barra(d, 300, piso - 312, 700, piso - 292, color)
    for a, b in ((332, 668), (668, 332)):
        d.line(R(a, piso - 290, b, piso - 20), fill=METAL[color][0], width=7 * S)
    barra(d, 320, piso - 150, 680, piso - 140, color)
    # Tanque.
    d.rounded_rectangle(R(340, piso - 560, 660, piso - 312), radius=40 * S, fill=(40, 46, 52))
    d.rounded_rectangle(R(360, piso - 548, 400, piso - 324), radius=20 * S, fill=(76, 84, 92))
    d.ellipse(R(450, piso - 586, 550, piso - 548), fill=(34, 38, 44))
    return img


PRODUCTOS = [
    ('producto-puerta-lamina-negra.jpg', puerta_lamina, {'color': 'negro'}),
    ('producto-puerta-lamina-cafe.jpg', puerta_lamina, {'color': 'cafe', 'paneles': (1, 4)}),
    ('producto-puerta-vidrio-reja.jpg', puerta_vidrio_reja, {}),
    ('producto-puerta-doble.jpg', puerta_doble, {}),
    ('producto-puerta-calada.jpg', puerta_calada, {}),
    ('producto-porton-corredizo.jpg', porton_corredizo, {}),
    ('producto-porton-batiente.jpg', porton_batiente, {}),
    ('producto-porton-garaje.jpg', porton_garaje, {}),
    ('producto-ventana-corrediza.jpg', ventana_corrediza, {}),
    ('producto-ventana-reja.jpg', ventana_reja, {}),
    ('producto-ventana-batiente.jpg', ventana_batiente, {}),
    ('producto-ventana-proyectante.jpg', ventana_proyectante, {}),
    ('producto-reja-ventana-blanca.jpg', ventana_reja, {'color': 'blanco', 'volutas': False}),
    ('producto-reja-puerta.jpg', reja_puerta, {}),
    ('producto-reja-plegable.jpg', reja_plegable, {}),
    ('producto-baranda.jpg', baranda, {}),
    ('producto-escalera-recta.jpg', escalera_recta, {}),
    ('producto-escalera-caracol.jpg', escalera_caracol, {}),
    ('producto-cerramiento.jpg', cerramiento, {}),
    ('producto-marquesina.jpg', marquesina, {}),
    ('producto-base-tanque.jpg', base_tanque, {}),
]


# ------------------------------------------------------------- Materiales
def fondo_material():
    return lienzo(pared=((242, 238, 232), (226, 220, 210)), piso=((206, 198, 186), (190, 180, 166)), horizonte=0.72)


def material_barras(nombre, forma='cuadrado', color='negro', n=7, grosor=52, largo=500):
    img, hz = fondo_material()
    piso = hz / S + 20
    img = sombra(img, (130, piso - 50, 880, piso + 30))
    d = ImageDraw.Draw(img)
    base, luz, osc = METAL[color]
    filas = []
    resto, fila = n, max(1, (n + 2) // 3 + 1)
    while resto > 0:
        filas.append(min(fila, resto))
        resto -= fila
        fila = max(1, fila - 1)
    y = piso
    for f, cuantos in enumerate(filas):
        y -= grosor + 4
        for i in range(cuantos):
            x = 170 + i * (grosor + 6) + f * (grosor / 2 + 3)
            # cuerpo en perspectiva
            d.polygon(R(x + grosor, y, x + grosor + largo, y - 150, x + grosor + largo, y - 150 + grosor, x + grosor, y + grosor), fill=base)
            d.line(R(x + grosor, y, x + grosor + largo, y - 150), fill=luz, width=3 * S)
            if forma == 'redondo':
                d.ellipse(R(x, y, x + grosor, y + grosor), fill=osc)
                d.ellipse(R(x + grosor * 0.2, y + grosor * 0.2, x + grosor * 0.8, y + grosor * 0.8), fill=(30, 28, 26))
            elif forma == 'angulo':
                d.polygon(R(x, y, x + grosor * 0.25, y, x + grosor * 0.25, y + grosor * 0.75, x + grosor, y + grosor * 0.75, x + grosor, y + grosor, x, y + grosor), fill=osc)
            elif forma == 'platina':
                d.rectangle(R(x, y + grosor * 0.65, x + grosor, y + grosor), fill=osc)
            elif forma == 'varilla':
                d.ellipse(R(x + grosor * 0.25, y + grosor * 0.25, x + grosor * 0.75, y + grosor * 0.75), fill=osc)
            else:
                d.rectangle(R(x, y, x + grosor, y + grosor), fill=osc)
                d.rectangle(R(x + grosor * 0.18, y + grosor * 0.18, x + grosor * 0.82, y + grosor * 0.82), fill=(30, 28, 26))
    guardar(img, nombre)


def material_laminas(nombre, color='negro', n=7):
    img, hz = fondo_material()
    piso = hz / S + 60
    img = sombra(img, (160, piso - 40, 860, piso + 30))
    d = ImageDraw.Draw(img)
    base, luz, osc = METAL[color]
    for i in range(n):
        y = piso - i * 14
        d.polygon(R(200, y, 640, y, 820, y - 150, 380, y - 150), fill=luz if i == n - 1 else base)
        d.line(R(200, y, 640, y), fill=osc, width=6 * S)
        d.line(R(640, y, 820, y - 150), fill=osc, width=4 * S)
    guardar(img, nombre)


def material_vidrio(nombre, tinte=VIDRIO):
    img, hz = fondo_material()
    piso = hz / S + 60
    img = sombra(img, (240, piso - 30, 780, piso + 30))
    for i in range(4):
        x = 290 + i * 60
        vidrio(img, x, piso - 470 + i * 10, x + 360, piso - 10, tinte)
        d = ImageDraw.Draw(img)
        d.rectangle(R(x, piso - 470 + i * 10, x + 360, piso - 10), outline=(150, 180, 192), width=3 * S)
    guardar(img, nombre)


def material_lata(nombre, color_pintura=(120, 124, 128), etiqueta='PINTURA', galon=True):
    img, hz = fondo_material()
    piso = hz / S + 60
    img = sombra(img, (330, piso - 30, 670, piso + 30))
    d = ImageDraw.Draw(img)
    x0, x1, y0 = 360, 640, piso - (380 if galon else 260)
    d.rectangle(R(x0, y0, x1, piso - 16), fill=(196, 198, 200))
    d.ellipse(R(x0, piso - 40, x1, piso), fill=(170, 172, 174))
    d.rectangle(R(x0 + 12, y0 + 10, x0 + 40, piso - 30), fill=(226, 228, 230))
    d.ellipse(R(x0, y0 - 26, x1, y0 + 26), fill=(214, 216, 218))
    d.ellipse(R(x0 + 30, y0 - 16, x1 - 30, y0 + 16), fill=(178, 180, 182))
    d.rectangle(R(x0, y0 + 80, x1, piso - 70), fill=color_pintura)
    claro = sum(color_pintura) > 600
    tam = 30 if len(etiqueta) <= 8 else 20
    d.text(R((x0 + x1) / 2, (y0 + piso) / 2), etiqueta, fill=(40, 40, 42) if claro else (255, 255, 255), font=fuente('Sora_700Bold.ttf', tam), anchor='mm')
    if galon:
        d.arc(R(x0 + 40, y0 - 150, x1 - 40, y0 + 40), 180, 360, fill=(90, 92, 94), width=6 * S)
    guardar(img, nombre)


def material_discos(nombre, color=(40, 70, 140), n=4):
    img, hz = fondo_material()
    piso = hz / S + 60
    img = sombra(img, (260, piso - 30, 760, piso + 30))
    d = ImageDraw.Draw(img)
    for i in range(n):
        cx, cy, r = 400 + i * 70, piso - 210 - (i % 2) * 20, 190
        d.ellipse(R(cx - r, cy - r, cx + r, cy + r), fill=(60, 60, 62))
        d.ellipse(R(cx - r + 14, cy - r + 14, cx + r - 14, cy + r - 14), fill=color)
        d.ellipse(R(cx - 70, cy - 70, cx + 70, cy + 70), fill=(214, 216, 218))
        d.ellipse(R(cx - 24, cy - 24, cx + 24, cy + 24), fill=(60, 60, 62))
    guardar(img, nombre)


def material_electrodos(nombre, color=(196, 82, 46), etiqueta='6013'):
    img, hz = fondo_material()
    piso = hz / S + 60
    img = sombra(img, (220, piso - 30, 800, piso + 30))
    d = ImageDraw.Draw(img)
    d.polygon(R(260, piso, 640, piso, 760, piso - 90, 380, piso - 90), fill=(160, 54, 30))
    d.rectangle(R(260, piso - 170, 640, piso), fill=color)
    d.polygon(R(640, piso - 170, 760, piso - 260, 760, piso - 90, 640, piso), fill=(150, 60, 34))
    d.text(R(450, piso - 85), etiqueta, fill=(255, 255, 255), font=fuente('Sora_700Bold.ttf', 40), anchor='mm')
    for i in range(9):
        x = 300 + i * 34
        d.line(R(x, piso - 170, x + 260, piso - 470), fill=(120, 124, 128), width=8 * S)
        d.line(R(x + 200, piso - 401, x + 260, piso - 470), fill=(70, 72, 74), width=8 * S)
    guardar(img, nombre)


def material_herraje(nombre, tipo='bisagra'):
    img, hz = fondo_material()
    piso = hz / S + 60
    img = sombra(img, (250, piso - 30, 750, piso + 30))
    d = ImageDraw.Draw(img)
    plata, luz, osc = (186, 188, 190), (226, 228, 230), (130, 132, 134)
    if tipo == 'bisagra':
        for k, x in enumerate((300, 540)):
            y = piso - 330
            d.rectangle(R(x, y, x + 70, y + 260), fill=plata)
            d.rectangle(R(x + 70, y, x + 110, y + 260), fill=osc)
            d.rectangle(R(x + 110, y, x + 180, y + 260), fill=plata)
            for yy in (y + 50, y + 130, y + 210):
                d.ellipse(R(x + 22, yy - 12, x + 46, yy + 12), fill=osc)
                d.ellipse(R(x + 134, yy - 12, x + 158, yy + 12), fill=osc)
    elif tipo == 'cerradura':
        d.rounded_rectangle(R(330, piso - 400, 640, piso - 60), radius=16 * S, fill=(70, 72, 76))
        d.rounded_rectangle(R(350, piso - 380, 620, piso - 80), radius=12 * S, fill=(96, 98, 102))
        d.ellipse(R(450, piso - 290, 520, piso - 220), fill=DORADO)
        d.rectangle(R(478, piso - 240, 492, piso - 200), fill=(60, 60, 60))
        d.rectangle(R(640, piso - 270, 720, piso - 230), fill=plata)
        d.ellipse(R(660, piso - 160, 740, piso - 80), fill=DORADO)
        d.rectangle(R(700, piso - 128, 800, piso - 112), fill=DORADO)
    elif tipo == 'rueda':
        cx, cy = 500, piso - 210
        d.ellipse(R(cx - 170, cy - 170, cx + 170, cy + 170), fill=(70, 72, 76))
        d.ellipse(R(cx - 120, cy - 120, cx + 120, cy + 120), fill=plata)
        d.ellipse(R(cx - 40, cy - 40, cx + 40, cy + 40), fill=osc)
        d.rectangle(R(cx - 200, cy - 250, cx + 200, cy - 200), fill=(90, 92, 96))
    elif tipo == 'tornillos':
        random.seed(nombre)
        for i in range(26):
            x = 260 + random.random() * 420
            y = piso - 50 - random.random() * 220
            a = random.random() * math.pi
            dx, dy = math.cos(a) * 130, math.sin(a) * 40
            d.line(R(x, y, x + dx, y + dy), fill=osc, width=16 * S)
            for k in range(1, 6):
                t = k / 6
                d.line(R(x + dx * t - 6, y + dy * t - 8, x + dx * t + 6, y + dy * t + 8), fill=plata, width=3 * S)
            d.ellipse(R(x - 24, y - 24, x + 24, y + 24), fill=plata)
            d.line(R(x - 12, y, x + 12, y), fill=osc, width=4 * S)
    guardar(img, nombre)


def material_herramienta(nombre, tipo='pulidora'):
    img, hz = fondo_material()
    piso = hz / S + 60
    img = sombra(img, (220, piso - 30, 800, piso + 30))
    d = ImageDraw.Draw(img)
    if tipo == 'pulidora':
        d.rounded_rectangle(R(260, piso - 230, 640, piso - 130), radius=50 * S, fill=(232, 178, 20))
        d.rounded_rectangle(R(280, piso - 220, 420, piso - 140), radius=40 * S, fill=(40, 40, 42))
        d.rectangle(R(640, piso - 210, 700, piso - 150), fill=(60, 62, 66))
        d.ellipse(R(640, piso - 330, 840, piso - 30), fill=(70, 72, 76))
        d.ellipse(R(660, piso - 310, 820, piso - 50), fill=(40, 70, 140))
        d.rounded_rectangle(R(520, piso - 320, 560, piso - 220), radius=12 * S, fill=(40, 40, 42))
    else:
        d.rounded_rectangle(R(280, piso - 380, 720, piso - 20), radius=24 * S, fill=(196, 40, 44))
        d.rectangle(R(320, piso - 340, 680, piso - 220), fill=(40, 40, 42))
        for i, x in enumerate((380, 500, 620)):
            d.ellipse(R(x - 34, piso - 314, x + 34, piso - 246), fill=(200, 200, 204))
            d.line(R(x, piso - 280, x + 20, piso - 304), fill=(40, 40, 42), width=5 * S)
        d.rectangle(R(320, piso - 180, 680, piso - 150), fill=(150, 30, 34))
        d.arc(R(380, piso - 470, 620, piso - 330), 180, 360, fill=(40, 40, 42), width=14 * S)
    guardar(img, nombre)


MATERIALES = [
    lambda: material_barras('material-tubo-cuadrado.jpg'),
    lambda: material_barras('material-tubo-cuadrado-galvanizado.jpg', color='galvanizado'),
    lambda: material_barras('material-tubo-rectangular.jpg', grosor=62, n=6),
    lambda: material_barras('material-tubo-redondo.jpg', forma='redondo', color='galvanizado'),
    lambda: material_barras('material-angulo.jpg', forma='angulo'),
    lambda: material_barras('material-platina.jpg', forma='platina', n=9, grosor=46),
    lambda: material_barras('material-varilla.jpg', forma='varilla', n=12, grosor=34),
    lambda: material_laminas('material-lamina-lisa.jpg'),
    lambda: material_laminas('material-lamina-galvanizada.jpg', color='galvanizado'),
    lambda: material_vidrio('material-vidrio-claro.jpg'),
    lambda: material_vidrio('material-vidrio-bronce.jpg', (196, 160, 118)),
    lambda: material_electrodos('material-soldadura-6013.jpg'),
    lambda: material_electrodos('material-soldadura-7018.jpg', (46, 98, 168), '7018'),
    lambda: material_discos('material-disco-corte.jpg'),
    lambda: material_discos('material-disco-pulir.jpg', (150, 120, 60)),
    lambda: material_lata('material-anticorrosivo.jpg', (128, 132, 136), 'ANTICORROSIVO'),
    lambda: material_lata('material-esmalte-negro.jpg', (36, 36, 38), 'ESMALTE'),
    lambda: material_lata('material-esmalte-blanco.jpg', (232, 232, 228), 'ESMALTE'),
    lambda: material_lata('material-thinner.jpg', (52, 120, 160), 'THINNER'),
    lambda: material_lata('material-masilla.jpg', (210, 170, 90), 'MASILLA', galon=False),
    lambda: material_herraje('material-bisagra.jpg', 'bisagra'),
    lambda: material_herraje('material-cerradura.jpg', 'cerradura'),
    lambda: material_herraje('material-rueda-porton.jpg', 'rueda'),
    lambda: material_herraje('material-tornillos.jpg', 'tornillos'),
    lambda: material_herramienta('material-pulidora.jpg', 'pulidora'),
    lambda: material_herramienta('material-equipo-soldar.jpg', 'soldador'),
]


# --------------------------------------------------------------- Servicios
def chispas(img, cx, cy, n=60, radio=260):
    capa = Image.new('RGBA', img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(capa)
    random.seed(cx * 7 + cy)
    for _ in range(n):
        a = random.uniform(-math.pi, 0.2)
        r = random.uniform(radio * 0.3, radio)
        x1, y1 = cx + math.cos(a) * r, cy + math.sin(a) * r * 0.8
        d.line(R(cx, cy, x1, y1), fill=(255, random.randint(150, 220), 60, random.randint(140, 255)), width=int(random.uniform(1.5, 4) * S))
    brillo = Image.new('RGBA', img.size, (0, 0, 0, 0))
    ImageDraw.Draw(brillo).ellipse(R(cx - 90, cy - 90, cx + 90, cy + 90), fill=(255, 220, 140, 200))
    brillo = brillo.filter(ImageFilter.GaussianBlur(40 * S))
    img.paste(brillo, (0, 0), brillo)
    img.paste(capa, (0, 0), capa)
    ImageDraw.Draw(img).ellipse(R(cx - 16, cy - 16, cx + 16, cy + 16), fill=(255, 250, 230))
    return img


def servicio_soldadura(nombre):
    img, hz = lienzo(pared=((52, 48, 44), (34, 31, 29)), piso=((60, 54, 48), (44, 40, 36)), horizonte=0.74)
    piso = hz / S + 40
    d = ImageDraw.Draw(img)
    barra(d, 150, piso - 120, 850, piso - 90, 'gris')
    barra(d, 480, piso - 420, 510, piso - 90, 'gris')
    img = chispas(img, 495, piso - 120)
    guardar(img, nombre)


def servicio_pintura(nombre):
    img, hz = lienzo()
    piso = hz / S + 8
    img = reja_puerta(img, piso, 'negro')
    d = ImageDraw.Draw(img)
    capa = Image.new('RGBA', img.size, (0, 0, 0, 0))
    dc = ImageDraw.Draw(capa)
    random.seed(4)
    for _ in range(500):
        x = 700 + random.gauss(0, 50)
        y = piso - 360 + random.gauss(0, 60)
        r = random.uniform(1, 4)
        dc.ellipse(R(x - r, y - r, x + r, y + r), fill=(60, 60, 64, 120))
    img.paste(capa, (0, 0), capa)
    d = ImageDraw.Draw(img)
    d.polygon(R(820, piso - 380, 900, piso - 420, 920, piso - 380, 860, piso - 340), fill=(196, 40, 44))
    d.rectangle(R(870, piso - 360, 900, piso - 250), fill=(60, 60, 64))
    guardar(img, nombre)


def servicio_medidas(nombre):
    img, hz = lienzo()
    piso = hz / S + 8
    img = ventana_corrediza(img, piso, 'blanco')
    d = ImageDraw.Draw(img)
    y = piso - 590
    d.rectangle(R(230, y, 770, y + 34), fill=(244, 200, 40))
    for i in range(0, 55):
        x = 230 + i * 10
        d.line(R(x, y, x, y + (16 if i % 5 == 0 else 8)), fill=(40, 40, 40), width=2 * S)
    d.rounded_rectangle(R(760, y - 50, 900, y + 84), radius=30 * S, fill=(244, 200, 40))
    d.ellipse(R(800, y - 10, 860, y + 50), fill=(40, 40, 40))
    d.text(R(500, y + 70), '1,20 m', fill=(40, 40, 40), font=fuente('Sora_700Bold.ttf', 30), anchor='mm')
    guardar(img, nombre)


def servicio_instalacion(nombre):
    img, hz = lienzo()
    piso = hz / S + 8
    img = puerta_vidrio_reja(img, piso)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle(R(700, piso - 300, 860, piso - 230), radius=20 * S, fill=(232, 178, 20))
    d.rectangle(R(760, piso - 240, 800, piso - 120), fill=(40, 40, 42))
    d.rectangle(R(640, piso - 278, 700, piso - 260), fill=(160, 160, 164))
    guardar(img, nombre)


def servicio_reparacion(nombre):
    img, hz = lienzo()
    piso = hz / S + 8
    img = porton_batiente(img, piso)
    img = chispas(img, 500, piso - 300, n=40, radio=180)
    guardar(img, nombre)


def servicio_portones(nombre):
    img, hz = lienzo()
    piso = hz / S + 8
    img = porton_corredizo(img, piso)
    d = ImageDraw.Draw(img)
    d.ellipse(R(150, piso - 200, 290, piso - 60), outline=(232, 178, 20), width=8 * S)
    guardar(img, nombre)


def servicio_diseno(nombre):
    img, hz = lienzo(pared=((236, 240, 244), (220, 226, 232)))
    piso = hz / S + 8
    d = ImageDraw.Draw(img)
    d.rectangle(R(200, piso - 560, 800, piso - 60), fill=(250, 251, 252))
    for i in range(0, 31):
        d.line(R(200 + i * 20, piso - 560, 200 + i * 20, piso - 60), fill=(214, 226, 238), width=1 * S)
    for i in range(0, 26):
        d.line(R(200, piso - 560 + i * 20, 800, piso - 560 + i * 20), fill=(214, 226, 238), width=1 * S)
    azul = (40, 80, 150)
    d.rectangle(R(300, piso - 480, 700, piso - 140), outline=azul, width=4 * S)
    for i in range(1, 8):
        d.line(R(300 + i * 50, piso - 480, 300 + i * 50, piso - 140), fill=azul, width=3 * S)
    for k in range(3):
        voluta(d, 380 + k * 120, piso - 310, 28, 'negro', k == 1)
    d.line(R(300, piso - 110, 700, piso - 110), fill=azul, width=2 * S)
    d.text(R(500, piso - 90), '2,40 m', fill=azul, font=fuente('Sora_700Bold.ttf', 22), anchor='mm')
    d.line(R(560, piso - 40, 860, piso - 360), fill=(232, 178, 20), width=14 * S)
    guardar(img, nombre)


SERVICIOS = [
    lambda: servicio_medidas('servicio-medidas.jpg'),
    lambda: servicio_instalacion('servicio-instalacion.jpg'),
    lambda: servicio_soldadura('servicio-soldadura.jpg'),
    lambda: servicio_pintura('servicio-pintura.jpg'),
    lambda: servicio_reparacion('servicio-reparacion.jpg'),
    lambda: servicio_portones('servicio-portones.jpg'),
    lambda: servicio_diseno('servicio-diseno.jpg'),
]


# ---------------------------------------------------------------- Fachada
def fachada(nombre='negocio-portada.jpg', w=1200, h=760):
    img, hz = lienzo(w, h, pared=((250, 214, 160), (196, 214, 232)), piso=((120, 116, 110), (96, 92, 88)), horizonte=0.80)
    piso = hz / S
    d = ImageDraw.Draw(img)
    # Edificio.
    # El título del negocio va encima, arriba a la izquierda: el letrero queda a la derecha.
    d.rectangle(R(80, 190, 1120, piso), fill=(232, 224, 212))
    d.rectangle(R(80, 190, 1120, 270), fill=(30, 29, 28))
    d.text(R(1090, 218), 'GRUMAR', fill=(232, 178, 20), font=fuente('Sora_700Bold.ttf', 34), anchor='rm')
    d.text(R(1090, 250), 'LATONERÍA Y ORNAMENTACIÓN', fill=(240, 236, 228), font=fuente('Inter-Regular.ttf', 14), anchor='rm')
    # Local con la cortina arriba y luz adentro.
    d.rectangle(R(340, 300, 860, piso), fill=(70, 56, 40))
    luz = Image.new('L', img.size, 0)
    ImageDraw.Draw(luz).rectangle(R(360, 320, 840, piso), fill=255)
    luz = luz.filter(ImageFilter.GaussianBlur(30 * S))
    img = Image.composite(Image.new('RGB', img.size, (255, 206, 130)), img, luz.point(lambda v: int(v * 0.55)))
    d = ImageDraw.Draw(img)
    for i in range(8):
        d.line(R(340, 300 + i * 6, 860, 300 + i * 6), fill=(150, 150, 150), width=2 * S)
    # Taller adentro: banco y chispas.
    barra(d, 420, piso - 120, 780, piso - 100, 'negro')
    barra(d, 440, piso - 100, 452, piso, 'negro')
    barra(d, 748, piso - 100, 760, piso, 'negro')
    img = chispas(img, 600, piso - 124, n=50, radio=160)
    d = ImageDraw.Draw(img)
    # Portones y puertas exhibidos a los lados.
    for x0 in (110, 880):
        marco(d, x0, 330, x0 + 210, piso - 6, 14, 'negro')
        for i in range(1, 8):
            xx = x0 + i * 210 / 8
            barra(d, xx - 4, 344, xx + 4, piso - 20, 'negro')
            punta(d, xx, 330, 7)
        voluta(d, x0 + 70, 420, 24)
        voluta(d, x0 + 140, 420, 24, 'negro', True)
    # Placa de la esquina.
    d.rounded_rectangle(R(930, 290, 1110, 324), radius=8 * S, fill=(30, 90, 60))
    d.text(R(1020, 307), 'Cl. 17 con Cra. 9', fill=(255, 255, 255), font=fuente('Inter-Regular.ttf', 16), anchor='mm')
    guardar(img, nombre, w, h)


def qr_de_prueba(nombre='cuenta-qr-prueba.png', modulos=29, celda=18):
    """Parece un código QR pero no lo es: solo para mostrar dónde va el de verdad."""
    random.seed('grumar-qr')
    borde = 4 * celda
    lado = modulos * celda + borde * 2
    img = Image.new('RGB', (lado, lado + 70), (255, 255, 255))
    d = ImageDraw.Draw(img)
    def cuadro(cx, cy):
        x, y = borde + cx * celda, borde + cy * celda
        d.rectangle([x, y, x + 7 * celda - 1, y + 7 * celda - 1], fill=(20, 20, 20))
        d.rectangle([x + celda, y + celda, x + 6 * celda - 1, y + 6 * celda - 1], fill=(255, 255, 255))
        d.rectangle([x + 2 * celda, y + 2 * celda, x + 5 * celda - 1, y + 5 * celda - 1], fill=(20, 20, 20))
    for f in range(modulos):
        for c in range(modulos):
            en_cuadro = (f < 8 and c < 8) or (f < 8 and c >= modulos - 8) or (f >= modulos - 8 and c < 8)
            if not en_cuadro and random.random() < 0.48:
                x, y = borde + c * celda, borde + f * celda
                d.rectangle([x, y, x + celda - 1, y + celda - 1], fill=(20, 20, 20))
    cuadro(0, 0)
    cuadro(modulos - 7, 0)
    cuadro(0, modulos - 7)
    d.text((lado / 2, lado + 28), 'QR DE PRUEBA · NO PAGAR', fill=(178, 58, 23), font=ImageFont.truetype(os.path.join(FUENTES, 'Sora_700Bold.ttf'), 30), anchor='mm')
    img.save(os.path.join(SALIDA, nombre), 'PNG', optimize=True)
    print(nombre)


if __name__ == '__main__':
    solo = sys.argv[1] if len(sys.argv) > 1 else ''
    for archivo, funcion, kw in PRODUCTOS:
        if solo in archivo:
            producto(archivo, funcion, **kw)
    if solo in 'materiales' or solo.startswith('material'):
        for m in MATERIALES:
            m()
    if solo in 'servicios' or solo.startswith('servicio'):
        for s in SERVICIOS:
            s()
    if solo in 'negocio-portada':
        fachada()
    if solo in 'cuenta-qr-prueba':
        qr_de_prueba()
