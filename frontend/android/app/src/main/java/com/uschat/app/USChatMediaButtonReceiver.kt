package com.uschat.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class USChatMediaButtonReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
        val action = intent?.action ?: return
        USChatMediaSessionModule.handleNotificationAction(action)
    }
}
