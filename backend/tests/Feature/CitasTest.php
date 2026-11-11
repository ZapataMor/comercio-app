<?php

use App\Models\Cita;
use App\Models\User;
use App\Notifications\CitaActualizada;
use App\Notifications\RecordatorioCita;
use App\Support\HorarioNegocio;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    Carbon::setTestNow('2026-11-09 08:00:00');
    Notification::fake();
    $this->dueno = User::factory()->create(['name' => 'Barbero']);
    $this->cliente = User::factory()->create();
    $this->negocio = $this->dueno->negocio()->create(['nombre' => 'Salón', 'horario' => [
        'lun' => ['abre' => '09:00', 'cierra' => '18:00', 'almuerzo' => ['inicio' => '12:00', 'fin' => '13:00']],
    ]]);
    $this->servicio = $this->negocio->servicios()->create(['nombre' => 'Corte', 'descripcion' => 'Corte de cabello', 'duracion_minutos' => 60]);
    $this->ruta = "/api/negocios/{$this->negocio->id}";
    $this->datos = ['servicio_id' => $this->servicio->id, 'profesional_id' => $this->dueno->id, 'fecha' => '2026-11-09', 'hora' => '14:00'];
    Sanctum::actingAs($this->cliente);
});

afterEach(fn () => Carbon::setTestNow());

it('solicita una cita, avisa al equipo y permite confirmar tras revisar la agenda presencial', function () {
    $id = $this->postJson($this->ruta.'/solicitudes-cita', $this->datos)->assertCreated()
        ->assertJsonPath('cita.estado', 'pendiente')->assertJsonPath('cita.hora_fin', '15:00')->json('cita.id');
    Notification::assertSentTo($this->dueno, CitaActualizada::class);
    $this->getJson('/api/citas')->assertOk()->assertJsonCount(1, 'citas');
    Sanctum::actingAs($this->dueno);
    $this->putJson($this->ruta.'/citas/'.$id, ['estado' => 'confirmada'])->assertOk()->assertJsonPath('cita.estado', 'confirmada');
    Notification::assertSentTo($this->cliente, CitaActualizada::class);
    $this->getJson($this->ruta.'/citas')->assertOk()->assertJsonPath('citas.0.cliente_nombre', trim($this->cliente->name.' '.$this->cliente->apellidos));
});

it('bloquea todo el intervalo pendiente y permite otra cita justo al terminar o con otro profesional', function () {
    $this->postJson($this->ruta.'/solicitudes-cita', $this->datos)->assertCreated();
    foreach (['13:30', '14:00', '14:30'] as $hora) $this->postJson($this->ruta.'/solicitudes-cita', [...$this->datos, 'hora' => $hora])->assertConflict();
    $this->postJson($this->ruta.'/solicitudes-cita', [...$this->datos, 'hora' => '15:00'])->assertCreated();
    $otro = User::factory()->create();
    $this->negocio->miembros()->attach($otro, ['rol' => 'trabajador', 'activo' => true]);
    $this->postJson($this->ruta.'/solicitudes-cita', [...$this->datos, 'profesional_id' => $otro->id])->assertCreated();
});

it('la disponibilidad oculta citas y sus datos privados y excluye almuerzo y duración que no cabe', function () {
    $this->postJson($this->ruta.'/solicitudes-cita', $this->datos)->assertCreated();
    $d = $this->getJson($this->ruta.'/disponibilidad?'.http_build_query($this->datos))->assertOk()->json();
    expect($d['horas'])->toContain('09:00', '11:00', '13:00', '15:00', '17:00')->not->toContain('11:15', '12:00', '12:45', '13:15', '14:00', '14:45', '17:15')
        ->and(array_keys($d['profesionales'][0]))->toBe(['id', 'nombre'])
        ->and($d)->not->toHaveKeys(['citas', 'cliente_nombre', 'cliente_telefono']);
});

