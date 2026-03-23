'use client';

import Link from 'next/link';
import { useRive } from '@rive-app/react-canvas';
import { Button } from './ui/button';
import { ArrowLeft } from 'lucide-react';

export default function FormNotFound() {
  const { RiveComponent } = useRive({
    src: 'https://firebasestorage.googleapis.com/v0/b/studio-9220106300-f74cb.firebasestorage.app/o/404-rive.riv?alt=media&token=03a088d9-5d26-4e5e-8c40-73ec81505a35',
    autoplay: true,
  });

  return (
    <div className="flex flex-col items-center justify-center text-center py-20">
      <div className="w-64 h-64">
        <RiveComponent />
      </div>
      <h1 className="mt-8 text-3xl font-bold tracking-tight">
        Form Not Found
      </h1>
      <p className="mt-2 text-lg text-muted-foreground">
        This form may have been moved, archived, or is not currently published.
      </p>
      <Button asChild className="mt-8">
        <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go to Homepage
        </Link>
      </Button>
    </div>
  );
}
