'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Public Reader Security & Scoping:
 *    Queries published publications by `slug` or `id`. Ensures anonymous readers can access
 *    only published content (`status === 'published'`) without exposing internal workspace IDs.
 * 2. Viewer Engine 2.0 Integration:
 *    Delegates rendering and navigation to modular `<ViewerContainer>` and `<ViewerToolbar>`,
 *    supporting 3 interchangeable modes (`flipbook`, `presentation`, `continuous`) (PRD Section 40).
 * 3. High-Load Memory Safety & Page Virtualization:
 *    Mounts a virtual window of current page +/- 2 pages in DOM, cleaning up unused canvas
 *    and image resources to prevent memory spikes on 100+ page documents.
 * 4. Multi-Touch Gesture Engine & Accessibility:
 *    Supports pinch zoom ($1.0\times$ to $3.0\times$), bounded panning, double-tap zoom toggle,
 *    keyboard shortcuts, procedural Web Audio sound effects, and high-contrast styling.
 * 5. Strict Typing Standard:
 *    Zero `any` or `any[]` types are permitted.
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import type { FlipbookConfig, FlipbookPage, FlipbookHotspot } from '@/lib/types/flipbook-types';
import type { ViewerMode } from '@/lib/types/document-types';
import { 
  submitDocumentLeadAction, 
  verifyDocumentPasscodeAction, 
  recordDocumentEventAction 
} from '@/lib/document-actions';
import { initializeClientSession, ClientSessionContext } from '@/lib/documents/session-tracker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  BookOpen, Lock, Sparkles, X, ExternalLink, Video 
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DocumentSearchBar } from '@/components/documents/DocumentSearchBar';
import { ViewerToolbar } from '@/components/documents/viewer/ViewerToolbar';
import { ViewerContainer } from '@/components/documents/viewer/ViewerContainer';
import { useViewerAudio } from '@/components/documents/viewer/useViewerAudio';
import { useViewerGestures } from '@/components/documents/viewer/useViewerGestures';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { PDFDocumentProxy } from 'pdfjs-dist';

interface FlipbookReaderClientProps {
  slug: string;
}

