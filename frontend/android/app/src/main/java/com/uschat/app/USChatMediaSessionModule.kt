package com.uschat.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Build
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import android.util.Log
import androidx.core.app.NotificationCompat
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.net.URL
import kotlin.concurrent.thread

class USChatMediaSessionModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "USChatMediaSession"
        private const val CHANNEL_ID = "USCHAT_MEDIA_CHANNEL"
        private const val NOTIFICATION_ID = 9002
        private var instance: USChatMediaSessionModule? = null

        fun handleNotificationAction(action: String) {
            val currentInstance = instance ?: return
            when (action) {
                "com.uschat.app.PLAY" -> currentInstance.sendEvent("play", null)
                "com.uschat.app.PAUSE" -> currentInstance.sendEvent("pause", null)
                "com.uschat.app.NEXT" -> currentInstance.sendEvent("next", null)
                "com.uschat.app.PREVIOUS" -> currentInstance.sendEvent("previous", null)
            }
        }
    }

    private var mediaSession: MediaSessionCompat? = null
    private var currentTitle = ""
    private var currentArtist = ""
    private var currentBitmap: Bitmap? = null
    private var isPlayingState = false

    override fun getName(): String = "USChatMediaSessionModule"

    override fun initialize() {
        super.initialize()
        instance = this
    }

    override fun invalidate() {
        instance = null
        stopMediaSession()
        super.invalidate()
    }

    private fun initMediaSession() {
        if (mediaSession != null) return
        val context = reactApplicationContext
        mediaSession = MediaSessionCompat(context, "USChatMediaSession").apply {
            setFlags(MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS or MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS)
            setCallback(object : MediaSessionCompat.Callback() {
                override fun onPlay() {
                    sendEvent("play", null)
                }

                override fun onPause() {
                    sendEvent("pause", null)
                }

                override fun onSkipToNext() {
                    sendEvent("next", null)
                }

                override fun onSkipToPrevious() {
                    sendEvent("previous", null)
                }

                override fun onSeekTo(pos: Long) {
                    val params = Arguments.createMap().apply {
                        putDouble("position", pos.toDouble())
                    }
                    sendEvent("seekTo", params)
                }
            })
            isActive = true
        }
        createNotificationChannel()
    }

    private fun sendEvent(action: String, params: WritableMap?) {
        val eventData = Arguments.createMap().apply {
            putString("action", action)
            if (params != null) {
                putMap("params", params)
            }
        }
        try {
            reactApplicationContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("onMediaSessionAction", eventData)
        } catch (e: Exception) {
            Log.e(TAG, "Error sending media action event to JS", e)
        }
    }

    @ReactMethod
    fun updateMetadata(title: String, artist: String, coverUrl: String, durationMs: Double) {
        initMediaSession()
        currentTitle = title
        currentArtist = artist
        val session = mediaSession ?: return

        val builder = MediaMetadataCompat.Builder().apply {
            putString(MediaMetadataCompat.METADATA_KEY_TITLE, title)
            putString(MediaMetadataCompat.METADATA_KEY_ARTIST, artist)
            putLong(MediaMetadataCompat.METADATA_KEY_DURATION, durationMs.toLong())
        }

        session.setMetadata(builder.build())
        showNotification(title, artist, null)

        if (coverUrl.isNotEmpty()) {
            thread {
                try {
                    val url = URL(coverUrl)
                    val connection = url.openConnection().apply {
                        connectTimeout = 3000
                        readTimeout = 3000
                    }
                    val bitmap = BitmapFactory.decodeStream(connection.getInputStream())
                    if (bitmap != null) {
                        reactApplicationContext.runOnUiQueueThread {
                            builder.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, bitmap)
                            session.setMetadata(builder.build())
                            showNotification(title, artist, bitmap)
                        }
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Error loading cover art thumbnail", e)
                }
            }
        }
    }

    @ReactMethod
    fun updatePlaybackState(isPlaying: Boolean, positionMs: Double) {
        initMediaSession()
        isPlayingState = isPlaying
        val session = mediaSession ?: return

        val stateBuilder = PlaybackStateCompat.Builder().apply {
            val state = if (isPlaying) PlaybackStateCompat.STATE_PLAYING else PlaybackStateCompat.STATE_PAUSED
            val actions = PlaybackStateCompat.ACTION_PLAY or
                    PlaybackStateCompat.ACTION_PAUSE or
                    PlaybackStateCompat.ACTION_SKIP_TO_NEXT or
                    PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS or
                    PlaybackStateCompat.ACTION_SEEK_TO

            setState(state, positionMs.toLong(), 1.0f)
            setActions(actions)
        }
        session.setPlaybackState(stateBuilder.build())

        // Refresh the notification with updated buttons
        if (currentTitle.isNotEmpty()) {
            showNotification(currentTitle, currentArtist, currentBitmap)
        }
    }

    @ReactMethod
    fun stopMediaSession() {
        val manager = reactApplicationContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.cancel(NOTIFICATION_ID)

        mediaSession?.let {
            it.isActive = false
            it.release()
        }
        mediaSession = null
        currentTitle = ""
        currentArtist = ""
        currentBitmap = null
        isPlayingState = false
    }

    private fun showNotification(title: String, artist: String, bitmap: Bitmap?) {
        if (bitmap != null) {
            currentBitmap = bitmap
        }

        val context = reactApplicationContext
        val session = mediaSession ?: return

        val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
        val pendingIntent = PendingIntent.getActivity(
            context, 0, launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val prevIntent = Intent(context, USChatMediaButtonReceiver::class.java).apply { action = "com.uschat.app.PREVIOUS" }
        val prevPending = PendingIntent.getBroadcast(context, 1, prevIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

        val playToggleAction = if (isPlayingState) "com.uschat.app.PAUSE" else "com.uschat.app.PLAY"
        val playIntent = Intent(context, USChatMediaButtonReceiver::class.java).apply { action = playToggleAction }
        val playPending = PendingIntent.getBroadcast(context, 2, playIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

        val nextIntent = Intent(context, USChatMediaButtonReceiver::class.java).apply { action = "com.uschat.app.NEXT" }
        val nextPending = PendingIntent.getBroadcast(context, 3, nextIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

        // Brutalist-style: uppercase text, dark colorized background, yellow accent
        val notificationBuilder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setContentTitle(title.uppercase())
            .setContentText(artist.uppercase())
            .setSubText("USCHAT MUSIC")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentIntent(pendingIntent)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(isPlayingState)
            .setSilent(true)
            .setColor(0xFFFFD600.toInt()) // Brutalist yellow accent
            .setColorized(true) // Dark colorized background matching in-app style
            .setStyle(
                androidx.media.app.NotificationCompat.MediaStyle()
                    .setMediaSession(session.sessionToken)
                    .setShowActionsInCompactView(0, 1, 2)
            )

        if (bitmap != null) {
            notificationBuilder.setLargeIcon(bitmap)
        } else if (currentBitmap != null) {
            notificationBuilder.setLargeIcon(currentBitmap)
        }

        notificationBuilder.addAction(android.R.drawable.ic_media_previous, "PREV", prevPending)

        val playIcon = if (isPlayingState) android.R.drawable.ic_media_pause else android.R.drawable.ic_media_play
        val playText = if (isPlayingState) "PAUSE" else "PLAY"
        notificationBuilder.addAction(playIcon, playText, playPending)

        notificationBuilder.addAction(android.R.drawable.ic_media_next, "NEXT", nextPending)

        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(NOTIFICATION_ID, notificationBuilder.build())
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val name = "USChat Media Controls"
            val descriptionText = "Display active playing song details and transport buttons"
            val importance = NotificationManager.IMPORTANCE_LOW
            val channel = NotificationChannel(CHANNEL_ID, name, importance).apply {
                description = descriptionText
                lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
            }
            val notificationManager = reactApplicationContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }
}
