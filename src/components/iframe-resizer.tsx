'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

export default function IframeResizer() {
  const searchParams = useSearchParams();
  const isEmbedded = searchParams?.get('embed') === 'true';

  useEffect(() => {
    if (!isEmbedded || typeof window === 'undefined' || window.parent === window) return;

    const reportSize = () => {
      const height = document.documentElement.scrollHeight || document.body.scrollHeight;
      const width = document.documentElement.scrollWidth || document.body.scrollWidth;
      window.parent.postMessage({
        type: 'iframe_resize',
        height,
        width
      }, '*');
    };

    const observer = new ResizeObserver(() => {
      reportSize();
    });

    observer.observe(document.body);
    reportSize();

    window.addEventListener('load', reportSize);

    return () => {
      observer.disconnect();
      window.removeEventListener('load', reportSize);
    };
  }, [isEmbedded]);

  return null;
}
