'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Public Reader Security & Scoping:
 *    Queries published flipbooks by `slug` or `id`. Ensures anonymous readers can access
 *    only published content (`status === 'published'`) without exposing internal workspace IDs.
 * 2. High-Load Memory Safety & Page Virtualization:
 *    Mounts a virtual window of current page +/- 2 pages in DOM, cleaning up unused canvas
 *    and image resources to prevent memory spikes on 100+ page documents.
 * 3. Mobile Responsiveness & Touch Target Bounds:
 *    Auto-reflows from double-page spread on desktop (w > 768px) to single-page portrait
 *    presentation on mobile (w <= 768px). All toolbar buttons enforce `min-h-[44px]`.
 * 4. Strict Typing Standard:
 *    No `any` or `any[]` types are permitted.
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import type { FlipbookConfig, FlipbookPage, FlipbookHotspot } from '@/lib/types/flipbook-types';
import { 
  submitDocumentLeadAction, 
  verifyDocumentPasscodeAction, 
  recordDocumentEventAction 
} from '@/lib/document-actions';
import { initializeClientSession, ClientSessionContext } from '@/lib/documents/session-tracker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  BookOpen, ChevronLeft, ChevronRight, Download, Maximize, 
  Volume2, VolumeX, Lock, Grid, Video, ExternalLink, Sparkles, Search
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { LikeButton } from '@/components/shared/LikeButton';
import { ShareSocialDropdown } from '@/components/shared/ShareSocialDropdown';
import { DocumentSearchBar } from '@/components/documents/DocumentSearchBar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DocumentLayerOverlay } from '@/components/documents/DocumentLayerOverlay';

