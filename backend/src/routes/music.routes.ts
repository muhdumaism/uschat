import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import axios from 'axios';
import { prisma } from '../prisma/client';
import { authenticate } from '../middleware/auth.middleware';
import { config } from '../config';

const searchSchema = z.object({
  q: z.string().min(1),
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

// Robust YouTube scraper (100% free, no API key needed, no daily quota limits)
async function searchYouTube(query: string): Promise<any[]> {
  try {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 8000,
    });

    const html = response.data;
    const regex = /var ytInitialData\s*=\s*({.+?});/;
    const match = regex.exec(html);
    if (!match) return [];

    const json = JSON.parse(match[1]);
    const contents =
      json.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]
        ?.itemSectionRenderer?.contents || [];

    const tracks: any[] = [];
    for (const item of contents) {
      const video = item.videoRenderer;
      if (!video) continue;

      const title = video.title?.runs?.[0]?.text || '';
      const videoId = video.videoId;
      if (!videoId) continue;

      const artist = video.ownerText?.runs?.[0]?.text || 'Unknown Artist';
      const durationText = video.lengthText?.simpleText || '3:00';

      const parts = durationText.split(':').map(Number);
      let duration = 0;
      if (parts.length === 2) {
        duration = parts[0] * 60 + parts[1];
      } else if (parts.length === 3) {
        duration = parts[0] * 3600 + parts[1] * 60 + parts[2];
      }

      const thumbnails = video.thumbnail?.thumbnails || [];
      const coverUrl = thumbnails.length > 0 ? thumbnails[thumbnails.length - 1].url : null;
      const trackUri = `https://www.youtube.com/watch?v=${videoId}`;

      tracks.push({
        title,
        artist,
        duration,
        trackUri,
        coverUrl,
        album: null,
      });
    }
    return tracks;
  } catch (err: any) {
    console.error('[YouTubeSearch] Scraper failed:', err?.message || err);
    return [];
  }
}

export async function musicRoutes(fastify: FastifyInstance) {
  // 1. Search Music (Lavalink node with direct YouTube fallback, completely free with no API key)
  fastify.get('/search', { preHandler: [authenticate] }, async (request, reply) => {
    const { q } = searchSchema.parse(request.query);
    try {
      const lavalinkUrl = `http://${config.lavalink.host}:${config.lavalink.port}/v4/loadtracks`;
      const response = await axios.get(lavalinkUrl, {
        params: { identifier: `ytsearch:${q}` },
        headers: { Authorization: config.lavalink.password },
        timeout: 4000,
      });

      const data = response.data;
      const loadTypeUpper = String(data.loadType).toUpperCase();

      if (
        (loadTypeUpper === 'SEARCH' || loadTypeUpper === 'TRACK_LOADED') &&
        Array.isArray(data.data) &&
        data.data.length > 0
      ) {
        const tracks = data.data.map((item: any) => ({
          title: item.info.title,
          artist: item.info.author,
          duration: Math.floor(item.info.length / 1000),
          trackUri: item.info.uri,
          coverUrl: item.info.artworkUrl || null,
          album: null,
        }));
        return reply.send(tracks);
      }

      fastify.log.warn('[MusicRouter] Lavalink empty or unconfigured. Using YouTube search fallback...');
      const fallbackTracks = await searchYouTube(q);
      return reply.send(fallbackTracks);
    } catch {
      fastify.log.warn('[MusicRouter] Lavalink node unavailable. Using YouTube search fallback...');
      const fallbackTracks = await searchYouTube(q);
      return reply.send(fallbackTracks);
    }
  });

  // 2. Playlists CRUD Endpoints
  fastify.get('/playlists', { preHandler: [authenticate] }, async (request, reply) => {
    const playlists = await prisma.playlist.findMany({
      where: { userId: request.user.id },
      include: {
        tracks: { orderBy: { position: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return reply.send(playlists);
  });

  fastify.post('/playlist', { preHandler: [authenticate] }, async (request, reply) => {
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

  fastify.delete('/playlist/:id', { preHandler: [authenticate] }, async (request, reply) => {
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

  // 3. Liked Songs Endpoints
  fastify.get('/liked', { preHandler: [authenticate] }, async (request, reply) => {
    const liked = await prisma.likedSong.findMany({
      where: { userId: request.user.id },
      orderBy: { createdAt: 'desc' },
    });
    return reply.send(liked);
  });

  fastify.post('/like', { preHandler: [authenticate] }, async (request, reply) => {
    const body = addTrackSchema.parse(request.body);
    const userId = request.user.id;

    const existing = await prisma.likedSong.findFirst({
      where: { userId, title: body.title, artist: body.artist },
    });

    if (existing) {
      return reply.status(200).send(existing);
    }

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

  fastify.delete('/unlike', { preHandler: [authenticate] }, async (request, reply) => {
    const { trackUri } = z.object({ trackUri: z.string().url() }).parse(request.query);
    await prisma.likedSong.deleteMany({
      where: { trackUri, userId: request.user.id },
    });
    return reply.send({ success: true });
  });
}
