/**
 * ARCHITECTURAL NOTE (Rule 10 Maintainer Guidance):
 * Single Source of Truth (SSOT) utility for extracting and formatting audio/video durations.
 * Supports:
 * 1. Probing browser audio/video metadata from File blobs before upload.
 * 2. Formatting seconds into standardized 'M:SS' or 'H:MM:SS' strings (e.g. "2:15", "1:04:20").
 * 3. Parsing ISO 8601 duration strings (e.g. "PT2M15S") from YouTube / video metadata APIs.
 *
 * TESTABILITY: Pure functions can be tested directly with mock File blobs and duration strings.
 * RELATED SURFACES: media-uploader.tsx, add-link-button.tsx, media-backfill-service.ts, block-inspector.tsx.
 */

/**
 * Formats a numeric duration in seconds into a clean human-readable duration string.
 * Example: 135 -> "2:15", 3725 -> "1:02:05", 0 -> ""
 */
export function formatSecondsToDuration(seconds: number): string {
  if (typeof seconds !== 'number' || isNaN(seconds) || seconds <= 0 || !isFinite(seconds)) {
    return '';
  }

  const totalSeconds = Math.round(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  const paddedSecs = secs < 10 ? `0${secs}` : `${secs}`;

  if (hours > 0) {
    const paddedMins = minutes < 10 ? `0${minutes}` : `${minutes}`;
    return `${hours}:${paddedMins}:${paddedSecs}`;
  }

  return `${minutes}:${paddedSecs}`;
}

/**
 * Extracts the media duration from a staged local File (video or audio) in browser context.
 * Creates a transient DOM audio/video element, loads metadata, formats the duration, and cleans up.
 */
export function extractFileDuration(file: File): Promise<string> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !file) {
      resolve('');
      return;
    }

    const mimeType = file.type || '';
    const isAudio = mimeType.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(file.name);
    const isVideo = mimeType.startsWith('video/') || /\.(mp4|webm|mov|mkv|avi)$/i.test(file.name);

    if (!isAudio && !isVideo) {
      resolve('');
      return;
    }

    let objectUrl = '';
    try {
      objectUrl = URL.createObjectURL(file);
    } catch {
      resolve('');
      return;
    }

    const element = document.createElement(isAudio ? 'audio' : 'video');
    element.preload = 'metadata';

    const cleanup = () => {
      element.onloadedmetadata = null;
      element.onerror = null;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };

    // Timeout fallback after 4 seconds to prevent stalling UI
    const timeoutId = setTimeout(() => {
      cleanup();
      resolve('');
    }, 4000);

    element.onloadedmetadata = () => {
      clearTimeout(timeoutId);
      const formatted = formatSecondsToDuration(element.duration || 0);
      cleanup();
      resolve(formatted);
    };

    element.onerror = () => {
      clearTimeout(timeoutId);
      cleanup();
      resolve('');
    };

    element.src = objectUrl;
  });
}

/**
 * Parses an ISO 8601 duration string (e.g. "PT2M15S", "PT1H4M20S", "PT45S") into "M:SS" or "H:MM:SS".
 */
export function parseIso8601Duration(isoDuration: string): string {
  if (!isoDuration || typeof isoDuration !== 'string') return '';

  const regex = /P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i;
  const matches = isoDuration.match(regex);

  if (!matches) return '';

  const days = parseInt(matches[1] || '0', 10);
  const hours = parseInt(matches[2] || '0', 10) + days * 24;
  const minutes = parseInt(matches[3] || '0', 10);
  const seconds = parseInt(matches[4] || '0', 10);

  const totalSeconds = hours * 3600 + minutes * 60 + seconds;
  return formatSecondsToDuration(totalSeconds);
}

/**
 * Probes an online media URL (video/audio file or YouTube link) to extract its duration.
 */
export async function extractMediaUrlDuration(mediaUrl: string): Promise<string> {
  if (!mediaUrl || typeof mediaUrl !== 'string') return '';

  // 1. YouTube Link Handling
  const ytMatch = mediaUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/i);
  if (ytMatch && ytMatch[1]) {
    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${ytMatch[1]}&format=json`;
      const res = await fetch(oembedUrl);
      if (res.ok) {
        const data = await res.json() as { duration?: number };
        if (data.duration && typeof data.duration === 'number') {
          return formatSecondsToDuration(data.duration);
        }
      }
    } catch {
      // Ignore oEmbed fetch failures
    }
  }

  // 2. Direct Audio/Video URL probing in browser context
  if (typeof window !== 'undefined' && /\.(mp4|webm|mp3|wav|m4a|ogg)(\?|$)/i.test(mediaUrl)) {
    return new Promise((resolve) => {
      const isAudio = /\.(mp3|wav|m4a|ogg)(\?|$)/i.test(mediaUrl);
      const element = document.createElement(isAudio ? 'audio' : 'video');
      element.preload = 'metadata';

      const timeoutId = setTimeout(() => {
        element.onloadedmetadata = null;
        element.onerror = null;
        resolve('');
      }, 5000);

      element.onloadedmetadata = () => {
        clearTimeout(timeoutId);
        const formatted = formatSecondsToDuration(element.duration || 0);
        element.onloadedmetadata = null;
        element.onerror = null;
        resolve(formatted);
      };

      element.onerror = () => {
        clearTimeout(timeoutId);
        element.onloadedmetadata = null;
        element.onerror = null;
        resolve('');
      };

      element.src = mediaUrl;
    });
  }

  return '';
}
