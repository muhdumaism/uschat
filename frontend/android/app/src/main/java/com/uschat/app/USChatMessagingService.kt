package com.uschat.app

import android.app.ActivityManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject

class USChatMessagingService : FirebaseMessagingService() {

    companion object {
        private const val TAG = "USChatMessagingService"
        const val CHANNEL_CUSTOM = "messages_custom"
        const val CHANNEL_DEFAULT = "messages_default"
        const val CHANNEL_SILENT = "messages_silent"
        const val GROUP_KEY_MESSAGES = "com.uschat.app.MESSAGES"
    }

    override fun onNewToken(token: String) {
        Log.d(TAG, "[USChatMessagingService] onNewToken generated: $token")
        val sharedPrefs = getSharedPreferences("USChatPrefs", Context.MODE_PRIVATE)
        sharedPrefs.edit().putString("fcm_token", token).apply()

        // Upload refreshed token to backend
        val authToken = sharedPrefs.getString("auth_token", null)
        val apiUrl = sharedPrefs.getString("api_url", null)
        if (authToken != null && apiUrl != null) {
            Log.d(TAG, "[USChatMessagingService] Uploading refreshed FCM token to backend...")
            Thread {
                try {
                    val client = okhttp3.OkHttpClient.Builder()
                        .connectTimeout(10, java.util.concurrent.TimeUnit.SECONDS)
                        .writeTimeout(10, java.util.concurrent.TimeUnit.SECONDS)
                        .readTimeout(10, java.util.concurrent.TimeUnit.SECONDS)
                        .build()

                    val mediaType = "application/json".toMediaType()
                    val body = JSONObject().apply {
                        put("token", token)
                        put("platform", "android")
                        put("deviceId", "android-${android.os.Build.VERSION.SDK_INT}")
                    }.toString().toRequestBody(mediaType)

                    val request = okhttp3.Request.Builder()
                        .url("$apiUrl/notifications/register-token")
                        .post(body)
                        .addHeader("Authorization", "Bearer $authToken")
                        .build()

                    val response = client.newCall(request).execute()
                    Log.d(TAG, "[USChatMessagingService] Token upload response: ${response.code}")
                    response.close()
                } catch (e: Exception) {
                    Log.e(TAG, "[USChatMessagingService] Failed to upload refreshed FCM token", e)
                }
            }.start()
        } else {
            Log.w(TAG, "[USChatMessagingService] Cannot upload token: auth credentials not yet stored")
        }
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        Log.d(TAG, "[USChatMessagingService] FCM Notification received from: ${remoteMessage.from}")
        Log.d(TAG, "[USChatMessagingService] Payload data map: ${remoteMessage.data}")

        val data = remoteMessage.data
        if (data.isEmpty()) {
            Log.d(TAG, "[USChatMessagingService] Received empty data payload. Skipping.")
            return
        }

        val type = data["type"] ?: return
        if (type == "message") {
            val chatId = data["chatId"] ?: return
            val senderId = data["senderId"] ?: return
            val senderName = data["title"] ?: "New Message"
            val messageText = data["body"] ?: ""

            // Active chat suppression check (only suppress if app is actively in the foreground)
            if (isAppInForeground()) {
                val sharedPrefs = getSharedPreferences("USChatPrefs", Context.MODE_PRIVATE)
                val activeChatId = sharedPrefs.getString("active_chat_id", null)
                if (activeChatId == chatId) {
                    Log.d(TAG, "[USChatMessagingService] User is actively viewing chat $chatId in foreground. Suppressing message notification.")
                    return
                }
            }

            Log.d(TAG, "[USChatMessagingService] Showing message notification for Chat: $chatId, Sender: $senderName")
            showMessageNotification(chatId, senderId, senderName, messageText)
        }
    }

    private fun showMessageNotification(chatId: String, senderId: String, senderName: String, messageText: String) {
        createNotificationChannels()

        val sharedPrefs = getSharedPreferences("USChatPrefs", Context.MODE_PRIVATE)
        val soundEnabled = sharedPrefs.getBoolean("sound_enabled", true)
        val vibrationEnabled = sharedPrefs.getBoolean("vibration_enabled", true)
        val useCustomSound = sharedPrefs.getBoolean("custom_sound_enabled", true)
        val isMuted = sharedPrefs.getBoolean("mute_chat_$chatId", false)

        val channelId = when {
            isMuted || !soundEnabled -> CHANNEL_SILENT
            useCustomSound -> CHANNEL_CUSTOM
            else -> CHANNEL_DEFAULT
        }

        val notificationId = chatId.hashCode()

        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("chatId", chatId)
            putExtra("action", "open_chat")
        }
        val pendingIntent = PendingIntent.getActivity(
            this, notificationId, launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
        )

