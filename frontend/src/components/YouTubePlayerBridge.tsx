import React, { useRef, useEffect, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { useMusicStore } from '../store/musicStore';

export interface YouTubeBridgeApi {
  loadVideo: (videoId: string, startSeconds?: number) => void;
  play: () => void;
  pause: () => void;
  seekTo: (seconds: number) => void;
  setVolume: (volume: number) => void;
}

const PLAYER_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; background-color: #000; }
    html, body { width: 100%; height: 100%; overflow: hidden; }
    #player { width: 100%; height: 100%; position: absolute; top: 0; left: 0; }
  </style>
</head>
<body>
  <div id="player"></div>

  <script>
    var player = null;
    var isReady = false;
    var timeUpdateInterval = null;

    function sendToRN(type, data) {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: type, data: data || {} }));
      }
    }

    var tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    var firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

    function onYouTubeIframeAPIReady() {
      player = new YT.Player('player', {
        height: '100%',
        width: '100%',
        playerVars: {
          autoplay: 1,
          controls: 0,
          playsinline: 1,
          rel: 0,
          showinfo: 0,
          modestbranding: 1,
          iv_load_policy: 3,
          fs: 0,
          disablekb: 1,
          origin: 'https://www.youtube.com'
        },
        events: {
          'onReady': onPlayerReady,
          'onStateChange': onPlayerStateChange,
          'onError': onPlayerError
        }
      });
    }

    function onPlayerReady(event) {
      isReady = true;
      sendToRN('READY');
      startTimeUpdater();
    }

    function onPlayerStateChange(event) {
      var state = event.data;
      var duration = (player && player.getDuration) ? player.getDuration() : 0;
      var currentTime = (player && player.getCurrentTime) ? player.getCurrentTime() : 0;

      sendToRN('STATE_CHANGE', {
        state: state,
        duration: duration,
        currentTime: currentTime
      });
    }

    function onPlayerError(event) {
      sendToRN('ERROR', { code: event.data });
    }

    function startTimeUpdater() {
      if (timeUpdateInterval) clearInterval(timeUpdateInterval);
      timeUpdateInterval = setInterval(function() {
        if (player && isReady && player.getPlayerState && player.getPlayerState() === YT.PlayerState.PLAYING) {
          sendToRN('TIME_UPDATE', {
            currentTime: player.getCurrentTime(),
            duration: player.getDuration()
          });
        }
      }, 500);
    }

    function handleRNMessage(msgStr) {
      try {
        var msg = JSON.parse(msgStr);
        if (!player || !isReady) return;

        switch (msg.action) {
          case 'LOAD_VIDEO':
            player.loadVideoById({
              videoId: msg.videoId,
              startSeconds: msg.startSeconds || 0
            });
            break;
          case 'PLAY':
            player.playVideo();
            break;
          case 'PAUSE':
            player.pauseVideo();
            break;
          case 'SEEK':
            player.seekTo(msg.seconds, true);
            break;
          case 'SET_VOLUME':
            player.setVolume(msg.volume);
            break;
        }
      } catch (e) {
        sendToRN('LOG', { error: e.message });
      }
    }

    window.addEventListener('message', function(e) { handleRNMessage(e.data); });
    document.addEventListener('message', function(e) { handleRNMessage(e.data); });
  </script>
</body>
</html>
`;

interface YouTubePlayerBridgeProps {
  visible?: boolean;
}

export const YouTubePlayerBridge: React.FC<YouTubePlayerBridgeProps> = ({ visible = false }) => {
  const webViewRef = useRef<WebView>(null);
  const setBridge = useMusicStore((state) => state.setBridge);
  const handlePlayerEvent = useMusicStore((state) => state.handlePlayerEvent);

  const postToWebView = useCallback((action: string, payload: Record<string, any> = {}) => {
    if (webViewRef.current) {
      const script = `handleRNMessage(${JSON.stringify(JSON.stringify({ action, ...payload }))}); true;`;
      webViewRef.current.injectJavaScript(script);
    }
  }, []);

  useEffect(() => {
    const api: YouTubeBridgeApi = {
      loadVideo: (videoId, startSeconds = 0) => postToWebView('LOAD_VIDEO', { videoId, startSeconds }),
      play: () => postToWebView('PLAY'),
      pause: () => postToWebView('PAUSE'),
      seekTo: (seconds) => postToWebView('SEEK', { seconds }),
      setVolume: (volume) => postToWebView('SET_VOLUME', { volume }),
    };

    setBridge(api);
    return () => setBridge(null);
  }, [postToWebView, setBridge]);

  const onMessage = (event: any) => {
    try {
      const payload = JSON.parse(event.nativeEvent.data);
      handlePlayerEvent(payload.type, payload.data);
    } catch (err) {
      console.warn('[YouTubePlayerBridge] Error parsing bridge event:', err);
    }
  };

  return (
    <View
      style={[
        styles.container,
        visible ? styles.visibleContainer : styles.minimizedContainer,
      ]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <WebView
        ref={webViewRef}
        source={{ html: PLAYER_HTML, baseUrl: 'https://www.youtube.com' }}
        onMessage={onMessage}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        scrollEnabled={false}
        originWhitelist={['*']}
        userAgent="Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
        style={styles.webView}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  visibleContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    maxHeight: 220,
    borderRadius: 8,
  },
  // To comply with YouTube ToS, the player is rendered in a compact docked layout (never display:none or width/height: 0)
  minimizedContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 64,
    height: 36,
    opacity: 0.05,
    zIndex: -999,
  },
  webView: {
    flex: 1,
    backgroundColor: '#000',
  },
});
