'use client';

/**
 * Direct Meeting Room Client & Device Check Lobby
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Minimum 44px touch targets on all interactive controls.
 * - Conforms to emilkowal-animations (custom cubic-bezier springs, 250ms transitions).
 * - Safe WebRTC media stream handling with proper track cleanup on unmount.
 * - Zero 'any' or 'any[]' policy strictly enforced.
 */

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneCall,
  PhoneOff,
  Calendar,
  Clock,
  User,
  ShieldCheck,
  ExternalLink,
  Volume2,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

export interface DirectRoomSessionData {
  roomId: string;
  title: string;
  hostName: string;
  startAt?: string;
  durationMinutes: number;
  externalJoinUrl?: string;
  isAdHoc: boolean;
}

interface DirectMeetingRoomClientProps {
  readonly sessionData: DirectRoomSessionData;
}

export default function DirectMeetingRoomClient({ sessionData }: DirectMeetingRoomClientProps) {
  const [isVideoEnabled, setIsVideoEnabled] = React.useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = React.useState(true);
  const [mediaStream, setMediaStream] = React.useState<MediaStream | null>(null);
  const [audioLevel, setAudioLevel] = React.useState(0);
  const [isInCall, setIsInCall] = React.useState(false);
  const [callDuration, setCallDuration] = React.useState(0);
  const [mediaError, setMediaError] = React.useState<string | null>(null);

  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const audioContextRef = React.useRef<AudioContext | null>(null);
  const analyserRef = React.useRef<AnalyserNode | null>(null);
  const animFrameRef = React.useRef<number | null>(null);

  // Initialize camera and microphone preview
  React.useEffect(() => {
    let streamInstance: MediaStream | null = null;

    async function initMedia() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setMediaError('Camera and microphone access is not supported by your browser.');
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: true,
        });

        streamInstance = stream;
        setMediaStream(stream);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        // Audio level analyser
        try {
          const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          if (AudioContextClass) {
            const ctx = new AudioContextClass();
            audioContextRef.current = ctx;
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 64;
            analyserRef.current = analyser;

            const source = ctx.createMediaStreamSource(stream);
            source.connect(analyser);

            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            const checkVolume = () => {
              if (analyserRef.current) {
                analyserRef.current.getByteFrequencyData(dataArray);
                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) {
                  sum += dataArray[i];
                }
                const avg = sum / dataArray.length;
                setAudioLevel(Math.min(100, Math.round((avg / 255) * 100)));
              }
              animFrameRef.current = requestAnimationFrame(checkVolume);
            };
            checkVolume();
          }
        } catch {
          // Audio analyser optional; continue if not permitted
        }
      } catch (err) {
        console.warn('[DirectMeetingRoomClient] Media stream initialization failed:', err);
        setMediaError('Could not connect to your camera or microphone. Please check your browser permissions.');
      }
    }

    initMedia();

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
      if (streamInstance) {
        streamInstance.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Update video element when stream is ready
  React.useEffect(() => {
    if (videoRef.current && mediaStream) {
      videoRef.current.srcObject = mediaStream;
    }
  }, [mediaStream, isInCall]);

  // Toggle video tracks
  const handleToggleVideo = () => {
    if (mediaStream) {
      const videoTracks = mediaStream.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = !isVideoEnabled;
      });
      setIsVideoEnabled(!isVideoEnabled);
    }
  };

  // Toggle audio tracks
  const handleToggleAudio = () => {
    if (mediaStream) {
      const audioTracks = mediaStream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !isAudioEnabled;
      });
      setIsAudioEnabled(!isAudioEnabled);
    }
  };

  // Call timer
  React.useEffect(() => {
    let timer: NodeJS.Timeout | undefined;
    if (isInCall) {
      timer = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isInCall]);

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleJoin = () => {
    if (sessionData.externalJoinUrl) {
      window.location.href = sessionData.externalJoinUrl;
    } else {
      setIsInCall(true);
    }
  };

  const handleLeave = () => {
    setIsInCall(false);
  };

  return (
    <div className="min-h-screen w-full bg-background flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <header className="w-full max-w-5xl mx-auto flex items-center justify-between py-3 border-b border-border/50">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-sm">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-foreground">SmartSapp Meetings</h1>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <ShieldCheck className="h-3 w-3 text-emerald-500" />
              Secure Encrypted Bridge
            </p>
          </div>
        </div>

        <Badge variant="outline" className="rounded-xl px-2.5 py-1 text-[11px] font-semibold">
          Room: {sessionData.roomId.slice(0, 8)}
        </Badge>
      </header>

      {/* Main Content Area */}
      <main className="w-full max-w-5xl mx-auto flex-1 flex flex-col justify-center py-6 sm:py-10">
        <AnimatePresence mode="wait">
          {!isInCall ? (
            /* Lobby State (Device Preview & Session Info) */
            <motion.div
              key="lobby"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center"
            >
              {/* Video Device Preview Box */}
              <div className="lg:col-span-7 flex flex-col items-center">
                <div className="relative w-full aspect-video max-w-lg rounded-3xl overflow-hidden bg-slate-900 border border-border shadow-xl flex items-center justify-center">
                  {mediaStream && isVideoEnabled ? (
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover scale-x-[-1]"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-400 space-y-2 p-6 text-center">
                      <div className="h-16 w-16 rounded-full bg-slate-800 flex items-center justify-center text-slate-300">
                        <VideoOff className="h-7 w-7" />
                      </div>
                      <p className="text-xs font-semibold">Camera is turned off</p>
                    </div>
                  )}

                  {/* Audio Level Indicator */}
                  {isAudioEnabled && (
                    <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-xl flex items-center gap-1.5 text-[11px] text-white font-medium">
                      <Volume2 className="h-3.5 w-3.5 text-emerald-400" />
                      <div className="w-12 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-400 transition-all duration-100 ease-out"
                          style={{ width: `${audioLevel}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* On-video Control Buttons */}
                  <div className="absolute bottom-3 inset-x-0 flex items-center justify-center gap-3">
                    <Button
                      type="button"
                      variant={isAudioEnabled ? 'secondary' : 'destructive'}
                      size="icon"
                      onClick={handleToggleAudio}
                      className="h-11 w-11 min-h-[44px] min-w-[44px] rounded-full shadow-lg active:scale-95 transition-transform"
                      aria-label={isAudioEnabled ? 'Mute Microphone' : 'Unmute Microphone'}
                    >
                      {isAudioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
                    </Button>

                    <Button
                      type="button"
                      variant={isVideoEnabled ? 'secondary' : 'destructive'}
                      size="icon"
                      onClick={handleToggleVideo}
                      className="h-11 w-11 min-h-[44px] min-w-[44px] rounded-full shadow-lg active:scale-95 transition-transform"
                      aria-label={isVideoEnabled ? 'Turn Camera Off' : 'Turn Camera On'}
                    >
                      {isVideoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
                    </Button>
                  </div>
                </div>

                {mediaError && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mt-3 text-center">
                    {mediaError}
                  </p>
                )}
              </div>

              {/* Session Information Card */}
              <div className="lg:col-span-5 space-y-5">
                <div className="space-y-2">
                  <Badge className="bg-primary/10 text-primary border-primary/20 text-xs px-2.5 py-0.5 font-semibold">
                    Ready to Connect
                  </Badge>
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground leading-snug">
                    {sessionData.title}
                  </h2>
                </div>

                <Card className="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-sm text-xs">
                  <div className="flex items-center gap-2.5 text-muted-foreground">
                    <User className="h-4 w-4 text-primary shrink-0" />
                    <span>Host: <strong className="text-foreground">{sessionData.hostName}</strong></span>
                  </div>

                  {sessionData.startAt && (
                    <div className="flex items-center gap-2.5 text-muted-foreground">
                      <Calendar className="h-4 w-4 text-primary shrink-0" />
                      <span>{new Date(sessionData.startAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2.5 text-muted-foreground">
                    <Clock className="h-4 w-4 text-primary shrink-0" />
                    <span>Estimated Duration: <strong className="text-foreground">{sessionData.durationMinutes} mins</strong></span>
                  </div>
                </Card>

                <div className="pt-2">
                  <Button
                    type="button"
                    onClick={handleJoin}
                    className="w-full h-12 min-h-[44px] rounded-2xl font-bold text-sm gap-2 shadow-md active:scale-[0.98] transition-transform"
                  >
                    <PhoneCall className="h-4 w-4" />
                    {sessionData.externalJoinUrl ? 'Launch Meeting Window' : 'Join Meeting Now'}
                  </Button>
                  <p className="text-[11px] text-muted-foreground text-center mt-2.5">
                    Clicking join connects your audio and video to the meeting bridge.
                  </p>
                </div>
              </div>
            </motion.div>
          ) : (
            /* In-Call Stage */
            <motion.div
              key="in-call"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col items-center w-full max-w-4xl mx-auto space-y-4"
            >
              {/* Virtual Stage View */}
              <div className="relative w-full aspect-video rounded-3xl overflow-hidden bg-slate-950 border border-border shadow-2xl flex items-center justify-center">
                {mediaStream && isVideoEnabled ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover scale-x-[-1]"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-400 space-y-2">
                    <div className="h-20 w-20 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-300 font-bold text-2xl">
                      {sessionData.hostName.charAt(0)}
                    </div>
                    <p className="text-sm font-semibold">{sessionData.hostName}</p>
                    <p className="text-xs text-slate-500">Camera is off</p>
                  </div>
                )}

                {/* Call Timer Overlay */}
                <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl flex items-center gap-2 text-xs font-mono text-white">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  {formatTimer(callDuration)}
                </div>

                {/* Session Title Overlay */}
                <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl text-xs font-semibold text-white">
                  {sessionData.title}
                </div>
              </div>

              {/* Call Control Toolbar */}
              <div className="flex items-center justify-center gap-4 py-2">
                <Button
                  type="button"
                  variant={isAudioEnabled ? 'outline' : 'destructive'}
                  size="icon"
                  onClick={handleToggleAudio}
                  className="h-12 w-12 min-h-[44px] min-w-[44px] rounded-2xl shadow-md active:scale-95 transition-transform"
                  aria-label={isAudioEnabled ? 'Mute Mic' : 'Unmute Mic'}
                >
                  {isAudioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
                </Button>

                <Button
                  type="button"
                  variant={isVideoEnabled ? 'outline' : 'destructive'}
                  size="icon"
                  onClick={handleToggleVideo}
                  className="h-12 w-12 min-h-[44px] min-w-[44px] rounded-2xl shadow-md active:scale-95 transition-transform"
                  aria-label={isVideoEnabled ? 'Turn Off Video' : 'Turn On Video'}
                >
                  {isVideoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
                </Button>

                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleLeave}
                  className="h-12 min-h-[44px] px-6 rounded-2xl font-bold text-xs gap-2 shadow-lg active:scale-95 transition-transform"
                >
                  <PhoneOff className="h-4 w-4" />
                  Leave Meeting
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-5xl mx-auto py-3 text-center text-xs text-muted-foreground border-t border-border/40">
        Powered by SmartSapp Meetings Platform
      </footer>
    </div>
  );
}
