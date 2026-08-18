'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for Like Interactions:
 *    Standardized Heart/Like button featuring real-time state updates, optimistic counts,
 *    and heart pop micro-animations conforming to Emil Kowalski animation principles.
 * 2. Touch Target Bounds:
 *    Enforces `min-h-[44px]` touch target bounds with active scaling (`active:scale-95`).
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Heart } from 'lucide-react';

export interface LikeButtonProps {
  initialLikes?: number;
  onLike?: () => void;
  disabled?: boolean;
  className?: string;
}

export function LikeButton({
  initialLikes = 0,
  onLike,
  disabled = false,
  className,
}: LikeButtonProps) {
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(initialLikes);

  const handleLike = () => {
    if (disabled) {
      if (onLike) onLike();
      return;
    }

    if (!liked) {
      setLiked(true);
      setLikesCount(prev => prev + 1);
      if (onLike) onLike();
    } else {
      setLiked(false);
      setLikesCount(prev => Math.max(0, prev - 1));
    }
  };

  return (
    <Button
      variant={liked ? 'default' : 'outline'}
      size="sm"
      onClick={handleLike}
      className={`rounded-xl font-bold text-xs gap-1.5 h-11 px-4 min-h-[44px] shadow-sm transition-all duration-300 active:scale-95 ${
        liked 
          ? 'bg-rose-500 hover:bg-rose-600 text-white border-rose-500 shadow-rose-500/20' 
          : 'hover:text-rose-500'
      } ${className || ''}`}
    >
      <Heart className={`h-4 w-4 transition-transform duration-300 ${liked ? 'fill-current scale-110' : ''}`} />
      <span>{likesCount}</span>
    </Button>
  );
}

export default LikeButton;
