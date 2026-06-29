'use client';

import * as React from 'react';
import { isIframeMessagePayload } from '@/lib/iframe-messaging';
import { cn } from '@/lib/utils';

interface ResizableIFrameProps extends React.IframeHTMLAttributes<HTMLIFrameElement> {
  src: string;
  slug: string;
  fallbackHeight?: number;
}

export function ResizableIFrame({
  src,
  slug,
  fallbackHeight = 600,
  className,
  style,
  ...props
}: ResizableIFrameProps) {
  const [height, setHeight] = React.useState<number>(fallbackHeight);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleMessage = (event: MessageEvent) => {
      if (isIframeMessagePayload(event.data)) {
        const payload = event.data;
        if (payload.slug === slug) {
          setHeight(payload.height);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [slug]);

  return (
    <iframe
      src={src}
      className={cn('w-full border-none bg-transparent overflow-hidden', className)}
      style={{
        height: `${height}px`,
        transition: 'height 0.25s cubic-bezier(0.16, 1, 0.3, 1)', // Emil Kowalski ease-out-expo
        ...style,
      }}
      allow="geolocation; microphone; camera"
      {...props}
    />
  );
}
