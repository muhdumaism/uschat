package com.uschat.app

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
import org.json.JSONObject

class USChatMessagingService : FirebaseMessagingService() {

    companion object {
        private const val TAG = "USChatMessagingService"
        const val CHANNEL_MESSAGES_ID = "messages"
        const val GROUP_KEY_MESSAGES = "com.uschat.app.MESSAGES"
    }

    override fun onNewToken(token: String) {
        Log.d(TAG, "[USChatMessagingService] onNewToken generated: $token")
        val sharedPrefs = getSharedPreferences("USChatPrefs", Context.MODE_PRIVATE)
        sharedPrefs.edit().putString("fcm_token", token).apply()
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

        when (type) {
            "incoming_call" -> {
                val callId = data["callId"] ?: ""
                val chatId = data["chatId"] ?: ""
                val callerId = data["callerId"] ?: ""
                val callerName = data["callerName"] ?: "Secured Caller"
                val roomName = data["roomName"] ?: ""
                val callType = data["callType"] ?: "AUDIO"
                val avatar = data["avatar"] ?: ""

                Log.d(TAG, "[USChatMessagingService] Routing call to USChatCallService. CallID: $callId, Caller: $callerName")
                val intent = Intent(this, USChatCallService::class.java).apply {
                    putExtra(USChatCallService.EXTRA_CALL_ID, callId)
                    putExtra(USChatCallService.EXTRA_CHAT_ID, chatId)
                    putExtra(USChatCallService.EXTRA_CALLER_ID, callerId)
                    putExtra(USChatCallService.EXTRA_CALLER_NAME, callerName)
                    putExtra(USChatCallService.EXTRA_ROOM_NAME, roomName)
                    putExtra(USChatCallService.EXTRA_CALL_TYPE, callType)
                    putExtra(USChatCallService.EXTRA_AVATAR, avatar)
                }
                USChatCallService.start(this, intent)
            }
            "call_cancelled" -> {
                val callId = data["callId"] ?: ""
                Log.d(TAG, "[USChatMessagingService] Call cancelled by caller. Stopping CallService for CallID: $callId")
                USChatCallService.stop(this, callId)
            }
            "message" -> {
                val chatId = data["conversationId"] ?: data["chatId"] ?: ""
                val senderId = data["senderId"] ?: ""
                val senderName = data["senderName"] ?: "New Message"
                val messageText = data["message"] ?: "Encrypted transmission"
                val avatar = data["avatar"] ?: ""

                // Active chat suppression check
                val sharedPrefs = getSharedPreferences("USChatPrefs", Context.MODE_PRIVATE)
                val activeChatId = sharedPrefs.getString("active_chat_id", null)
                if (activeChatId == chatId) {
                    Log.d(TAG, "[USChatMessagingService] User is actively viewing chat $chatId. Suppressing message notification.")
                    return
                }

                Log.d(TAG, "[USChatMessagingService] Showing message notification for Chat: $chatId, Sender: $senderName")
                showMessageNotification(chatId, senderId, senderName, messageText, avatar)
            }
            "missed_call" -> {
                val chatId = data["chatId"] ?: ""
                val callerName = data["callerName"] ?: "Someone"
                Log.d(TAG, "[USChatMessagingService] Displaying missed call notification from $callerName")
                showMissedCallNotification(chatId, callerName)
            }
        }
    }

    private fun showMessageNotification(chatId: String, senderId: String, senderName: String, messageText: String, avatar: String) {
        createMessagesChannel()

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

        // Summary notification for grouping
        val summaryNotification = NotificationCompat.Builder(this, CHANNEL_MESSAGES_ID)
            .setSmallIcon(android.R.drawable.sym_action_chat)
            .setContentTitle("USChat")
            .setContentText("New messages")
            .setGroup(GROUP_KEY_MESSAGES)
            .setGroupSummary(true)
            .setAutoCancel(true)
            .build()

        val notification = NotificationCompat.Builder(this, CHANNEL_MESSAGES_ID)
            .setContentTitle(senderName)
            .setContentText(messageText)
            .setSmallIcon(android.R.drawable.sym_action_chat)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setGroup(GROUP_KEY_MESSAGES)
            .setAutoCancel(true)
            .build()

        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(notificationId, notification)
        manager.notify(999, summaryNotification)
        Log.d(TAG, "[USChatMessagingService] Message notification displayed. ID: $notificationId")
    }

    private fun showMissedCallNotification(chatId: String, callerName: String) {
        createMessagesChannel()

        val notificationId = (chatId + "_missed").hashCode()

        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("chatId", chatId)
            putExtra("action", "open_chat")
        }
        val pendingIntent = PendingIntent.getActivity(
            this, notificationId, launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
        )

        val notification = NotificationCompat.Builder(this, CHANNEL_MESSAGES_ID)
            .setContentTitle("Missed Call")
            .setContentText("Missed call from $callerName")
            .setSmallIcon(android.R.drawable.sym_action_call)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)
            .build()

        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(notificationId, notification)
        Log.d(TAG, "[USChatMessagingService] Missed call notification displayed. ID: $notificationId")
    }

    private fun createMessagesChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val name = "Chat Messages"
            val descriptionText = "Shows incoming chat messages"
            val importance = NotificationManager.IMPORTANCE_HIGH
            val channel = NotificationChannel(CHANNEL_MESSAGES_ID, name, importance).apply {
                description = descriptionText
            }
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }
}