it('registra citas presenciales confirmadas en la misma agenda', function () {
    Sanctum::actingAs($this->dueno);
    $this->postJson($this->ruta.'/citas', [...$this->datos, 'cliente_nombre' => 'Cliente presencial', 'cliente_telefono' => '3001234567'])
        ->assertCreated()->assertJsonPath('cita.estado', 'confirmada')->assertJsonPath('cita.origen', 'presencial');
    Sanctum::actingAs($this->cliente);
    $this->postJson($this->ruta.'/solicitudes-cita', $this->datos)->assertConflict();
    $this->getJson('/api/citas')->assertJsonCount(0, 'citas');
});

it('vence las solicitudes después de una hora, libera el tiempo y no permite confirmarlas', function () {
    $id = $this->postJson($this->ruta.'/solicitudes-cita', $this->datos)->assertCreated()->json('cita.id');
    Carbon::setTestNow('2026-11-09 09:00:00');
    $this->artisan('citas:vencer')->assertSuccessful();
    expect(Cita::find($id)->estado)->toBe('vencida');
    Sanctum::actingAs($this->dueno);
    $this->putJson($this->ruta.'/citas/'.$id, ['estado' => 'confirmada'])->assertConflict();
    Sanctum::actingAs($this->cliente);
    $this->postJson($this->ruta.'/solicitudes-cita', $this->datos)->assertCreated();
});

it('rechaza y cancela con motivo y libera el horario', function () {
    $id = $this->postJson($this->ruta.'/solicitudes-cita', $this->datos)->assertCreated()->json('cita.id');
    Sanctum::actingAs($this->dueno);
    $this->putJson($this->ruta.'/citas/'.$id, ['estado' => 'rechazada'])->assertUnprocessable();
    $this->putJson($this->ruta.'/citas/'.$id, ['estado' => 'rechazada', 'motivo' => 'Ya había una cita en la agenda física.'])->assertOk();
    Sanctum::actingAs($this->cliente);
    $id = $this->postJson($this->ruta.'/solicitudes-cita', $this->datos)->assertCreated()->json('cita.id');
    $this->postJson('/api/citas/'.$id.'/cancelar')->assertOk()->assertJsonPath('cita.estado', 'cancelada');
    $this->postJson($this->ruta.'/solicitudes-cita', $this->datos)->assertCreated();
});

it('autoriza por membresía y por cliente y no permite cambiar citas de otro negocio', function () {
    $id = $this->postJson($this->ruta.'/solicitudes-cita', $this->datos)->assertCreated()->json('cita.id');
    $otro = User::factory()->create();
    Sanctum::actingAs($otro);
    $this->getJson('/api/citas')->assertJsonCount(0, 'citas');
    $this->getJson($this->ruta.'/citas')->assertForbidden();
    $this->postJson($this->ruta.'/citas', [...$this->datos, 'cliente_nombre' => 'Intruso'])->assertForbidden();
    $this->putJson($this->ruta.'/citas/'.$id, ['estado' => 'confirmada'])->assertForbidden();
    $this->postJson('/api/citas/'.$id.'/cancelar')->assertNotFound();
    $ajeno = $otro->negocio()->create(['nombre' => 'Otro']);
    $this->putJson('/api/negocios/'.$ajeno->id.'/citas/'.$id, ['estado' => 'confirmada'])->assertNotFound();
    Sanctum::actingAs($this->dueno);
    $this->negocio->miembros()->updateExistingPivot($this->dueno->id, ['activo' => false]);
    $this->getJson($this->ruta.'/citas')->assertForbidden();
});

it('valida profesional, servicio, fecha, horario y duración antes de reservar', function () {
    foreach (['08:00', '11:30', '12:00', '17:30', '18:00'] as $hora) $this->postJson($this->ruta.'/solicitudes-cita', [...$this->datos, 'hora' => $hora])->assertUnprocessable();
    $this->postJson($this->ruta.'/solicitudes-cita', [...$this->datos, 'fecha' => '2026-11-08'])->assertUnprocessable();
    $this->postJson($this->ruta.'/solicitudes-cita', [...$this->datos, 'profesional_id' => $this->cliente->id])->assertUnprocessable();
    $this->postJson($this->ruta.'/solicitudes-cita', [...$this->datos, 'fecha' => 'incorrecta'])->assertUnprocessable();
    $this->servicio->update(['permite_citas' => false]);
    $this->postJson($this->ruta.'/solicitudes-cita', $this->datos)->assertNotFound();
});

