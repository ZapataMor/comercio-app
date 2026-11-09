<?php

require '/var/www/html/vendor/autoload.php';
$app = require '/var/www/html/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
$kernel->bootstrap();
if (config('database.connections.mysql.database') !== 'vitrina_load') {
    throw new RuntimeException('Solo se puede perfilar la BD de carga.');
}
$fixtures = json_decode(file_get_contents('/results/fixtures.json'), true, 512, JSON_THROW_ON_ERROR);
$queries = [];
Illuminate\Support\Facades\DB::listen(function ($query) use (&$queries) {
    $queries[] = ['sql' => $query->sql, 'ms' => $query->time];
});
$path = $argv[1] ?? '/api/negocios';
$request = Illuminate\Http\Request::create($path, 'GET', [], [], [], [
    'HTTP_AUTHORIZATION' => 'Bearer '.$fixtures['tokens'][999], 'HTTP_ACCEPT' => 'application/json',
]);
$response = $kernel->handle($request);
$kernel->terminate($request, $response);
$repeated = array_count_values(array_column($queries, 'sql'));
arsort($repeated);
echo json_encode([
    'path' => $path, 'status' => $response->status(), 'queries' => count($queries),
    'database_ms' => array_sum(array_column($queries, 'ms')), 'repeated_sql' => array_slice($repeated, 0, 5, true),
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE).PHP_EOL;
