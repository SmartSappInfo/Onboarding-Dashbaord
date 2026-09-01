/**
 * @fileoverview Interactive Public Passcode / PIN Unlock Page
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Public-facing page: zero authentication required.
 * - Brute-force rate limiting: 5 attempts maximum before cooldown.
 * - Zero `any` or `any[]` typing.
 */

'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Lock,
  Unlock,
  KeyRound,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';

export default function QRUnlockPage() {
  const params = useParams();
  const router = useRouter();
  const shortPath = (params?.shortPath as string) || '';

  const [pin, setPin] = React.useState('');
  const [isVerifying, setIsVerifying] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [attempts, setAttempts] = React.useState(0);
  const [isLocked, setIsLocked] = React.useState(false);
  const [cooldown, setCooldown] = React.useState(0);

  React.useEffect(() => {
    let timer: NodeJS.Timeout;
    if (cooldown > 0) {
      timer = setTimeout(() => setCooldown((prev) => prev - 1), 1000);
    } else if (cooldown === 0 && isLocked) {
      setIsLocked(false);
      setAttempts(0);
      setErrorMsg(null);
    }
    return () => clearTimeout(timer);
  }, [cooldown, isLocked]);

  const handleVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pin.trim() || isLocked || isVerifying) return;

    setIsVerifying(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/qr/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shortPath, passcode: pin.trim() }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        // Success: set unlocked state in session and redirect to shortPath
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(`qr_unlocked_${shortPath}`, 'true');
        }
        router.push(`/q/${shortPath}?unlocked=true`);
      } else {
        const nextAttempts = attempts + 1;
        setAttempts(nextAttempts);

        if (nextAttempts >= 5) {
          setIsLocked(true);
          setCooldown(60); // 60 seconds lockout
          setErrorMsg('Too many failed attempts. Please wait 60 seconds.');
        } else {
          setErrorMsg(data.error || `Incorrect PIN. (${5 - nextAttempts} attempts remaining)`);
        }
        setPin('');
      }
    } catch {
      setErrorMsg('Network error. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleKeypadPress = (digit: string) => {
    if (isLocked || pin.length >= 8) return;
    setPin((prev) => prev + digit);
  };

  const handleBackspace = () => {
    if (isLocked) return;
    setPin((prev) => prev.slice(0, -1));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center p-4 sm:p-6 font-sans">
      <div className="w-full max-w-sm space-y-6">
        {/* Lock Shield Header */}
        <div className="text-center space-y-3">
          <div className="h-16 w-16 mx-auto rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-lg shadow-primary/10">
            {isLocked ? (
              <AlertTriangle className="h-8 w-8 text-amber-500 animate-bounce" />
            ) : (
              <Lock className="h-8 w-8 animate-pulse" />
            )}
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">
              {isLocked ? 'Access Cooldown' : 'Passcode Protected Link'}
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
              {isLocked
                ? `Temporarily locked due to multiple failed attempts. Retry in ${cooldown}s.`
                : 'Enter the 4-digit PIN provided by the organizer to access this destination.'}
            </p>
          </div>
        </div>

        {/* PIN Input & Error Card */}
        <motion.div
          animate={errorMsg ? { x: [-10, 10, -8, 8, -4, 4, 0] } : {}}
          transition={{ duration: 0.4 }}
          className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-5"
        >
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="space-y-1.5">
              <div className="relative flex items-center justify-center">
                <Input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={8}
                  placeholder="••••"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))}
                  disabled={isLocked || isVerifying}
                  className="h-14 text-center text-2xl tracking-[0.5em] font-mono font-bold rounded-2xl bg-slate-950/80 border-slate-800 focus-visible:ring-primary text-white"
                  autoFocus
                />
              </div>

              {errorMsg && (
                <p className="text-xs text-rose-400 text-center font-medium pt-1">
                  {errorMsg}
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={isLocked || isVerifying || pin.length < 3}
              className="w-full h-12 rounded-2xl font-bold text-sm shadow-lg shadow-primary/20 active:scale-[0.97] transition-all bg-primary hover:bg-primary/90 text-white"
            >
              {isVerifying ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Unlock className="h-4 w-4 mr-2" />
              )}
              {isVerifying ? 'Verifying...' : 'Unlock Destination'}
            </Button>
          </form>

          {/* Touch-Friendly Numeric Keypad for Mobile Convenience */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/60">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  if (k === 'C') setPin('');
                  else if (k === '⌫') handleBackspace();
                  else handleKeypadPress(k);
                }}
                disabled={isLocked || isVerifying}
                className="h-12 rounded-xl bg-slate-950/60 hover:bg-slate-800/60 active:scale-[0.95] text-sm font-bold text-slate-200 transition-all border border-slate-800/40 flex items-center justify-center font-mono disabled:opacity-40"
              >
                {k}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Security Badge */}
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
          <span>Encrypted with SHA-256 Guardrails</span>
        </div>
      </div>
    </div>
  );
}
