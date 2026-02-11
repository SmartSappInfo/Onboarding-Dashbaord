'use client';

import Lottie from 'lottie-react';
import Link from 'next/link';
import searchingAnimation from '@/lib/animations/searching-file.json';
import { Button } from './ui/button';
import { ArrowLeft } from 'lucide-react';

export default function MeetingNotFound() {
  return (
    <div className="flex flex-col items-center justify-center text-center py-20">
      <div className="w-64 h-64">
        <Lottie animationData={searchingAnimation} loop={true} />
      </div>
      <h1 className="mt-8 text-3xl font-bold tracking-tight">
        Sorry! We can't find your meeting!
      </h1>
      <p className="mt-2 text-lg text-muted-foreground">
        Check the link and try again.
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
