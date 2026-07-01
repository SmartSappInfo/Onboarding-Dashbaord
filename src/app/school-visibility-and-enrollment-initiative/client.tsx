'use client';

import { useState, useCallback, Suspense, useEffect } from 'react';
import Link from 'next/link';
import { SmartSappLogo as Logo } from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  ArrowRight,
  BarChart2,
  Sliders,
  Users,
  Video,
  MessagesSquare,
  Tablet,
  BrainCircuit,
  Code2,
  Briefcase,
  CheckCircle2,
} from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ResizableIFrame } from '@/components/ui/ResizableIFrame';
import { usePageAnalytics } from '@/hooks/use-page-analytics';
import { PageAnalyticsReader } from '@/components/page-analytics-reader';
import type { PageEventChannel } from '@/lib/types';
import LightRays from '@/components/LightRays';
import AnimatedHeroShapes from '@/components/animated-hero-shapes';

const PAGE_SLUG = 'school-visibility-and-enrollment-initiative';
const TRIAL_URL = '/surveys/school-visiblity?embed=true';

export default function SchoolVisibilityClient() {
  const { track, setEntityId } = usePageAnalytics(PAGE_SLUG);
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

  const handleCtaClick = (_location: string) => {
    track('cta_click');
    setIsSurveyOpen(true);
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-[#3B5FFF]/20 relative overflow-hidden">
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
                ? 'bg-slate-950/60 backdrop-blur-md shadow-lg shadow-slate-950/50 border border-slate-850 px-6 py-3'
                : 'bg-slate-950/20 backdrop-blur-sm px-6 py-4'
            }`}
          >
            <div className="flex items-center gap-2">
              <Logo variant="white" className="h-8 w-auto animate-pulse" />
            </div>
            
            <nav className="hidden md:flex items-center gap-8 font-medium text-sm text-slate-200">
              <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
              <a href="#rewards" className="hover:text-white transition-colors">Rewards</a>
              <a href="#support" className="hover:text-white transition-colors">Support</a>
            </nav>

            <div className="flex items-center gap-4">
              <div className="hidden lg:flex flex-col text-sm font-semibold text-right text-slate-200 mr-2">
                <span>+233 50 160 8002</span>
              </div>
              <Button
                onClick={() => handleCtaClick('nav')}
                className="bg-[#3B5FFF] hover:bg-[#2b4cdd] text-white rounded-full px-6 transition-transform hover:scale-105 active:scale-95 shadow-md shadow-blue-500/20"
              >
                Join Initiative
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="pb-24">
        {/* HERO SECTION */}
        <section className="relative w-full overflow-hidden min-h-[auto] md:min-h-screen flex flex-col justify-center items-center pt-36 pb-24 md:pt-40 md:pb-20 text-center bg-[#0a0a1a]">
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

          {/* Graphic Overlay image of diverse students */}
          <div
            className="absolute inset-0 w-full h-full object-cover opacity-10 bg-cover bg-center pointer-events-none mix-blend-overlay"
            style={{
              backgroundImage: `url('https://lh3.googleusercontent.com/aida-public/AB6AXuB5laAcEyzihz7BBFHdEQjozQIbuFRF_iVTL6hmRUqVNWukmmVvfVgx0XnjStBLSz4lKYayjhsT6TJ3nL0__DUZc5AHA7kv6NUZBvcM58U6PMZ0IUvIkhTlqoLym-n-dfdGLcaX3vebu5sjLAehY7uJCpRRBzAtJit4QniSKrBJ0vBsxiObyhMk2lWSsOrO3HLkwLH6j2oCB9WQ5lu0feKUgx0Q8gURAZMh9sAtsesfkAWCnjmnbo3inzgXaJOqjFdvMntRAut2NFw')`
            }}
          />
          
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 space-y-6">
            <span className="inline-block bg-[#ffc629] text-slate-950 font-semibold py-1.5 px-4 rounded-full uppercase tracking-wider text-xs font-bold shadow-md animate-bounce">
              Special Initiative
            </span>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white mb-6 leading-tight">
              Turn Your School Community Into Your <br className="hidden md:block" />
              <span className="text-[#ffc629] relative inline-block">
                Strongest Brand Ambassadors
                <svg className="absolute -bottom-2 left-0 w-full h-3 text-[#ffc629]/20" viewBox="0 0 100 10" preserveAspectRatio="none">
                  <path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="4" fill="transparent" />
                </svg>
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
              A special initiative to boost your school&apos;s visibility, reputation, and enrollment — at no extra workload for your team.
            </p>

            <div className="pt-6">
              <Button
                size="lg"
                onClick={() => handleCtaClick('hero')}
                className="bg-[#3B5FFF] hover:bg-[#2b4cdd] text-white text-lg rounded-full px-8 py-7 shadow-xl shadow-blue-500/30 hover:-translate-y-1 transition-all duration-300 font-semibold"
              >
                Reserve My School&apos;s Place
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </div>
          </div>
        </section>

        {/* INTRO SECTION */}
        <section
          id="how-it-works"
          className="py-24 bg-slate-900 bg-cover bg-center relative z-10 text-white overflow-hidden"
          style={{
            backgroundImage: `url('https://firebasestorage.googleapis.com/v0/b/studio-9220106300-f74cb.firebasestorage.app/o/media%2Fimage%2F1782894007752-Blue%20overlay.webp?alt=media&token=f10fcb91-982c-435a-8ac9-5ef24efff90d')`
          }}
        >
          {/* Overlay to ensure maximum contrast */}
          <div className="absolute inset-0 bg-[#0a0a1a]/40 mix-blend-multiply pointer-events-none" />

          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8 relative z-10">
            <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mx-auto border border-white/20">
              <div className="w-5 h-5 border-2 border-[#ffc629] rounded-sm animate-spin" style={{ animationDuration: '4s' }}></div>
            </div>
            
            <h2 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
              Amplify Your School&apos;s Reputation
            </h2>
            
            <div className="space-y-6 text-slate-205 text-lg leading-relaxed max-w-3xl mx-auto">
              <p>
                Imagine hundreds of parents, students, teachers, and staff sharing positive stories about your school online. That is the goal of the SmartSapp School Visibility &amp; Enrollment Initiative—a special initiative designed to increase your school&apos;s visibility, strengthen its online reputation, and help more families discover your school ahead of the next academic year.
              </p>
              <p>
                With your approval, we will invite your community to share how your school uses SmartSapp to enhance their experience through short videos, photos, and testimonials on social media. Authentic stories from people they trust.
              </p>
            </div>
          </div>
        </section>

        {/* BENTO GRID SERVICES SECTION */}
        <section className="py-24 bg-slate-50 border-y border-slate-100 relative z-10 text-slate-900">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16 space-y-3">
              <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
                SmartSapp Will Do the Heavy Lifting
              </h2>
              <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                No additional workload for your staff. No marketing expertise required. We handle it from start to finish.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto items-stretch">
              {/* Bento Card 1 */}
              <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between group">
                <div className="space-y-4">
                  <div className="w-12 h-12 bg-blue-50 text-[#3B5FFF] rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <BarChart2 className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">Social Media Audit</h3>
                  <p className="text-slate-600 text-sm leading-relaxed">
                    We will audit your school&apos;s current social media and online presence to identify growth opportunities.
                  </p>
                </div>
              </div>

              {/* Bento Card 2 */}
              <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between group">
                <div className="space-y-4">
                  <div className="w-12 h-12 bg-blue-50 text-[#3B5FFF] rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Sliders className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">Presence Setup</h3>
                  <p className="text-slate-600 text-sm leading-relaxed">
                    Set up or improve your school&apos;s social media pages and overall digital footprint.
                  </p>
                </div>
              </div>

              {/* Bento Card 3 */}
              <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between group">
                <div className="space-y-4">
                  <div className="w-12 h-12 bg-blue-50 text-[#3B5FFF] rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Users className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">Staff Training</h3>
                  <p className="text-slate-600 text-sm leading-relaxed">
                    Train your staff to manage your school&apos;s online visibility effectively and confidently.
                  </p>
                </div>
              </div>

              {/* Bento Card 4 (Spans full on md, 1 col on lg) */}
              <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between group md:col-span-2 lg:col-span-1">
                <div className="space-y-4">
                  <div className="w-12 h-12 bg-blue-50 text-[#3B5FFF] rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Video className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">Professional Media</h3>
                  <p className="text-slate-600 text-sm leading-relaxed">
                    Produce professional promotional videos and photographs that showcase your school to prospective families.
                  </p>
                </div>
              </div>

              {/* Bento Card 5 (Spans 2 cols on md/lg) */}
              <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between group md:col-span-2 lg:col-span-2">
                <div className="space-y-4">
                  <div className="w-12 h-12 bg-blue-50 text-[#3B5FFF] rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <MessagesSquare className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">Community Content Support</h3>
                  <p className="text-slate-600 text-sm leading-relaxed">
                    Help parents, students, teachers, and staff record and professionally edit their testimonial videos and photos.
                  </p>
                </div>
              </div>
            </div>

            <div className="text-center pt-12">
              <Button
                onClick={() => handleCtaClick('bento')}
                className="bg-[#3B5FFF] hover:bg-[#2b4cdd] text-white font-semibold rounded-full px-8 py-6 transition-all hover:scale-105"
              >
                Yes, I need these services for my school
              </Button>
            </div>
          </div>
        </section>

        {/* REWARDS SECTION */}
        <section id="rewards" className="py-24 bg-white relative z-10 text-slate-900">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center max-w-5xl mx-auto">
              {/* Left Info Column */}
              <div className="lg:col-span-6 space-y-6 text-left">
                <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
                  Rewards for Your School Community
                </h2>
                <p className="text-slate-600 text-lg leading-relaxed">
                  To encourage participation and build a steady stream of authentic content, each month, the top contributors can choose one of the following rewards:
                </p>
                <div className="flex items-center gap-2 text-slate-400 text-xs italic">
                  <span className="font-semibold text-slate-500">*Initiative runs until 31st December 2026.</span>
                </div>
              </div>

              {/* Right Cards Grid */}
              <div className="lg:col-span-6 grid grid-cols-2 gap-4">
                {/* Reward Card 1 */}
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 text-center flex flex-col items-center justify-center space-y-3 hover:bg-slate-100 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-yellow-100 text-yellow-600 flex items-center justify-center">
                    <Tablet className="w-5 h-5" />
                  </div>
                  <span className="font-bold text-slate-800 text-sm">A Tablet</span>
                </div>
                {/* Reward Card 2 */}
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 text-center flex flex-col items-center justify-center space-y-3 hover:bg-slate-100 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                    <BrainCircuit className="w-5 h-5" />
                  </div>
                  <span className="font-bold text-slate-800 text-sm">AI Training</span>
                </div>
                {/* Reward Card 3 */}
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 text-center flex flex-col items-center justify-center space-y-3 hover:bg-slate-100 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                    <Code2 className="w-5 h-5" />
                  </div>
                  <span className="font-bold text-slate-800 text-sm">Coding Training</span>
                </div>
                {/* Reward Card 4 */}
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 text-center flex flex-col items-center justify-center space-y-3 hover:bg-slate-100 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">
                    <Briefcase className="w-5 h-5" />
                  </div>
                  <span className="font-bold text-slate-800 text-sm">Internship</span>
                </div>
              </div>
            </div>
          </div>
        </section>



        {/* OPT-IN WIDGET SECTION */}
        <section id="support" className="py-24 bg-white relative z-10 text-slate-900">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-slate-50 p-8 md:p-12 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden text-center space-y-6">
              {/* Decorative design vector */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#3B5FFF]/5 rounded-bl-full pointer-events-none" />
              
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Reserve Your School&apos;s Place Today
              </h2>
              
              <p className="text-slate-600 leading-relaxed max-w-xl mx-auto">
                Participation is offered on a strictly first-come, first-served basis due to the hands-on support we provide. Once all available places are filled, registration will close.
              </p>

              <div className="pt-4">
                <Button
                  size="lg"
                  onClick={() => handleCtaClick('reserve_bottom')}
                  className="bg-[#3B5FFF] hover:bg-[#2b4cdd] text-white text-lg rounded-full px-8 py-7 shadow-xl shadow-blue-500/20 hover:-translate-y-0.5 transition-all duration-300 font-semibold"
                >
                  Reserve My School&apos;s Place Now
                  <CheckCircle2 className="ml-2 w-5 h-5 text-[#ffc629]" />
                </Button>
              </div>

              <p className="text-xs text-slate-400 font-medium pt-2">
                We look forward to partnering with you to turn your school community into your strongest ambassadors.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="bg-slate-950 py-12 border-t border-slate-900 relative z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-slate-400 text-sm">
            © 2024 Copyrights by <span className="font-semibold text-slate-200">SmartSapp</span>. All Rights Reserved.
          </div>
          <div className="flex gap-6 text-sm text-slate-400">
            <Link href="#" className="hover:text-white transition-colors">Privacy Policy</Link>
            <Link href="#" className="hover:text-white transition-colors">Terms of Service</Link>
            <Link href="#" className="hover:text-white transition-colors">Contact Support</Link>
            <Link href="#" className="hover:text-white transition-colors">Campaign FAQs</Link>
          </div>
        </div>
      </footer>

      {/* SURVEY MODAL DIALOG */}
      <Dialog open={isSurveyOpen} onOpenChange={setIsSurveyOpen}>
        <DialogContent
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          className="max-w-4xl md:max-w-5xl w-[95vw] md:w-full p-1 max-h-[90vh] overflow-y-auto bg-white border border-slate-200/80 rounded-3xl"
        >
          <DialogTitle className="sr-only">School Visibility Onboarding Survey</DialogTitle>
          <DialogDescription className="sr-only">
            Fill in details to reserve your school&apos;s slot in the SmartSapp Visibility Initiative.
          </DialogDescription>
          {isSurveyOpen && (
            <ResizableIFrame
              src={TRIAL_URL}
              slug="school-visiblity"
              fallbackHeight={720}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
