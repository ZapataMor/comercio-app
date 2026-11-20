Llaves RSA **solo para pruebas** (`tests/Feature/AccesoGoogleTest.php`): firman ID tokens
falsos de Google que la prueba publica como si fueran las llaves de Google. No protegen nada ni
se usan fuera de las pruebas. Están en archivos porque PHP en Windows no siempre puede generar
llaves RSA (le falta `openssl.cnf`).