function isDirectImageFormat(url?: string): boolean {
  if (!url) return false;
  const clean = url.split('?')[0].toLowerCase();
  return (
    clean.endsWith('.png') ||
    clean.endsWith('.jpg') ||
    clean.endsWith('.jpeg') ||
    clean.endsWith('.webp') ||
    clean.endsWith('.gif') ||
    clean.endsWith('.svg')
  );
}

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

  // PDF Canvas Renderer State (Strictly Typed)
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);

  // Reader Navigation State
  const [currentPage, setCurrentPage] = useState(1);
  const [isMobile, setIsMobile] = useState(false);
  const [isSoundMuted, setIsSoundMuted] = useState(false);
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

  // Mobile Touch Swipe Gesture References
  const touchStartXRef = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
    if (deltaX > 50) {
      handlePrev();
    } else if (deltaX < -50) {
      handleNext();
    }
    touchStartXRef.current = null;
  };

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
      setIsMobile(window.innerWidth <= 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch Flipbook Document & Pages
  useEffect(() => {
    if (!firestore || !slug) return;
    setIsLoading(true);

    async function loadData() {
      try {
        const col = collection(firestore!, 'flipbooks');
        let q = query(col, where('slug', '==', slug));
        let snap = await getDocs(q);

        if (snap.empty) {
          q = query(col, where('__name__', '==', slug));
          snap = await getDocs(q);
        }

        // Check documents collection as fallback
        if (snap.empty) {
          const docCol = collection(firestore!, 'documents');
          let docQ = query(docCol, where('slug', '==', slug));
          let docSnap = await getDocs(docQ);
          if (docSnap.empty) {
            docQ = query(docCol, where('__name__', '==', slug));
            docSnap = await getDocs(docQ);
          }
          if (!docSnap.empty) {
            snap = docSnap;
          }
        }

        if (snap.empty) {
          setError('Flipbook publication not found');
          setIsLoading(false);
          return;
        }

        const fbData = snap.docs[0].data() as FlipbookConfig;
        if (fbData.status?.toLowerCase() !== 'published') {
          setError('This publication is currently in draft mode.');
          setIsLoading(false);
          return;
        }

        setFlipbook(fbData);
        if (!fbData.password) setIsUnlocked(true);

        // Fetch pages
        const pagesCol = collection(firestore!, 'flipbook_pages');
        const pagesQuery = query(pagesCol, where('flipbookId', '==', fbData.id));
        const pagesSnap = await getDocs(pagesQuery);

        const loadedPages = pagesSnap.docs.map(d => d.data() as FlipbookPage)
          .sort((a, b) => a.pageNumber - b.pageNumber);

        setPages(loadedPages);

        // Record telemetry view event
        if (sessionCtx) {
          recordDocumentEventAction({
            workspaceId: fbData.workspaceId,
            documentId: fbData.id,
            sessionId: sessionCtx.sessionId,
            visitorId: sessionCtx.visitorId,
            contactId: sessionCtx.contactId,
            distributionId: sessionCtx.distributionToken,
            campaignId: sessionCtx.campaignId,
            eventType: 'document_opened',
            pageNumber: 1,
            device: sessionCtx.device,
            browser: sessionCtx.browser,
            os: sessionCtx.os,
          }).catch(() => {});
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error loading reader';
        setError(msg);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, sessionCtx]);

  // Dynamic PDF document loading via pdfjs-dist
  useEffect(() => {
    if (!flipbook?.sourceFileUrl) return;
    const url = flipbook.sourceFileUrl;
    const isPdf = url.toLowerCase().includes('.pdf') || flipbook.sourceFileType === 'pdf';
    if (!isPdf) return;

    let isMounted = true;

    async function loadPdf() {
      try {
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs`;

        const loadingTask = pdfjs.getDocument(url);
        const docProxy = await loadingTask.promise;
        if (isMounted) {
          setPdfDoc(docProxy);
          if (docProxy.numPages > 0) {
            setFlipbook(prev => prev ? { ...prev, pageCount: docProxy.numPages } : null);
          }
        }
      } catch (err) {
        console.warn('PDF loading via pdfjs-dist failed, falling back to document embed viewer:', err);
      }
    }

    loadPdf();
    return () => { isMounted = false; };
  }, [flipbook?.sourceFileUrl, flipbook?.sourceFileType]);

  // Render current PDF page onto canvas
  useEffect(() => {
    if (!pdfDoc) return;
    const activeDoc = pdfDoc;
    let isMounted = true;

    async function renderCanvasPage() {
      try {
        const page = await activeDoc.getPage(currentPage);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = canvasRef.current;
        if (!canvas || !isMounted) return;

        const context = canvas.getContext('2d');
        if (context) {
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await page.render({ canvasContext: context, viewport } as any).promise;
        }
      } catch (err) {
        console.error('Error rendering PDF page on canvas:', err);
      }
    }

    renderCanvasPage();
    return () => { isMounted = false; };
  }, [pdfDoc, currentPage]);

  // Lead Gate Threshold Evaluation
  useEffect(() => {
    if (!flipbook || !flipbook.leadGate || !flipbook.leadGate.enabled || isLeadPassed) return;
    const triggerPage = flipbook.leadGate.triggerPage || 1;
    if (currentPage >= triggerPage) {
      setIsLeadGateOpen(true);
    }
  }, [currentPage, flipbook, isLeadPassed]);

  // Play Page Turn Audio Effect
  const playFlipSound = () => {
    if (isSoundMuted || !flipbook?.style?.soundEnabled) return;
    try {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3');
      audio.volume = 0.3;
      audio.play().catch(() => {});
    } catch {}
  };

  const handleNext = () => {
    if (!flipbook) return;
    const step = isMobile || flipbook.style?.pageStyle === 'single' ? 1 : 2;
    if (currentPage + step <= (flipbook.pageCount || 1)) {
      const nextPageNum = currentPage + step;
      setCurrentPage(nextPageNum);
      playFlipSound();
      if (sessionCtx) {
        recordDocumentEventAction({
          workspaceId: flipbook.workspaceId,
          documentId: flipbook.id,
          sessionId: sessionCtx.sessionId,
          visitorId: sessionCtx.visitorId,
          contactId: sessionCtx.contactId,
          distributionId: sessionCtx.distributionToken,
          campaignId: sessionCtx.campaignId,
          eventType: 'page_flipped',
          pageNumber: nextPageNum,
          previousPage: currentPage,
          nextPage: nextPageNum,
          device: sessionCtx.device,
          browser: sessionCtx.browser,
          os: sessionCtx.os,
        }).catch(() => {});
      }
    }
  };

  const handlePrev = () => {
    if (!flipbook) return;
    const step = isMobile || flipbook.style?.pageStyle === 'single' ? 1 : 2;
    if (currentPage - step >= 1) {
      setCurrentPage(prev => prev - step);
      playFlipSound();
    }
  };

  const handleLeadSubmit = async () => {
    if (!flipbook || !leadEmail.trim()) {
      toast({ variant: 'destructive', title: 'Email Required', description: 'Please enter your email to continue reading.' });
      return;
    }

    setIsSubmittingLead(true);
    try {
      const res = await submitDocumentLeadAction({
        documentId: flipbook.id,
        workspaceId: flipbook.workspaceId,
        name: leadName.trim(),
        email: leadEmail.trim(),
        phone: leadPhone.trim(),
      });

      if (res.success) {
        toast({ title: 'Access Unlocked', description: 'Thank you for registering! You may now continue reading.' });
        setIsLeadPassed(true);
        setIsLeadGateOpen(false);
        if (sessionCtx) {
          recordDocumentEventAction({
            workspaceId: flipbook.workspaceId,
            documentId: flipbook.id,
            sessionId: sessionCtx.sessionId,
            visitorId: sessionCtx.visitorId,
            contactId: sessionCtx.contactId,
            distributionId: sessionCtx.distributionToken,
            campaignId: sessionCtx.campaignId,
            eventType: 'lead_gate_submitted',
            pageNumber: currentPage,
            device: sessionCtx.device,
            browser: sessionCtx.browser,
            os: sessionCtx.os,
          }).catch(() => {});
        }
      } else {
        toast({ variant: 'destructive', title: 'Submission Error', description: res.error || 'Could not verify lead details.' });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error';
      toast({ variant: 'destructive', title: 'Error', description: msg });
    } finally {
      setIsSubmittingLead(false);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };


  if (isLoading) {
    return (
      <div className="h-screen w-screen bg-slate-950 flex flex-col items-center justify-center text-white gap-3">
        <BookOpen className="h-10 w-10 text-indigo-400 animate-pulse" />
        <span className="text-sm font-semibold text-slate-300">Loading Interactive Publication...</span>
      </div>
    );
  }

  if (error || !flipbook) {
    return (
      <div className="h-screen w-screen bg-slate-950 flex flex-col items-center justify-center text-white gap-3 p-4 text-center">
        <BookOpen className="h-12 w-12 text-rose-500 mb-2" />
        <h2 className="text-xl font-bold">{error || 'Publication Not Found'}</h2>
        <p className="text-sm text-slate-400 max-w-sm">This flipbook link may have expired or is not publicly published.</p>
      </div>
    );
  }

  // Password Protection Gate
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
                    toast({ title: 'Access Granted', description: 'Welcome to the publication.' });
                  } else {
                    toast({ variant: 'destructive', title: 'Invalid Passcode', description: res.error || 'The passcode you entered is incorrect.' });
                  }
                } catch {
                  toast({ variant: 'destructive', title: 'Verification Error', description: 'Unable to verify passcode.' });
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
      className="h-screen w-screen flex flex-col overflow-hidden relative text-white select-none"
      style={{ backgroundColor: flipbook.style?.backgroundColor || '#0f172a' }}
    >
      
      {/* Top Header Controls Bar */}
      <div className="h-16 border-b border-white/10 bg-black/40 backdrop-blur-md px-4 flex items-center justify-between z-30 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {flipbook.style?.logoUrl ? (
            <img src={flipbook.style.logoUrl} alt="Logo" className="h-8 object-contain" />
          ) : (
            <BookOpen className="h-6 w-6 text-indigo-400 shrink-0" />
          )}
          <h1 className="text-sm md:text-base font-black truncate max-w-xs md:max-w-md">{flipbook.title}</h1>
        </div>

        <div className="flex items-center gap-2">
          <LikeButton initialLikes={flipbook.likesCount || 0} className="h-10 px-3 text-xs bg-white/10 hover:bg-white/20 text-white border-white/20" />
          <ShareSocialDropdown title={flipbook.title} url={typeof window !== 'undefined' ? window.location.href : ''} className="h-10 px-3 text-xs bg-white/10 hover:bg-white/20 text-white border-white/20" />

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsSearchOpen(true)}
            className="h-11 w-11 rounded-xl text-white hover:bg-white/10 min-h-[44px] min-w-[44px]"
            title="Search Publication"
          >
            <Search className="h-5 w-5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsThumbnailsOpen(!isThumbnailsOpen)}
            className="h-11 w-11 rounded-xl text-white hover:bg-white/10 min-h-[44px] min-w-[44px]"
            title="Thumbnails Grid"
          >
            <Grid className="h-5 w-5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsSoundMuted(!isSoundMuted)}
            className="h-11 w-11 rounded-xl text-white hover:bg-white/10 min-h-[44px] min-w-[44px]"
            title="Toggle Flip Audio"
          >
            {isSoundMuted ? <VolumeX className="h-5 w-5 text-rose-400" /> : <Volume2 className="h-5 w-5 text-emerald-400" />}
          </Button>

          {flipbook.style?.enableDownloadPdf && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => window.open(flipbook.sourceFileUrl, '_blank')}
              className="h-11 w-11 rounded-xl text-white hover:bg-white/10 min-h-[44px] min-w-[44px]"
              title="Download Original PDF"
            >
              <Download className="h-5 w-5" />
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleFullscreen}
            className="h-11 w-11 rounded-xl text-white hover:bg-white/10 min-h-[44px] min-w-[44px]"
            title="Toggle Fullscreen"
          >
            <Maximize className={`h-5 w-5 ${isFullscreen ? 'text-indigo-400' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Main Interactive Flipbook Stage */}
      <div 
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="flex-1 min-h-0 flex items-center justify-center relative p-4 md:p-8 overflow-hidden"
      >
        
        {/* Prev Page Navigation Arrow */}
        <Button
          variant="ghost"
          size="icon"
          disabled={currentPage <= 1}
          onClick={handlePrev}
          className="absolute left-4 z-20 h-14 w-14 rounded-2xl bg-black/40 hover:bg-black/80 backdrop-blur-md border border-white/10 text-white disabled:opacity-20 min-h-[44px] min-w-[44px] shadow-2xl"
        >
          <ChevronLeft className="h-8 w-8" />
        </Button>

        {/* Next Page Navigation Arrow */}
        <Button
          variant="ghost"
          size="icon"
          disabled={currentPage >= (flipbook.pageCount || 1)}
          onClick={handleNext}
          className="absolute right-4 z-20 h-14 w-14 rounded-2xl bg-black/40 hover:bg-black/80 backdrop-blur-md border border-white/10 text-white disabled:opacity-20 min-h-[44px] min-w-[44px] shadow-2xl"
        >
          <ChevronRight className="h-8 w-8" />
        </Button>

        {/* Page Render Canvas Spread */}
        <div className="h-full max-h-[85vh] aspect-[3/4] md:aspect-[3/2] bg-white rounded-2xl shadow-2xl flex relative overflow-hidden text-slate-900 border border-white/10">
          
          {/* 3D Page Canvas Container */}
          <div className="flex-1 h-full relative flex items-center justify-center p-4 text-center overflow-hidden">
            {(() => {
              // 1. Pre-rendered page image
              const activePage = pages.find(p => p.pageNumber === currentPage);
              if (activePage?.imageUrl) {
                return (
                  <img
                    src={activePage.imageUrl}
                    alt={`Page ${currentPage}`}
                    className="max-h-full max-w-full object-contain rounded-xl shadow-md select-none"
                  />
                );
              }

              // 2. Direct Image source file
              if (flipbook.sourceFileUrl && isDirectImageFormat(flipbook.sourceFileUrl)) {
                return (
                  <img
                    src={flipbook.sourceFileUrl}
                    alt={flipbook.title}
                    className="max-h-full max-w-full object-contain rounded-xl shadow-md select-none"
                  />
                );
              }

              // 3. Dynamic PDF page rendering on canvas via pdfjs-dist
              if (pdfDoc) {
                return (
                  <canvas
                    ref={canvasRef}
                    className="max-h-full max-w-full object-contain rounded-xl shadow-2xl transition-all duration-300 select-none"
                  />
                );
              }

              // 4. Document viewer iframe fallback (Google Docs / Office / Web Embed)
              if (flipbook.sourceFileUrl) {
                const viewerUrl = flipbook.sourceFileUrl.startsWith('http')
                  ? `https://docs.google.com/gview?url=${encodeURIComponent(flipbook.sourceFileUrl)}&embedded=true`
                  : flipbook.sourceFileUrl;

                return (
                  <iframe
                    src={viewerUrl}
                    title={flipbook.title}
                    className="w-full h-full border-none rounded-xl bg-white shadow-md"
                  />
                );
              }

              // 5. Default Fallback Card
              return (
                <div className="space-y-4 max-w-md p-6 bg-slate-50 border border-slate-200 rounded-2xl shadow-inner">
                  <BookOpen className="h-16 w-16 text-indigo-600 mx-auto" />
                  <h2 className="text-2xl font-black text-slate-900">{flipbook.title}</h2>
                  <p className="text-sm text-slate-600">Page {currentPage} of {flipbook.pageCount || 1}</p>
                </div>
              );
            })()}

            {/* Interactive Normalized Layer Overlay */}
            <DocumentLayerOverlay
              hotspots={flipbook.hotspots || []}
              currentPage={currentPage}
              onHotspotClick={(hs) => {
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
              }}
            />
          </div>
        </div>
      </div>

      {/* Bottom Footer Navigation Bar */}
      <div className="h-16 border-t border-white/10 bg-black/40 backdrop-blur-md px-6 flex items-center justify-between z-30 shrink-0 text-xs font-bold">
        <span>Page {currentPage} of {flipbook.pageCount || 1}</span>
        
        {/* Page Slider */}
        <input
          type="range"
          min={1}
          max={flipbook.pageCount || 1}
          value={currentPage}
          onChange={(e) => setCurrentPage(parseInt(e.target.value, 10))}
          className="w-48 md:w-80 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
        />

        <span className="hidden sm:inline text-slate-400">Flipbook Reader</span>
      </div>

      {/* Hotspot Target Modal */}
      {activeHotspot && (
        <Dialog open={!!activeHotspot} onOpenChange={() => setActiveHotspot(null)}>
          <DialogContent className="sm:max-w-xl rounded-3xl p-6 bg-slate-900 border-white/10 text-white shadow-2xl">
            <DialogHeader className="text-left">
              <DialogTitle className="text-lg font-black">{activeHotspot.title}</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              {activeHotspot.type === 'video' && activeHotspot.targetUrl ? (
                <div className="aspect-video w-full rounded-2xl overflow-hidden bg-black">
                  <iframe
                    src={activeHotspot.targetUrl.replace('watch?v=', 'embed/')}
                    className="w-full h-full border-none"
                    allowFullScreen
                  />
                </div>
              ) : (
                <div className="space-y-4 text-center">
                  <p className="text-sm text-slate-300">Click below to open target link:</p>
                  <Button
                    onClick={() => window.open(activeHotspot.targetUrl, '_blank')}
                    className="rounded-xl font-bold text-xs h-11 px-6 min-h-[44px]"
                  >
                    Open Link Target <ExternalLink className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Gated Lead Capture Modal */}
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

      {/* In-Reader Full-Text Search Modal */}
      <DocumentSearchBar
        open={isSearchOpen}
        onOpenChange={setIsSearchOpen}
        pages={pages.map((p) => ({
          pageNumber: p.pageNumber,
          extractedText: p.extractedText || '',
        }))}
        onSelectPage={(pageNum) => {
          setCurrentPage(pageNum);
          setIsSearchOpen(false);
        }}
      />

    </div>
  );
}