it('protege a un profesional que trabaja en dos negocios del mismo cruce de horas', function () {
    $otro = $this->dueno->negocio()->create(['nombre' => 'Otra sede', 'horario' => $this->negocio->horario]);
    $servicio = $otro->servicios()->create(['nombre' => 'Corte', 'descripcion' => 'Otro corte']);
    $this->postJson($this->ruta.'/solicitudes-cita', $this->datos)->assertCreated();
    $this->postJson('/api/negocios/'.$otro->id.'/solicitudes-cita', [...$this->datos, 'servicio_id' => $servicio->id])->assertConflict();
});

it('revalida cambios de horario al confirmar y no marca atendida una cita futura', function () {
    $id = $this->postJson($this->ruta.'/solicitudes-cita', $this->datos)->assertCreated()->json('cita.id');
    Sanctum::actingAs($this->dueno);
    $h = $this->negocio->horario;
    $this->negocio->update(['horario' => null]);
    $this->putJson($this->ruta.'/citas/'.$id, ['estado' => 'confirmada'])->assertConflict();
    $this->negocio->update(['horario' => $h]);
    $this->putJson($this->ruta.'/citas/'.$id, ['estado' => 'confirmada'])->assertOk();
    $this->putJson($this->ruta.'/citas/'.$id, ['estado' => 'completada'])->assertUnprocessable();
    Carbon::setTestNow('2026-11-09 14:00:00');
    $this->postJson($this->ruta.'/citas/'.$id.'/llegada')->assertOk();
    Carbon::setTestNow('2026-11-09 15:00:00');
    $this->putJson($this->ruta.'/citas/'.$id, ['estado' => 'completada'])->assertOk();
});

it('cancela por inasistencia solo después de 15 minutos y avisa una única vez al cliente', function () {
    $id = $this->postJson($this->ruta.'/solicitudes-cita', $this->datos)->assertCreated()->json('cita.id');
    Sanctum::actingAs($this->dueno);
    $this->putJson($this->ruta.'/citas/'.$id, ['estado' => 'confirmada'])->assertOk();
    Notification::fake();
    Carbon::setTestNow('2026-11-09 14:15:00');
    $this->artisan('citas:cancelar-inasistencias')->assertSuccessful();
    expect(Cita::find($id)->estado)->toBe('confirmada');
    Notification::assertNothingSent();

    Carbon::setTestNow('2026-11-09 14:15:01');
    $this->artisan('citas:cancelar-inasistencias')->assertSuccessful();
    $this->artisan('citas:cancelar-inasistencias')->assertSuccessful();
    expect(Cita::find($id)->estado)->toBe('no_asistio')
        ->and(\App\Support\AgendaCitas::ocupadas($this->dueno->id)->exists())->toBeFalse();
    Notification::assertSentToTimes($this->cliente, CitaActualizada::class, 1);
    Notification::assertSentTo($this->cliente, CitaActualizada::class, function ($aviso) {
        $mensaje = $aviso->toFcm($this->cliente)->toArray();
        expect($mensaje['notification']['title'])->toBe('Cita cancelada: no asistió')
            ->and($mensaje['notification']['body'])->toContain('Solicita una nueva cita')
            ->and($mensaje['data']['tipo'])->toBe('cita_cliente');
        return true;
    });
    $this->postJson($this->ruta.'/citas/'.$id.'/llegada')->assertConflict();
    $this->putJson($this->ruta.'/citas/'.$id, ['estado' => 'completada'])->assertConflict();
});

