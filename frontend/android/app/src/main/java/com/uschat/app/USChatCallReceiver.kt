package com.uschat.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.util.concurrent.TimeUnit

class USChatCallReceiver : BroadcastReceiver() {
    companion object {
        private const val TAG = "USChatCallReceiver"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        val callId = intent.getStringExtra(USChatCallService.EXTRA_CALL_ID) ?: ""
        val chatId = intent.getStringExtra(USChatCallService.EXTRA_CHAT_ID) ?: ""

        Log.d(TAG, "[USChatCallReceiver] Received broadcast event: $action for Call ID: $callId")

        // Immediately stop call service ringing & vibrating
        USChatCallService.stop(context, callId)

        if (action == USChatCallService.ACTION_ACCEPT) {
            Log.d(TAG, "[USChatCallReceiver] Accept action clicked. Launching main activity...")

            val roomName = intent.getStringExtra(USChatCallService.EXTRA_ROOM_NAME) ?: ""
            val callType = intent.getStringExtra(USChatCallService.EXTRA_CALL_TYPE) ?: "AUDIO"
            val callerName = intent.getStringExtra(USChatCallService.EXTRA_CALLER_NAME) ?: ""

            // Wake up app and place it in foreground
            val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                putExtra("incomingCall", true)
                putExtra("callId", callId)
                putExtra("chatId", chatId)
                putExtra("roomName", roomName)
                putExtra("callType", callType)
                putExtra("callerName", callerName)
                putExtra("action", "accept")
            }

            // Immediately send event to React Native module if bridge is alive
            USChatModule.handleCallAction(
                action = "accept",
                callId = callId,
                chatId = chatId,
                roomName = roomName,
                callType = callType,
                callerName = callerName
            )

            if (launchIntent != null) {
                context.startActivity(launchIntent)
            } else {
                Log.e(TAG, "[USChatCallReceiver] Failed to resolve launcher intent for accept action")
            }

        } else if (action == USChatCallService.ACTION_DECLINE) {
            Log.d(TAG, "[USChatCallReceiver] Decline action clicked. Notifying native bridge and API...")

            // Notify React Native local call store
            USChatModule.handleCallAction(
                action = "decline",
                callId = callId,
                chatId = chatId
            )

            // Submit POST request to backend decline route
            declineCallOnBackend(context, callId)
        }
    }

    private fun declineCallOnBackend(context: Context, callId: String) {
        val sharedPrefs = context.getSharedPreferences("USChatPrefs", Context.MODE_PRIVATE)
        val token = sharedPrefs.getString("auth_token", null)

        if (token == null) {
            Log.e(TAG, "[USChatCallReceiver] Decline API failed: Auth token not present in SharedPreferences")
            return
        }

        val apiUrl = sharedPrefs.getString("api_url", null)
        if (apiUrl == null) {
            Log.e(TAG, "[USChatCallReceiver] Decline API failed: API Base URL not present in SharedPreferences")
            return
        }

        Log.d(TAG, "[USChatCallReceiver] Sending decline POST request to: $apiUrl/calls/$callId/decline")

        val client = OkHttpClient.Builder()
            .connectTimeout(10, TimeUnit.SECONDS)
            .writeTimeout(10, TimeUnit.SECONDS)
            .readTimeout(10, TimeUnit.SECONDS)
            .build()

        val mediaType = "application/json".toMediaTypeOrNull()
        val requestBody = "{}".toRequestBody(mediaType)

        val request = Request.Builder()
            .url("$apiUrl/calls/$callId/decline")
            .post(requestBody)
            .addHeader("Authorization", "Bearer $token")
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                Log.e(TAG, "[USChatCallReceiver] Decline call network failure: ", e)
            }

            override fun onResponse(call: Call, response: Response) {
                Log.d(TAG, "[USChatCallReceiver] Decline call API completed with response code: ${response.code}")
                response.close()
            }
        })
    }
}
