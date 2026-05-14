import { del, list, put } from '@vercel/blob';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const storageDir = path.join(rootDir, 'storage');
const uploadDir = path.join(storageDir, 'uploads');
const playlistPath = path.join(storageDir, 'playlist.json');
const playlistPrefix = 'data/playlists/';

export const useBlobStorage = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

function emptyPlaylist() {
  return { updatedAt: new Date().toISOString(), ads: [] };
}

function clampDuration(value) {
  return Math.max(1, Math.min(3600, Number(value) || 10));
}

function cleanTitle(value) {
  return String(value || 'Untitled ad').trim().slice(0, 80) || 'Untitled ad';
}

function decodeImageDataUrl(imageDataUrl) {
  const match = /^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i.exec(String(imageDataUrl || ''));

  if (!match) {
    throw Object.assign(new Error('A PNG, JPG, or WebP image data URL is required.'), {
      statusCode: 400
    });
  }

  return {
    extension: match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase(),
    buffer: Buffer.from(match[2], 'base64'),
    contentType: `image/${match[1].toLowerCase() === 'jpg' ? 'jpeg' : match[1].toLowerCase()}`
  };
}

function normalizePlaylist(playlist) {
  if (!playlist || !Array.isArray(playlist.ads)) return emptyPlaylist();

  return {
    updatedAt: playlist.updatedAt || new Date().toISOString(),
    ads: playlist.ads.map((ad) => ({
      ...ad,
      durationSeconds: clampDuration(ad.durationSeconds)
    }))
  };
}

function toAdResponse(ad) {
  return {
    id: ad.id,
    title: ad.title,
    imageUrl: ad.imageUrl || `/uploads/${ad.filename}`,
    durationSeconds: ad.durationSeconds,
    createdAt: ad.createdAt
  };
}

async function readLocalPlaylist() {
  try {
    const raw = await fs.readFile(playlistPath, 'utf8');
    return normalizePlaylist(JSON.parse(raw));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return emptyPlaylist();
  }
}

async function writeLocalPlaylist(playlist) {
  await fs.mkdir(storageDir, { recursive: true });
  const next = normalizePlaylist({
    updatedAt: new Date().toISOString(),
    ads: playlist.ads
  });

  await fs.writeFile(playlistPath, JSON.stringify(next, null, 2));
  return next;
}

async function readBlobPlaylist() {
  const { blobs } = await list({ prefix: playlistPrefix, limit: 1000 });

  if (!blobs.length) return emptyPlaylist();

  const latest = blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))[0];
  const response = await fetch(latest.url, { cache: 'no-store' });

  if (!response.ok) {
    throw new Error(`Could not read playlist blob: ${response.status}`);
  }

  return normalizePlaylist(await response.json());
}

async function writeBlobPlaylist(playlist) {
  const next = normalizePlaylist({
    updatedAt: new Date().toISOString(),
    ads: playlist.ads
  });
  const pathname = `${playlistPrefix}${Date.now()}-${randomUUID()}.json`;

  await put(pathname, JSON.stringify(next, null, 2), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    cacheControlMaxAge: 60
  });

  cleanupOldBlobPlaylists(pathname).catch((error) => {
    console.error('Could not clean old playlist blobs', error);
  });

  return next;
}

async function cleanupOldBlobPlaylists(currentPathname) {
  const { blobs } = await list({ prefix: playlistPrefix, limit: 1000 });
  const oldPlaylistUrls = blobs
    .filter((blob) => blob.pathname !== currentPathname)
    .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
    .slice(10)
    .map((blob) => blob.url);

  if (oldPlaylistUrls.length) {
    await del(oldPlaylistUrls);
  }
}

async function readPlaylist() {
  if (useBlobStorage) return readBlobPlaylist();
  return readLocalPlaylist();
}

async function writePlaylist(playlist) {
  if (useBlobStorage) return writeBlobPlaylist(playlist);
  return writeLocalPlaylist(playlist);
}

async function storeImage({ id, imageDataUrl }) {
  const image = decodeImageDataUrl(imageDataUrl);

  if (image.buffer.length > 15 * 1024 * 1024) {
    throw Object.assign(new Error('Image must be smaller than 15 MB.'), { statusCode: 413 });
  }

  if (useBlobStorage) {
    const blob = await put(`ads/${id}.${image.extension}`, image.buffer, {
      access: 'public',
      contentType: image.contentType,
      addRandomSuffix: false,
      cacheControlMaxAge: 31536000
    });

    return {
      imageUrl: blob.url,
      imagePathname: blob.pathname
    };
  }

  await fs.mkdir(uploadDir, { recursive: true });
  const filename = `${id}.${image.extension}`;
  await fs.writeFile(path.join(uploadDir, filename), image.buffer);

  return {
    filename,
    imageUrl: `/uploads/${filename}`
  };
}

export async function ensureLocalStorage() {
  if (!useBlobStorage) {
    await fs.mkdir(uploadDir, { recursive: true });
  }
}

export async function getPublicPlaylist() {
  const playlist = await readPlaylist();

  return {
    updatedAt: playlist.updatedAt,
    ads: playlist.ads.map(toAdResponse)
  };
}

export async function createAd(input) {
  const id = randomUUID();
  const image = await storeImage({ id, imageDataUrl: input.imageDataUrl });
  const playlist = await readPlaylist();
  const ad = {
    id,
    title: cleanTitle(input.title),
    durationSeconds: clampDuration(input.durationSeconds),
    createdAt: new Date().toISOString(),
    ...image
  };

  playlist.ads.push(ad);
  const saved = await writePlaylist(playlist);

  return {
    updatedAt: saved.updatedAt,
    ad: toAdResponse(ad)
  };
}

export async function updateAd(id, input) {
  const playlist = await readPlaylist();
  const ad = playlist.ads.find((item) => item.id === id);

  if (!ad) {
    throw Object.assign(new Error('Ad not found.'), { statusCode: 404 });
  }

  if (input.title !== undefined) {
    ad.title = cleanTitle(input.title);
  }

  if (input.durationSeconds !== undefined) {
    ad.durationSeconds = clampDuration(input.durationSeconds);
  }

  const saved = await writePlaylist(playlist);

  return {
    updatedAt: saved.updatedAt,
    ad: toAdResponse(ad)
  };
}

export async function deleteAd(id) {
  const playlist = await readPlaylist();
  const ad = playlist.ads.find((item) => item.id === id);

  if (!ad) {
    throw Object.assign(new Error('Ad not found.'), { statusCode: 404 });
  }

  await writePlaylist({
    ads: playlist.ads.filter((item) => item.id !== id)
  });

  if (useBlobStorage) {
    await del(ad.imagePathname || ad.imageUrl);
  } else if (ad.filename) {
    await fs.rm(path.join(uploadDir, ad.filename), { force: true });
  }
}

