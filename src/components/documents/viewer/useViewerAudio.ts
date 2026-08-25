'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for Reader Audio Synthesis:
 *    Generates realistic paper-flip sound effects using the Web Audio API with zero network latency,
 *    and provides a silent graceful fallback if audio contexts are blocked by browser autoplay policies
 *    (PRD Section 46 & 85).
 * 2. Autoplay Policy Handling:
 *    Audio context is initialized/resumed on the first user interaction (touch/click/key).
 * 3. Accessibility & User Preferences:
 *    Respects `soundEnabled` document setting and global mute state.
 * 4. Strict Typing Standard:
 *    Zero `any` or `any[]` types are permitted.
 */

import { useState, useRef, useCallback, useEffect } from 'react';

interface UseViewerAudioOptions {
  soundEnabled?: boolean;
  initialMuted?: boolean;
}

export function useViewerAudio({
  soundEnabled = true,
  initialMuted = false,
}: UseViewerAudioOptions = {}) {
  const [isMuted, setIsMuted] = useState(initialMuted);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Initialize or resume AudioContext safely on user gesture
  const getAudioContext = useCallback((): AudioContext | null => {
    if (typeof window === 'undefined') return null;

    try {
      if (!audioCtxRef.current) {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioContextClass) {
          audioCtxRef.current = new AudioContextClass();
        }
      }

      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }

      return audioCtxRef.current;
    } catch {
      return null;
    }
  }, []);

  // Play procedural page-flip swoosh
  const playPageFlipSound = useCallback(() => {
    if (isMuted || !soundEnabled) return;

    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;

      // 1. Noise buffer for paper friction texture
      const bufferSize = ctx.sampleRate * 0.08; // 80ms duration
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = buffer.getChannelData(0);

      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = buffer;

      // 2. Bandpass filter to sculpt warm paper sound
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1200, now);
      filter.frequency.exponentialRampToValueAtTime(400, now + 0.08);
      filter.Q.setValueAtTime(2.5, now);

      // 3. Gain envelope
      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(0.01, now);
      gainNode.gain.linearRampToValueAtTime(0.18, now + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      whiteNoise.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(ctx.destination);

      whiteNoise.start(now);
      whiteNoise.stop(now + 0.08);
    } catch {
      // Graceful silent fallback
    }
  }, [isMuted, soundEnabled, getAudioContext]);

  // Cleanup audio context on unmount
  useEffect(() => {
    return () => {
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  return {
    isMuted,
    toggleMute,
    playPageFlipSound,
  };
}
