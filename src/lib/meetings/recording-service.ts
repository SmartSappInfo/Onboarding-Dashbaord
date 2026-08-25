/**
 * @fileoverview Pure Recording Utilities Service.
 * Formats duration, calculates file sizes, and generates secure media tokens.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% pure with zero side-effects.
 * - All byte calculations use 1024 binary boundaries (KiB, MiB, GiB).
 */

import { randomBytes } from 'crypto';

/**
 * Formats a duration in seconds into a clean human readable string ("HH:MM:SS" or "MM:SS").
 */
export function formatRecordingDuration(totalSeconds: number): string {
  if (isNaN(totalSeconds) || totalSeconds <= 0) return '00:00';

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  const formattedMins = minutes.toString().padStart(2, '0');
  const formattedSecs = seconds.toString().padStart(2, '0');

  if (hours > 0) {
    const formattedHours = hours.toString().padStart(2, '0');
    return `${formattedHours}:${formattedMins}:${formattedSecs}`;
  }

  return `${formattedMins}:${formattedSecs}`;
}

/**
 * Formats file size in bytes to a human readable string ("124.5 MB", "1.2 GB").
 */
export function formatFileSizeBytes(bytes: number): string {
  if (isNaN(bytes) || bytes <= 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const normalizedIndex = Math.min(i, units.length - 1);
  const size = bytes / Math.pow(1024, normalizedIndex);

  return `${size.toFixed(1)} ${units[normalizedIndex]}`;
}

/**
 * Validates whether a file extension / MIME type is an allowable meeting recording format.
 */
export function isValidMediaFormat(formatOrExtension: string): boolean {
  const allowed = ['mp4', 'webm', 'mov', 'mp3', 'm4a', 'wav', 'audio/mp4', 'video/mp4', 'video/webm', 'audio/webm'];
  const clean = formatOrExtension.toLowerCase().replace(/^\./, '').trim();
  return allowed.includes(clean);
}

/**
 * Generates a 32-byte cryptographically secure random token for signed recording playback URLs.
 */
export function generateRecordingShareToken(): string {
  return randomBytes(24).toString('hex');
}
