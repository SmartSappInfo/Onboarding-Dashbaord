import { useEffect } from 'react';
import { IframeResizePayload } from '@/lib/iframe-messaging';

export function useIframeHeightReporter(slug: string) {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.self === window.top) return; // Not embedded

    let frameId: number | null = null;

    const observer = new ResizeObserver(() => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }

      frameId = requestAnimationFrame(() => {
        const height = document.documentElement.scrollHeight || document.body.scrollHeight;
        const payload: IframeResizePayload = {
          type: 'iframe_resize',
          slug,
          height,
        };
        window.parent.postMessage(payload, '*');
      });
    });

    // Observe documentElement for full-page layout changes
    observer.observe(document.documentElement);

    return () => {
      observer.disconnect();
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [slug]);
}