it('conserva una llegada registrada en el límite y permite completar la atención', function () {
    Sanctum::actingAs($this->dueno);
    $id = $this->postJson($this->ruta.'/citas', [...$this->datos, 'cliente_nombre' => 'Presencial'])->assertCreated()->json('cita.id');
    Carbon::setTestNow('2026-11-09 14:15:00');
    $llegada = $this->postJson($this->ruta.'/citas/'.$id.'/llegada')->assertOk()->json('cita.llegada_at');
    expect($llegada)->not->toBeNull();
    Carbon::setTestNow('2026-11-09 14:15:01');
    $this->artisan('citas:cancelar-inasistencias')->assertSuccessful();
    $this->postJson($this->ruta.'/citas/'.$id.'/llegada')->assertOk()->assertJsonPath('cita.llegada_at', $llegada);
    expect(Cita::find($id)->estado)->toBe('confirmada');
    Carbon::setTestNow('2026-11-09 15:00:00');
    $this->putJson($this->ruta.'/citas/'.$id, ['estado' => 'completada'])->assertOk();
});

it('solo el equipo puede registrar llegadas de su negocio y solo para citas confirmadas', function () {
    $id = $this->postJson($this->ruta.'/solicitudes-cita', $this->datos)->assertCreated()->json('cita.id');
    $this->postJson($this->ruta.'/citas/'.$id.'/llegada')->assertForbidden();
    Sanctum::actingAs($this->dueno);
    $this->postJson($this->ruta.'/citas/'.$id.'/llegada')->assertConflict();
    $otro = $this->dueno->negocio()->create(['nombre' => 'Otro negocio']);
    $this->postJson('/api/negocios/'.$otro->id.'/citas/'.$id.'/llegada')->assertNotFound();
    $this->putJson($this->ruta.'/citas/'.$id, ['estado' => 'confirmada'])->assertOk();
    Carbon::setTestNow('2026-11-09 14:16:00');
    Sanctum::actingAs($this->cliente);
    $this->getJson('/api/citas')->assertOk()->assertJsonPath('citas.0.estado', 'no_asistio');
});

it('publica fotos, precio y duración del servicio y rechaza galerías ajenas', function () {
    Storage::fake('public');
    Sanctum::actingAs($this->dueno);
    $datos = ['nombre' => 'Uñas', 'descripcion' => 'Diseños personalizados', 'duracion_minutos' => 90, 'precio' => 40000, 'imagenes' => [UploadedFile::fake()->image('unas.jpg')]];
    $respuesta = $this->post($this->ruta.'/servicios', $datos, ['Accept' => 'application/json'])->assertCreated();
    $id = $respuesta->json('servicio.id');
    $foto = $respuesta->json('servicio.galeria.0');
    $this->getJson($this->ruta)->assertOk()->assertJsonFragment(['duracion_minutos' => 90, 'precio' => 40000]);
    $this->putJson($this->ruta.'/servicios/'.$id, ['nombre' => 'Uñas', 'descripcion' => 'Diseños', 'conservar_imagenes' => ['/storage/ajeno.jpg']])->assertUnprocessable();
    Storage::disk('public')->assertExists(substr($foto, strlen('/storage/')));
});

it('conserva citas al borrar un servicio y permite cancelar su reserva', function () {
    $id = $this->postJson($this->ruta.'/solicitudes-cita', $this->datos)->assertCreated()->json('cita.id');
    $this->servicio->delete();
    $this->getJson('/api/citas')->assertOk()->assertJsonPath('citas.0.servicio_nombre', 'Corte');
    $this->postJson('/api/citas/'.$id.'/cancelar')->assertOk();
});

