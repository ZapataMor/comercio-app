# Copia solo imagenes publicas; no copia usuarios, pedidos ni secretos.
. "$PSScriptRoot\scripts\preproduccion-common.ps1"
Invoke-Compose exec -T app sh -c 'mkdir -p storage/app/public/negocios storage/app/public/productos storage/app/public/propiedades'
foreach ($directory in @('negocios', 'productos', 'propiedades')) {
    $sourceDir = "$Root\backend\storage\app\public\$directory"
    if (Test-Path $sourceDir) {
        Invoke-Compose cp "$sourceDir\." "app:/var/www/html/storage/app/public/$directory"
    }
}
Invoke-Compose exec -T -u root app chown -R www-data:www-data /var/www/html/storage/app/public/negocios /var/www/html/storage/app/public/productos /var/www/html/storage/app/public/propiedades

# Permite usar el seeder actualizado sin reconstruir la imagen para copiar fotos.
# Se carga desde /tmp; no se modifica el codigo del contenedor en ejecucion.
Invoke-Compose cp "$Root\backend\database\seeders\ImagenesDemoSeeder.php" app:/tmp/vitrina-imagenes-demo.php
Invoke-Compose cp "$Root\backend\database\seeders\PropiedadesDemoSeeder.php" app:/tmp/vitrina-propiedades-demo.php
$phpCode = @'
require "vendor/autoload.php";
$app = require "bootstrap/app.php";
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
if (config("app.env") !== "staging" || config("database.connections.mysql.database") !== "vitrina_staging") {
    throw new RuntimeException("Solo se pueden preparar fotos demo en vitrina_staging/staging.");
}
require "/tmp/vitrina-imagenes-demo.php";
require "/tmp/vitrina-propiedades-demo.php";
Illuminate\Support\Facades\Artisan::call("db:seed", ["--class" => "Database\\Seeders\\ImagenesDemoSeeder", "--force" => true]);
echo Illuminate\Support\Facades\Artisan::output();
// Fotos de las casas y patios demo (storage/app/public/propiedades/tematico-*).
Illuminate\Support\Facades\Artisan::call("db:seed", ["--class" => "Database\\Seeders\\PropiedadesDemoSeeder", "--force" => true]);
echo Illuminate\Support\Facades\Artisan::output();
echo json_encode([
    "negocios_con_imagen" => App\Models\Negocio::whereNotNull("imagen")->count(),
    "productos_con_imagen" => App\Models\Producto::whereNotNull("imagen")->count(),
    "propiedades_con_fotos" => App\Models\Propiedad::get()->filter(fn ($p) => count($p->galeria ?? []) > 0)->count(),
]).PHP_EOL;
'@
("<?php`n" + $phpCode) | & $Docker @ComposeArgs exec -T -e IMAGENES_DEMO_SOLO_LOCALES=1 app php
if ($LASTEXITCODE -ne 0) { throw 'No se pudieron asignar las imagenes demo.' }
Write-Host 'Imagenes demo preparadas en Docker. Actualiza el catalogo o vuelve a abrir la app.'
