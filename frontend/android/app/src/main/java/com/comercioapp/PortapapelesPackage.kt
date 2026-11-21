package com.comercioapp

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.uimanager.ViewManager

/**
 * Copiar texto al portapapeles (el número de Nequi o la llave del negocio,
 * para pegarlo en la app del banco). React Native ya no trae Clipboard y
 * para esto basta el ClipboardManager de Android: sin dependencias.
 */
class PortapapelesModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "Portapapeles"

  @ReactMethod
  fun copiar(texto: String, promise: Promise) {
    val portapapeles = context.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
    if (portapapeles == null) {
      promise.reject("error", "No hay portapapeles")
      return
    }
    // El ClipboardManager se usa desde el hilo principal.
    context.runOnUiQueueThread {
      try {
        portapapeles.setPrimaryClip(ClipData.newPlainText("Vitrina", texto))
        promise.resolve(null)
      } catch (e: Exception) {
        promise.reject("error", e.message, e)
      }
    }
  }
}

class PortapapelesPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> =
    listOf(PortapapelesModule(context))

  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