it('cierra por almuerzo, muestra Almorzando y reabre al terminar sin preguntar por el cierre del día', function () {
    $n = $this->negocio;
    Carbon::setTestNow('2026-11-09 11:50:00');
    expect(HorarioNegocio::cierreSinConfirmar($n, now()))->toBeNull();
    Carbon::setTestNow('2026-11-09 12:00:00');
    expect(HorarioNegocio::aplicar($n, now()))->toBeTrue()->and($n->activo)->toBeFalse();
    $this->getJson($this->ruta)->assertJsonPath('negocio.estado_texto', 'Almorzando');
    $this->getJson($this->ruta.'/estado')->assertJsonPath('estado_texto', 'Almorzando');
    $this->getJson('/api/negocios?seccion=servicios')->assertJsonPath('negocios.0.estado_texto', 'Almorzando');
    Carbon::setTestNow('2026-11-09 13:00:00');
    expect(HorarioNegocio::aplicar($n, now()))->toBeTrue()->and($n->activo)->toBeTrue();
});

it('valida almuerzo opcional dentro de la jornada, incluidos turnos nocturnos', function () {
    Sanctum::actingAs($this->dueno);
    foreach ([['inicio' => '14:00', 'fin' => '13:00'], ['inicio' => '08:00', 'fin' => '13:00'], ['inicio' => '12:00', 'fin' => '19:00']] as $almuerzo) {
        $this->putJson($this->ruta, ['horario' => ['lun' => ['abre' => '09:00', 'cierra' => '18:00', 'almuerzo' => $almuerzo]]])->assertUnprocessable();
    }
    $this->putJson($this->ruta, ['horario' => ['lun' => ['abre' => '18:00', 'cierra' => '03:00', 'almuerzo' => ['inicio' => '23:30', 'fin' => '00:30']]]])->assertOk();
    $n = $this->negocio->fresh();
    Carbon::setTestNow('2026-11-10 00:00:00');
    HorarioNegocio::aplicar($n, now());
    expect(HorarioNegocio::almorzando($n, now()))->toBeTrue();
    $this->putJson($this->ruta, ['horario' => ['lun' => ['abre' => '09:00', 'cierra' => '18:00', 'almuerzo' => null]]])->assertOk();
});

it('solo acepta horas en intervalos de 15 minutos y alinea la disponibilidad aunque el negocio abra 07:07', function () {
    foreach (['14:07', '14:10', '14:50', '7:00'] as $hora) {
        $this->postJson($this->ruta.'/solicitudes-cita', [...$this->datos, 'hora' => $hora])->assertUnprocessable()->assertJsonValidationErrors('hora');
    }
    Sanctum::actingAs($this->dueno);
    $this->postJson($this->ruta.'/citas', [...$this->datos, 'hora' => '14:07', 'cliente_nombre' => 'Presencial'])->assertUnprocessable();
    $this->negocio->update(['horario' => ['lun' => ['abre' => '07:07', 'cierra' => '10:00']]]);
    $horas = $this->getJson($this->ruta.'/disponibilidad?'.http_build_query($this->datos))->assertOk()->json('horas');
    expect($horas)->toBe(['08:15', '08:30', '08:45', '09:00']);
    Sanctum::actingAs($this->cliente);
    $this->postJson($this->ruta.'/solicitudes-cita', [...$this->datos, 'hora' => '07:00'])->assertUnprocessable();
    $this->postJson($this->ruta.'/solicitudes-cita', [...$this->datos, 'hora' => '10:00'])->assertUnprocessable();
    $this->postJson($this->ruta.'/solicitudes-cita', [...$this->datos, 'hora' => '08:15'])->assertCreated();
});

