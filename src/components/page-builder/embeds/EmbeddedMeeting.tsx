'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, ArrowRight } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { cn } from '@/lib/utils';
import type { Meeting } from '@/lib/types';

interface EmbeddedMeetingProps {
  meetingId: string;
  pageId?: string;
  displayMode?: 'inline' | 'button';
  isInModal?: boolean;
  onClose?: () => void;
  showIcon?: boolean;
  showHeader?: boolean;
  showDescription?: boolean;
  buttonText?: string;
  buttonStyle?: 'primary' | 'secondary' | 'glass' | 'glow';
  primaryColor?: string;
}

export function EmbeddedMeeting({ 
  meetingId, 
  pageId, 
  displayMode = 'inline', 
  isInModal = false, 
  onClose,
  showIcon = true,
  showHeader = true,
  showDescription = true,
  buttonText = 'Book Session',
  buttonStyle = 'primary',
  primaryColor = '#3B5FFF'
}: EmbeddedMeetingProps) {
  const firestore = useFirestore();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firestore || !meetingId) return;
    
    let active = true;
    const fetchMeeting = async () => {
      try {
        const snap = await getDoc(doc(firestore, 'meetings', meetingId));
        if (active && snap.exists()) {
          setMeeting({ id: snap.id, ...snap.data() } as Meeting);
        }
      } catch (err) {
        console.error('Failed to fetch meeting details', err);
      } finally {
        if (active) setLoading(false);
      }
    };
    
    fetchMeeting();
    return () => {
      active = false;
    };
  }, [firestore, meetingId]);

  const [size, setSize] = useState({ height: 600, width: 512 });

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'meeting_booked' && event.data?.meetingId === meetingId) {
        onClose?.();
      }
      if (event.data?.type === 'iframe_resize' && event.data?.height) {
        setSize({
          height: event.data.height,
          width: event.data.width || 512
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [meetingId, onClose]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider animate-pulse">Loading Session Details...</p>
      </div>
    );
  }

  const typeSlug = meeting?.type?.id === 'parent' ? 'parent-engagement' : (meeting?.type?.slug || 'parent-engagement');
  const targetSlug = meeting?.meetingSlug || meetingId;
  const embedUrl = `/meetings/${typeSlug}/${targetSlug}?embed=true${pageId ? `&sourcePageId=${pageId}` : ''}`;

  if (displayMode === 'inline' || isInModal) {
    return (
      <div 
        className="w-full flex flex-col bg-transparent relative rounded-2xl overflow-hidden shadow-inner transition-all duration-200"
        style={{
          height: isInModal ? `${size.height}px` : '600px',
          maxHeight: '100%',
        }}
      >
        <iframe
          src={embedUrl}
          className="w-full flex-grow border-0 bg-transparent"
          style={{ height: '100%' }}
          title="Book Session"
          allow="geolocation; microphone; camera"
        />
      </div>
    );
  }

  const isOutline = buttonStyle === 'secondary';
  const resolvedPrimaryColor = primaryColor || '#3B5FFF';
  const customButtonStyle: React.CSSProperties = isOutline
    ? { borderColor: resolvedPrimaryColor, color: resolvedPrimaryColor, borderWidth: '2px', backgroundColor: 'transparent' }
    : { backgroundColor: resolvedPrimaryColor, color: '#ffffff' };

  return (
    <div className="text-center p-12 space-y-6">
      {showIcon && (
        <div className="h-16 w-16 bg-blue-50 dark:bg-blue-950/30 rounded-2xl flex items-center justify-center mx-auto text-blue-600 dark:text-blue-400">
          <Calendar className="h-8 w-8" />
        </div>
      )}
      {(showHeader || showDescription) && (
        <div className="space-y-2">
          {showHeader && <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">{meeting?.title || 'Book a Session'}</h2>}
          {showDescription && meeting?.meetingTime && (
            <div className="flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400 text-sm font-medium">
              <Clock className="w-4 h-4" />
              <span>Scheduled for {new Date(meeting.meetingTime).toLocaleString()}</span>
            </div>
          )}
        </div>
      )}
      <Button
        onClick={() => window.open(embedUrl.replace('?embed=true', ''), '_blank', 'noopener,noreferrer')}
        className={cn(
          "w-full h-14 rounded-2xl font-bold text-lg hover:scale-[1.02] active:scale-[0.97] transition-all duration-200 gap-2 flex items-center justify-center",
          buttonStyle === 'glass' && 'backdrop-blur-md border border-white/30',
          buttonStyle === 'glow' && 'shadow-[0_0_20px_rgba(59,95,255,0.3)]',
        )}
        style={customButtonStyle}
      >
        {buttonText}
        <ArrowRight className="ml-2 w-5 h-5" />
      </Button>
    </div>
  );
}
