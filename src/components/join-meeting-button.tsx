"use client";

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface JoinMeetingButtonProps {
  meetingTime: string;
  meetingLink: string;
}

export default function JoinMeetingButton({ meetingTime, meetingLink }: JoinMeetingButtonProps) {
  const [isMeetingTime, setIsMeetingTime] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const checkMeetingTime = () => {
      const now = new Date();
      const meetingDate = new Date(meetingTime);
      setIsMeetingTime(now >= meetingDate);
    };

    checkMeetingTime(); // Initial check
    const interval = setInterval(checkMeetingTime, 1000); // Check every second

    return () => clearInterval(interval);
  }, [meetingTime]);

  if (!isClient) {
    return (
        <Button size="lg" disabled className="px-10 py-6 text-lg w-full sm:w-auto">
            Join the Meeting
        </Button>
    );
  }

  if (!isMeetingTime) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="inline-block"> {/* Wrapper div for tooltip on disabled button */}
              <Button size="lg" disabled className="cursor-not-allowed px-10 py-6 text-lg w-full sm:w-auto">
                Join the Meeting
              </Button>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Meeting has not started yet</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Button
      size="lg"
      className="animate-pulse bg-accent px-10 py-6 text-lg text-accent-foreground hover:bg-accent/90 w-full sm:w-auto"
      asChild
    >
      <a href={meetingLink} target="_blank" rel="noopener noreferrer">
        Join the Meeting
      </a>
    </Button>
  );
}
