import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import type { StreamSource } from '../src/shared/types.ts';
import { parseStreamUrl } from '../src/utils/clipMath.ts';
import { MEDIA_DIR, ensureDirectories, isPathInside } from './store.ts';
import { ensureSampleStreamFile, probeVideo } from './mediaEngine.ts';

const execFileAsync = promisify(execFile);

const YT_DLP_BIN = path.resolve(process.cwd(), 'bin', 'yt-dlp');
const TWITCH_PUBLIC_CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko';

export function getYtDlpPath(): string {
  if (fs.existsSync(YT_DLP_BIN)) {
    return YT_DLP_BIN;
  }
  return 'yt-dlp';
}

export interface CreatorSearchResult {
  platform: 'twitch' | 'kick';
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  followers?: number;
}

export async function searchTwitchCreators(query: string): Promise<CreatorSearchResult[]> {
  const clean = query.trim();
  if (!clean) return [];

  const gqlQuery = {
    query: `query($query: String!) {
      searchUsers(userQuery: $query, first: 6) {
        edges {
          node {
            id
            login
            displayName
            profileImageURL(width: 150)
          }
        }
      }
    }`,
    variables: { query: clean },
  };

  const resp = await fetch('https://gql.twitch.tv/gql', {
    method: 'POST',
    headers: {
      'Client-ID': TWITCH_PUBLIC_CLIENT_ID,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(gqlQuery),
  });

  if (!resp.ok) {
    throw new Error(`Twitch search returned HTTP ${resp.status}`);
  }
  const data = (await resp.json()) as {
    data?: {
      searchUsers?: {
        edges?: Array<{
          node: { id: string; login: string; displayName: string; profileImageURL: string };
        }>;
      };
    };
  };

  const edges = data.data?.searchUsers?.edges ?? [];
  return edges.map(({ node }) => ({
    platform: 'twitch',
    id: node.id,
    username: node.login,
    displayName: node.displayName,
    avatarUrl: node.profileImageURL,
  }));
}

export async function getTwitchVodsByUsername(username: string): Promise<{
  creator: CreatorSearchResult | null;
  vods: StreamSource[];
}> {
  const clean = username.trim().toLowerCase().replace(/^@/, '');
  const gqlQuery = {
    query: `query($login: String!) {
      user(login: $login) {
        id
        login
        displayName
        profileImageURL(width: 150)
        videos(first: 8, type: ARCHIVE) {
          edges {
            node {
              id
              title
              lengthSeconds
              createdAt
              thumbnailURLs(width: 640, height: 360)
            }
          }
        }
      }
    }`,
    variables: { login: clean },
  };

  const resp = await fetch('https://gql.twitch.tv/gql', {
    method: 'POST',
    headers: {
      'Client-ID': TWITCH_PUBLIC_CLIENT_ID,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(gqlQuery),
  });

  if (!resp.ok) {
    throw new Error(`Twitch VOD lookup failed with HTTP ${resp.status}`);
  }

  const data = (await resp.json()) as {
    data?: {
      user?: {
        id: string;
        login: string;
        displayName: string;
        profileImageURL: string;
        videos?: {
          edges?: Array<{
            node: {
              id: string;
              title: string;
              lengthSeconds: number;
              createdAt: string;
              thumbnailURLs: string[];
            };
          }>;
        };
      };
    };
  };

  const user = data.data?.user;
  if (!user) {
    return { creator: null, vods: [] };
  }

  const creator: CreatorSearchResult = {
    platform: 'twitch',
    id: user.id,
    username: user.login,
    displayName: user.displayName,
    avatarUrl: user.profileImageURL,
  };

  const vods: StreamSource[] = (user.videos?.edges ?? []).map(({ node }) => ({
    id: `twitch_${node.id}`,
    platform: 'twitch',
    title: node.title || `${user.displayName} Stream`,
    creatorName: user.displayName,
    creatorHandle: `@${user.login}`,
    creatorAvatar: user.profileImageURL,
    thumbnailUrl: node.thumbnailURLs?.[0] || '',
    durationSeconds: node.lengthSeconds || 1200,
    sourceUrl: `https://www.twitch.tv/videos/${node.id}`,
    createdAt: node.createdAt || new Date().toISOString(),
  }));

  return { creator, vods };
}

async function fetchKickJson(url: string): Promise<unknown> {
  const resp = await fetch(url, { headers: { Accept: 'application/json' } });
  if (resp.status === 404) return null;
  if (resp.ok) {
    return resp.json();
  }
  // Fallback to curl if Cloudflare blocks Node fetch TLS fingerprint
  const { stdout } = await execFileAsync('curl', ['-sL', '-A', 'Mozilla/5.0', url], {
    maxBuffer: 8 * 1024 * 1024,
    timeout: 15000,
  });
  const trimmed = stdout.trim();
  if (!trimmed || trimmed.startsWith('<')) {
    throw new Error(`Kick channel lookup failed (HTTP ${resp.status})`);
  }
  return JSON.parse(trimmed);
}

export async function getKickChannelAndVods(slugInput: string): Promise<{
  creator: CreatorSearchResult | null;
  vods: StreamSource[];
}> {
  const slug = slugInput.trim().toLowerCase().replace(/^@/, '').replace(/[^a-z0-9_-]/g, '');
  if (!slug) {
    return { creator: null, vods: [] };
  }

  const [channelData, videosData] = await Promise.all([
    fetchKickJson(`https://kick.com/api/v2/channels/${encodeURIComponent(slug)}`),
    fetchKickJson(`https://kick.com/api/v2/channels/${encodeURIComponent(slug)}/videos`).catch(() => []),
  ]);

  if (!channelData) {
    return { creator: null, vods: [] };
  }

  const ch = channelData as {
    id?: number;
    slug?: string;
    playback_url?: string;
    user?: { username?: string; profile_pic?: string };
    livestream?: { session_title?: string; thumbnail?: { url?: string } };
  };

  const creator: CreatorSearchResult = {
    platform: 'kick',
    id: String(ch.id ?? slug),
    username: ch.slug || slug,
    displayName: ch.user?.username || ch.slug || slug,
    avatarUrl: ch.user?.profile_pic || '',
  };

  const rawVideos = Array.isArray(videosData) ? (videosData as Array<Record<string, unknown>>) : [];
  const vods: StreamSource[] = (Array.isArray(rawVideos) ? rawVideos : []).slice(0, 8).map((v) => {
    const uuid = String((v.video as Record<string, unknown>)?.uuid || v.uuid || v.id || '');
    const durationMs = Number(v.duration || 0);
    const thumbObj = v.thumbnail as Record<string, unknown> | undefined;
    return {
      id: `kick_${uuid || v.id}`,
      platform: 'kick',
      title: String(v.session_title || `${creator.displayName} Kick VOD`),
      creatorName: creator.displayName,
      creatorHandle: `@${creator.username}`,
      creatorAvatar: creator.avatarUrl,
      thumbnailUrl: String(thumbObj?.src || thumbObj?.url || ''),
      durationSeconds: durationMs > 10000 ? Math.round(durationMs / 1000) : Math.max(60, durationMs),
      sourceUrl: uuid
        ? `https://kick.com/${creator.username}/videos/${uuid}`
        : `https://kick.com/${creator.username}`,
      previewUrl: typeof v.source === 'string' ? v.source : ch.playback_url,
      createdAt: String(v.created_at || new Date().toISOString()),
    };
  });

  if (vods.length === 0 && ch.playback_url) {
    vods.push({
      id: `kick_live_${creator.username}`,
      platform: 'kick',
      title: ch.livestream?.session_title || `${creator.displayName} Live Stream`,
      creatorName: creator.displayName,
      creatorHandle: `@${creator.username}`,
      creatorAvatar: creator.avatarUrl,
      thumbnailUrl: ch.livestream?.thumbnail?.url || '',
      durationSeconds: 3600,
      sourceUrl: `https://kick.com/${creator.username}`,
      previewUrl: ch.playback_url,
      createdAt: new Date().toISOString(),
    });
  }

  return { creator, vods };
}

export async function resolveStreamWithYtDlp(
  rawUrl: string,
  youtubeCookiesText?: string
): Promise<{
  stream: StreamSource;
  playableStreamUrl?: string;
  warning?: string;
}> {
  const parsed = parseStreamUrl(rawUrl);
  if (!parsed.valid || !parsed.platform) {
    throw new Error(parsed.error || 'Unsupported stream URL.');
  }

  const ytdlp = getYtDlpPath();
  let cookieFile: string | undefined;

  try {
    ensureDirectories();
    const args = ['--no-warnings', '--skip-download', '--dump-json'];

    if (youtubeCookiesText && youtubeCookiesText.trim().length > 20) {
      cookieFile = path.join(MEDIA_DIR, `cookies_${Date.now()}.txt`);
      fs.writeFileSync(cookieFile, youtubeCookiesText, 'utf-8');
      args.push('--cookies', cookieFile);
    }

    args.push(parsed.normalizedUrl);

    try {
      const { stdout } = await execFileAsync(ytdlp, args, {
        maxBuffer: 12 * 1024 * 1024,
        timeout: 30000,
      });
      const info = JSON.parse(stdout.trim().split('\n').pop() || '{}') as Record<string, unknown>;
      const formats = Array.isArray(info.formats) ? (info.formats as Array<Record<string, unknown>>) : [];
      const bestDirect =
        formats.find((f) => f.vcodec !== 'none' && f.acodec !== 'none' && typeof f.url === 'string') ||
        formats.find((f) => typeof f.url === 'string');

      const stream: StreamSource = {
        id: `${parsed.platform}_${info.id || parsed.videoId || Date.now()}`,
        platform: parsed.platform,
        title: String(info.title || `${parsed.platform.toUpperCase()} Stream`),
        creatorName: String(info.uploader || info.channel || parsed.channelSlug || 'Creator'),
        creatorHandle: String(info.uploader_id || parsed.channelSlug || '@creator'),
        thumbnailUrl: String(info.thumbnail || ''),
        durationSeconds: Number(info.duration) || 1200,
        sourceUrl: parsed.normalizedUrl,
        previewUrl: typeof bestDirect?.url === 'string' ? bestDirect.url : undefined,
        createdAt: new Date().toISOString(),
        width: Number(info.width) || 1920,
        height: Number(info.height) || 1080,
        fps: Number(info.fps) || 60,
      };

      return {
        stream,
        playableStreamUrl: typeof bestDirect?.url === 'string' ? bestDirect.url : undefined,
      };
    } catch (ytdlpErr) {
      // Fallback for YouTube metadata via oEmbed when datacenter IP triggers YouTube bot-gate
      if (parsed.platform === 'youtube') {
        const oembedResp = await fetch(
          `https://www.youtube.com/oembed?url=${encodeURIComponent(parsed.normalizedUrl)}&format=json`
        );
        if (oembedResp.ok) {
          const oe = (await oembedResp.json()) as {
            title?: string;
            author_name?: string;
            thumbnail_url?: string;
          };
          const errMsg = ytdlpErr instanceof Error ? ytdlpErr.message : String(ytdlpErr);
          const botGate = /Sign in to confirm|bot/i.test(errMsg);
          return {
            stream: {
              id: `youtube_${parsed.videoId}`,
              platform: 'youtube',
              title: oe.title || 'YouTube Stream',
              creatorName: oe.author_name || 'YouTube Creator',
              creatorHandle: oe.author_name || '@youtube',
              thumbnailUrl: oe.thumbnail_url || '',
              durationSeconds: 1800,
              sourceUrl: parsed.normalizedUrl,
              createdAt: new Date().toISOString(),
            },
            warning: botGate
              ? 'YouTube metadata loaded via oEmbed. Direct media stream download from this server IP requires optional YouTube cookies or a local upload for FFmpeg cutting.'
              : errMsg,
          };
        }
      }
      throw ytdlpErr;
    }
  } finally {
    if (cookieFile && fs.existsSync(cookieFile)) {
      fs.unlinkSync(cookieFile);
    }
  }
}

export async function downloadStreamSegmentForClip(params: {
  stream: StreamSource;
  startSec: number;
  endSec: number;
}): Promise<string> {
  if (params.stream.localFilePath && fs.existsSync(params.stream.localFilePath)) {
    return params.stream.localFilePath;
  }
  if (params.stream.platform === 'sample') {
    const key = params.stream.id.includes('gaming')
      ? 'gaming'
      : params.stream.id.includes('car')
      ? 'car'
      : 'irl';
    return ensureSampleStreamFile(key);
  }

  ensureDirectories();
  const ytdlp = getYtDlpPath();
  const safeId = params.stream.id.replace(/[^a-zA-Z0-9_-]/g, '_');
  const cachedPath = path.join(MEDIA_DIR, `${safeId}_seg_${Math.floor(params.startSec)}_${Math.floor(params.endSec)}.mp4`);
  if (!isPathInside(cachedPath, MEDIA_DIR)) {
    throw new Error('Invalid cache path.');
  }
  if (fs.existsSync(cachedPath) && fs.statSync(cachedPath).size > 10_000) {
    return cachedPath;
  }

  const targetUrl = params.stream.previewUrl || params.stream.sourceUrl;
  const parsed = parseStreamUrl(params.stream.sourceUrl);
  if (!parsed.valid && !params.stream.previewUrl) {
    throw new Error('Cannot resolve stream media URL.');
  }

  // Extract direct URL with yt-dlp or download bounded section directly with ffmpeg
  let mediaUrl = params.stream.previewUrl;
  if (!mediaUrl) {
    const { stdout } = await execFileAsync(
      ytdlp,
      ['--no-warnings', '-g', '-f', 'best[ext=mp4]/best', params.stream.sourceUrl],
      { timeout: 30000 }
    );
    mediaUrl = stdout.trim().split('\n')[0];
  }

  if (!mediaUrl || !/^https?:\/\//i.test(mediaUrl)) {
    throw new Error(`Unable to fetch playable stream URL for ${targetUrl}`);
  }

  const segDuration = Math.min(180, Math.max(5, params.endSec - params.startSec + 4));
  const safeStart = Math.max(0, params.startSec - 1);

  await execFileAsync(
    'ffmpeg',
    [
      '-y',
      '-ss',
      String(safeStart),
      '-t',
      String(segDuration),
      '-i',
      mediaUrl,
      '-c',
      'copy',
      cachedPath,
    ],
    { timeout: 90000 }
  );

  await probeVideo(cachedPath);
  return cachedPath;
}
