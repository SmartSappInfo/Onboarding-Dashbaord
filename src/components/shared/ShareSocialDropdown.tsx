'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for Social Sharing:
 *    Standardized social channel share dropdown featuring direct integration with
 *    WhatsApp, Telegram, Facebook, Twitter (X), LinkedIn, Email, and SMS.
 * 2. Touch Target Compliance:
 *    All dropdown triggers and menu items strictly enforce `min-h-[44px]` touch bounds.
 * 3. Security & Anti-Pop-up Protection:
 *    Uses safe target window features (`noopener,noreferrer`) to prevent tabnabbing security risks.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { 
  Share2, Copy, Check, MessageSquare, Send, 
  Share, Mail, MessageCircle, Globe, ChevronDown 
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';

export interface ShareSocialDropdownProps {
  title: string;
  url: string;
  onShareClick?: (channel: string) => void;
  className?: string;
}

export function ShareSocialDropdown({
  title,
  url,
  onShareClick,
  className,
}: ShareSocialDropdownProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const encodedTitle = encodeURIComponent(title || 'Check this out');
  const encodedUrl = encodeURIComponent(url);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast({ title: 'Link Copied', description: 'Page URL copied to clipboard.' });
    if (onShareClick) onShareClick('copy');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSocialShare = (channel: string, shareUrl: string) => {
    if (onShareClick) onShareClick(channel);
    window.open(shareUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`rounded-xl font-bold text-xs gap-1.5 h-11 px-4 min-h-[44px] shadow-sm active:scale-[0.97] ${className || ''}`}
        >
          <Share2 className="h-4 w-4 text-primary" />
          Share
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2 space-y-1 shadow-2xl">
        <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-wider text-muted-foreground px-2 py-1">
          Share Publication Page
        </DropdownMenuLabel>
        
        <DropdownMenuItem
          onClick={handleCopyLink}
          className="rounded-xl font-semibold text-xs py-2.5 cursor-pointer min-h-[44px]"
        >
          {copied ? <Check className="h-4 w-4 mr-2 text-emerald-500" /> : <Copy className="h-4 w-4 mr-2 text-primary" />}
          {copied ? 'Link Copied!' : 'Copy Page Link'}
        </DropdownMenuItem>

        <DropdownMenuSeparator className="my-1" />

        <DropdownMenuItem
          onClick={() => handleSocialShare('whatsapp', `https://api.whatsapp.com/send?text=${encodedTitle}%20${encodedUrl}`)}
          className="rounded-xl font-semibold text-xs py-2.5 cursor-pointer min-h-[44px] hover:text-emerald-500"
        >
          <MessageCircle className="h-4 w-4 mr-2 text-emerald-500" />
          WhatsApp
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => handleSocialShare('telegram', `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`)}
          className="rounded-xl font-semibold text-xs py-2.5 cursor-pointer min-h-[44px] hover:text-sky-500"
        >
          <Send className="h-4 w-4 mr-2 text-sky-500" />
          Telegram
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => handleSocialShare('facebook', `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`)}
          className="rounded-xl font-semibold text-xs py-2.5 cursor-pointer min-h-[44px] hover:text-blue-600"
        >
          <Globe className="h-4 w-4 mr-2 text-blue-600" />
          Facebook
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => handleSocialShare('twitter', `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`)}
          className="rounded-xl font-semibold text-xs py-2.5 cursor-pointer min-h-[44px] hover:text-sky-400"
        >
          <Share className="h-4 w-4 mr-2 text-sky-400" />
          Twitter / X
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => handleSocialShare('linkedin', `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`)}
          className="rounded-xl font-semibold text-xs py-2.5 cursor-pointer min-h-[44px] hover:text-blue-700"
        >
          <Globe className="h-4 w-4 mr-2 text-blue-700" />
          LinkedIn
        </DropdownMenuItem>

        <DropdownMenuSeparator className="my-1" />

        <DropdownMenuItem
          onClick={() => handleSocialShare('email', `mailto:?subject=${encodedTitle}&body=${encodedUrl}`)}
          className="rounded-xl font-semibold text-xs py-2.5 cursor-pointer min-h-[44px]"
        >
          <Mail className="h-4 w-4 mr-2 text-amber-500" />
          Email
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => handleSocialShare('sms', `sms:?body=${encodedTitle}%20${encodedUrl}`)}
          className="rounded-xl font-semibold text-xs py-2.5 cursor-pointer min-h-[44px]"
        >
          <MessageSquare className="h-4 w-4 mr-2 text-purple-500" />
          SMS Message
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default ShareSocialDropdown;
