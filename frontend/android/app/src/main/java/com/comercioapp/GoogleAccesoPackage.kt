package com.comercioapp

import android.os.CancellationSignal
import androidx.core.content.ContextCompat
import androidx.credentials.CredentialManager
import androidx.credentials.CredentialManagerCallback
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.GetCredentialResponse
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.NoCredentialException
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.uimanager.ViewManager
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential

/**
 * Entrar con Google en Android, con Credential Manager (la forma que Google
 * recomienda hoy; reemplaza al Google Sign-In antiguo).
 *
 * `elegirCuenta` abre la hoja de cuentas de Google del teléfono y devuelve el
 * «ID token» de la cuenta elegida, que la app manda al backend
 * (POST /api/google) para que lo verifique. `webClientId` es el ID de cliente
 * OAuth de tipo «Aplicación web» (GOOGLE_WEB_CLIENT_ID en src/config.ts).
 *
 * Errores (código de la promesa): `cancelado` (cerró la hoja), `sin_cuentas`
 * (no hay cuentas o no se pudo usar ninguna) y `error` (configuración de
 * Google Cloud incompleta, sin Play Services…: el mensaje trae el detalle).
 */
class GoogleAccesoModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "GoogleAcceso"

  @ReactMethod
  fun elegirCuenta(webClientId: String, promise: Promise) {
    val actividad = reactApplicationContext.currentActivity
    if (actividad == null) {
      promise.reject("error", "La app no está en primer plano.")
      return
    }

    val solicitud = GetCredentialRequest.Builder()
      .addCredentialOption(GetSignInWithGoogleOption.Builder(webClientId).build())
      .build()

    CredentialManager.create(actividad).getCredentialAsync(
      actividad,
      solicitud,
      CancellationSignal(),
      ContextCompat.getMainExecutor(actividad),
      object : CredentialManagerCallback<GetCredentialResponse, GetCredentialException> {
        override fun onResult(result: GetCredentialResponse) {
          val credencial = result.credential
          if (credencial !is CustomCredential ||
            credencial.type != GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL
          ) {
            promise.reject("error", "Google devolvió una respuesta inesperada (${credencial.type}).")
            return
          }
          try {
            promise.resolve(GoogleIdTokenCredential.createFrom(credencial.data).idToken)
          } catch (e: Exception) {
            promise.reject("error", e.message ?: "No se pudo leer la respuesta de Google.", e)
          }
        }

        override fun onError(e: GetCredentialException) {
          when (e) {
            is GetCredentialCancellationException -> promise.reject("cancelado", "Se cerró la ventana de Google.")
            is NoCredentialException -> promise.reject("sin_cuentas", e.message ?: "No hay cuentas de Google disponibles.")
            else -> promise.reject("error", "${e.type}: ${e.message}", e)
          }
        }
      },
    )
  }
}

class GoogleAccesoPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> =
    listOf(GoogleAccesoModule(context))

  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
