<?php

namespace App\Support;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

/**
 * Guarda una foto subida desde el celular en un tamaño razonable para verla
 * en la app: lado mayor de hasta 1600 px, en JPEG. Una foto de cámara pesa
 * 4-8 MB y el listado la descargaría completa con datos móviles; achicada
 * queda en unos cientos de KB.
 *
 * Respeta la orientación EXIF (el celular guarda la foto acostada y anota
 * cómo girarla). Docker no trae la extensión exif, así que se lee del archivo.
 * Si algo no se puede procesar (WebP sin soporte, foto gigante), se guarda
 * tal cual: nunca se pierde la foto.
 */
class FotoOptimizada
{
    public const LADO_MAXIMO = 1600;

    private const CALIDAD = 82;


    /** Devuelve la ruta pública ("/storage/..."). */
    public static function guardar(UploadedFile $foto, string $carpeta): string
    {
        return '/storage/'.self::guardarEn($foto, $carpeta);
    }

    /**
     * Igual que guardar(), pero en el disco indicado y devolviendo la ruta
     * relativa al disco ("negocios/abc.jpg"), como la da UploadedFile::store().
     */
    public static function guardarEn(UploadedFile $foto, string $carpeta, string $disco = 'public'): string
    {
        try {
            $ruta = self::optimizar($foto, $carpeta, $disco);
            if ($ruta) {
                return $ruta;
            }
        } catch (Throwable) {
            // Se guarda la original.
        }

        return (string) $foto->store($carpeta, $disco);
    }

    private static function optimizar(UploadedFile $foto, string $carpeta, string $disco): ?string
    {
        $archivo = $foto->getRealPath();
        $info = $archivo ? @getimagesize($archivo) : false;
        if (! $info || ! function_exists('imagecreatetruecolor')) {
            return null;
        }
        [$ancho, $alto, $tipo] = $info;
        if (! in_array($tipo, [IMAGETYPE_JPEG, IMAGETYPE_PNG], true) || ! self::cabeEnMemoria($ancho * $alto)) {
            return null;
        }
        $orientacion = $tipo === IMAGETYPE_JPEG ? self::orientacion($archivo) : 1;
        // Ya liviana, derecha y del tamaño justo: no hace falta tocarla.
        if ($tipo === IMAGETYPE_JPEG && $orientacion === 1 && max($ancho, $alto) <= self::LADO_MAXIMO && $foto->getSize() <= 600 * 1024) {
            return null;
        }

        $original = $tipo === IMAGETYPE_JPEG ? @imagecreatefromjpeg($archivo) : @imagecreatefrompng($archivo);
        if (! $original) {
            return null;
        }
        $escala = min(1, self::LADO_MAXIMO / max($ancho, $alto));
        $nuevoAncho = max(1, (int) round($ancho * $escala));
        $nuevoAlto = max(1, (int) round($alto * $escala));
        $imagen = imagecreatetruecolor($nuevoAncho, $nuevoAlto);
        // Un PNG transparente queda sobre blanco (JPEG no tiene transparencia).
        imagefill($imagen, 0, 0, imagecolorallocate($imagen, 255, 255, 255));
        imagecopyresampled($imagen, $original, 0, 0, 0, 0, $nuevoAncho, $nuevoAlto, $ancho, $alto);
        imagedestroy($original);
        $imagen = self::enderezar($imagen, $orientacion);

        ob_start();
        imagejpeg($imagen, null, self::CALIDAD);
        $bytes = (string) ob_get_clean();
        imagedestroy($imagen);

        $ruta = trim($carpeta, '/').'/'.Str::random(40).'.jpg';
        if (! Storage::disk($disco)->put($ruta, $bytes)) {
            return null;
        }

        return $ruta;
    }

    /**
     * ¿Alcanza la memoria de PHP para decodificarla? GD usa unos 5 bytes por
     * píxel (más la copia achicada). Quedarse sin memoria es un error fatal
     * que no se puede atrapar: mejor guardar la original.
     */
    private static function cabeEnMemoria(int $pixeles): bool
    {
        $limite = self::bytes((string) ini_get('memory_limit'));
        if ($limite <= 0) {
            return true; // Sin límite.
        }
        $necesaria = $pixeles * 5 + self::LADO_MAXIMO ** 2 * 5 + 16 * 1024 * 1024;

        return memory_get_usage(true) + $necesaria < $limite;
    }

    private static function bytes(string $valor): int
    {
        $numero = (int) $valor;

        return match (strtolower(substr(trim($valor), -1))) {
            'g' => $numero * 1024 ** 3,
            'm' => $numero * 1024 ** 2,
            'k' => $numero * 1024,
            default => $numero,
        };
    }

    /** Gira o voltea según la etiqueta EXIF (1 = ya está derecha). */
    private static function enderezar(\GdImage $imagen, int $orientacion): \GdImage
    {
        if (in_array($orientacion, [2, 4, 5, 7], true)) {
            imageflip($imagen, $orientacion === 4 ? IMG_FLIP_VERTICAL : IMG_FLIP_HORIZONTAL);
        }
        // imagerotate gira en sentido contrario a las agujas del reloj.
        $grados = match ($orientacion) {
            3, 4 => 180,
            5, 6 => 270,
            7, 8 => 90,
            default => 0,
        };
        if ($grados) {
            $girada = imagerotate($imagen, $grados, 0);
            if ($girada) {
                imagedestroy($imagen);

                return $girada;
            }
        }

        return $imagen;
    }

    /** Etiqueta de orientación EXIF de un JPEG (0x0112), leída de sus primeros 128 KB. */
    public static function orientacion(string $archivo): int
    {
        $datos = (string) @file_get_contents($archivo, false, null, 0, 131072);
        if (! str_starts_with($datos, "\xFF\xD8")) {
            return 1;
        }
        $i = 2;
        $largo = strlen($datos);
        while ($i + 4 <= $largo && $datos[$i] === "\xFF") {
            $marcador = ord($datos[$i + 1]);
            $tamano = unpack('n', substr($datos, $i + 2, 2))[1];
            if ($marcador === 0xE1 && substr($datos, $i + 4, 6) === "Exif\0\0") {
                return self::orientacionTiff(substr($datos, $i + 10, $tamano - 8));
            }
            if ($marcador === 0xDA) {
                break; // Empiezan los datos de la imagen: no hay EXIF.
            }
            $i += 2 + $tamano;
        }

        return 1;
    }

    private static function orientacionTiff(string $tiff): int
    {
        if (strlen($tiff) < 8) {
            return 1;
        }
        $le = substr($tiff, 0, 2) === 'II';
        $u16 = fn (int $p) => unpack($le ? 'v' : 'n', substr($tiff, $p, 2))[1] ?? 0;
        $u32 = fn (int $p) => unpack($le ? 'V' : 'N', substr($tiff, $p, 4))[1] ?? 0;
        $ifd = $u32(4);
        if ($ifd + 2 > strlen($tiff)) {
            return 1;
        }
        $entradas = $u16($ifd);
        for ($n = 0; $n < $entradas; $n++) {
            $p = $ifd + 2 + $n * 12;
            if ($p + 12 > strlen($tiff)) {
                break;
            }
            if ($u16($p) === 0x0112) {
                $valor = $u16($p + 8);

                return $valor >= 1 && $valor <= 8 ? $valor : 1;
            }
        }

        return 1;
    }
}
