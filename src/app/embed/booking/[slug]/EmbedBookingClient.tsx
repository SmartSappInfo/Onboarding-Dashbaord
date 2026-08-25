'use client';

import * as React from 'react';
import type { PublicBookingPageData } from '@/lib/meetings/types';
import PublicBookingClient from '@/app/book/[slug]/PublicBookingClient';

interface EmbedBookingClientProps {
  initialData: PublicBookingPageData;
  prefill?: {
    name?: string;
    email?: string;
    phone?: string;
  };
}

export function EmbedBookingClient({ initialData, prefill }: EmbedBookingClientProps) {
  // Emit resize message to parent window on mount and document mutation
  React.useEffect(() => {
    const notifyHeight = () => {
      if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
        const height = document.documentElement.scrollHeight || document.body.scrollHeight;
        window.parent.postMessage({ type: 'smartsapp:resize', height }, '*');
      }
    };

    notifyHeight();
    const observer = new ResizeObserver(notifyHeight);
    observer.observe(document.body);

    return () => observer.disconnect();
  }, []);

  return (
    <div className="bg-transparent min-h-screen p-2 sm:p-4">
      <PublicBookingClient initialData={initialData} prefill={prefill} />
    </div>
  );
}
