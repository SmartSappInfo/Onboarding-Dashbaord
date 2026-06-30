'use client';

import { useState, useCallback, Suspense, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { SmartSappLogo as Logo } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { ArrowRight, CheckCircle2, Play } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ResizableIFrame } from '@/components/ui/ResizableIFrame';
import { usePageAnalytics } from '@/hooks/use-page-analytics';
import { PageAnalyticsReader } from '@/components/page-analytics-reader';
import type { PageEventChannel } from '@/lib/types';
import LightRays from '@/components/LightRays';
import AnimatedHeroShapes from '@/components/animated-hero-shapes';

// ─── Constants ────────────────────────────────────────────────────────────────

const HERO_THUMBNAIL_URL = 'https://firebasestorage.googleapis.com/v0/b/studio-9220106300-f74cb.firebasestorage.app/o/media%2Fimage%2F1782713567250-Thumb_Enrollment_SalesVideo.gif?alt=media&token=7a46ab6b-7079-45d4-ba99-c9783098c6cc';
const PRICING_THUMBNAIL_URL = 'https://firebasestorage.googleapis.com/v0/b/studio-9220106300-f74cb.firebasestorage.app/o/media%2Fimage%2F1782713567250-Thumb_Pricing_Features_Enrollment.gif?alt=media&token=f0f9c166-a8cf-47e3-85cc-ca88f738dac7';
const HERO_VIDEO_URL = 'https://firebasestorage.googleapis.com/v0/b/studio-9220106300-f74cb.firebasestorage.app/o/media%2Fvideo%2FEnrollment%20Main%20Video.mp4?alt=media&token=a6659184-8044-4229-a0e1-64f8d17d4ae2';
const PRICING_VIDEO_URL = 'https://firebasestorage.googleapis.com/v0/b/studio-9220106300-f74cb.firebasestorage.app/o/media%2Fvideo%2F1782804150466-Pricing%20Options.mp4?alt=media&token=dd9c4116-14fe-4cca-9f79-3618b33b828e';
const CTA_LINK = 'https://smartsapp.com/request-trial';
const PAGE_SLUG = 'school-enrollment';

// ─── Video Facade Component (LCP Optimization) ─────────────────────────────────

interface VideoFacadeProps {
  videoUrlOrId: string;
  thumbnailUrl?: string;
  onPlay: () => void;
  title?: string;
}

function VideoFacade({ videoUrlOrId, thumbnailUrl, onPlay, title = 'Video' }: VideoFacadeProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  const handlePlay = useCallback(() => {
    setIsPlaying(true);
    onPlay();
  }, [onPlay]);

  const isHtml5Video = videoUrlOrId.startsWith('http://') || videoUrlOrId.startsWith('https://');

  if (isPlaying) {
    return (
      <div className="relative w-full aspect-video rounded-xl overflow-hidden shadow-2xl bg-slate-900 border border-slate-200/20">
        {isHtml5Video ? (
          <video
            src={videoUrlOrId}
            controls
            autoPlay
            playsInline
            className="absolute inset-0 w-full h-full object-contain"
          />
        ) : (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${videoUrlOrId}?autoplay=1&rel=0&modestbranding=1`}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 w-full h-full border-0"
          />
        )}
      </div>
    );
  }

  return (
    <div 
      className="relative w-full aspect-video rounded-xl overflow-hidden shadow-2xl cursor-pointer group bg-slate-100 border border-slate-200"
      onClick={handlePlay}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handlePlay()}
      aria-label={`Play ${title}`}
    >
      {thumbnailUrl ? (
        <Image 
          src={thumbnailUrl} 
          alt="Video Thumbnail" 
          fill 
          className="object-cover group-hover:scale-105 transition-transform duration-700 ease-out-back" 
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
           {isHtml5Video ? (
             <div className="text-slate-400 text-xs">No preview available</div>
           ) : (
             <img src={`https://img.youtube.com/vi/${videoUrlOrId}/maxresdefault.jpg`} className="object-cover w-full h-full opacity-90 group-hover:scale-105 transition-transform duration-700" alt="Thumbnail" />
           )}
        </div>
      )}
      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors duration-300" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-20 h-20 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
          <Play className="w-8 h-8 text-[#3B5FFF] ml-1" fill="currentColor" />
        </div>
      </div>
    </div>
  );
}

