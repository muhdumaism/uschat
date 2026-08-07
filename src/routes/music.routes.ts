import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import axios from 'axios';
import ytdl from '@distube/ytdl-core';
import { prisma } from '../prisma/client';
import { authenticate } from '../middleware/auth.middleware';
import { config } from '../config';

const searchSchema = z.object({
  q: z.string().min(1),
});

const spotifyImportSchema = z.object({
  playlistUrl: z.string().url(),
});

const playlistCreateSchema = z.object({
  name: z.string().min(1).max(100),
});

const addTrackSchema = z.object({
  title: z.string().min(1),
  artist: z.string().min(1),
  album: z.string().optional().nullable(),
  duration: z.number().int().optional().nullable(),
  coverUrl: z.string().optional().nullable(),
  trackUri: z.string().url(),
});

export async function musicRoutes(fastify: FastifyInstance) {
  // 1. Search Music via Lavalink Node
  fastify.get('/search', { preHandler: [authenticate] }, async (request, reply) => {
    const { q } = searchSchema.parse(request.query);
    try {
      const lavalinkUrl = `http://${config.lavalink.host}:${config.lavalink.port}/v4/loadtracks`;
      const response = await axios.get(lavalinkUrl, {
        params: { identifier: `ytsearch:${q}` },
        headers: { Authorization: config.lavalink.password },
        timeout: 5000,
      });

      const data = response.data;
      if (data.loadType === 'search' && Array.isArray(data.data)) {
        const tracks = data.data.map((item: any) => ({
          title: item.info.title,
          artist: item.info.author,
          duration: Math.floor(item.info.length / 1000), // convert ms to seconds
          trackUri: item.info.uri, // YouTube watch link
          coverUrl: item.info.artworkUrl || null,
        }));
        return reply.send(tracks);
      }
      return reply.send([]);
    } catch (err: any) {
      fastify.log.error(err, '[MusicRouter] Lavalink search failed');
      return reply.status(500).send({ error: 'Internal Error', message: 'Failed to search tracks via Lavalink' });
    }
  });

  // 2. Direct Audio Stream Pipe (HTTP redirect)
  fastify.get('/stream', { preHandler: [authenticate] }, async (request, reply) => {
    const { uri } = z.object({ uri: z.string().url() }).parse(request.query);
    try {
      const info = await ytdl.getInfo(uri);
      const format = ytdl.chooseFormat(info.formats, { filter: 'audioonly', quality: 'highestaudio' });
      if (!format || !format.url) {
        return reply.status(404).send({ error: 'Not Found', message: 'No streaming formats found for this track' });
      }
      
      // Redirect to direct YouTube audio URL
      return reply.redirect(format.url);
    } catch (err: any) {
      fastify.log.error(err, '[MusicRouter] Stream resolution failed');
      return reply.status(500).send({ error: 'Resolution Failed', message: 'Failed to resolve audio stream link' });
    }
  });

  // 3. Spotify Playlist Metadata Import
  fastify.post('/spotify-import', { preHandler: [authenticate] }, async (request, reply) => {
    const { playlistUrl } = spotifyImportSchema.parse(request.body);
    const userId = request.user.id;

    if (!config.spotify.clientId || !config.spotify.clientSecret) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Spotify Client Credentials are not configured on the server.',
      });
    }

    try {
      // Extract Spotify Playlist ID
      const match = /\/playlist\/([a-zA-Z0-9]+)/.exec(playlistUrl);
      if (!match) {
        return reply.status(400).send({ error: 'Bad Request', message: 'Invalid Spotify playlist URL' });
      }
      const playlistId = match[1];

      // 1. Get Spotify Client Access Token
      const tokenRes = await axios.post(
        'https://accounts.spotify.com/api/token',
        'grant_type=client_credentials',
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${Buffer.from(
              `${config.spotify.clientId}:${config.spotify.clientSecret}`
            ).toString('base64')}`,
          },
        }
      );
      const accessToken = tokenRes.data.access_token;

      // 2. Fetch Playlist Details & Tracks from Spotify API
      const playlistRes = await axios.get(
        `https://api.spotify.com/v1/playlists/${playlistId}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      const playlistData = playlistRes.data;
      const playlistName = playlistData.name || 'Imported Playlist';
      const coverUrl = playlistData.images?.[0]?.url || null;

      // 3. Create Playlist Record in DB
      const dbPlaylist = await prisma.playlist.create({
        data: {
          userId,
          name: playlistName,
          coverUrl,
        },
      });

      // 4. Save tracks list
      const tracksItems = playlistData.tracks?.items || [];
      const tracksToCreate = [];

      for (let i = 0; i < tracksItems.length; i++) {
        const item = tracksItems[i];
        if (!item.track) continue;

        const trackName = item.track.name;
        const artistName = item.track.artists?.map((a: any) => a.name).join(', ') || 'Unknown';
        const albumName = item.track.album?.name || null;
        const durationSecs = Math.floor((item.track.duration_ms || 0) / 1000);
        const trackCover = item.track.album?.images?.[0]?.url || null;

        // Construct search query string for YouTube resolving later
        const searchQuery = `${trackName} ${artistName}`;
        const searchUri = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`;

        tracksToCreate.push({
          playlistId: dbPlaylist.id,
          title: trackName,
          artist: artistName,
          album: albumName,
          duration: durationSecs,
          coverUrl: trackCover,
          trackUri: searchUri, // Saved search string acting as URI fallback
          position: i,
        });
      }

      if (tracksToCreate.length > 0) {
        await prisma.playlistTrack.createMany({
          data: tracksToCreate,
        });
      }

      // Fetch the created playlist with its tracks
      const populated = await prisma.playlist.findUnique({
        where: { id: dbPlaylist.id },
        include: { tracks: { orderBy: { position: 'asc' } } },
      });

      return reply.status(201).send(populated);
    } catch (err: any) {
      fastify.log.error(err, '[MusicRouter] Spotify import error');
      return reply.status(500).send({
        error: 'Import Failed',
        message: err.response?.data?.error?.message || 'Failed to import Spotify playlist',
      });
    }
  });

  // 4. Playlists CRUD Endpoints
  fastify.get('/playlists', { preHandler: [authenticate] }, async (request, reply) => {
    const playlists = await prisma.playlist.findMany({
      where: { userId: request.user.id },
      include: {
        _count: { select: { tracks: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return reply.send(playlists);
  });

  fastify.post('/playlists', { preHandler: [authenticate] }, async (request, reply) => {
    const { name } = playlistCreateSchema.parse(request.body);
    const playlist = await prisma.playlist.create({
      data: {
        userId: request.user.id,
        name,
      },
    });
    return reply.status(201).send(playlist);
  });

  fastify.get('/playlists/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const playlist = await prisma.playlist.findFirst({
      where: { id, userId: request.user.id },
      include: {
        tracks: { orderBy: { position: 'asc' } },
      },
    });

    if (!playlist) {
      return reply.status(404).send({ error: 'Not Found', message: 'Playlist not found' });
    }
    return reply.send(playlist);
  });

  fastify.delete('/playlists/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.playlist.deleteMany({
      where: { id, userId: request.user.id },
    });
    return reply.send({ success: true });
  });

  fastify.post('/playlists/:id/tracks', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = addTrackSchema.parse(request.body);

    const playlist = await prisma.playlist.findFirst({
      where: { id, userId: request.user.id },
    });

    if (!playlist) {
      return reply.status(404).send({ error: 'Not Found', message: 'Playlist not found' });
    }

    const count = await prisma.playlistTrack.count({ where: { playlistId: id } });

    const newTrack = await prisma.playlistTrack.create({
      data: {
        playlistId: id,
        title: body.title,
        artist: body.artist,
        album: body.album,
        duration: body.duration,
        coverUrl: body.coverUrl,
        trackUri: body.trackUri,
        position: count,
      },
    });

    return reply.status(201).send(newTrack);
  });

  fastify.delete('/playlists/:id/tracks/:trackId', { preHandler: [authenticate] }, async (request, reply) => {
    const { id, trackId } = request.params as { id: string; trackId: string };
    
    const playlist = await prisma.playlist.findFirst({
      where: { id, userId: request.user.id },
    });

    if (!playlist) {
      return reply.status(404).send({ error: 'Not Found', message: 'Playlist not found' });
    }

    await prisma.playlistTrack.delete({
      where: { id: trackId },
    });

    return reply.send({ success: true });
  });

  // 5. Liked Songs Endpoints
  fastify.get('/liked-songs', { preHandler: [authenticate] }, async (request, reply) => {
    const liked = await prisma.likedSong.findMany({
      where: { userId: request.user.id },
      orderBy: { createdAt: 'desc' },
    });
    return reply.send(liked);
  });

  fastify.post('/liked-songs', { preHandler: [authenticate] }, async (request, reply) => {
    const body = addTrackSchema.parse(request.body);
    const userId = request.user.id;

    const liked = await prisma.likedSong.create({
      data: {
        userId,
        title: body.title,
        artist: body.artist,
        album: body.album,
        duration: body.duration,
        coverUrl: body.coverUrl,
        trackUri: body.trackUri,
      },
    });

    return reply.status(201).send(liked);
  });

  fastify.delete('/liked-songs/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.likedSong.deleteMany({
      where: { id, userId: request.user.id },
    });
    return reply.send({ success: true });
  });
}
