package com.uschat.app

import android.app.*
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.PorterDuff
import android.graphics.PorterDuffXfermode
import android.graphics.Rect
import android.media.AudioAttributes
import android.media.Ringtone
import android.media.RingtoneManager
import android.os.*
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.Person
import androidx.core.graphics.drawable.IconCompat
import java.io.InputStream
import java.net.URL
import java.util.concurrent.TimeUnit

class USChatCallService : Service() {

    private var vibrator: Vibrator? = null
    private var ringtone: Ringtone? = null
    private var wakeLock: PowerManager.WakeLock? = null

    companion object {
        private const val TAG = "USChatCallService"
        const val CHANNEL_ID = "calls"
        private const val NOTIFICATION_ID = 2002

        const val ACTION_INCOMING_CALL = "com.uschat.app.INCOMING_CALL"
        const val ACTION_ACCEPT = "com.uschat.app.ACCEPT"
        const val ACTION_DECLINE = "com.uschat.app.DECLINE"
        const val ACTION_TIMEOUT = "com.uschat.app.TIMEOUT"

        const val EXTRA_CALL_ID = "callId"
        const val EXTRA_CHAT_ID = "chatId"
        const val EXTRA_CALLER_ID = "callerId"
        const val EXTRA_CALLER_NAME = "callerName"
        const val EXTRA_ROOM_NAME = "roomName"
        const val EXTRA_CALL_TYPE = "callType"
        const val EXTRA_AVATAR = "avatar"

        private var activeCallId: String? = null

        fun start(context: Context, intent: Intent) {
            val callId = intent.getStringExtra(EXTRA_CALL_ID) ?: return
            activeCallId = callId
            
            val serviceIntent = Intent(context, USChatCallService::class.java).apply {
                action = ACTION_INCOMING_CALL
                putExtras(intent)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent)
            } else {
                context.startService(serviceIntent)
            }
        }

        fun stop(context: Context, callId: String) {
            if (activeCallId == callId) {
                val serviceIntent = Intent(context, USChatCallService::class.java)
                context.stopService(serviceIntent)
                activeCallId = null
            }
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent == null) return START_NOT_STICKY

        when (intent.action) {
            ACTION_INCOMING_CALL -> {
                handleIncomingCall(intent)
            }
            ACTION_TIMEOUT -> {
                Log.d(TAG, "[USChatCallService] Call timed out. Dismissing UI.")
                stopSelf()
            }
            else -> stopSelf()
        }

