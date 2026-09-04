'use client';

import * as React from 'react';

// Web Speech API Types
interface SpeechRecognitionResultItem {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionResultItem;
  [index: number]: SpeechRecognitionResultItem;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message?: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export interface UseVoiceDictationOptions {
  lang?: string;
  onTranscriptChange?: (text: string) => void;
  onError?: (error: string) => void;
}

export interface UseVoiceDictationReturn {
  isListening: boolean;
  isSupported: boolean;
  transcript: string;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
}

/**
 * Universal voice speech-to-text dictation hook (Phase 2).
 *
 * Safe for Next.js SSR (feature-detected strictly inside useEffect/client).
 * Uses Web Speech API for low-latency live streaming of spoken audio to text.
 */
export function useVoiceDictation({
  lang = 'en-US',
  onTranscriptChange,
  onError,
}: UseVoiceDictationOptions = {}): UseVoiceDictationReturn {
  const [isSupported, setIsSupported] = React.useState(false);
  const [isListening, setIsListening] = React.useState(false);
  const [transcript, setTranscript] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const recognitionRef = React.useRef<SpeechRecognitionInstance | null>(null);
  const onTranscriptChangeRef = React.useRef(onTranscriptChange);
  const onErrorRef = React.useRef(onError);

  React.useEffect(() => {
    onTranscriptChangeRef.current = onTranscriptChange;
    onErrorRef.current = onError;
  }, [onTranscriptChange, onError]);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechClass = window.SpeechRecognition || window.webkitSpeechRecognition;
      setIsSupported(!!SpeechClass);
    }
  }, []);

  const stopListening = React.useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore if already stopped
      }
      setIsListening(false);
    }
  }, []);

  const startListening = React.useCallback(() => {
    if (typeof window === 'undefined') return;
    const SpeechClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechClass) {
      const msg = 'Speech recognition is not supported in this browser.';
      setError(msg);
      onErrorRef.current?.(msg);
      return;
    }

    setError(null);

    try {
      // Abort any previous instance
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }

      const recognition = new SpeechClass();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = lang;

      recognition.onstart = () => {
        setIsListening(true);
        setError(null);
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let fullText = '';
        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          if (result && result[0]) {
            fullText += result[0].transcript;
          }
        }
        setTranscript(fullText);
        onTranscriptChangeRef.current?.(fullText);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        // 'no-speech' is non-fatal when user pauses
        if (event.error === 'no-speech') return;
        const msg = event.message || `Speech recognition error: ${event.error}`;
        setError(msg);
        onErrorRef.current?.(msg);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start speech recognition';
      setError(msg);
      onErrorRef.current?.(msg);
      setIsListening(false);
    }
  }, [lang]);

  const resetTranscript = React.useCallback(() => {
    setTranscript('');
    setError(null);
  }, []);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  return {
    isListening,
    isSupported,
    transcript,
    error,
    startListening,
    stopListening,
    resetTranscript,
  };
}