it('limita a 3 citas vigentes por día y negocio para cada cliente', function () {
    $ids = [];
    foreach (['09:00', '10:00', '11:00'] as $hora) {
        $ids[] = $this->postJson($this->ruta.'/solicitudes-cita', [...$this->datos, 'hora' => $hora])->assertCreated()->json('cita.id');
    }
    $this->postJson($this->ruta.'/solicitudes-cita', [...$this->datos, 'hora' => '15:00'])->assertUnprocessable()->assertJsonPath('message', fn ($m) => str_contains($m, '3 citas'));
    $this->getJson($this->ruta.'/disponibilidad?'.http_build_query($this->datos))->assertJsonPath('citas_del_dia', 3)->assertJsonPath('max_citas_dia', 3);
    // Otro día y otro negocio no cuentan.
    $this->postJson($this->ruta.'/solicitudes-cita', [...$this->datos, 'fecha' => '2026-11-23'])->assertCreated();
    $otro = $this->dueno->negocio()->create(['nombre' => 'Otra sede', 'horario' => $this->negocio->horario]);
    $s = $otro->servicios()->create(['nombre' => 'Uñas', 'descripcion' => 'Uñas', 'duracion_minutos' => 30]);
    $this->postJson('/api/negocios/'.$otro->id.'/solicitudes-cita', [...$this->datos, 'servicio_id' => $s->id, 'hora' => '16:00'])->assertCreated();
    // Cancelar una libera el cupo.
    $this->postJson('/api/citas/'.$ids[0].'/cancelar')->assertOk();
    $this->postJson($this->ruta.'/solicitudes-cita', [...$this->datos, 'hora' => '15:00'])->assertCreated();
});

it('permite pedir la cita a nombre de otra persona y lo muestra al negocio', function () {
    $this->postJson($this->ruta.'/solicitudes-cita', [...$this->datos, 'a_nombre_de' => 'Ana123'])->assertUnprocessable()->assertJsonValidationErrors('a_nombre_de');
    $this->postJson($this->ruta.'/solicitudes-cita', [...$this->datos, 'a_nombre_de' => '  María   José Pérez '])->assertCreated()
        ->assertJsonPath('cita.a_nombre_de', 'María José Pérez')->assertJsonPath('cita.cliente_nombre', trim($this->cliente->name.' '.$this->cliente->apellidos));
    Notification::assertSentTo($this->dueno, CitaActualizada::class, fn ($n) => str_contains($n->toFcm($this->dueno)->notification->body, 'A nombre de María José Pérez'));
    $this->postJson($this->ruta.'/solicitudes-cita', [...$this->datos, 'hora' => '15:00', 'a_nombre_de' => trim($this->cliente->name.' '.$this->cliente->apellidos)])
        ->assertCreated()->assertJsonPath('cita.a_nombre_de', null);
});

it('recuerda la cita 1 día, 5 horas, 1 hora y 15 minutos antes, una sola vez cada uno', function () {
    $id = $this->postJson($this->ruta.'/solicitudes-cita', [...$this->datos, 'fecha' => '2026-11-23'])->assertCreated()->json('cita.id');
    Sanctum::actingAs($this->dueno);
    $this->putJson($this->ruta.'/citas/'.$id, ['estado' => 'confirmada'])->assertOk();
    foreach (['2026-11-22 13:59', '2026-11-22 14:00', '2026-11-22 14:01', '2026-11-23 09:00', '2026-11-23 12:00', '2026-11-23 13:00', '2026-11-23 13:45', '2026-11-23 13:50'] as $momento) {
        Carbon::setTestNow($momento);
        $this->artisan('citas:recordar')->assertSuccessful();
    }
    $enviados = [];
    Notification::assertSentTo($this->cliente, RecordatorioCita::class, function ($n) use (&$enviados) {
        $enviados[] = $n->minutos;

        return true;
    });
    expect($enviados)->toBe([1440, 300, 60, 15]);
});

