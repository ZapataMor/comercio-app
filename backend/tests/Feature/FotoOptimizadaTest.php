<?php

use App\Support\FotoOptimizada;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

// Fotos del celular: se guardan achicadas (lado mayor ≤ 1600 px) y derechas.

beforeEach(fn () => Storage::fake('public'));

/** JPEG de $ancho×$alto; con $orientacion, lleva la etiqueta EXIF como las fotos de cámara. */
function jpegDePrueba(int $ancho, int $alto, ?int $orientacion = null): UploadedFile
{
    $im = imagecreatetruecolor($ancho, $alto);
    imagefill($im, 0, 0, imagecolorallocate($im, 200, 120, 40));
    ob_start();
    imagejpeg($im, null, 95);
    $jpeg = (string) ob_get_clean();
    if ($orientacion) {
        // TIFF little endian con una sola entrada: Orientation (0x0112), SHORT, 1 valor.
        $tiff = 'II'.pack('v', 42).pack('V', 8).pack('v', 1)
            .pack('v', 0x0112).pack('v', 3).pack('V', 1).pack('v', $orientacion).pack('v', 0)
            .pack('V', 0);
        $app1 = "Exif\0\0".$tiff;
        $jpeg = "\xFF\xD8\xFF\xE1".pack('n', strlen($app1) + 2).$app1.substr($jpeg, 2);
    }
    $ruta = tempnam(sys_get_temp_dir(), 'foto').'.jpg';
    file_put_contents($ruta, $jpeg);

    return new UploadedFile($ruta, 'foto.jpg', 'image/jpeg', null, true);
}

function medidasGuardada(string $publica): array
{
    $bytes = Storage::disk('public')->get(substr($publica, strlen('/storage/')));

    return array_slice(getimagesizefromstring($bytes), 0, 2);
}

it('achica una foto grande de cámara a 1600 px de lado mayor', function () {
    $ruta = FotoOptimizada::guardar(jpegDePrueba(3200, 2400), 'propiedades');

    expect($ruta)->toStartWith('/storage/propiedades/')->toEndWith('.jpg')
        ->and(medidasGuardada($ruta))->toBe([1600, 1200]);
});

it('lee la orientación EXIF y deja la foto derecha', function () {
    $foto = jpegDePrueba(2400, 1600, 6);
    expect(FotoOptimizada::orientacion($foto->getRealPath()))->toBe(6);

    // Acostada en el archivo, de pie al verla.
    expect(medidasGuardada(FotoOptimizada::guardar($foto, 'propiedades')))->toBe([1067, 1600]);
});

it('una foto ya liviana y derecha se guarda tal cual', function () {
    $foto = jpegDePrueba(800, 600);
    $ruta = FotoOptimizada::guardar($foto, 'propiedades');

    expect(Storage::disk('public')->size(substr($ruta, strlen('/storage/'))))->toBe($foto->getSize());
});

it('un PNG grande queda en JPEG achicado', function () {
    $ruta = FotoOptimizada::guardar(UploadedFile::fake()->image('plano.png', 2400, 2400), 'propiedades');

    expect($ruta)->toEndWith('.jpg')->and(medidasGuardada($ruta))->toBe([1600, 1600]);
});

it('guarda en el disco privado y devuelve la ruta relativa', function () {
    Storage::fake('local');
    $ruta = FotoOptimizada::guardarEn(jpegDePrueba(3200, 2400), 'referencias-entrega', 'local');

    expect($ruta)->toStartWith('referencias-entrega/')->toEndWith('.jpg')
        ->and(array_slice(getimagesizefromstring(Storage::disk('local')->get($ruta)), 0, 2))->toBe([1600, 1200]);
    Storage::disk('public')->assertMissing($ruta);
});

it('lo que no sabe procesar lo guarda sin tocar', function () {
    $ruta = FotoOptimizada::guardar(UploadedFile::fake()->create('foto.webp', 50, 'image/webp'), 'propiedades');

    Storage::disk('public')->assertExists(substr($ruta, strlen('/storage/')));
});
