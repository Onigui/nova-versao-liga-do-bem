package com.ligadobemnovo

import android.content.Intent
import android.content.ActivityNotFoundException
import android.content.ComponentName
import android.net.Uri
import android.os.Build
import androidx.core.content.FileProvider
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import java.io.File

class ApkInstallerModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "ApkInstaller"
    }

    @ReactMethod
    fun installApk(filePath: String, promise: Promise) {
        try {
            val context = reactApplicationContext
            val currentActivity = currentActivity
            
            // Verificar se a Activity está disponível
            if (currentActivity == null) {
                promise.reject("NO_ACTIVITY", "Não foi possível obter a Activity atual. O app pode estar em background.")
                return
            }

            val file = File(filePath)

            // Verificar se o arquivo existe
            if (!file.exists()) {
                promise.reject("FILE_NOT_FOUND", "Arquivo APK não encontrado: $filePath")
                return
            }

            // Verificar se o arquivo pode ser lido
            if (!file.canRead()) {
                promise.reject("FILE_NOT_READABLE", "Não foi possível ler o arquivo APK. Verifique as permissões.")
                return
            }

            // Obter URI usando FileProvider (com tratamento de erro)
            val uri = try {
                getUriForFile(context, file)
            } catch (e: Exception) {
                promise.reject("URI_ERROR", "Erro ao criar URI para o arquivo: ${e.message}", e)
                return
            }

            // Criar Intent de instalação
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "application/vnd.android.package-archive")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                // Adicionar flag para não causar crash se não houver app
                addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
            }

            // Verificar se há algum app que pode lidar com a instalação
            val packageManager = currentActivity.packageManager
            val componentName = intent.resolveActivity(packageManager)
            if (componentName == null) {
                promise.reject("NO_INSTALLER", "Nenhum aplicativo encontrado para instalar APKs. Verifique as configurações do dispositivo.")
                return
            }

            // Garantir permissões de leitura para o pacote que vai receber o Intent
            try {
                context.grantUriPermission(
                    componentName.packageName,
                    uri,
                    Intent.FLAG_GRANT_READ_URI_PERMISSION
                )
            } catch (e: Exception) {
                // Se não conseguir conceder permissão, continuar mesmo assim
                // O FileProvider pode lidar com isso automaticamente
            }

            // Iniciar a instalação usando a Activity atual (com tratamento de erro)
            try {
                currentActivity.startActivity(intent)
                promise.resolve(true)
            } catch (e: ActivityNotFoundException) {
                promise.reject("ACTIVITY_NOT_FOUND", "Não foi possível abrir o instalador. Verifique se há um aplicativo instalador disponível.", e)
            } catch (e: Exception) {
                promise.reject("START_ACTIVITY_ERROR", "Erro ao iniciar instalação: ${e.message}", e)
            }
        } catch (e: SecurityException) {
            promise.reject("SECURITY_ERROR", "Erro de segurança ao instalar APK: ${e.message}. Verifique as permissões do app.", e)
        } catch (e: IllegalArgumentException) {
            promise.reject("INVALID_URI", "URI inválido para o arquivo APK: ${e.message}", e)
        } catch (e: Exception) {
            promise.reject("INSTALL_ERROR", "Erro ao instalar APK: ${e.message}", e)
        }
    }

    private fun getUriForFile(context: ReactApplicationContext, file: File): Uri {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            // Android 7.0+ - usar FileProvider
            val authority = "${context.packageName}.fileprovider"
            FileProvider.getUriForFile(context, authority, file)
        } else {
            // Android < 7.0 - usar file:// URI
            Uri.fromFile(file)
        }
    }
}

