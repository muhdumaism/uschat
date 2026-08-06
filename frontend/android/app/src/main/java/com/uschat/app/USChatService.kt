package com.uschat.app

import android.app.*
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import okhttp3.*
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class USChatService : Service() {

    private var webSocket: WebSocket? = null
    private val client = OkHttpClient.Builder()
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .build()

    companion object {
        private const val TAG = "USChatService"
        private const val CHANNEL_ID = "USCHAT_ALERTS_CHANNEL"
        private const val NOTIFICATION_ID = 9001
        private const val ACTION_START = "com.uschat.app.START_SERVICE"
        private const val ACTION_STOP = "com.uschat.app.STOP_SERVICE"
        private const val EXTRA_TOKEN = "token"
        private const val EXTRA_URL = "socketUrl"

        fun startService(context: Context, token: String, socketUrl: String) {
            val intent = Intent(context, USChatService::class.java).apply {
                action = ACTION_START
                putExtra(EXTRA_TOKEN, token)
                putExtra(EXTRA_URL, socketUrl)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stopService(context: Context) {
            val intent = Intent(context, USChatService::class.java).apply {
                action = ACTION_STOP
            }
            context.startService(intent)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent == null) return START_STICKY

        when (intent.action) {
            ACTION_START -> {
                val token = intent.getStringExtra(EXTRA_TOKEN) ?: ""
                val socketUrl = intent.getStringExtra(EXTRA_URL) ?: ""
                
                // Show sticky foreground notification
                startForegroundNotification()

                // Connect socket
                if (token.isNotEmpty() && socketUrl.isNotEmpty()) {
                    connectWebSocket(socketUrl, token)
                }
            }
            ACTION_STOP -> {
                disconnectWebSocket()
                stopForeground(true)
                stopSelf()
            }
        }

        return START_STICKY
    }

    private fun startForegroundNotification() {
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("USChat Background Mode")
            .setContentText("Listening for secured messages and incoming calls...")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .build()

        startForeground(NOTIFICATION_ID, notification)
    }

    private fun connectWebSocket(url: String, token: String) {
        disconnectWebSocket()

        val wsUrl = if (url.startsWith("http")) {
            url.replace("http", "ws")
        } else {
            url
        }

        val request = Request.Builder()
            .url("$wsUrl?token=$token")
            .build()

        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                Log.d(TAG, "WebSocket Connected successfully.")
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                Log.d(TAG, "WebSocket Received: $text")
                try {
                    val json = JSONObject(text)
                    val type = json.optString("type")

                    if (type == "message") {
                        val senderName = json.optString("senderName", "New Message")
                        val content = json.optString("content", "Encrypted transmission")
                        showAlertNotification(senderName, content)
                    } else if (type == "incoming_call") {
                        val callerName = json.optString("callerName", "Secured Caller")
                        val callType = json.optString("callType", "AUDIO")
                        showIncomingCallNotification(callerName, callType)
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Error parsing websocket packet: ", e)
                }
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                Log.d(TAG, "WebSocket Connection closed: $reason")
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                Log.e(TAG, "WebSocket Error: ", t)
                // Auto reconnect after 5 seconds if running
                Thread {
                    try {
                        Thread.sleep(5000)
                        if (webSocket == null) {
                            connectWebSocket(url, token)
                        }
                    } catch (e: Exception) {}
                }.start()
            }
        })
    }

    private fun disconnectWebSocket() {
        webSocket?.close(1000, "Service Shutdown")
        webSocket = null
    }

    private fun showAlertNotification(title: String, text: String) {
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
        val pendingIntent = PendingIntent.getActivity(
            this, System.currentTimeMillis().toInt(), launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(text)
            .setSmallIcon(android.R.drawable.sym_action_chat)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .build()

        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(System.currentTimeMillis().toInt(), notification)
    }

    private fun showIncomingCallNotification(caller: String, type: String) {
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
            putExtra("incomingCall", true)
            putExtra("caller", caller)
            putExtra("callType", type)
        }
        val pendingIntent = PendingIntent.getActivity(
            this, 200, launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Incoming $type Call")
            .setContentText("$caller is calling you...")
            .setSmallIcon(android.R.drawable.sym_action_call)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setFullScreenIntent(pendingIntent, true)
            .setAutoCancel(true)
            .build()

        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(200, notification)
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val name = "USChat Notifications"
            val descriptionText = "Displays secured chat signals and notifications"
            val importance = NotificationManager.IMPORTANCE_HIGH
            val channel = NotificationChannel(CHANNEL_ID, name, importance).apply {
                description = descriptionText
            }
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }

    override fun onDestroy() {
        disconnectWebSocket()
        super.onDestroy()
    }
}
