
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Video } from 'lucide-react';

interface JoinMeetingButtonProps {
  schoolSlug: string;
  className?: string;
}

export default function JoinMeetingButton({ schoolSlug, className }: JoinMeetingButtonProps) {
  return (
    <Button asChild size="lg" className={className}>
      <Link href={`/meetings/parent-engagement/${schoolSlug}`}>
        <Video className="mr-2 h-5 w-5" />
        Join Parent Engagement Meeting
      </Link>
    </Button>
  );
}