        val soundId = resources.getIdentifier("notification_message", "raw", packageName)
        val soundUri = if (soundId != 0 && useCustomSound && soundEnabled && !isMuted) {
            android.net.Uri.parse("android.resource://" + packageName + "/" + soundId)
        } else if (soundEnabled && !isMuted) {
            android.provider.Settings.System.DEFAULT_NOTIFICATION_URI
        } else {
            null
        }

        // Summary notification for grouping
        val summaryNotification = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(android.R.drawable.sym_action_chat)
            .setContentTitle("USChat")
            .setContentText("New messages")
            .setGroup(GROUP_KEY_MESSAGES)
            .setGroupSummary(true)
            .setAutoCancel(true)
            .apply {
                if (soundUri != null) {
                    setSound(soundUri)
                }
            }
            .build()

        val notification = NotificationCompat.Builder(this, channelId)
            .setContentTitle(senderName)
            .setContentText(messageText)
            .setSmallIcon(android.R.drawable.sym_action_chat)
            .setContentIntent(pendingIntent)
            .setPriority(if (channelId == CHANNEL_SILENT) NotificationCompat.PRIORITY_LOW else NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setGroup(GROUP_KEY_MESSAGES)
            .setAutoCancel(true)
            .apply {
                if (soundUri != null) {
                    setSound(soundUri)
                }
                if (!vibrationEnabled || isMuted) {
                    setVibrate(null)
                } else {
                    setVibrate(longArrayOf(0, 250, 250, 250))
                }
            }
            .build()

        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(notificationId, notification)
        manager.notify(999, summaryNotification)
        Log.d(TAG, "[USChatMessagingService] Message notification displayed via $channelId. ID: $notificationId")
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            
            // 1. Custom Sound Channel
            if (manager.getNotificationChannel(CHANNEL_CUSTOM) == null) {
                val channel = NotificationChannel(CHANNEL_CUSTOM, "Chat Messages (Custom Tone)", NotificationManager.IMPORTANCE_HIGH).apply {
                    description = "Plays custom USCHAT message tone"
                    enableVibration(true)
                    vibrationPattern = longArrayOf(0, 250, 250, 250)
                }
                try {
                    val soundId = resources.getIdentifier("notification_message", "raw", packageName)
                    if (soundId != 0) {
                        val soundUri = android.net.Uri.parse("android.resource://" + packageName + "/" + soundId)
                        val audioAttributes = android.media.AudioAttributes.Builder()
                            .setUsage(android.media.AudioAttributes.USAGE_NOTIFICATION_COMMUNICATION_INSTANT)
                            .setContentType(android.media.AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .build()
                        channel.setSound(soundUri, audioAttributes)
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Error setting sound for custom channel", e)
                }
                manager.createNotificationChannel(channel)
            }

            // 2. Default System Sound Channel
            if (manager.getNotificationChannel(CHANNEL_DEFAULT) == null) {
                val channel = NotificationChannel(CHANNEL_DEFAULT, "Chat Messages (System Tone)", NotificationManager.IMPORTANCE_HIGH).apply {
                    description = "Plays system default notification tone"
                    enableVibration(true)
                    vibrationPattern = longArrayOf(0, 250, 250, 250)
                }
                manager.createNotificationChannel(channel)
            }

            // 3. Silent Channel
            if (manager.getNotificationChannel(CHANNEL_SILENT) == null) {
                val channel = NotificationChannel(CHANNEL_SILENT, "Chat Messages (Silent)", NotificationManager.IMPORTANCE_LOW).apply {
                    description = "Shows chat notifications silently without sound or vibration"
                    enableVibration(false)
                    setSound(null, null)
                }
                manager.createNotificationChannel(channel)
            }
        }
    }

    private fun isAppInForeground(): Boolean {
        try {
            val activityManager = getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
            val appProcesses = activityManager.runningAppProcesses ?: return false
            val packageName = packageName
            for (appProcess in appProcesses) {
                if (appProcess.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND &&
                    appProcess.processName == packageName) {
                    return true
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error checking if app is in foreground", e)
        }
        return false
    }
}
