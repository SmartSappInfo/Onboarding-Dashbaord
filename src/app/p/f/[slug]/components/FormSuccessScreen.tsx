'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Form, OrgBranding } from '@/lib/types';
import { cn } from '@/lib/utils';
import { CheckCircle2, ArrowRight, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Footer from '@/components/footer';
import { normalizeSuccessBehavior, appendTrackingParams, sanitizeRedirectUrl } from '@/lib/tracking-utils';
import { motion } from 'framer-motion';

interface FormSuccessScreenProps {
  form: Form;
  orgBranding?: OrgBranding | null;
  trackingParams?: Record<string, string>;
  isInModal?: boolean;
}

/**
 * Public Form Thank You Screen & Post-Submission Redirection Component
 *
 * Handles:
 * 1. Mode 'none': Displays thank you title and message text.
 * 2. Mode 'immediate': Navigates directly to target URL (or sends postMessage to host window if in modal).
 * 3. Mode 'delay': Displays thank you message with countdown timer, auto-navigating upon zero.
 * 4. Mode 'button': Displays thank you message with interactive action button.
 * 
 * Safety & Security:
 * - Uses `sanitizeRedirectUrl()` to prevent XSS / open redirects.
 * - Uses `appendTrackingParams()` to preserve UTMs and tracking codes when `preserveTrackingParams` is active.
 * - Uses secure cross-origin `postMessage` handshake for embedded modals.
 */
export default function FormSuccessScreen({
  form,
  orgBranding,
  trackingParams = {},
  isInModal = false,
}: FormSuccessScreenProps) {
  const config = useMemo(() => normalizeSuccessBehavior(form.successBehavior), [form.successBehavior]);

  // Compute final sanitized redirect URL with tracking parameters if enabled
  const finalRedirectUrl = useMemo(() => {
    if (!config.redirectUrl) return '';
    const safeUrl = sanitizeRedirectUrl(config.redirectUrl);
    if (!safeUrl) return '';
    if (config.preserveTrackingParams) {
      return appendTrackingParams(safeUrl, trackingParams);
    }
    return safeUrl;
  }, [config.redirectUrl, config.preserveTrackingParams, trackingParams]);

  // Countdown state for 'delay' mode
  const [secondsLeft, setSecondsLeft] = useState<number>(config.redirectDelaySeconds);

  // Track if confetti celebration explosion has fired
  const hasConfettiFired = React.useRef(false);

  // Trigger celebration confetti explosion on mount if enabled (default: true)
  useEffect(() => {
    if (config.enableConfetti !== false && !hasConfettiFired.current) {
      hasConfettiFired.current = true;
      import('canvas-confetti')
        .then(({ default: confetti }) => {
          confetti({
            particleCount: 120,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'],
          });
        })
        .catch((e) => console.error('[FormSuccessScreen] Confetti error:', e));
    }
  }, [config.enableConfetti]);

  // Perform actual navigation or parent postMessage trigger
  const executeRedirect = React.useCallback(() => {
    if (!finalRedirectUrl) return;

    const isIframe = typeof window !== 'undefined' && window.self !== window.top;

    // Signal parent host window if embedded in a modal or iframe
    if (isIframe && typeof window !== 'undefined') {
      try {
        window.parent.postMessage(
          {
            type: 'smartsapp:redirect',
            url: finalRedirectUrl,
            presentation: config.presentation,
          },
          '*'
        );
      } catch (_e) {
        // Fallback if postMessage fails
      }
    }

    if (config.presentation === 'page' && isIframe) {
      try {
        window.top!.location.href = finalRedirectUrl;
        return;
      } catch (_e) {
        // Fallthrough if cross-origin top navigation is restricted
      }
    }

    // Default window location navigation
    window.location.href = finalRedirectUrl;
  }, [finalRedirectUrl, config.presentation]);

  // 1. Handle Immediate Redirect Mode
  useEffect(() => {
    if (config.redirectMode === 'immediate' && finalRedirectUrl) {
      executeRedirect();
    }
  }, [config.redirectMode, finalRedirectUrl, executeRedirect]);

  // 2. Handle Delay Countdown Redirect Mode
  useEffect(() => {
    if (config.redirectMode !== 'delay' || !finalRedirectUrl) return;

    setSecondsLeft(config.redirectDelaySeconds);

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          executeRedirect();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [config.redirectMode, config.redirectDelaySeconds, finalRedirectUrl, executeRedirect]);

  // Immediate redirect loading view
  if (config.redirectMode === 'immediate' && finalRedirectUrl) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 text-slate-800">
        <div className="text-center space-y-4 max-w-md">
          <div className="relative mx-auto w-12 h-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
          <h2 className="text-lg font-bold">Redirecting you...</h2>
          <p className="text-xs text-slate-500">
            If you are not redirected automatically within a few seconds,{' '}
            <a href={finalRedirectUrl} className="underline font-bold text-primary hover:text-primary/80">
              click here to continue
            </a>
            .
          </p>
        </div>
      </div>
    );
  }

  const theme = form.theme;
  const isGlass = theme.backgroundStyle === 'glass';
  const radiusMap: Record<string, string> = {
    none: 'rounded-none',
    small: 'rounded-md',
    medium: 'rounded-xl',
    large: 'rounded-3xl',
  };
  const cardRadius = radiusMap[theme.borderRadius || 'medium'];
  const cardWidthClass =
    theme.cardWidth === 'sm' ? 'max-w-md' : theme.cardWidth === 'lg' ? 'max-w-4xl' : 'max-w-2xl';

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-4 transition-all duration-500',
        !isInModal && 'min-h-screen bg-slate-50'
      )}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
        className={cn(
          'w-full transition-all duration-700 text-center',
          cardWidthClass,
          isGlass
            ? 'glass shadow-2xl border border-white/20 p-8 sm:p-14'
            : 'bg-white shadow-xl border border-slate-200 p-8 sm:p-14',
          cardRadius
        )}
      >
        {/* Animated Check Icon */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="absolute inset-0 bg-emerald-500/20 blur-xl rounded-full scale-150 animate-pulse"></div>
            <div className="relative bg-emerald-500 text-white rounded-full p-4 shadow-lg">
              <CheckCircle2 className="h-10 w-10 sm:h-12 sm:w-12" />
            </div>
          </div>
        </div>

        {/* Custom Thank You Title */}
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 mb-4">
          {config.thankYouTitle}
        </h1>

        {/* Custom Thank You Body Message */}
        <div className="prose prose-slate max-w-none text-slate-600 text-base sm:text-lg mb-8 leading-relaxed font-medium">
          {config.thankYouMessage}
        </div>

        {/* Delay Countdown Badge View */}
        {config.redirectMode === 'delay' && finalRedirectUrl && (
          <div className="mb-8 p-4 rounded-2xl bg-primary/5 border border-primary/10 max-w-md mx-auto space-y-2">
            <div className="flex items-center justify-center gap-2 text-xs font-bold text-primary">
              <RotateCcw className="h-4 w-4 animate-spin" />
              <span>Auto-redirecting in {secondsLeft} second{secondsLeft !== 1 ? 's' : ''}...</span>
            </div>
            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-primary h-full transition-all duration-1000 ease-linear"
                style={{
                  width: `${Math.max(0, Math.min(100, (secondsLeft / config.redirectDelaySeconds) * 100))}%`,
                }}
              />
            </div>
            <p className="text-[11px] text-slate-400">
              Taking too long?{' '}
              <button
                type="button"
                onClick={executeRedirect}
                className="underline font-semibold text-primary"
              >
                Click here to redirect now
              </button>
            </p>
          </div>
        )}

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
          {/* Button Redirect Mode CTA */}
          {config.redirectMode === 'button' && finalRedirectUrl ? (
            <Button
              onClick={executeRedirect}
              className="w-full sm:w-auto h-12 px-8 font-bold text-sm shadow-md hover:shadow-lg transition-all active:scale-[0.97]"
              style={{ backgroundColor: theme.accentColor || '#3b82f6' }}
            >
              {config.redirectButtonText}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => window.location.reload()}
              className="w-full sm:w-auto h-12 px-6 font-bold border-2 active:scale-[0.97]"
            >
              Submit another response
            </Button>
          )}
        </div>

        {/* Org Footer */}
        {!isInModal && orgBranding?.landingPageFooterEnabled !== false && (
          <Footer orgBranding={orgBranding} className="mt-12 bg-transparent text-slate-500 pt-8" />
        )}
      </motion.div>
    </div>
  );
}