        return START_NOT_STICKY
    }

    private fun handleIncomingCall(intent: Intent) {
        val callId = intent.getStringExtra(EXTRA_CALL_ID) ?: ""
        val chatId = intent.getStringExtra(EXTRA_CHAT_ID) ?: ""
        val callerId = intent.getStringExtra(EXTRA_CALLER_ID) ?: ""
        val callerName = intent.getStringExtra(EXTRA_CALLER_NAME) ?: "Secured Caller"
        val roomName = intent.getStringExtra(EXTRA_ROOM_NAME) ?: ""
        val callType = intent.getStringExtra(EXTRA_CALL_TYPE) ?: "AUDIO"
        val avatarUrl = intent.getStringExtra(EXTRA_AVATAR) ?: ""

        Log.d(TAG, "[USChatCallService] Displaying native call interface for caller: $callerName, Call ID: $callId")

        // Hold a WakeLock to force device screen to turn on
        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = pm.newWakeLock(
            PowerManager.SCREEN_BRIGHT_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP or PowerManager.ON_AFTER_RELEASE,
            "USChat:CallWakeLock"
        )
        wakeLock?.acquire(20000) // Wakes screen for 20 seconds maximum

        // Vibrate and Play Ringtone
        startRinging()

        // Setup pending broadcast intents for accepting/declining calls
        val acceptIntent = Intent(this, USChatCallReceiver::class.java).apply {
            action = ACTION_ACCEPT
            putExtra(EXTRA_CALL_ID, callId)
            putExtra(EXTRA_CHAT_ID, chatId)
            putExtra(EXTRA_ROOM_NAME, roomName)
            putExtra(EXTRA_CALL_TYPE, callType)
            putExtra(EXTRA_CALLER_NAME, callerName)
        }
        val pendingAccept = PendingIntent.getBroadcast(
            this, 101, acceptIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
        )

        val declineIntent = Intent(this, USChatCallReceiver::class.java).apply {
            action = ACTION_DECLINE
            putExtra(EXTRA_CALL_ID, callId)
            putExtra(EXTRA_CHAT_ID, chatId)
        }
        val pendingDecline = PendingIntent.getBroadcast(
            this, 102, declineIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
        )

        // Full Screen Intent (takes user directly to the app screen if phone is locked/asleep)
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("incomingCall", true)
            putExtra("callId", callId)
            putExtra("chatId", chatId)
            putExtra("roomName", roomName)
            putExtra("callType", callType)
            putExtra("callerName", callerName)
            putExtra("action", "show")
        }
        val pendingLaunch = PendingIntent.getActivity(
            this, 103, launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
        )

        // 1. Build and display initial notification immediately on the main thread to satisfy Android OS constraints
        val personBuilder = Person.Builder()
            .setName(callerName)
            .setImportant(true)
        val person = personBuilder.build()

        val notificationBuilder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.sym_action_call)
            .setContentTitle(callerName)
            .setContentText(if (callType == "VIDEO") "Incoming video call..." else "Incoming voice call...")
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setFullScreenIntent(pendingLaunch, true)
            .setOngoing(true)
            .setAutoCancel(false)
            .setStyle(
                NotificationCompat.CallStyle.forIncomingCall(
                    person,
                    pendingDecline,
                    pendingAccept
                )
            )

        val notification = notificationBuilder.build()
        startForeground(NOTIFICATION_ID, notification)
        Log.d(TAG, "[USChatCallService] startForeground called successfully on main thread")

        // 2. Asynchronously download the avatar and refresh the notification
        Thread {
            try {
                val bitmap = getCircularBitmap(avatarUrl)
                if (bitmap != null) {
                    val updatedPerson = Person.Builder()
                        .setName(callerName)
                        .setImportant(true)
                        .setIcon(IconCompat.createWithBitmap(bitmap))
                        .build()

                    val updatedNotification = NotificationCompat.Builder(this, CHANNEL_ID)
                        .setSmallIcon(android.R.drawable.sym_action_call)
                        .setContentTitle(callerName)
                        .setContentText(if (callType == "VIDEO") "Incoming video call..." else "Incoming voice call...")
                        .setPriority(NotificationCompat.PRIORITY_MAX)
                        .setCategory(NotificationCompat.CATEGORY_CALL)
                        .setFullScreenIntent(pendingLaunch, true)
                        .setOngoing(true)
                        .setAutoCancel(false)
                        .setStyle(
                            NotificationCompat.CallStyle.forIncomingCall(
                                updatedPerson,
                                pendingDecline,
                                pendingAccept
                            )
                        )
                        .build()

                    val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                    notificationManager.notify(NOTIFICATION_ID, updatedNotification)
                    Log.d(TAG, "[USChatCallService] Notification updated with caller avatar successfully")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error updating notification avatar background thread", e)
            }
        }.start()

        // Set Timeout for 30 seconds to automatically trigger missed call status
        val timeoutIntent = Intent(this, USChatCallService::class.java).apply {
            action = ACTION_TIMEOUT
        }
        val pendingTimeout = PendingIntent.getService(
            this, 104, timeoutIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val alarmManager = getSystemService(Context.ALARM_SERVICE) as AlarmManager
        alarmManager.set(
            AlarmManager.ELAPSED_REALTIME_WAKEUP,
            SystemClock.elapsedRealtime() + 30000,
            pendingTimeout
        )
    }

    private fun startRinging() {
        try {
            val ringtoneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
            ringtone = RingtoneManager.getRingtone(this, ringtoneUri)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                ringtone?.audioAttributes = AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build()
            }
            ringtone?.play()

            vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vibratorManager = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
                vibratorManager.defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
            }
            
            val pattern = longArrayOf(0, 1000, 1000)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator?.vibrate(VibrationEffect.createWaveform(pattern, 0))
            } else {
                @Suppress("DEPRECATION")
                vibrator?.vibrate(pattern, 0)
            }
            Log.d(TAG, "[USChatCallService] Ringtone and vibrator active")
        } catch (e: Exception) {
            Log.e(TAG, "Error starting ringtone/vibration", e)
        }
    }

    private fun stopRinging() {
        try {
            ringtone?.stop()
            vibrator?.cancel()
            Log.d(TAG, "[USChatCallService] Ringtone and vibrator stopped")
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping ringtone/vibration", e)
        }
    }

    private fun getCircularBitmap(urlStr: String?): Bitmap? {
        if (urlStr.isNullOrEmpty()) return null
        return try {
            val url = URL(urlStr)
            val connection = url.openConnection()
            connection.doInput = true
            connection.connect()
            val input: InputStream = connection.getInputStream()
            val src = BitmapFactory.decodeStream(input) ?: return null
            
            val output = Bitmap.createBitmap(src.width, src.height, Bitmap.Config.ARGB_8888)
            val canvas = Canvas(output)
            val paint = Paint()
            val rect = Rect(0, 0, src.width, src.height)

            paint.isAntiAlias = true
            canvas.drawARGB(0, 0, 0, 0)
            canvas.drawCircle((src.width / 2).toFloat(), (src.height / 2).toFloat(), (src.width / 2).toFloat(), paint)
            paint.xfermode = PorterDuffXfermode(PorterDuff.Mode.SRC_IN)
            canvas.drawBitmap(src, rect, rect, paint)
            output
        } catch (e: Exception) {
            Log.e(TAG, "Failed to download avatar: ${e.message}")
            null
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Incoming Calls",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Shows incoming call notifications with CallStyle UI"
                setSound(null, null)
                enableVibration(false)
            }
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }

    override fun onDestroy() {
        Log.d(TAG, "[USChatCallService] Service destroyed")
        stopRinging()
        if (wakeLock?.isHeld == true) {
            wakeLock?.release()
        }
        super.onDestroy()
    }
}