export default function FlipbookReaderClient({ slug }: FlipbookReaderClientProps) {
  const { toast } = useToast();
  const firestore = useFirestore();

  const [flipbook, setFlipbook] = useState<FlipbookConfig | null>(null);
  const [pages, setPages] = useState<FlipbookPage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Client Session Context (Visitor & Session Tracking)
  const [sessionCtx, setSessionCtx] = useState<ClientSessionContext | null>(null);

  // PDF Canvas Renderer State
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);

  // Viewer Engine 2.0 Modes & Customization
  const [viewerMode, setViewerMode] = useState<ViewerMode>('flipbook');
  const [isHighContrast, setIsHighContrast] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isMobile, setIsMobile] = useState(false);
  const [isThumbnailsOpen, setIsThumbnailsOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Password Protection State
  const [enteredPassword, setEnteredPassword] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);

  // Lead Gate Modal State
  const [isLeadGateOpen, setIsLeadGateOpen] = useState(false);
  const [leadName, setLeadName] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [isSubmittingLead, setIsSubmittingLead] = useState(false);
  const [isLeadPassed, setIsLeadPassed] = useState(false);

  // Active Hotspot Popover State
  const [activeHotspot, setActiveHotspot] = useState<FlipbookHotspot | null>(null);

  // Procedural Web Audio Engine
  const { isMuted, toggleMute, playPageFlipSound } = useViewerAudio({
    soundEnabled: flipbook?.style?.soundEnabled,
  });

  // Multi-Touch Gesture & Zoom Engine
  const {
    zoomScale,
    panOffset,
    zoomIn,
    zoomOut,
    resetZoom,
    navigateNext,
    navigatePrev,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  } = useViewerGestures({
    pageCount: flipbook?.pageCount || 1,
    currentPage,
    onPageChange: (pageNum) => {
      setCurrentPage(pageNum);
      playPageFlipSound();
    },
    step: isMobile || viewerMode === 'presentation' || viewerMode === 'single_page' ? 1 : 2,
  });

  // Initialize client session metrics on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const ctx = initializeClientSession(searchParams);
      setSessionCtx(ctx);
    }
  }, []);

  // Detect mobile viewport
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch Flipbook Configuration from Firestore
  useEffect(() => {
    if (!firestore || !slug) return;

    let isMounted = true;
    async function loadFlipbook() {
      setIsLoading(true);
      setError(null);

      try {
        const colRef = collection(firestore!, 'flipbooks');
        let snap = await getDocs(query(colRef, where('slug', '==', slug)));

        if (snap.empty) {
          snap = await getDocs(query(colRef, where('__name__', '==', slug)));
        }

        if (snap.empty) {
          if (isMounted) {
            setError('Flipbook publication not found. Please verify the URL or link.');
            setIsLoading(false);
          }
          return;
        }

        const data = snap.docs[0].data() as FlipbookConfig;
        const config: FlipbookConfig = {
          ...data,
          id: snap.docs[0].id || 'fb_doc',
        };

        if (config.status && config.status !== 'published') {
          if (isMounted) {
            setError('This publication is currently in draft mode or unavailable.');
            setIsLoading(false);
          }
          return;
        }

        if (isMounted) {
          setFlipbook(config);
          const isProtected = !!config.password;
          setIsUnlocked(!isProtected);

          if (config.style?.pageStyle === 'single') {
            setViewerMode('presentation');
          }

          // Fetch Pages Sub-collection
          const pagesRef = collection(firestore!, 'flipbook_pages');
          const pagesSnap = await getDocs(
            query(pagesRef, where('flipbookId', '==', config.id))
          );

          if (!pagesSnap.empty) {
            const pageList: FlipbookPage[] = pagesSnap.docs
              .map((d) => ({
                id: d.id,
                flipbookId: config.id,
                workspaceId: config.workspaceId,
                pageNumber: (d.data().pageNumber as number) || 1,
                imageUrl: d.data().imageUrl as string,
                thumbnailUrl: d.data().thumbnailUrl as string,
                width: (d.data().width as number) || 800,
                height: (d.data().height as number) || 1130,
                aspectRatio: (d.data().aspectRatio as number) || 1.414,
                extractedText: d.data().extractedText as string,
                createdAt: (d.data().createdAt as string) || new Date().toISOString(),
              }))
              .sort((a, b) => a.pageNumber - b.pageNumber);

            setPages(pageList);
          }

          setIsLoading(false);
        }
      } catch (err) {
        console.error('Error fetching flipbook data:', err);
        if (isMounted) {
          setError('Failed to load publication. Please try refreshing.');
          setIsLoading(false);
        }
      }
    }

    loadFlipbook();
    return () => { isMounted = false; };
  }, [slug]);

  // Telemetry: Document Opened
  useEffect(() => {
    if (!flipbook || !sessionCtx || !isUnlocked) return;

    recordDocumentEventAction({
      workspaceId: flipbook.workspaceId,
      documentId: flipbook.id,
      sessionId: sessionCtx.sessionId,
      visitorId: sessionCtx.visitorId,
      contactId: sessionCtx.contactId,
      distributionId: sessionCtx.distributionToken,
      campaignId: sessionCtx.campaignId,
      eventType: 'document_opened',
      pageNumber: currentPage,
      device: sessionCtx.device,
      browser: sessionCtx.browser,
      os: sessionCtx.os,
    }).catch(() => {});
  }, [flipbook, sessionCtx, isUnlocked]);

  // Telemetry: Page Viewed
  useEffect(() => {
    if (!flipbook || !sessionCtx || !isUnlocked) return;

    recordDocumentEventAction({
      workspaceId: flipbook.workspaceId,
      documentId: flipbook.id,
      sessionId: sessionCtx.sessionId,
      visitorId: sessionCtx.visitorId,
      contactId: sessionCtx.contactId,
      distributionId: sessionCtx.distributionToken,
      campaignId: sessionCtx.campaignId,
      eventType: 'page_viewed',
      pageNumber: currentPage,
      device: sessionCtx.device,
      browser: sessionCtx.browser,
      os: sessionCtx.os,
    }).catch(() => {});
  }, [currentPage, flipbook, sessionCtx, isUnlocked]);

  // Lead Gate Threshold Evaluation
  useEffect(() => {
    if (!flipbook || !flipbook.leadGate || !flipbook.leadGate.enabled || isLeadPassed) return;
    const triggerPage = flipbook.leadGate.triggerPage || 1;
    if (currentPage >= triggerPage) {
      setIsLeadGateOpen(true);
    }
  }, [currentPage, flipbook, isLeadPassed]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    }
  };

  const handleLeadSubmit = async () => {
    if (!leadEmail.trim()) {
      toast({ variant: 'destructive', title: 'Email Required', description: 'Please enter your email to continue reading.' });
      return;
    }

    if (!flipbook) return;

    setIsSubmittingLead(true);
    try {
      const res = await submitDocumentLeadAction({
        workspaceId: flipbook.workspaceId,
        documentId: flipbook.id,
        email: leadEmail.trim(),
        name: leadName.trim() || undefined,
        phone: leadPhone.trim() || undefined,
      });

      if (res.success) {
        setIsLeadPassed(true);
        setIsLeadGateOpen(false);
        toast({ title: 'Access Unlocked', description: 'Thank you! Enjoy reading the publication.' });
      } else {
        toast({ variant: 'destructive', title: 'Submission Error', description: res.error || 'Could not verify details.' });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Submission Error', description: 'An unexpected error occurred.' });
    } finally {
      setIsSubmittingLead(false);
    }
  };

  const handleHotspotClick = (hs: FlipbookHotspot) => {
    setActiveHotspot(hs);
    if (sessionCtx && flipbook) {
      recordDocumentEventAction({
        workspaceId: flipbook.workspaceId,
        documentId: flipbook.id,
        sessionId: sessionCtx.sessionId,
        visitorId: sessionCtx.visitorId,
        contactId: sessionCtx.contactId,
        distributionId: sessionCtx.distributionToken,
        campaignId: sessionCtx.campaignId,
        eventType: hs.type === 'video' ? 'video_started' : 'link_clicked',
        pageNumber: hs.pageNumber,
        elementId: hs.id,
        metadata: {
          targetUrl: hs.targetUrl || '',
          layerTitle: hs.title || '',
        },
      }).catch(() => {});
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen w-screen bg-slate-950 flex flex-col items-center justify-center text-white space-y-4">
        <div className="h-10 w-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-bold text-slate-400 tracking-wider uppercase">Loading publication...</p>
      </div>
    );
  }

  if (error || !flipbook) {
    return (
      <div className="h-screen w-screen bg-slate-950 flex flex-col items-center justify-center text-white p-4 text-center space-y-4">
        <BookOpen className="h-12 w-12 text-rose-500" />
        <h2 className="text-xl font-bold">{error || 'Publication Unavailable'}</h2>
        <p className="text-xs text-slate-400 max-w-sm">
          The requested document could not be displayed. It may be unpublished or the link has expired.
        </p>
      </div>
    );
  }

  // Password Unlock Gate
  if (!isUnlocked) {
    return (
      <div className="h-screen w-screen bg-slate-950 flex flex-col items-center justify-center text-white p-4">
        <div className="max-w-md w-full bg-slate-900 border border-white/10 p-8 rounded-3xl space-y-6 text-left shadow-2xl">
          <div className="space-y-2">
            <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-2xl w-fit">
              <Lock className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-black">{flipbook.title}</h2>
            <p className="text-xs text-slate-400">This publication is password protected. Enter the passcode to gain access.</p>
          </div>

          <div className="space-y-3">
            <Input
              type="password"
              value={enteredPassword}
              onChange={(e) => setEnteredPassword(e.target.value)}
              placeholder="Enter passcode..."
              className="h-12 rounded-xl bg-slate-800 border-white/10 text-white font-mono text-sm min-h-[44px]"
            />
            <Button
              disabled={isVerifyingPassword}
              onClick={async () => {
                if (!enteredPassword.trim()) {
                  toast({ variant: 'destructive', title: 'Passcode Required', description: 'Please enter a passcode.' });
                  return;
                }
                setIsVerifyingPassword(true);
                try {
                  const res = await verifyDocumentPasscodeAction(flipbook.id, enteredPassword.trim());
                  if (res.success) {
                    setIsUnlocked(true);
                    toast({ title: 'Access Granted', description: 'Passcode verified successfully.' });
                  } else {
                    toast({ variant: 'destructive', title: 'Incorrect Passcode', description: 'The passcode entered is invalid.' });
                  }
                } catch {
                  toast({ variant: 'destructive', title: 'Verification Error', description: 'Could not verify passcode.' });
                } finally {
                  setIsVerifyingPassword(false);
                }
              }}
              className="w-full h-12 rounded-xl font-bold text-sm min-h-[44px]"
            >
              {isVerifyingPassword ? 'Verifying...' : 'Unlock Publication'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`h-screen w-screen flex flex-col overflow-hidden relative text-white select-none ${
        isHighContrast ? 'bg-black text-yellow-300' : ''
      }`}
      style={{ backgroundColor: isHighContrast ? '#000000' : (flipbook.style?.backgroundColor || '#0f172a') }}
    >
      {/* ── Top Header Toolbar ──────────────────────────────────────────────── */}
      <ViewerToolbar
        title={flipbook.title}
        logoUrl={flipbook.style?.logoUrl}
        currentPage={currentPage}
        pageCount={flipbook.pageCount || 1}
        viewerMode={viewerMode}
        onModeChange={setViewerMode}
        zoomScale={zoomScale}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onResetZoom={resetZoom}
        isMuted={isMuted}
        onToggleMute={toggleMute}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        isHighContrast={isHighContrast}
        onToggleHighContrast={() => setIsHighContrast(!isHighContrast)}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenThumbnails={() => setIsThumbnailsOpen(!isThumbnailsOpen)}
        onPageSelect={(p) => {
          setCurrentPage(p);
          playPageFlipSound();
        }}
        likesCount={flipbook.likesCount || 0}
        sourceFileUrl={flipbook.sourceFileUrl}
        enableDownload={flipbook.style?.enableDownloadPdf}
      />

      {/* ── Main Multi-Mode Viewer Container ────────────────────────────────── */}
      <ViewerContainer
        mode={viewerMode}
        currentPage={currentPage}
        pageCount={flipbook.pageCount || 1}
        pages={pages}
        hotspots={flipbook.hotspots || []}
        onHotspotClick={handleHotspotClick}
        onNextPage={navigateNext}
        onPrevPage={navigatePrev}
        onPageSelect={(p) => {
          setCurrentPage(p);
          playPageFlipSound();
        }}
        zoomScale={zoomScale}
        panOffset={panOffset}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        isHighContrast={isHighContrast}
        canvasRef={canvasRef}
      />

      {/* ── Bottom Page Slider Footer ───────────────────────────────────────── */}
      <footer 
        className="h-16 border-t border-white/10 bg-black/50 backdrop-blur-xl px-6 flex items-center justify-between z-30 shrink-0 text-xs font-bold select-none"
        role="navigation"
        aria-label="Bottom page scrubber"
      >
        <span>Page {currentPage} of {flipbook.pageCount || 1}</span>

        <input
          type="range"
          min={1}
          max={flipbook.pageCount || 1}
          value={currentPage}
          onChange={(e) => {
            const next = parseInt(e.target.value, 10);
            setCurrentPage(next);
            playPageFlipSound();
          }}
          className="w-48 sm:w-80 h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-indigo-500 min-h-[44px]"
          aria-label="Jump to page"
        />

        <span className="text-[11px] font-mono text-slate-400">
          {Math.round((currentPage / (flipbook.pageCount || 1)) * 100)}% read
        </span>
      </footer>

      {/* ── Thumbnails Drawer Grid ─────────────────────────────────────────── */}
      {isThumbnailsOpen && (
        <div className="absolute inset-x-0 bottom-16 z-40 bg-slate-950/95 backdrop-blur-xl border-t border-white/10 p-4 max-h-48 overflow-x-auto flex gap-3 shadow-2xl custom-scrollbar animate-in slide-in-from-bottom duration-200">
          {pages.map((p) => (
            <button
              key={`thumb_${p.pageNumber}`}
              type="button"
              onClick={() => {
                setCurrentPage(p.pageNumber);
                playPageFlipSound();
                setIsThumbnailsOpen(false);
              }}
              className={`relative flex-shrink-0 aspect-[1/1.41] h-36 rounded-xl overflow-hidden border-2 transition-all hover:scale-105 min-h-[44px] min-w-[44px] ${
                currentPage === p.pageNumber
                  ? 'border-indigo-500 ring-2 ring-indigo-500/50 shadow-lg'
                  : 'border-white/10 opacity-70 hover:opacity-100'
              }`}
            >
              {p.thumbnailUrl || p.imageUrl ? (
                <img
                  src={p.thumbnailUrl || p.imageUrl}
                  alt={`Thumbnail ${p.pageNumber}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-slate-900 flex items-center justify-center text-xs font-bold text-slate-400">
                  {p.pageNumber}
                </div>
              )}
              <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/70 text-[9px] font-bold text-white">
                {p.pageNumber}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* ── Active Hotspot Interactive Popover Modal ───────────────────────── */}
      {activeHotspot && (
        <Dialog open={!!activeHotspot} onOpenChange={(open) => !open && setActiveHotspot(null)}>
          <DialogContent className="max-w-md rounded-3xl border-white/20 bg-slate-900 text-white p-6 shadow-2xl text-left">
            <DialogHeader className="space-y-1 text-left">
              <DialogTitle className="text-lg font-black text-white flex items-center gap-2">
                {activeHotspot.type === 'video' ? (
                  <Video className="h-5 w-5 text-rose-400" />
                ) : (
                  <ExternalLink className="h-5 w-5 text-indigo-400" />
                )}
                {activeHotspot.title || 'Interactive Layer'}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              {activeHotspot.type === 'video' ? (
                <div className="aspect-video w-full rounded-2xl overflow-hidden bg-black shadow-inner">
                  <iframe
                    src={activeHotspot.targetUrl}
                    title={activeHotspot.title || 'Video Player'}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="w-full h-full border-none"
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs text-slate-300">
                    Click the button below to navigate to the linked external resource:
                  </p>
                  <Button
                    onClick={() => {
                      if (activeHotspot.targetUrl) {
                        window.open(activeHotspot.targetUrl, '_blank', 'noopener,noreferrer');
                      }
                      setActiveHotspot(null);
                    }}
                    className="w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm min-h-[44px]"
                  >
                    Open Link Target <ExternalLink className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Gated Lead Capture Modal ───────────────────────────────────────── */}
      {isLeadGateOpen && !isLeadPassed && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-white/10 p-8 rounded-3xl space-y-6 text-left shadow-2xl animate-in fade-in zoom-in-95">
            <div className="space-y-2">
              <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-2xl w-fit">
                <Sparkles className="h-6 w-6" />
              </div>
              <h2 className="text-2xl font-black text-white">{flipbook.leadGate.title || 'Unlock Reader Access'}</h2>
              <p className="text-xs text-slate-400">{flipbook.leadGate.description || 'Enter your details to continue reading.'}</p>
            </div>

            <div className="space-y-3">
              {flipbook.leadGate.requireName && (
                <Input
                  value={leadName}
                  onChange={(e) => setLeadName(e.target.value)}
                  placeholder="Full Name"
                  className="h-11 rounded-xl bg-slate-800 border-white/10 text-white text-sm min-h-[44px]"
                />
              )}

              <Input
                type="email"
                value={leadEmail}
                onChange={(e) => setLeadEmail(e.target.value)}
                placeholder="Email Address"
                className="h-11 rounded-xl bg-slate-800 border-white/10 text-white text-sm min-h-[44px]"
              />

              {flipbook.leadGate.requirePhone && (
                <Input
                  value={leadPhone}
                  onChange={(e) => setLeadPhone(e.target.value)}
                  placeholder="Phone Number"
                  className="h-11 rounded-xl bg-slate-800 border-white/10 text-white text-sm min-h-[44px]"
                />
              )}

              <Button
                disabled={isSubmittingLead}
                onClick={handleLeadSubmit}
                className="w-full h-12 rounded-xl font-bold text-sm min-h-[44px] shadow-lg"
              >
                {isSubmittingLead ? 'Verifying...' : (flipbook.leadGate.ctaText || 'Unlock Reader')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── In-Reader Full-Text Search Modal ───────────────────────────────── */}
      <DocumentSearchBar
        open={isSearchOpen}
        onOpenChange={setIsSearchOpen}
        pages={pages.map((p) => ({
          pageNumber: p.pageNumber,
          extractedText: p.extractedText || '',
        }))}
        onSelectPage={(pageNum) => {
          setCurrentPage(pageNum);
          playPageFlipSound();
          setIsSearchOpen(false);
        }}
      />
    </div>
  );
}