it('omite los recordatorios que ya no tenían tiempo al confirmar y no recuerda citas canceladas', function () {
    Carbon::setTestNow('2026-11-09 11:00');
    $id = $this->postJson($this->ruta.'/solicitudes-cita', $this->datos)->assertCreated()->json('cita.id');
    Sanctum::actingAs($this->dueno);
    Carbon::setTestNow('2026-11-09 11:30');
    $this->putJson($this->ruta.'/citas/'.$id, ['estado' => 'confirmada'])->assertOk();
    foreach (['2026-11-09 11:30', '2026-11-09 13:00', '2026-11-09 13:45'] as $momento) {
        Carbon::setTestNow($momento);
        $this->artisan('citas:recordar')->assertSuccessful();
    }
    Notification::assertSentToTimes($this->cliente, RecordatorioCita::class, 2);

    Carbon::setTestNow('2026-11-09 15:00');
    Sanctum::actingAs($this->cliente);
    $otra = $this->postJson($this->ruta.'/solicitudes-cita', [...$this->datos, 'fecha' => '2026-11-23'])->assertCreated()->json('cita.id');
    Sanctum::actingAs($this->dueno);
    $this->putJson($this->ruta.'/citas/'.$otra, ['estado' => 'confirmada'])->assertOk();
    $this->putJson($this->ruta.'/citas/'.$otra, ['estado' => 'cancelada', 'motivo' => 'Cierre'])->assertOk();
    Carbon::setTestNow('2026-11-23 13:00');
    $this->artisan('citas:recordar')->assertSuccessful();
    Notification::assertSentToTimes($this->cliente, RecordatorioCita::class, 2);
});

it('reprograma una cita: vuelve a pendiente, libera el horario anterior y avisa al negocio', function () {
    $id = $this->postJson($this->ruta.'/solicitudes-cita', $this->datos)->assertCreated()->json('cita.id');
    Sanctum::actingAs($this->dueno);
    $this->putJson($this->ruta.'/citas/'.$id, ['estado' => 'confirmada'])->assertOk();
    Sanctum::actingAs($this->cliente);
    $nuevos = ['profesional_id' => $this->dueno->id, 'fecha' => '2026-11-23', 'hora' => '10:00'];
    $this->putJson('/api/citas/'.$id.'/reprogramar', [...$nuevos, 'hora' => '10:05'])->assertUnprocessable();
    $this->putJson('/api/citas/'.$id.'/reprogramar', [...$nuevos, 'hora' => '20:00'])->assertUnprocessable();
    $this->putJson('/api/citas/'.$id.'/reprogramar', [...$nuevos, 'fecha' => '2026-11-09', 'hora' => '14:00'])->assertUnprocessable();
    $this->putJson('/api/citas/'.$id.'/reprogramar', $nuevos)->assertOk()
        ->assertJsonPath('cita.estado', 'pendiente')->assertJsonPath('cita.fecha', '2026-11-23')->assertJsonPath('cita.hora', '10:00');
    Notification::assertSentTo($this->dueno, CitaActualizada::class, fn ($n) => $n->reprogramada);
    // El horario anterior quedó libre para otro cliente, que no puede tocar la cita ajena.
    Sanctum::actingAs(User::factory()->create());
    $this->postJson($this->ruta.'/solicitudes-cita', $this->datos)->assertCreated();
    $this->putJson('/api/citas/'.$id.'/reprogramar', [...$nuevos, 'hora' => '11:00'])->assertNotFound();
});

it('no permite reprogramar para superar el límite diario ni citas canceladas', function () {
    foreach (['09:00', '10:00', '11:00'] as $hora) {
        $this->postJson($this->ruta.'/solicitudes-cita', [...$this->datos, 'hora' => $hora])->assertCreated();
    }
    $id = $this->postJson($this->ruta.'/solicitudes-cita', [...$this->datos, 'fecha' => '2026-11-23'])->assertCreated()->json('cita.id');
    $this->putJson('/api/citas/'.$id.'/reprogramar', ['profesional_id' => $this->dueno->id, 'fecha' => '2026-11-09', 'hora' => '15:00'])->assertUnprocessable();
    // Moverla dentro del mismo día no cuenta dos veces.
    $this->putJson('/api/citas/'.$id.'/reprogramar', ['profesional_id' => $this->dueno->id, 'fecha' => '2026-11-23', 'hora' => '15:00'])->assertOk();
    $this->postJson('/api/citas/'.$id.'/cancelar')->assertOk();
    $this->putJson('/api/citas/'.$id.'/reprogramar', ['profesional_id' => $this->dueno->id, 'fecha' => '2026-11-23', 'hora' => '16:00'])->assertConflict();
});
