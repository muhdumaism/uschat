import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
  Platform,
} from 'react-native';
import {
  Search,
  Music,
  Heart,
  Plus,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Shuffle,
  Repeat,
  ArrowLeft,
  Trash2,
  ListMusic,
  Share2,
} from 'lucide-react-native';
import Slider from '@react-native-community/slider';
import { BRUTALIST_COLORS, BRUTALIST_STYLES } from '../../theme/brutalistTheme';
import { BrutalistCard } from '../../components/BrutalistCard';
import { BrutalistButton } from '../../components/BrutalistButton';
import { BrutalistTextInput } from '../../components/BrutalistTextInput';
import { apiClient } from '../../api/client';
import { useMusicStore, Track } from '../../store/musicStore';

export const MusicScreen: React.FC<any> = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState<'search' | 'playlists' | 'likes'>('search');
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [searching, setSearching] = useState(false);

  // Playlists state
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [spotifyUrl, setSpotifyUrl] = useState('');
  const [importingSpotify, setImportingSpotify] = useState(false);

  const {
    currentTrack,
    isPlaying,
    position,
    duration,
    isLooping,
    isShuffled,
    queue,
    likedSongs,
    playTrack,
    pauseTrack,
    resumeTrack,
    nextTrack,
    prevTrack,
    toggleLoop,
    toggleShuffle,
    addToQueue,
    removeFromQueue,
    likeTrack,
    unlikeTrack,
    fetchLikedSongs,
    seekTrack,
  } = useMusicStore();

  useEffect(() => {
    fetchLikedSongs();
    loadPlaylists();
  }, []);

  const loadPlaylists = async () => {
    try {
      setLoadingPlaylists(true);
      const res = await apiClient.get('/music/playlists');
      setPlaylists(res.data || []);
    } catch (e) {
      console.warn('Failed to load playlists:', e);
    } finally {
      setLoadingPlaylists(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    try {
      setSearching(true);
      const res = await apiClient.get(`/music/search?q=${encodeURIComponent(searchQuery)}`);
      setSearchResults(res.data || []);
    } catch (e) {
      Alert.alert('ERROR', 'FAILED TO QUERY AUDIO CATALOG.');
    } finally {
      setSearching(false);
    }
  };

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return;
    try {
      await apiClient.post('/music/playlist', { name: newPlaylistName });
      setNewPlaylistName('');
      Alert.alert('SUCCESS', 'PLAYLIST DECK CREATED.');
      loadPlaylists();
    } catch (e) {
      Alert.alert('ERROR', 'FAILED TO CREATE PLAYLIST.');
    }
  };

  const handleSpotifyImport = async () => {
    if (!spotifyUrl.trim()) return;
    try {
      setImportingSpotify(true);
      const res = await apiClient.post('/music/spotify-import', { url: spotifyUrl });
      setSpotifyUrl('');
      Alert.alert('IMPORT INITIATED', `${res.data?.message?.toUpperCase() || 'METADATA RESOLVED.'}`);
      loadPlaylists();
    } catch (e: any) {
      Alert.alert('IMPORT FAILED', e.response?.data?.message?.toUpperCase() || 'UNABLE TO CONVERT PLAYLIST.');
    } finally {
      setImportingSpotify(false);
    }
  };

  const formatMillis = (millis: number) => {
    const totalSecs = Math.floor(millis / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const renderTrackItem = ({ item }: { item: Track }) => {
    const isCurrent = currentTrack?.trackUri === item.trackUri;
    const isLiked = likedSongs.some((s: any) => s.trackUri === item.trackUri);

    return (
      <BrutalistCard accentColor="#FFFFFF" padding={10} style={styles.trackCard}>
        <View style={styles.trackRow}>
          <Music size={18} color="#000" style={{ marginRight: 8 }} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.trackTitle, isCurrent && { color: BRUTALIST_COLORS.pink }]} numberOfLines={1}>
              {item.title.toUpperCase()}
            </Text>
            <Text style={styles.trackArtist} numberOfLines={1}>
              {item.artist.toUpperCase()}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <TouchableOpacity onPress={() => (isLiked ? unlikeTrack(item.trackUri) : likeTrack(item))}>
              <Heart size={18} color={isLiked ? BRUTALIST_COLORS.red : '#000000'} fill={isLiked ? BRUTALIST_COLORS.red : 'transparent'} />
            </TouchableOpacity>
            <BrutalistButton
              onPress={() => playTrack(item)}
              style={styles.trackPlayBtn}
              accentColor={isCurrent ? BRUTALIST_COLORS.pink : BRUTALIST_COLORS.yellow}
              title={isCurrent && isPlaying ? "⏸" : "▶"}
            />
          </View>
        </View>
      </BrutalistCard>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <View style={styles.statusBarSpacer} />

      {/* Header Bar */}
      <View style={styles.header}>
        <BrutalistButton onPress={() => navigation.goBack()} style={styles.backBtn} accentColor={BRUTALIST_COLORS.yellow}>
          <ArrowLeft size={18} color="#000000" />
        </BrutalistButton>
        <Text style={styles.headerTitle}>MUSIC DECK</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Tabs list */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          onPress={() => setActiveTab('search')}
          style={[
            styles.tab,
            {
              backgroundColor: activeTab === 'search' ? BRUTALIST_COLORS.yellow : '#FFFFFF',
              borderRightWidth: BRUTALIST_STYLES.borderWidthThin,
            }
          ]}
        >
          <Text style={styles.tabText}>SEARCH</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab('playlists')}
          style={[
            styles.tab,
            {
              backgroundColor: activeTab === 'playlists' ? BRUTALIST_COLORS.yellow : '#FFFFFF',
              borderRightWidth: BRUTALIST_STYLES.borderWidthThin,
            }
          ]}
        >
          <Text style={styles.tabText}>PLAYLISTS</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab('likes')}
          style={[
            styles.tab,
            {
              backgroundColor: activeTab === 'likes' ? BRUTALIST_COLORS.yellow : '#FFFFFF',
            }
          ]}
        >
          <Text style={styles.tabText}>LIKES</Text>
        </TouchableOpacity>
      </View>

      {/* Tab Panels */}
      <View style={{ flex: 1 }}>
        {activeTab === 'search' && (
          <View style={{ flex: 1 }}>
            <View style={styles.searchRow}>
              <BrutalistTextInput
                placeholder="SEARCH TRACK TITLE OR ARTIST..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                containerStyle={{ flex: 1 }}
              />
              <BrutalistButton
                onPress={handleSearch}
                style={styles.searchBtn}
                accentColor={BRUTALIST_COLORS.yellow}
              >
                <Search size={18} color="#000000" />
              </BrutalistButton>
            </View>

            {searching ? (
              <View style={styles.center}>
                <ActivityIndicator color="#000" size="large" />
              </View>
            ) : (
              <FlatList
                data={searchResults}
                keyExtractor={(item) => item.trackUri}
                renderItem={renderTrackItem}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                  <View style={styles.center}>
                    <Text style={styles.emptyText}>QUERY HIGH QUALITY STREAMS VIA LAVALINK</Text>
                  </View>
                }
              />
            )}
          </View>
        )}

        {activeTab === 'playlists' && (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {/* Create Playlist */}
            <BrutalistCard accentColor="#FFFFFF" padding={12} style={styles.metaCard}>
              <Text style={styles.label}>NEW PLAYLIST CONTAINER</Text>
              <View style={styles.row}>
                <BrutalistTextInput
                  placeholder="PLAYLIST NAME..."
                  value={newPlaylistName}
                  onChangeText={setNewPlaylistName}
                  containerStyle={{ flex: 1, marginRight: 8 }}
                />
                <BrutalistButton
                  onPress={handleCreatePlaylist}
                  title="CREATE"
                  accentColor={BRUTALIST_COLORS.yellow}
                />
              </View>
            </BrutalistCard>

            {/* Spotify Importer */}
            <BrutalistCard accentColor="#FFFFFF" padding={12} style={styles.metaCard}>
              <Text style={styles.label}>IMPORT SPOTIFY PLAYLIST URL</Text>
              <View style={styles.row}>
                <BrutalistTextInput
                  placeholder="SPOTIFY URL..."
                  value={spotifyUrl}
                  onChangeText={setSpotifyUrl}
                  containerStyle={{ flex: 1, marginRight: 8 }}
                />
                <BrutalistButton
                  onPress={handleSpotifyImport}
                  title={importingSpotify ? "IMPORTING..." : "IMPORT"}
                  accentColor={BRUTALIST_COLORS.green}
                  disabled={importingSpotify}
                />
              </View>
            </BrutalistCard>

            {/* Playlist list */}
            {loadingPlaylists ? (
              <ActivityIndicator color="#000" />
            ) : (
              playlists.map((pl) => (
                <BrutalistCard key={pl.id} accentColor="#FFFFFF" padding={12} style={styles.metaCard}>
                  <View style={styles.row}>
                    <ListMusic size={20} color="#000" style={{ marginRight: 8 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.playlistName}>{pl.name.toUpperCase()}</Text>
                      <Text style={styles.playlistTracks}>
                        {pl.tracks?.length || 0} TRACKS RESOLVED
                      </Text>
                    </View>
                    <BrutalistButton
                      onPress={async () => {
                        try {
                          await apiClient.delete(`/music/playlist/${pl.id}`);
                          loadPlaylists();
                        } catch (e) {
                          Alert.alert('ERROR', 'FAILED TO DELETE PLAYLIST.');
                        }
                      }}
                      accentColor={BRUTALIST_COLORS.red}
                      style={{ paddingHorizontal: 8, paddingVertical: 6 }}
                    >
                      <Trash2 size={12} color="#FFFFFF" />
                    </BrutalistButton>
                  </View>
                </BrutalistCard>
              ))
            )}
          </ScrollView>
        )}

        {activeTab === 'likes' && (
          <FlatList
            data={likedSongs}
            keyExtractor={(item) => item.trackUri}
            renderItem={renderTrackItem}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={styles.emptyText}>NO SONGS SAVED IN YOUR LIKES PACKET</Text>
              </View>
            }
          />
        )}
      </View>

      {/* Brutalist Player Deck Panel */}
      {currentTrack && (
        <BrutalistCard accentColor={BRUTALIST_COLORS.yellow} padding={12} style={styles.playerDeck}>
          <View style={styles.playerInfoRow}>
            <Music size={18} color="#000000" style={{ marginRight: 8 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.playerTitle} numberOfLines={1}>
                {currentTrack.title.toUpperCase()}
              </Text>
              <Text style={styles.playerArtist} numberOfLines={1}>
                {currentTrack.artist.toUpperCase()}
              </Text>
            </View>
            <TouchableOpacity onPress={() => (likedSongs.some((s: any) => s.trackUri === currentTrack.trackUri) ? unlikeTrack(currentTrack.trackUri) : likeTrack(currentTrack))}>
              <Heart size={20} color={likedSongs.some((s: any) => s.trackUri === currentTrack.trackUri) ? BRUTALIST_COLORS.red : '#000000'} fill={likedSongs.some((s: any) => s.trackUri === currentTrack.trackUri) ? BRUTALIST_COLORS.red : 'transparent'} />
            </TouchableOpacity>
          </View>

          {/* Timeline Seeker Slider */}
          <View style={styles.progressSection}>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={duration}
              value={position}
              onSlidingComplete={seekTrack}
              minimumTrackTintColor="#000000"
              maximumTrackTintColor="#555555"
              thumbTintColor="#000000"
            />
            <View style={styles.timeLabelRow}>
              <Text style={styles.timeTextLabel}>{formatMillis(position)}</Text>
              <Text style={styles.timeTextLabel}>{formatMillis(duration)}</Text>
            </View>
          </View>

          {/* Action transport controls */}
          <View style={styles.controlRow}>
            <BrutalistButton onPress={toggleShuffle} style={styles.miniCtrlBtn} accentColor={isShuffled ? BRUTALIST_COLORS.pink : '#FFFFFF'}>
              <Shuffle size={14} color="#000000" />
            </BrutalistButton>
            
            <BrutalistButton onPress={prevTrack} style={styles.miniCtrlBtn} accentColor="#FFFFFF">
              <SkipBack size={16} color="#000000" fill="#000000" />
            </BrutalistButton>

            <BrutalistButton
              onPress={isPlaying ? pauseTrack : resumeTrack}
              style={styles.playPauseBtn}
              accentColor={BRUTALIST_COLORS.green}
            >
              {isPlaying ? (
                <Pause size={18} color="#000" fill="#000" />
              ) : (
                <Play size={18} color="#000" fill="#000" style={{ marginLeft: 2 }} />
              )}
            </BrutalistButton>

            <BrutalistButton onPress={nextTrack} style={styles.miniCtrlBtn} accentColor="#FFFFFF">
              <SkipForward size={16} color="#000000" fill="#000000" />
            </BrutalistButton>

            <BrutalistButton onPress={toggleLoop} style={styles.miniCtrlBtn} accentColor={isLooping ? BRUTALIST_COLORS.pink : '#FFFFFF'}>
              <Repeat size={14} color="#000000" />
            </BrutalistButton>
          </View>
        </BrutalistCard>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRUTALIST_COLORS.background,
    paddingHorizontal: 16,
  },
  statusBarSpacer: {
    height: Platform.OS === 'android' ? 44 : 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 10,
  },
  backBtn: {
    width: 34,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    fontFamily: BRUTALIST_STYLES.fontBold,
    color: '#000000',
  },
  tabBar: {
    flexDirection: 'row',
    marginBottom: 16,
    borderWidth: BRUTALIST_STYLES.borderWidth,
    borderColor: '#000000',
    borderRadius: BRUTALIST_STYLES.borderRadiusSmall,
    overflow: 'hidden',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  tabText: {
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: BRUTALIST_STYLES.fontBold,
    color: '#000000',
  },
  searchRow: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 8,
  },
  searchBtn: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingBottom: 160,
  },
  scrollContent: {
    paddingBottom: 180,
  },
  trackCard: {
    marginBottom: 10,
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trackTitle: {
    fontSize: 12,
    fontWeight: '900',
    fontFamily: BRUTALIST_STYLES.fontBold,
    color: '#000000',
  },
  trackArtist: {
    fontSize: 9,
    fontFamily: BRUTALIST_STYLES.fontBold,
    color: '#555555',
    marginTop: 1,
  },
  trackPlayBtn: {
    width: 32,
    height: 32,
    paddingHorizontal: 0,
    paddingVertical: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaCard: {
    marginBottom: 12,
  },
  label: {
    fontSize: 9,
    fontWeight: '900',
    fontFamily: BRUTALIST_STYLES.fontBold,
    color: '#000000',
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playlistName: {
    fontSize: 12,
    fontWeight: '900',
    fontFamily: BRUTALIST_STYLES.fontBold,
    color: '#000000',
  },
  playlistTracks: {
    fontSize: 9,
    fontFamily: BRUTALIST_STYLES.fontBold,
    color: '#555555',
  },
  playerDeck: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    zIndex: 99,
  },
  playerInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  playerTitle: {
    fontSize: 12,
    fontWeight: '900',
    fontFamily: BRUTALIST_STYLES.fontBold,
    color: '#000000',
  },
  playerArtist: {
    fontSize: 9,
    fontFamily: BRUTALIST_STYLES.fontBold,
    color: '#333333',
    marginTop: 1,
  },
  progressSection: {
    marginBottom: 10,
  },
  slider: {
    width: '100%',
    height: 28,
  },
  timeLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeTextLabel: {
    fontSize: 9,
    fontFamily: BRUTALIST_STYLES.fontBold,
    color: '#000000',
    fontWeight: 'bold',
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  miniCtrlBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  playPauseBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 11,
    fontFamily: BRUTALIST_STYLES.fontBold,
    color: '#666666',
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
