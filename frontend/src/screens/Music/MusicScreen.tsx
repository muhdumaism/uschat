import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator, Image, Modal, TextInput, Platform } from 'react-native';
import { ArrowLeft, Search, Music, Play, Pause, SkipForward, SkipBack, Heart, Plus, Download, ListMusic, Shuffle, Repeat } from 'lucide-react-native';
import { RetroWindow } from '../../components/RetroWindow';
import { RetroButton } from '../../components/RetroButton';
import { RetroPanel } from '../../components/RetroPanel';
import { RetroTextInput } from '../../components/RetroTextInput';
import { RETRO_COLORS } from '../../theme/retroTheme';
import { COLORS } from '../../theme/colors';
import { apiClient } from '../../api/client';
import { useMusicStore, Track } from '../../store/musicStore';

export const MusicScreen: React.FC<any> = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState<'search' | 'playlists' | 'liked'>('search');
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [searching, setSearching] = useState(false);

  // Playlists state
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState<any | null>(null);

  // Liked songs state
  const [likedSongs, setLikedSongs] = useState<Track[]>([]);
  const [loadingLikes, setLoadingLikes] = useState(false);

  // Modals state
  const [showPlaylistCreate, setShowPlaylistCreate] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [showSpotifyImport, setShowSpotifyImport] = useState(false);
  const [spotifyUrl, setSpotifyUrl] = useState('');
  const [importing, setImporting] = useState(false);

  // Global player state
  const {
    currentTrack,
    isPlaying,
    position,
    duration,
    isLooping,
    isShuffled,
    playTrack,
    pauseTrack,
    resumeTrack,
    nextTrack,
    prevTrack,
    seek,
    toggleLoop,
    toggleShuffle,
  } = useMusicStore();

  useEffect(() => {
    fetchPlaylists();
    fetchLikedSongs();
  }, []);

  const fetchPlaylists = async () => {
    try {
      setLoadingPlaylists(true);
      const res = await apiClient.get('/music/playlists');
      setPlaylists(res.data || []);
    } catch (err) {
      console.error('Fetch playlists failed:', err);
    } finally {
      setLoadingPlaylists(false);
    }
  };

  const fetchLikedSongs = async () => {
    try {
      setLoadingLikes(true);
      const res = await apiClient.get('/music/liked-songs');
      setLikedSongs(res.data || []);
    } catch (err) {
      console.error('Fetch liked songs failed:', err);
    } finally {
      setLoadingLikes(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    try {
      setSearching(true);
      const res = await apiClient.get(`/music/search?q=${encodeURIComponent(searchQuery)}`);
      setSearchResults(res.data || []);
    } catch (err) {
      console.error('Music search failed:', err);
      Alert.alert('SEARCH ERROR', 'FAILED TO RETRIEVE MUSIC RESULTS.');
    } finally {
      setSearching(false);
    }
  };

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return;
    try {
      await apiClient.post('/music/playlists', { name: newPlaylistName });
      Alert.alert('SUCCESS', 'PLAYLIST CREATED SUCCESSFULLY.');
      setNewPlaylistName('');
      setShowPlaylistCreate(false);
      fetchPlaylists();
    } catch (err) {
      console.error('Create playlist failed:', err);
    }
  };

  const handleImportSpotify = async () => {
    if (!spotifyUrl.trim()) return;
    try {
      setImporting(true);
      const res = await apiClient.post('/music/spotify-import', { playlistUrl: spotifyUrl });
      Alert.alert('IMPORT COMPLETE', `IMPORTED "${res.data.name?.toUpperCase()}" WITH ${res.data.tracks?.length} SONGS.`);
      setSpotifyUrl('');
      setShowSpotifyImport(false);
      fetchPlaylists();
    } catch (err: any) {
      console.error('Spotify import failed:', err);
      const msg = err.response?.data?.message || 'FAILED TO IMPORT SPOTIFY PLAYLIST.';
      Alert.alert('IMPORT ERROR', msg.toUpperCase());
    } finally {
      setImporting(false);
    }
  };

  const handleToggleLike = async (track: Track) => {
    const isLiked = likedSongs.some((s) => s.trackUri === track.trackUri);
    try {
      if (isLiked) {
        const item = likedSongs.find((s) => s.trackUri === track.trackUri);
        if (item && (item as any).id) {
          await apiClient.delete(`/music/liked-songs/${(item as any).id}`);
        }
      } else {
        await apiClient.post('/music/liked-songs', track);
      }
      fetchLikedSongs();
    } catch (err) {
      console.error('Like toggle failed:', err);
    }
  };

  const handleSelectPlaylist = async (playlist: any) => {
    try {
      const res = await apiClient.get(`/music/playlists/${playlist.id}`);
      setSelectedPlaylist(res.data);
    } catch (err) {
      console.error('Get playlist details failed:', err);
    }
  };

  const renderTrackItem = ({ item, index, sectionTracks }: { item: Track; index: number; sectionTracks: Track[] }) => {
    const isCurrent = currentTrack?.trackUri === item.trackUri;
    const isLiked = likedSongs.some((s) => s.trackUri === item.trackUri);
    
    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => playTrack(item, sectionTracks)}
        style={[styles.trackRow, isCurrent && styles.activeTrackRow]}
      >
        <View style={styles.trackDetails}>
          <Text style={[styles.trackTitle, isCurrent && styles.activeTrackText]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.trackArtist} numberOfLines={1}>
            {item.artist}
          </Text>
        </View>
        
        <View style={styles.trackActions}>
          <TouchableOpacity onPress={() => handleToggleLike(item)} style={styles.likeBtn}>
            <Heart size={16} color={isLiked ? '#800000' : '#808080'} fill={isLiked ? '#800000' : 'transparent'} />
          </TouchableOpacity>
          <Text style={styles.trackDuration}>{Math.floor(item.duration / 60)}:{item.duration % 60 < 10 ? '0' : ''}{item.duration % 60}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const formatTime = (millis: number) => {
    const secs = Math.floor(millis / 1000);
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = duration > 0 ? (position / duration) * 100 : 0;

  return (
    <View style={styles.container}>
      <View style={styles.statusBarSpacer} />
      
      <RetroWindow
        title="MUSIC_PLAYER.EXE"
        onClose={() => navigation.goBack()}
        contentStyle={styles.windowContent}
      >
        {/* Navigation Tabs */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            onPress={() => { setActiveTab('search'); setSelectedPlaylist(null); }}
            style={[styles.tab, activeTab === 'search' && styles.activeTab]}
          >
            <Search size={14} color="#000" style={{ marginRight: 6 }} />
            <Text style={styles.tabText}>SEARCH</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { setActiveTab('playlists'); setSelectedPlaylist(null); }}
            style={[styles.tab, activeTab === 'playlists' && styles.activeTab]}
          >
            <ListMusic size={14} color="#000" style={{ marginRight: 6 }} />
            <Text style={styles.tabText}>PLAYLISTS</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { setActiveTab('liked'); setSelectedPlaylist(null); }}
            style={[styles.tab, activeTab === 'liked' && styles.activeTab]}
          >
            <Heart size={14} color="#000" style={{ marginRight: 6 }} />
            <Text style={styles.tabText}>LIKED</Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content Panel */}
        <RetroPanel style={styles.tabContentPanel} raised={false}>
          {activeTab === 'search' && (
            <View style={{ flex: 1 }}>
              <View style={styles.searchRow}>
                <RetroTextInput
                  placeholder="SEARCH MUSIC / YT TRACKS..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  containerStyle={{ flex: 1, marginRight: 6 }}
                  onSubmitEditing={handleSearch}
                />
                <RetroButton title="SEARCH" onPress={handleSearch} />
              </View>

              {searching ? (
                <View style={styles.centerContainer}>
                  <ActivityIndicator color={COLORS.primary} size="large" />
                </View>
              ) : (
                <FlatList
                  data={searchResults}
                  keyExtractor={(item) => item.trackUri}
                  renderItem={(info) => renderTrackItem({ ...info, sectionTracks: searchResults })}
                  contentContainerStyle={styles.listContainer}
                  ListEmptyComponent={
                    <View style={styles.centerContainer}>
                      <Text style={styles.emptyText}>ENTER SEARCH TERM AND DIAL PLAYBACK</Text>
                    </View>
                  }
                />
              )}
            </View>
          )}

          {activeTab === 'playlists' && (
            <View style={{ flex: 1 }}>
              {!selectedPlaylist ? (
                <View style={{ flex: 1 }}>
                  <View style={styles.playlistActionRow}>
                    <RetroButton
                      onPress={() => setShowPlaylistCreate(true)}
                      style={styles.playlistActionBtn}
                    >
                      <Plus size={14} color="#000" style={{ marginRight: 6 }} />
                      <Text style={styles.btnText}>NEW PLAYLIST</Text>
                    </RetroButton>
                    <RetroButton
                      onPress={() => setShowSpotifyImport(true)}
                      style={styles.playlistActionBtn}
                    >
                      <Download size={14} color="#000" style={{ marginRight: 6 }} />
                      <Text style={styles.btnText}>SPOTIFY IMPORT</Text>
                    </RetroButton>
                  </View>

                  {loadingPlaylists ? (
                    <View style={styles.centerContainer}>
                      <ActivityIndicator color={COLORS.primary} size="large" />
                    </View>
                  ) : (
                    <FlatList
                      data={playlists}
                      keyExtractor={(item) => item.id}
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={() => handleSelectPlaylist(item)}
                          style={styles.playlistRow}
                        >
                          <Music size={24} color="#000" style={{ marginRight: 12 }} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.playlistName}>{item.name.toUpperCase()}</Text>
                            <Text style={styles.playlistTracksCount}>{item._count?.tracks || 0} TRACKS</Text>
                          </View>
                        </TouchableOpacity>
                      )}
                      contentContainerStyle={styles.listContainer}
                      ListEmptyComponent={
                        <View style={styles.centerContainer}>
                          <Text style={styles.emptyText}>NO CUSTOM PLAYLISTS</Text>
                        </View>
                      }
                    />
                  )}
                </View>
              ) : (
                <View style={{ flex: 1 }}>
                  {/* Playlist Header details */}
                  <View style={styles.playlistDetailsHeader}>
                    <RetroButton title="BACK" onPress={() => setSelectedPlaylist(null)} style={{ marginRight: 10 }} />
                    <Text style={styles.playlistHeaderTitle} numberOfLines={1}>{selectedPlaylist.name.toUpperCase()}</Text>
                  </View>
                  
                  <FlatList
                    data={selectedPlaylist.tracks || []}
                    keyExtractor={(item) => item.id}
                    renderItem={(info) => renderTrackItem({ ...info, sectionTracks: selectedPlaylist.tracks })}
                    contentContainerStyle={styles.listContainer}
                    ListEmptyComponent={
                      <View style={styles.centerContainer}>
                        <Text style={styles.emptyText}>PLAYLIST IS EMPTY</Text>
                      </View>
                    }
                  />
                </View>
              )}
            </View>
          )}

          {activeTab === 'liked' && (
            <View style={{ flex: 1 }}>
              {loadingLikes ? (
                <View style={styles.centerContainer}>
                  <ActivityIndicator color={COLORS.primary} size="large" />
                </View>
              ) : (
                <FlatList
                  data={likedSongs}
                  keyExtractor={(item) => item.trackUri}
                  renderItem={(info) => renderTrackItem({ ...info, sectionTracks: likedSongs })}
                  contentContainerStyle={styles.listContainer}
                  ListEmptyComponent={
                    <View style={styles.centerContainer}>
                      <Text style={styles.emptyText}>NO LIKED SONGS FOUND</Text>
                    </View>
                  }
                />
              )}
            </View>
          )}
        </RetroPanel>

        {/* Dynamic Interactive Now Playing Panel */}
        <RetroPanel style={styles.playerPanel} raised>
          {currentTrack ? (
            <View style={styles.playerContainer}>
              <View style={styles.playerHeader}>
                <View style={styles.albumFrame}>
                  {currentTrack.coverUrl ? (
                    <Image source={{ uri: currentTrack.coverUrl }} style={styles.albumArt} />
                  ) : (
                    <Music size={28} color="#000" />
                  )}
                </View>
                <View style={styles.playerMeta}>
                  <Text style={styles.nowPlayingTitle} numberOfLines={1}>{currentTrack.title}</Text>
                  <Text style={styles.nowPlayingArtist} numberOfLines={1}>{currentTrack.artist}</Text>
                </View>
              </View>

              {/* Progress Bar Timeline */}
              <View style={styles.progressRow}>
                <Text style={styles.timeText}>{formatTime(position)}</Text>
                <View style={styles.progressLineBg}>
                  <View style={[styles.progressLineFill, { width: `${progressPercent}%` }]} />
                </View>
                <Text style={styles.timeText}>{formatTime(duration)}</Text>
              </View>

              {/* Playback Button Actions */}
              <View style={styles.controlRow}>
                <RetroButton onPress={toggleShuffle} style={[styles.miniControlBtn, isShuffled && styles.activeControlBtn]}>
                  <Shuffle size={14} color="#000" />
                </RetroButton>
                
                <RetroButton onPress={prevTrack} style={styles.miniControlBtn}>
                  <SkipBack size={16} color="#000" fill="#000" />
                </RetroButton>

                <RetroButton
                  onPress={isPlaying ? pauseTrack : resumeTrack}
                  style={styles.playPauseBtn}
                >
                  {isPlaying ? (
                    <Pause size={20} color="#000" fill="#000" />
                  ) : (
                    <Play size={20} color="#000" fill="#000" style={{ marginLeft: 2 }} />
                  )}
                </RetroButton>

                <RetroButton onPress={nextTrack} style={styles.miniControlBtn}>
                  <SkipForward size={16} color="#000" fill="#000" />
                </RetroButton>

                <RetroButton onPress={toggleLoop} style={[styles.miniControlBtn, isLooping && styles.activeControlBtn]}>
                  <Repeat size={14} color="#000" />
                </RetroButton>
              </View>
            </View>
          ) : (
            <View style={styles.idlePlayer}>
              <Music size={20} color="#808080" style={{ marginRight: 10 }} />
              <Text style={styles.idleText}>NO SONG SELECT DECK LOADED</Text>
            </View>
          )}
        </RetroPanel>
      </RetroWindow>

      {/* Playlist Create Modal */}
      <Modal visible={showPlaylistCreate} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <RetroWindow
            title="CREATE_PLAYLIST.EXE"
            onClose={() => setShowPlaylistCreate(false)}
            style={{ width: 280 }}
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalLabel}>ENTER PLAYLIST NAME:</Text>
              <RetroTextInput
                placeholder="MY ALBUM PLAYLIST"
                value={newPlaylistName}
                onChangeText={setNewPlaylistName}
                containerStyle={{ marginBottom: 12 }}
              />
              <View style={styles.modalBtnRow}>
                <RetroButton title="CREATE" onPress={handleCreatePlaylist} style={{ flex: 1, marginRight: 6 }} />
                <RetroButton title="CANCEL" onPress={() => setShowPlaylistCreate(false)} style={{ flex: 1 }} />
              </View>
            </View>
          </RetroWindow>
        </View>
      </Modal>

      {/* Spotify Import Modal */}
      <Modal visible={showSpotifyImport} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <RetroWindow
            title="SPOTIFY_IMPORT.EXE"
            onClose={() => setShowSpotifyImport(false)}
            style={{ width: 310 }}
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalLabel}>SPOTIFY PLAYLIST URL:</Text>
              <RetroTextInput
                placeholder="https://open.spotify.com/playlist/..."
                value={spotifyUrl}
                onChangeText={setSpotifyUrl}
                containerStyle={{ marginBottom: 12 }}
              />
              {importing ? (
                <View style={{ paddingVertical: 10, alignItems: 'center' }}>
                  <ActivityIndicator color={COLORS.primary} size="small" />
                  <Text style={styles.importingText}>PARSING AND IMPORTING METADATA...</Text>
                </View>
              ) : (
                <View style={styles.modalBtnRow}>
                  <RetroButton title="IMPORT" onPress={handleImportSpotify} style={{ flex: 1, marginRight: 6 }} />
                  <RetroButton title="CANCEL" onPress={() => setShowSpotifyImport(false)} style={{ flex: 1 }} />
                </View>
              )}
            </View>
          </RetroWindow>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: RETRO_COLORS.desktop,
    padding: 8,
  },
  statusBarSpacer: {
    height: Platform.OS === 'android' ? 34 : 20,
  },
  windowContent: {
    flex: 1,
    padding: 8,
  },
  tabBar: {
    flexDirection: 'row',
    marginBottom: 2,
    zIndex: 10,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    backgroundColor: RETRO_COLORS.windowBackground,
    borderWidth: 2,
    borderTopColor: RETRO_COLORS.panelLight,
    borderLeftColor: RETRO_COLORS.panelLight,
    borderRightColor: RETRO_COLORS.panelDark,
    borderBottomColor: RETRO_COLORS.panelDark,
  },
  activeTab: {
    backgroundColor: '#fff',
    borderBottomWidth: 0,
    borderTopColor: RETRO_COLORS.panelLight,
    borderLeftColor: RETRO_COLORS.panelLight,
    borderRightColor: RETRO_COLORS.panelDark,
  },
  tabText: {
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    color: '#000000',
  },
  tabContentPanel: {
    flex: 1,
    padding: 8,
    borderWidth: 2,
    borderTopColor: RETRO_COLORS.panelDark,
    borderLeftColor: RETRO_COLORS.panelDark,
    borderRightColor: RETRO_COLORS.panelLight,
    borderBottomColor: RETRO_COLORS.panelLight,
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  searchRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  listContainer: {
    paddingBottom: 10,
  },
  trackRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  activeTrackRow: {
    backgroundColor: '#000080',
  },
  trackDetails: {
    flex: 1,
    marginRight: 10,
  },
  trackTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    color: '#000',
  },
  activeTrackText: {
    color: '#fff',
  },
  trackArtist: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#666',
    marginTop: 2,
  },
  trackActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  likeBtn: {
    padding: 6,
    marginRight: 6,
  },
  trackDuration: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#555',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: '#808080',
    fontSize: 12,
    fontFamily: 'monospace',
    fontWeight: 'bold',
  },
  playlistActionRow: {
    flexDirection: 'row',
    marginBottom: 10,
    gap: 6,
  },
  playlistActionBtn: {
    flex: 1,
    flexDirection: 'row',
  },
  btnText: {
    fontSize: 11,
    fontFamily: 'monospace',
    fontWeight: 'bold',
  },
  playlistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#d4d0c8',
  },
  playlistName: {
    fontSize: 13,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    color: '#000',
  },
  playlistTracksCount: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#808080',
    marginTop: 2,
  },
  playlistDetailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: '#808080',
    paddingBottom: 6,
  },
  playlistHeaderTitle: {
    fontSize: 14,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    color: '#000',
    flex: 1,
  },
  playerPanel: {
    padding: 10,
  },
  playerContainer: {
    width: '100%',
  },
  playerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  albumFrame: {
    width: 44,
    height: 44,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#808080',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  albumArt: {
    width: 40,
    height: 40,
  },
  playerMeta: {
    flex: 1,
  },
  nowPlayingTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    color: '#000',
  },
  nowPlayingArtist: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#666',
    marginTop: 2,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  timeText: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#333',
  },
  progressLineBg: {
    flex: 1,
    height: 6,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#808080',
    marginHorizontal: 8,
    position: 'relative',
  },
  progressLineFill: {
    height: '100%',
    backgroundColor: '#000080',
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  miniControlBtn: {
    width: 32,
    height: 28,
    paddingVertical: 0,
    paddingHorizontal: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeControlBtn: {
    backgroundColor: '#fff',
    borderColor: '#0a0a0a',
  },
  playPauseBtn: {
    width: 46,
    height: 38,
    borderRadius: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  idlePlayer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
  },
  idleText: {
    color: '#555',
    fontFamily: 'monospace',
    fontWeight: 'bold',
    fontSize: 11,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    padding: 12,
  },
  modalLabel: {
    fontSize: 11,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 6,
  },
  modalBtnRow: {
    flexDirection: 'row',
  },
  importingText: {
    fontSize: 9,
    fontFamily: 'monospace',
    color: '#555',
    marginTop: 6,
    textAlign: 'center',
  },
});