// ─── Main Client Component ──────────────────────────────────────────────────

export default function SchoolEnrollmentClient() {
  const { track, setEntityId, hasFiredVideoStart } = usePageAnalytics(PAGE_SLUG);
  const [isNavScrolled, setIsNavScrolled] = useState(false);
  const [isSurveyOpen, setIsSurveyOpen] = useState(false);

  // Track scroll for sticky nav
  useEffect(() => {
    const handleScroll = () => setIsNavScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleEntityDetected = useCallback((entityId: string) => {
    setEntityId(entityId);
  }, [setEntityId]);

  const handleReady = useCallback((channel: PageEventChannel) => {
    track('page_view', channel);
  }, [track]);

  const handleCtaClick = (location: string) => {
    track('cta_click');
    setIsSurveyOpen(true);
  };

  const handleVideoPlay = (location: string) => {
    if (!hasFiredVideoStart.current) {
      hasFiredVideoStart.current = true;
      track('video_start');
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a1a] text-slate-100 font-sans selection:bg-[#3B5FFF]/20 relative overflow-hidden">
      <Suspense fallback={null}>
        <PageAnalyticsReader onEntityDetected={handleEntityDetected} onReady={handleReady} />
      </Suspense>



      {/* Floating Navigation */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isNavScrolled ? 'py-4' : 'py-6'
        }`}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div
            className={`flex items-center justify-between transition-all duration-300 rounded-full ${
              isNavScrolled
                ? 'bg-slate-950/60 backdrop-blur-md shadow-lg shadow-slate-950/50 border border-slate-800 px-6 py-3'
                : 'bg-transparent px-2 py-2'
            }`}
          >
            <div className="flex items-center gap-2">
              <Logo variant="white" className="h-8 w-auto" />
            </div>
            
            <nav className="hidden md:flex items-center gap-8 font-medium text-sm text-slate-300">
              <a href="#challenges" className="hover:text-white transition-colors">Challenges</a>
              <a href="#solution" className="hover:text-white transition-colors">Fill My Classrooms</a>
              <a href="#features" className="hover:text-white transition-colors">Our Blueprint</a>
              <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
            </nav>

            <div className="flex items-center gap-4">
              <div className="hidden lg:flex flex-col text-sm font-semibold text-right text-slate-300 mr-2">
                <span>+233 50 160 8002</span>
              </div>
              <Button
                onClick={() => handleCtaClick('nav')}
                className="bg-[#3B5FFF] hover:bg-[#2b4cdd] text-white rounded-full px-6 transition-transform hover:scale-105 active:scale-95 shadow-md shadow-blue-500/20"
              >
                Request Free Demo
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="pb-24">
        {/* HERO SECTION */}
        <section className="relative w-full overflow-hidden pt-36 pb-24 text-center bg-[#0a0a1a]">
          {/* Decorative Meeting Background */}
          <LightRays
            raysOrigin="top-center"
            raysColor="#3B5FFF"
            raysSpeed={1}
            lightSpread={0.5}
            rayLength={3}
            followMouse={true}
            mouseInfluence={0.4}
            noiseAmount={0}
            distortion={0}
            pulsating
            fadeDistance={1}
            saturation={1}
            className="!absolute inset-0 z-0"
          />
          
          <AnimatedHeroShapes />

          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-white mb-6 leading-tight">
            Are You <span className="text-red-500 relative inline-block">
              Bleeding 🩸 Financially
              <svg className="absolute -bottom-2 left-0 w-full h-3 text-red-500/20" viewBox="0 0 100 10" preserveAspectRatio="none">
                <path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="4" fill="transparent" />
              </svg>
            </span><br/>
            Due to Empty Spots In Your Classrooms?
          </h1>
          
          <p className="text-xl md:text-2xl text-slate-300 mb-10 max-w-[850px] mx-auto leading-relaxed">
            Whether your enrollment is declining, flat, or growing —our expert training will help you boost your numbers just in time for the upcoming academic year.
          </p>
 
          <div className="mb-4">
            <p className="font-semibold text-slate-300 mt-2">Click to watch video, It's super important!</p>
          </div>
 
          <div className="max-w-3xl mx-auto mb-8">
            <VideoFacade 
              videoUrlOrId={HERO_VIDEO_URL} 
              thumbnailUrl={HERO_THUMBNAIL_URL}
              onPlay={() => handleVideoPlay('hero_video')} 
              title="Enrollment Strategy Video" 
            />
          </div>
 
          <div className="mb-8">
            <p className="font-semibold text-slate-300 mt-2 mb-6">You might want to see if this works for you.</p>
            
            <Button
              size="lg"
              onClick={() => handleCtaClick('hero_main')}
              className="bg-[#3B5FFF] hover:bg-[#2b4cdd] text-white text-lg rounded-full px-8 py-7 shadow-xl shadow-blue-500/30 hover:-translate-y-1 transition-all duration-300 font-semibold"
            >
              I need a free 30-minutes consultation
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </div>
          </div>
        </section>

        {/* IMAGINE SECTION */}
        <section className="pt-20 pb-8 bg-white relative z-10 text-center">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-[#3B5FFF]/10 flex items-center justify-center mb-6">
              <div className="w-5 h-5 border-2 border-[#3B5FFF] rounded-sm"></div>
            </div>
            <h2 className="text-3xl md:text-5xl font-bold text-slate-900 mb-4 leading-tight">
              Imagine every classroom filled, buzzing with eager students in just one term.
            </h2>
            <p className="text-xl md:text-2xl text-red-600 italic font-medium">
              ~We guarantee it, or you pay nothing!
            </p>
          </div>
        </section>
 
        {/* THE ENROLLMENT CHALLENGE */}
        <section id="challenges" className="bg-white relative z-10 text-slate-900">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-10 grid grid-cols-1 md:grid-cols-12 gap-12 items-center">
            <div className="md:col-span-6 space-y-8">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 leading-tight">
                The Enrollment Challenge
              </h2>
              <div className="space-y-6 text-slate-600 text-lg leading-relaxed">
                <p>
                  You're dedicated, passionate, and committed to providing top-tier education, but your school isn't reaching its full potential. Enrollment numbers are stagnant or, worse, declining.
                </p>
                <p>
                  This isn't just a number game; it's about the future of your school and its students. The problem is clear: traditional enrollment strategies are no longer sufficient in today's digital age.
                </p>
                <p>
                  Parents and students are looking for something more, something you're eager to provide but haven't yet found the best way to do it.
                </p>
              </div>
            </div>
            <div className="md:col-span-6">
              <img 
                src="https://firebasestorage.googleapis.com/v0/b/studio-9220106300-f74cb.firebasestorage.app/o/media%2Fimage%2F1782713539850-MailImage_EnrollmentChallenges.gif?alt=media&token=3a81216a-6031-4ef0-8828-8867dbbfb410" 
                alt="Enrollment Challenges" 
                className="w-full h-auto"
              />
            </div>
          </div>
        </section>

        {/* EMPTY SPOTS SECTION */}
        <section className="bg-white pt-10 pb-20 relative z-10 text-slate-900">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-12 gap-16 items-center">
            <div className="md:col-span-5 order-2 md:order-1 relative">
              <img 
                src="https://firebasestorage.googleapis.com/v0/b/studio-9220106300-f74cb.firebasestorage.app/o/media%2Fimage%2F1782713539851-MailImage_UmetProjections.gif?alt=media&token=c51de80b-95ae-4ec7-9f62-cd009cf34a4f" 
                alt="Empty Spots Projection" 
                className="w-full h-auto relative z-10"
              />
              {/* Ambient Decor */}
              <div className="absolute -bottom-10 -left-10 w-40 h-40 border-8 border-[#3B5FFF]/10 rounded-full -z-10"></div>
            </div>
            
            <div className="md:col-span-7 order-1 md:order-2 space-y-8">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 leading-tight">
                How many empty spots do you have in your school right now?
              </h2>
              <div className="space-y-6 text-slate-600 text-base leading-relaxed">
                <p>
                  Imagine the stress and frustration of watching empty seats that could have been filled with eager learners. Each unfilled spot is a missed opportunity to shape a young mind and grow your school's community.
                </p>
                <p className="border-l-4 border-orange-500 pl-6 py-3 bg-orange-50 text-orange-950 italic rounded-r-lg">
                  Financial uncertainties loom larger with each passing semester, affecting your ability to invest in quality staff, advanced teaching materials, and the very essence that makes your school unique.
                </p>
                <p>
                  The longer this trend continues, the harder it becomes to maintain the high educational standards you've set, let alone think about expanding your offerings or facilities.
                </p>
              </div>
              <div className="flex flex-wrap gap-4 pt-4">
                <Button
                  onClick={() => handleCtaClick('empty_spots_audit')}
                  className="bg-[#3B5FFF] hover:bg-[#2b4cdd] text-white rounded-xl px-8 py-6 font-semibold hover:shadow-lg transition-all active:scale-95 flex items-center gap-2"
                >
                  Request Enrollment Audit
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* CONSOLIDATED SOLUTION & FEATURES GRID */}
        <section id="solution" className="pt-24 pb-12 bg-white relative z-10 text-slate-900">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Consolidated Header */}
            <div className="flex flex-col items-center text-center">
              <div className="w-10 h-10 bg-[#3b5fff]/10 flex items-center justify-center rounded-xl border border-[#3b5fff]/20 mb-6">
                <div className="w-3.5 h-3.5 border-2 border-[#3B5FFF] rounded-sm"></div>
              </div>
              <h2 className="text-3xl md:text-5xl font-bold text-slate-900 mb-6 leading-tight max-w-4xl">
                We Have a Solution to Filling All Empty Spots in Your Classrooms
              </h2>
            </div>
          </div>
        </section>

        {/* Feature Row 1 */}
        <section className="py-6 bg-slate-50 border-y border-slate-100 relative z-10 text-slate-900">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-12 items-center">
              <div className="md:col-span-6 space-y-4 text-left">
                <h3 className="text-2xl font-bold text-slate-900">Tailored Enrollment Strategies</h3>
                <p className="text-slate-650 text-lg leading-relaxed">
                  Our approach is not one-size-fits-all. We craft personalized strategies that align with your school's unique strengths and values.
                </p>
              </div>
              <div className="md:col-span-6 flex justify-center md:justify-end">
                <img
                  src="https://firebasestorage.googleapis.com/v0/b/studio-9220106300-f74cb.firebasestorage.app/o/media%2Fimage%2F1782713539851-MailImage_ProvenEnrollmentTactics.webp?alt=media&token=04666276-9855-47ff-8f83-edd89bd2bf99"
                  alt="Tailored Enrollment Strategies"
                  className="w-full max-w-[460px] h-auto object-contain"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Feature Row 2 */}
        <section className="py-6 bg-white relative z-10 text-slate-900">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-12 items-center">
              <div className="md:col-span-6 md:order-2 space-y-4 text-left md:pl-8">
                <h3 className="text-2xl font-bold text-slate-900">Digital Marketing Mastery</h3>
                <p className="text-slate-650 text-lg leading-relaxed">
                  From social media to search engines, we make your school visible and attractive to the right audience.
                </p>
              </div>
              <div className="md:col-span-6 md:order-1 flex justify-center md:justify-start">
                <img
                  src="https://firebasestorage.googleapis.com/v0/b/studio-9220106300-f74cb.firebasestorage.app/o/media%2Fimage%2F1782713539851-MailImage_BeSeenEverywhere.webp?alt=media&token=00e7171d-ad3e-4822-9516-a99fb522b6fa"
                  alt="Digital Marketing Mastery"
                  className="w-full max-w-[460px] h-auto object-contain"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Feature Row 3 */}
        <section className="py-6 bg-slate-50 border-y border-slate-100 relative z-10 text-slate-900">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-12 items-center">
              <div className="md:col-span-6 space-y-4 text-left">
                <h3 className="text-2xl font-bold text-slate-900">AI Insights and Analytics</h3>
                <p className="text-slate-650 text-lg leading-relaxed">
                  Understand what attracts students and parents through advanced analytics, helping you engage.
                </p>
              </div>
              <div className="md:col-span-6 flex justify-center md:justify-end">
                <img
                  src="https://firebasestorage.googleapis.com/v0/b/studio-9220106300-f74cb.firebasestorage.app/o/media%2Fimage%2F1782713539851-MailImage_InformedTargeting.png?alt=media&token=6cf6b885-51b5-4987-ae1f-f910f82cc776"
                  alt="AI Insights and Analytics"
                  className="w-full max-w-[460px] h-auto object-contain"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Feature Row 4 */}
        <section className="py-6 bg-white relative z-10 text-slate-900">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-12 items-center">
              <div className="md:col-span-6 md:order-2 space-y-4 text-left md:pl-8">
                <h3 className="text-2xl font-bold text-slate-900">Proven Sales Strategies</h3>
                <p className="text-slate-650 text-lg leading-relaxed">
                  We combine our digital prowess with proven sales strategies to not just attract inquiries but convert them into enrollments.
                </p>
              </div>
              <div className="md:col-span-6 md:order-1 flex justify-center md:justify-start">
                <img
                  src="https://firebasestorage.googleapis.com/v0/b/studio-9220106300-f74cb.firebasestorage.app/o/media%2Fimage%2F1782713539931-MailImage_BringThemAllIn.webp?alt=media&token=3cd748f2-01d6-41ce-bf34-c73cf40d3e4f"
                  alt="Proven Sales Strategies"
                  className="w-full max-w-[460px] h-auto object-contain"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Feature Row 5 */}
        <section className="py-6 bg-slate-50 border-y border-slate-100 relative z-10 text-slate-900">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-12 items-center">
              <div className="md:col-span-6 space-y-4 text-left">
                <h3 className="text-2xl font-bold text-slate-900">Complete Transparency</h3>
                <p className="text-slate-650 text-lg leading-relaxed">
                  With regular reports and analytics, you'll see exactly how our strategies translate into real enrollment increases.
                </p>
              </div>
              <div className="md:col-span-6 flex justify-center md:justify-end">
                <img
                  src="https://firebasestorage.googleapis.com/v0/b/studio-9220106300-f74cb.firebasestorage.app/o/media%2Fimage%2F1782713539851-MailImage_StayInTheLoop.png?alt=media&token=c3951492-33d4-433d-ab23-ea71943353e9"
                  alt="Complete Transparency"
                  className="w-full max-w-[460px] h-auto object-contain"
                />
              </div>
            </div>
          </div>
        </section>

        {/* PRICING & PACKAGES */}
        <section id="pricing" className="py-24 bg-white border-y border-slate-100 relative z-10 text-slate-900">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">How Much Will I Pay For This Value?</h2>
              
              <div className="max-w-3xl mx-auto my-12">
                <p className="font-semibold text-slate-700 mb-4">Click to watch video 👇🏽It's Super Important👇🏽</p>
                <VideoFacade 
                  videoUrlOrId={PRICING_VIDEO_URL} 
                  thumbnailUrl={PRICING_THUMBNAIL_URL}
                  onPlay={() => handleVideoPlay('pricing_video')} 
                  title="Pricing Explanation Video" 
                />
              </div>

              <h3 className="text-2xl font-bold text-[#3B5FFF] mb-4">Which Plan best suits your needs?</h3>
              <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                Every plan comes with a <span className="font-bold text-slate-900">100% Money Back Guarantee</span>, 
                and at least 3 months retainer fee - <span className="font-bold text-slate-900">20% of the Package price</span>, 
                after setup period, to ensure good results.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto items-stretch">
              {/* Standard */}
              <div className="bg-slate-50 rounded-3xl p-8 border border-slate-200 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all duration-300 flex flex-col group relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-slate-200 group-hover:bg-[#3B5FFF] transition-colors" />
                <h4 className="text-xl font-bold text-slate-900 mb-1">Standard Package</h4>
                <p className="text-[#3B5FFF] font-semibold mb-6">Trusted Advisor <br/>(Do It Myself)</p>
                
                <ul className="space-y-3 mb-8 flex-grow">
                  <li className="flex items-start gap-2"><CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" /><span className="text-slate-600">Strategy Formulation</span></li>
                  <li className="flex items-start gap-2"><CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" /><span className="text-slate-600">Implementation Guide</span></li>
                </ul>
                
                <p className="text-sm text-slate-500 mb-6 flex-grow">
                  This option lays the foundation for achieving enrollment strategy by providing you with ongoing access by phone, WhatsApp, email, and similar means during the setup period. In this capacity, we will serve as a trusted advisor.
                </p>
                
                <Button onClick={() => handleCtaClick('pricing_standard')} className="w-full rounded-full bg-slate-950 text-white hover:bg-slate-800 transition-all active:scale-95 py-6 font-semibold">See Details</Button>
              </div>

              {/* Classic */}
              <div className="bg-slate-50 rounded-3xl p-8 border border-slate-200 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all duration-300 flex flex-col group relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-slate-200 group-hover:bg-[#3B5FFF] transition-colors" />
                <h4 className="text-xl font-bold text-slate-900 mb-1">Classic Package</h4>
                <p className="text-[#3B5FFF] font-semibold mb-6">Strategic Partner <br/>(Do It With Me)</p>
                
                <ul className="space-y-3 mb-8 flex-grow">
                  <li className="flex items-start gap-2"><CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" /><span className="text-slate-600">Strategy Implementation</span></li>
                  <li className="flex items-start gap-2"><CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" /><span className="text-slate-600">Automated Processes</span></li>
                  <li className="flex items-start gap-2"><CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" /><span className="text-slate-600">Expert Training</span></li>
                </ul>
                
                <p className="text-sm text-slate-500 mb-6 flex-grow">
                  In addition to the responsibilities of the Standard Option, we will work closely with you and the enrollment team to implement the initiatives necessary to achieve specific goals.
                </p>
                
                <Button onClick={() => handleCtaClick('pricing_classic')} className="w-full rounded-full bg-slate-950 text-white hover:bg-slate-800 transition-all active:scale-95 py-6 font-semibold">See Details</Button>
              </div>

              {/* Premium */}
              <div className="bg-slate-900 rounded-3xl p-8 border border-slate-800 shadow-xl hover:shadow-2xl hover:shadow-blue-900/20 transition-all duration-300 flex flex-col relative overflow-hidden text-white transform hover:-translate-y-1">
                <div className="absolute top-0 right-0 bg-[#3B5FFF] text-white text-xs font-bold px-3 py-1 rounded-bl-lg">POPULAR</div>
                <h4 className="text-xl font-bold text-white mb-1">Premium Package</h4>
                <p className="text-blue-300 font-semibold mb-6">Implementation Partner <br/>(Do It For Me)</p>
                
                <ul className="space-y-3 mb-8 flex-grow">
                  <li className="flex items-start gap-2"><CheckCircle2 className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" /><span className="text-slate-300">Ads Setups</span></li>
                  <li className="flex items-start gap-2"><CheckCircle2 className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" /><span className="text-slate-300">Retention Strategy</span></li>
                  <li className="flex items-start gap-2"><CheckCircle2 className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" /><span className="text-slate-300 font-semibold text-white">0 Empty Spots</span></li>
                </ul>
                
                <p className="text-sm text-slate-400 mb-6 flex-grow">
                  In addition to the responsibilities described in both Standard and Classic Options, we will have the responsibility of filling your empty spots. (Ad cost not included).
                </p>
                
                <Button onClick={() => handleCtaClick('pricing_premium')} className="w-full rounded-full bg-[#3B5FFF] hover:bg-[#2b4cdd] text-white border-none transition-all active:scale-95 py-6 font-semibold">See Details</Button>
              </div>
            </div>
          </div>
        </section>

        {/* COMPREHENSIVE CONTENT CREATION SECTION */}
        <section id="content-creation" className="py-24 bg-slate-50 border-b border-slate-100 relative z-10 text-slate-900">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-bold text-slate-900 mb-6 leading-tight">
                Comprehensive Content Creation
              </h2>
              <p className="text-lg text-slate-500 max-w-2xl mx-auto">
                Our Content Creation package comes with a <span className="font-semibold text-slate-900">100% Money Back Guarantee</span>
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-12 items-center max-w-5xl mx-auto">
              {/* Left Column - Details Card */}
              <div className="md:col-span-6 bg-white border border-slate-200 rounded-3xl p-8 md:p-10 shadow-sm flex flex-col items-start">
                <h3 className="text-xl font-bold text-slate-900 mb-6">Everything you'll need to attract parents:</h3>
                
                <ul className="space-y-4 mb-8 text-slate-650 text-left">
                  <li className="flex items-start gap-2.5">
                    <span className="text-slate-400 mt-1.5 shrink-0">•</span>
                    <span>
                      <strong className="text-slate-800">Engaging Videos and Animations:</strong> Three Months worth of Videos and animations to show your school's unique strengths websites, landing pages, social media, etc.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="text-slate-400 mt-1.5 shrink-0">•</span>
                    <span>
                      <strong className="text-slate-800">Stunning Graphics:</strong> Graphics content that Highlight your key features.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="text-slate-400 mt-1.5 shrink-0">•</span>
                    <span>
                      <strong className="text-slate-800">Captivating Headlines and Sales Copies:</strong> Speak directly to parents' needs.
                    </span>
                  </li>
                </ul>

                <Button
                  onClick={() => handleCtaClick('content_creation_cta')}
                  className="bg-[#3B5FFF] hover:bg-[#2b4cdd] text-white rounded-full px-8 py-6 font-semibold shadow-md active:scale-95 transition-all w-full sm:w-auto"
                >
                  Get More Details and Pricing
                </Button>
              </div>

              {/* Right Column - Image Illustration */}
              <div className="md:col-span-6 flex justify-center">
                <img
                  src="https://firebasestorage.googleapis.com/v0/b/studio-9220106300-f74cb.firebasestorage.app/o/media%2Fimage%2F1782713539851-Enrollment_ContentPackage.png?alt=media&token=f82164e0-d105-4bda-ae5d-37d1745019c2"
                  alt="Comprehensive Content Creation Package"
                  className="w-full max-w-[480px] h-auto object-contain"
                />
              </div>
            </div>
          </div>
        </section>

        {/* GUARANTEE & FINAL CTA */}
        <section className="py-24 bg-[#0a0a1a]/40 border-y border-slate-900 relative z-10">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mb-16">
            <div className="flex flex-col md:flex-row gap-10 md:gap-16 items-center">
              {/* Left Column - Badge */}
              <div className="shrink-0 flex justify-center">
                <img
                  src="https://firebasestorage.googleapis.com/v0/b/studio-9220106300-f74cb.firebasestorage.app/o/media%2Fimage%2F1782713610285-gaurantee-badge-02-shadow.webp?alt=media&token=41e504a4-2a7d-4c2d-980c-9805f45de0b1"
                  alt="100% Money Back Guarantee Badge"
                  className="w-48 h-48 md:w-64 md:h-64 object-contain animate-pulse-slow"
                />
              </div>
              
              {/* Right Column - Guarantee Text */}
              <div className="flex-1 text-center md:text-left space-y-4">
                <h2 className="text-3xl md:text-4xl font-bold text-white">100% Money Back Guarantee</h2>
                <p className="text-lg text-slate-300 leading-relaxed">
                  If you implement our strategies and for any reason, you are not satisfied with the results or cannot fill your empty spots in one term, Please send me an email and we will refund 100% of your money into your account. We won't ask you a single question.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FINAL CTA - READY TO TRANSFORM */}
        <section className="py-24 bg-slate-50 border-t border-slate-200 text-center relative z-10 text-slate-900">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center">
            {/* Top Icon */}
            <div className="w-16 h-16 rounded-full bg-[#3B5FFF]/10 flex items-center justify-center mb-8">
              <div className="w-5 h-5 border-2 border-[#3B5FFF] rounded-sm"></div>
            </div>

            {/* Heading */}
            <h2 className="text-3xl md:text-5xl font-bold text-slate-900 mb-8 leading-tight max-w-3xl">
              Ready To Transform Your Enrollment Strategy?
            </h2>

            {/* Body copy with highlights */}
            <div className="max-w-3xl mx-auto text-lg text-slate-650 mb-12 space-y-6 leading-relaxed">
              <p>
                Don't let another <strong className="text-slate-900 font-bold">enrollment period</strong> pass by with less-than-ideal numbers. <strong className="text-slate-900 font-bold">It's time to take the first step</strong> towards securing a brighter future for your school.
              </p>
              <p>
                Request your <span className="bg-yellow-200 text-slate-900 px-1.5 py-0.5 rounded font-bold border border-yellow-300">Free 30-minute Consultation today</span>, and let's discuss how we can help <strong className="text-slate-900 font-bold">you fill your empty spots in one term – Guaranteed.</strong>
              </p>
              <p>
                With our expertise, passion, and data-driven approach, coupled with a 100% money-back guarantee, you have everything to gain.
              </p>
            </div>

            {/* Vertically Stacked Buttons */}
            <div className="flex flex-col gap-4 w-full max-w-md mx-auto">
              <button
                onClick={() => handleCtaClick('footer_yes')}
                className="bg-[#3B5FFF] hover:bg-[#2b4cdd] text-white font-semibold rounded-xl shadow-md hover:shadow-lg active:scale-95 transition-all flex items-center justify-between pl-6 pr-2 py-2 w-full text-left"
              >
                <span>Yes, I want to fill every empty spots in my classrooms</span>
                <div className="w-8 h-8 bg-white/20 flex items-center justify-center rounded-lg ml-4">
                  <ArrowRight className="w-4 h-4 text-white" />
                </div>
              </button>
              
              <button
                onClick={() => {
                  track('cta_click');
                }}
                className="bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl shadow-md hover:shadow-lg active:scale-95 transition-all flex items-center justify-start pl-2 pr-6 py-2 w-full text-left"
              >
                <div className="w-8 h-8 bg-white/20 flex items-center justify-center rounded-lg mr-4">
                  <span className="text-white text-xs">✖</span>
                </div>
                <span>No, Thanks. I'll continue bleeding financially</span>
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="bg-slate-950 py-12 border-t border-slate-900 relative z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-slate-400 text-sm">
            © 2024 Copyrights by <span className="font-semibold text-slate-200">SmartSapp</span>. All Rights Reserved.
          </div>
          <div className="flex gap-6 text-sm text-slate-400">
            <Link href="#" className="hover:text-white transition-colors">Contact Us</Link>
            <Link href="#" className="hover:text-white transition-colors">Privacy Policy</Link>
            <Link href="#" className="hover:text-white transition-colors">Terms of Use</Link>
            <Link href="#" className="hover:text-white transition-colors">Cookies</Link>
          </div>
        </div>
      </footer>

      <Dialog open={isSurveyOpen} onOpenChange={setIsSurveyOpen}>
        <DialogContent
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          className="max-w-2xl p-0 overflow-hidden bg-slate-900 border border-slate-800 rounded-3xl h-auto transition-[height] duration-500 ease-out-expo w-full"
        >
          <DialogTitle className="sr-only">Free Consultation Survey</DialogTitle>
          <DialogDescription className="sr-only">
            Please fill out the survey to request your free consultation roadmap.
          </DialogDescription>
          <ResizableIFrame 
            slug="collect-your-fees-within-4-weeks-of-reopening-copy-2s0p0"
            src="/surveys/collect-your-fees-within-4-weeks-of-reopening-copy-2s0p0?embed=true&theme=dark"
            className="w-full border-none bg-transparent"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
