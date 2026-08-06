package com.uschat.app

import android.os.Build
import android.content.Context
import android.content.Intent
import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.google.firebase.messaging.FirebaseMessaging

class USChatModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "USChatModule"
        private var pendingCallAction: Map<String, String>? = null
        private var pendingOpenChatAction: String? = null
        private var instance: USChatModule? = null

        fun handleCallAction(
            action: String,
            callId: String,
            chatId: String,
            roomName: String = "",
            callType: String = "AUDIO",
            callerName: String = ""
        ) {
            Log.d(TAG, "handleCallAction static called: action=$action, callId=$callId")
            val currentInstance = instance
            if (currentInstance != null && currentInstance.reactApplicationContext.hasActiveCatalystInstance()) {
                val params = Arguments.createMap().apply {
                    putString("action", action)
                    putString("callId", callId)
                    putString("chatId", chatId)
                    putString("roomName", roomName)
                    putString("callType", callType)
                    putString("callerName", callerName)
                }
                currentInstance.sendEvent("onCallAction", params)
            } else {
                pendingCallAction = mapOf(
                    "action" to action,
                    "callId" to callId,
                    "chatId" to chatId,
                    "roomName" to roomName,
                    "callType" to callType,
                    "callerName" to callerName
                )
            }
        }

        fun handleOpenChatAction(chatId: String) {
            Log.d(TAG, "handleOpenChatAction static called: chatId=$chatId")
            val currentInstance = instance
            if (currentInstance != null && currentInstance.reactApplicationContext.hasActiveCatalystInstance()) {
                val params = Arguments.createMap().apply {
                    putString("chatId", chatId)
                }
                currentInstance.sendEvent("onOpenChat", params)
            } else {
                pendingOpenChatAction = chatId
            }
        }
    }

    override fun getName(): String = "USChatModule"

    override fun initialize() {
        super.initialize()
        instance = this
    }

    override fun invalidate() {
        instance = null
        super.invalidate()
    }

    fun sendEvent(eventName: String, params: WritableMap?) {
        try {
            reactApplicationContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(eventName, params)
        } catch (e: Exception) {
            Log.e(TAG, "Error emitting event $eventName to JS: ", e)
        }
    }

    @ReactMethod
    fun getFcmToken(promise: Promise) {
        FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
            if (!task.isSuccessful) {
                Log.w(TAG, "Fetching FCM registration token failed", task.exception)
                promise.reject("FCM_FAILED", task.exception)
                return@addOnCompleteListener
            }
            val token = task.result
            Log.d(TAG, "FCM Token retrieved natively: $token")
            promise.resolve(token)
        }
    }

    @ReactMethod
    fun setAuthToken(token: String, apiUrl: String) {
        val sharedPrefs = reactApplicationContext.getSharedPreferences("USChatPrefs", Context.MODE_PRIVATE)
        sharedPrefs.edit().apply {
            putString("auth_token", token)
            putString("api_url", apiUrl)
            apply()
        }
        Log.d(TAG, "Auth details saved in SharedPreferences")
    }

    @ReactMethod
    fun clearAuthToken() {
        val sharedPrefs = reactApplicationContext.getSharedPreferences("USChatPrefs", Context.MODE_PRIVATE)
        sharedPrefs.edit().apply {
            remove("auth_token")
            remove("api_url")
            apply()
        }
        Log.d(TAG, "Auth details cleared from SharedPreferences")
    }

    @ReactMethod
    fun setActiveChatId(chatIdVal: Dynamic) {
        val sharedPrefs = reactApplicationContext.getSharedPreferences("USChatPrefs", Context.MODE_PRIVATE)
        val chatId = if (chatIdVal.type == ReadableType.String) chatIdVal.asString() else null
        if (chatId != null && chatId.isNotEmpty()) {
            sharedPrefs.edit().putString("active_chat_id", chatId).apply()
        } else {
            sharedPrefs.edit().remove("active_chat_id").apply()
        }
        Log.d(TAG, "Active chat ID set in SharedPreferences dynamically to: $chatId")
    }

    @ReactMethod
    fun clearChatNotifications(chatId: String) {
        try {
            val manager = reactApplicationContext.getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
            manager.cancel(chatId.hashCode())
        } catch (e: Exception) {
            Log.e(TAG, "Error clearing notifications for chat $chatId", e)
        }
    }

    @ReactMethod
    fun setBoolPreference(key: String, value: Boolean) {
        val sharedPrefs = reactApplicationContext.getSharedPreferences("USChatPrefs", Context.MODE_PRIVATE)
        sharedPrefs.edit().putBoolean(key, value).apply()
        Log.d(TAG, "SharedPreferences set preference: $key = $value")
    }

    @ReactMethod
    fun getBoolPreference(key: String, defaultValue: Boolean, promise: Promise) {
        val sharedPrefs = reactApplicationContext.getSharedPreferences("USChatPrefs", Context.MODE_PRIVATE)
        promise.resolve(sharedPrefs.getBoolean(key, defaultValue))
    }

    @ReactMethod
    fun setSecureWindow(secure: Boolean) {
        val activity = currentActivity
        if (activity != null) {
            activity.runOnUiThread {
                if (secure) {
                    activity.window.addFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE)
                    Log.d(TAG, "FLAG_SECURE added to current window")
                } else {
                    activity.window.clearFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE)
                    Log.d(TAG, "FLAG_SECURE cleared from current window")
                }
            }
        }
    }

    @ReactMethod
    fun getInitialCallAction(promise: Promise) {
        val action = pendingCallAction
        if (action != null) {
            val params = Arguments.createMap().apply {
                action.forEach { (key, value) -> putString(key, value) }
            }
            pendingCallAction = null
            Log.d(TAG, "Returning initial call action to JS")
            promise.resolve(params)
        } else {
            promise.resolve(null)
        }
    }

    @ReactMethod
    fun getInitialOpenChatAction(promise: Promise) {
        val chatId = pendingOpenChatAction
        if (chatId != null) {
            pendingOpenChatAction = null
            Log.d(TAG, "Returning initial open chat action to JS: $chatId")
            promise.resolve(chatId)
        } else {
            promise.resolve(null)
        }
    }

    @ReactMethod
    fun installApk(filePath: String, expectedSha256: String, promise: Promise) {
        val context = reactApplicationContext
        val file = java.io.File(filePath)
        if (!file.exists()) {
            promise.reject("FILE_NOT_FOUND", "APK file does not exist at path: $filePath")
            return
        }

        try {
            // 1. Verify SHA-256 Checksum natively
            if (expectedSha256.isNotEmpty()) {
                val computedHash = getFileSha256(file)
                if (!computedHash.equals(expectedSha256, ignoreCase = true)) {
                    Log.w(TAG, "SHA-256 mismatch! Computed: $computedHash, Expected: $expectedSha256")
                    promise.reject("CHECKSUM_MISMATCH", "APK checksum verification failed. The downloaded file might be corrupted.")
                    return
                }
                Log.d(TAG, "SHA-256 checksum matched successfully: $computedHash")
            }

            // 2. Unknown Sources Permission check for Android Oreo (8.0) and above
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                if (!context.packageManager.canRequestPackageInstalls()) {
                    Log.d(TAG, "REQUEST_INSTALL_PACKAGES permission not allowed. Redirecting to settings...")
                    val intent = Intent(android.provider.Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES).apply {
                        data = android.net.Uri.parse("package:${context.packageName}")
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    }
                    context.startActivity(intent)
                    promise.reject("PERMISSION_DENIED", "Permission to install unknown sources is required. Settings screen opened.")
                    return
                }
            }

            // 3. Verify APK Package Integrity, Package Name & Version Code
            val packageInfo = context.packageManager.getPackageArchiveInfo(filePath, 0)
            if (packageInfo == null) {
                promise.reject("INVALID_APK", "The downloaded file is corrupted or not a valid Android package archive.")
                return
            }

            if (packageInfo.packageName != context.packageName) {
                promise.reject("PACKAGE_MISMATCH", "Package name mismatch! Downloaded: ${packageInfo.packageName}, Expected: ${context.packageName}")
                return
            }

            // Determine version codes defensively
            val downloadedVersionCode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                packageInfo.longVersionCode
            } else {
                packageInfo.versionCode.toLong()
            }

            val currentVersionCode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                context.packageManager.getPackageInfo(context.packageName, 0).longVersionCode
            } else {
                context.packageManager.getPackageInfo(context.packageName, 0).versionCode.toLong()
            }

            Log.d(TAG, "APK validation: downloaded=$downloadedVersionCode, current=$currentVersionCode")
            if (downloadedVersionCode < currentVersionCode) {
                promise.reject("VERSION_DOWNGRADE", "Cannot downgrade from version $currentVersionCode to $downloadedVersionCode.")
                return
            }

            // 4. Trigger standard Package Installer intent
            val authority = "${context.packageName}.provider"
            val apkUri = androidx.core.content.FileProvider.getUriForFile(context, authority, file)
            
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(apkUri, "application/vnd.android.package-archive")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_GRANT_READ_URI_PERMISSION
            }
            context.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Error launching package installer", e)
            promise.reject("INSTALL_FAILED", e.message)
        }
    }

    private fun getFileSha256(file: java.io.File): String {
        val digest = java.security.MessageDigest.getInstance("SHA-256")
        val fis = java.io.FileInputStream(file)
        val buffer = ByteArray(8192)
        var bytesRead = fis.read(buffer)
        while (bytesRead != -1) {
            digest.update(buffer, 0, bytesRead)
            bytesRead = fis.read(buffer)
        }
        fis.close()
        val hashBytes = digest.digest()
        val sb = java.lang.StringBuilder()
        for (b in hashBytes) {
            sb.append(String.format("%02x", b))
        }
        return sb.toString()
    }

    // Required for React Native NativeEventEmitter (0.71+)
    @ReactMethod
    fun addListener(eventName: String) {
        Log.d(TAG, "Listener added for event: $eventName")
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        Log.d(TAG, "Removed $count listeners")
    }

    // Keep compatibility for any legacy code checks
    @ReactMethod
    fun startService(token: String, socketUrl: String) {
        Log.d(TAG, "Legacy startService called. Ignored since FCM is the notification handler.")
    }

    @ReactMethod
    fun stopService() {
        Log.d(TAG, "Legacy stopService called. Ignored since FCM is the notification handler.")
    }
}
