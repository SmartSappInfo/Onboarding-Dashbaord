'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Phone, Play } from 'lucide-react';
import assetsJson from './assets.json';

// ─── Assets (uploaded to Firebase Storage from the Kartra page backup) ────────

type AssetKey =
  | 'logo' | 'heroThumb' | 'frustratedAdmin' | 'seriousAdmin' | 'salesThumb'
  | 'billNotify' | 'paymentMethods' | 'businesswomanBg' | 'guaranteeBadge'
  | 'faqBg' | 'sectionBg' | 'berthaThumb' | 'derekThumb' | 'evansThumb'
  | 'williamThumb' | 'heroVideo' | 'salesVideo' | 'berthaVideo' | 'derekVideo'
  | 'evansVideo' | 'williamVideo';

const ASSETS = assetsJson as Record<AssetKey, string>;

const TRIAL_URL = 'https://smartsapp.com/features/automatic-fee-collection/';
const OFFER_END = new Date('2026-07-31T00:00:00');

// ─── Video player — poster with play overlay, swaps to native video ──────────

function VideoPlayer({
  src,
  poster,
  label,
  className,
}: {
  src: string;
  poster: string;
  label: string;
  className?: string;
}) {
  const [playing, setPlaying] = React.useState(false);

  return (
    <div className={`relative w-full overflow-hidden rounded-2xl shadow-2xl bg-black ${className ?? ''}`}>
      {playing ? (
        <video src={src} poster={poster} controls autoPlay playsInline className="w-full h-full object-contain aspect-video" />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          className="relative block w-full aspect-video group cursor-pointer"
          aria-label={`Play video: ${label}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- animated GIF posters must not be optimized */}
          <img src={poster} alt={label} className="absolute inset-0 w-full h-full object-cover" />
          <span className="absolute inset-0 bg-black/10 group-hover:bg-black/25 transition-colors" />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="relative">
              <span className="absolute -inset-3 rounded-full bg-white/30 animate-ping" />
              <span className="relative flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full bg-white/90 text-[#5f30e2] shadow-xl transition-transform duration-300 group-hover:scale-110">
                <Play className="h-8 w-8 sm:h-10 sm:w-10 fill-current ml-1" />
              </span>
            </span>
          </span>
        </button>
      )}
    </div>
  );
}

// ─── CTA button + caption (repeated throughout the original page) ─────────────

function CtaBlock({ label, light = false }: { label: string; light?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 pt-2">
      <p className={`text-xs italic ${light ? 'text-white/70' : 'text-slate-500'}`}>
        You might want to see if this works for you.
      </p>
      <Button
        size="lg"
        className="h-14 sm:h-16 px-8 sm:px-12 rounded-full bg-[#ffc629] hover:bg-[#ffb800] text-slate-900 text-base sm:text-lg font-extrabold shadow-[0_12px_28px_-8px_rgba(255,198,41,0.6)] hover:-translate-y-0.5 transition-all"
        asChild
      >
        <Link href={TRIAL_URL}>{label}</Link>
      </Button>
    </div>
  );
}

// ─── Countdown (original counts to 16 Feb 2025; clamps at zero) ──────────────

function useCountdown(target: Date) {
  const [remaining, setRemaining] = React.useState(() => Math.max(0, target.getTime() - Date.now()));
  React.useEffect(() => {
    const id = setInterval(() => setRemaining(Math.max(0, target.getTime() - Date.now())), 1000);
    return () => clearInterval(id);
  }, [target]);
  const s = Math.floor(remaining / 1000);
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
  };
}

function Countdown() {
  const { days, hours, minutes, seconds } = useCountdown(OFFER_END);
  const cells = [
    { v: days, l: 'Days' },
    { v: hours, l: 'Hours' },
    { v: minutes, l: 'Minutes' },
    { v: seconds, l: 'Seconds' },
  ];
  return (
    <div className="flex items-center justify-center gap-3 sm:gap-4">
      {cells.map(c => (
        <div key={c.l} className="flex flex-col items-center rounded-xl bg-slate-900 text-white px-4 py-3 min-w-[70px] shadow-lg">
          <span className="text-2xl sm:text-3xl font-extrabold tabular-nums" suppressHydrationWarning>
            {String(c.v).padStart(2, '0')}
          </span>
          <span className="text-[10px] uppercase tracking-widest text-white/60">{c.l}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Static content ───────────────────────────────────────────────────────────

const FEATURES = [
  { title: 'Automate Billing', desc: 'Generate student bills monthly or termly for the whole year with just a few clicks.' },
  { title: 'Co-ordinate Mobile Payments', desc: 'Parents can pay fees anytime, anywhere without going to the bank – a win for their schedule and your cash flow' },
  { title: 'Send Automatic Reminders', desc: "Our system chases up outstanding bills, so you don't have to." },
  { title: 'Our Flagship Feature - Drop off Denial', desc: 'This preferred feature gently nudges parents to pay up their fees on time without any human intervention' },
  { title: 'Customize Payment Plans', desc: 'For parents, it’s an added stress to their already busy schedules, often requiring inconvenient trips to the bank and manual payment processes.' },
  { title: 'Issue Instant Electronic Receipt', desc: 'Send electronic receipts directly to parents upon payment, cutting down on paperwork.' },
  { title: 'Auto-Reconcile all Payments', desc: 'Automatic reconciliation of all payments hence eliminating delays and errors in your fee collection' },
];

const OFFER_POINTS = [
  'Within 4 weeks - Guaranteed!',
  'Without the usual stress and frustrations of calling parents with countless reminders',
  'With 100% visibility into every cedi paid',
  'Without any confrontations between parents and your staff over fee payments',
  'Automated reconciliation and no errors',
  'With ZERO fee defaults from parents',
];

const FAQS = [
  {
    q: 'How will SmartSapp integrate with our current systems, and what payment methods does it support?',
    a: "SmartSapp's APIs ensure smooth integration with your school management system. It supports multiple payment methods, including bank transfers, Visa, Mastercard, and all major mobile payment platforms.",
  },
  {
    q: 'What security measures does SmartSapp have to protect financial data, and is it compliant with local regulations?',
    a: "We prioritize security with end-to-end encryption and adherence to Ghana's data protection regulations, ensuring the safety of all financial transactions",
  },
  {
    q: "Can SmartSapp adapt to our school's unique financial processes, and how user-friendly is it?",
    a: "Yes, SmartSapp is designed for flexibility to match your school's billing cycles and policies, and its intuitive interface makes it easy for all users.",
  },
  {
    q: 'What support can we expect from SmartSapp, and how does it help with financial reporting?',
    a: 'Our dedicated team is available during business hours for support, and SmartSapp provides comprehensive financial reports that are ready for audits and board meetings.',
  },
  {
    q: 'If there are payment disputes or issues, how does SmartSapp assist in resolving them?',
    a: 'SmartSapp offers a clear and transparent dispute resolution process with features for easy tracking and communication, ensuring prompt issue resolution',
  },
];

const TESTIMONIALS: { video: AssetKey; poster: AssetKey; name: string; role: string }[] = [
  { video: 'berthaVideo', poster: 'berthaThumb', name: 'Mrs. Bertha Kyei', role: "Administrator - North Hills Int'l School" },
  { video: 'derekVideo', poster: 'derekThumb', name: 'Derek Amokotu', role: 'Assist. Admin - Sunflower School' },
  { video: 'evansVideo', poster: 'evansThumb', name: 'Evans Gyamfi', role: "Accountant - Equisite Int'l School" },
  { video: 'williamVideo', poster: 'williamThumb', name: 'William Zormelo', role: 'C. O. O. - Aristoland Montessori Centre' },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CollectFeesClient() {
  return (
    <div className="light min-h-screen bg-white font-body text-slate-900 selection:bg-[#5f30e2]/10">

      {/* ── Top bar + header ──────────────────────────────────────────────── */}
      <div className="bg-slate-900 text-white text-xs sm:text-sm py-2 px-4 text-center font-semibold tracking-wide">
        <span className="inline-flex items-center gap-2">
          <Phone className="h-3.5 w-3.5" />
          +233 50 160 8001 | +233 50 160 8002
        </span>
      </div>
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-100 py-3 px-4 sm:px-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ASSETS.logo} alt="SmartSapp" className="h-9 sm:h-10 w-auto" />
          <Button className="rounded-full bg-[#5f30e2] hover:bg-[#4c26b5] text-white font-bold px-6" asChild>
            <Link href={TRIAL_URL}>Request Free Trial</Link>
          </Button>
        </div>
      </header>

      {/* ── 1. Hero (purple) ──────────────────────────────────────────────── */}
      <section className="bg-[#5f30e2] text-white px-4 sm:px-8 py-14 sm:py-20">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <h1 className="text-3xl sm:text-5xl font-extrabold leading-tight tracking-tight">
            Collect <span className="text-[#ffc629]">Your Fees in 4 Weeks</span>{' '}
            or use SmartSapp for <span className="text-[#ffc629]">FREE!!!</span>
          </h1>
          <p className="text-base sm:text-xl font-semibold text-white/90">
            👇🏽 Click to watch video, It&apos;s super important! 👇🏽
          </p>
          <VideoPlayer
            src={ASSETS.heroVideo}
            poster={ASSETS.heroThumb}
            label="Collect Your Fees in 4 Weeks campaign video"
            className="border-4 border-white/20"
          />
          <CtaBlock label="Yes, I need A Free Trial Now!" light />
        </div>
      </section>

      {/* ── 2. Problem (white) ────────────────────────────────────────────── */}
      <section className="bg-white px-4 sm:px-8 py-14 sm:py-20">
        <div className="max-w-5xl mx-auto space-y-12">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-center tracking-tight">
            Is Fee Collection Your School&apos;s <span className="text-[#5f30e2]">Achilles Heel?</span>
          </h2>

          <div className="grid md:grid-cols-2 gap-10 items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ASSETS.frustratedAdmin}
              alt="Administrator frustrated by fee collection delays"
              className="w-full rounded-2xl shadow-lg"
            />
            <div className="space-y-4">
              <h3 className="text-xl sm:text-2xl font-bold">Why do Parents delay in paying their children Fees?</h3>
              <p className="text-slate-600 leading-relaxed">
                Some say it&rsquo;s the economy. Other say it has to do with priorities! As a school owner, your
                passion is to cultivate young minds, not chase down payments. Yet every term, you&rsquo;re met with
                the daunting task of fee collection. It&rsquo;s a painstaking process that siphons your energy and
                resources, leaving less for what truly matters &ndash; education. The toll it takes isn&rsquo;t just
                financial; it&rsquo;s personal &ndash; stress and frustrations.
              </p>
              <p className="text-slate-600 leading-relaxed">
                For parents, it&rsquo;s an added stress to their already busy schedules, often requiring inconvenient
                trips to the bank and manual payment processes.
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div className="space-y-4 md:order-1 order-2">
              <h3 className="text-xl sm:text-2xl font-bold">
                How will it feel if you or your staff don&rsquo;t have to call parents on fees?
              </h3>
              <p className="text-slate-600 leading-relaxed">
                Imagine the compounded frustration when these payments are delayed. The constant reminders, the
                awkward conversations, the looming uncertainty of &quot;Will we collect enough this time?&quot; Late
                payments mean disrupted cash flows, which in turn affect your ability to pay staff and maintain the
                school facilities. It&rsquo;s a cycle you know all too well, and it&rsquo;s begging to be broken.
              </p>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ASSETS.seriousAdmin}
              alt="Serious administrator reviewing fee records"
              className="w-full rounded-2xl shadow-lg md:order-2 order-1"
            />
          </div>
        </div>
      </section>

      {/* ── 3. Band (grey) ────────────────────────────────────────────────── */}
      <section className="bg-[#f6f6f6] px-4 sm:px-8 py-10">
        <h2 className="max-w-4xl mx-auto text-center text-2xl sm:text-3xl font-extrabold tracking-tight">
          Wouldn&rsquo;t it be helpful if parents can pay you from{' '}
          <span className="text-[#5f30e2]">anywhere, anytime?</span>
        </h2>
      </section>

      {/* ── 4. Welcome to SmartSapp (dark, businesswoman bg) ──────────────── */}
      <section className="relative bg-[#151b20] text-white px-4 sm:px-8 py-14 sm:py-20 overflow-hidden">
        <div
          className="absolute inset-0 opacity-20 bg-cover bg-center pointer-events-none"
          style={{ backgroundImage: `url(${ASSETS.businesswomanBg})` }}
        />
        <div className="relative max-w-4xl mx-auto text-center space-y-6">
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
            Welcome to <span className="text-[#ffc629]">SmartSapp</span>
          </h2>
          <p className="text-lg sm:text-2xl font-semibold text-white/90">~The #1 automated fee collection solution</p>
          <p className="text-base sm:text-lg text-white/80 max-w-2xl mx-auto">
            Our solution is designed to make it super easy for you to collect your fees within 4 weeks ~ Guaranteed!
          </p>
          <p className="text-base sm:text-xl font-semibold text-white/90">
            👇🏽 Click to watch this video till the end, It&apos;s super important. 👇🏽
          </p>
          <VideoPlayer
            src={ASSETS.salesVideo}
            poster={ASSETS.salesThumb}
            label="How to collect your fees within 4 weeks"
            className="border-4 border-white/10"
          />
          <CtaBlock label="Yes, I need a free trial now" light />
        </div>
      </section>

      {/* ── 5. Features (light grey) ──────────────────────────────────────── */}
      <section className="bg-[#efefef] px-4 sm:px-8 py-14 sm:py-20">
        <div className="max-w-5xl mx-auto space-y-10">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-center tracking-tight">
            With SmartSapp, <span className="text-[#5f30e2]">You Can:</span>
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left Column - Features Cards Grid */}
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {FEATURES.map((f, i) => (
                <div key={f.title} className="rounded-2xl bg-white p-5 shadow-sm border border-slate-100 h-full flex flex-col justify-between">
                  <div>
                    <div className="h-8 w-8 rounded-lg bg-[#5f30e2]/10 text-[#5f30e2] flex items-center justify-center font-extrabold mb-3 text-sm">
                      {i + 1}
                    </div>
                    <h3 className="font-bold text-base mb-1.5">{f.title}</h3>
                    <p className="text-xs text-slate-605 leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Right Column - Flow Illustration Image */}
            <div className="lg:col-span-5 flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={ASSETS.billNotify}
                alt="Bill, notify and collect — SmartSapp fee collection flow"
                className="w-full max-w-[420px] h-auto object-contain"
              />
            </div>
          </div>
          <CtaBlock label="Yes, I need a free trial now" />
        </div>
      </section>

      {/* ── 6. Offer / pricing (white) ────────────────────────────────────── */}
      <section className="bg-white px-4 sm:px-8 py-14 sm:py-20">
        <div className="max-w-6xl mx-auto space-y-12">
          {/* Header */}
          <h2 className="text-3xl sm:text-4xl font-extrabold text-center tracking-tight">
            Collect Your Fees in 4 Weeks or Use SmartSapp for <span className="text-[#5f30e2]">FREE!!!</span>
          </h2>

          {/* Split Block: Offer details on Left, image on Right */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center max-w-5xl mx-auto">
            {/* Left Column - Bullet Points */}
            <div className="lg:col-span-7 space-y-6">
              <p className="text-xl font-bold text-slate-800 text-left">School Owners, Accountants, &amp; School Admins</p>
              <p className="text-slate-650 text-left">
                If I offered you a system that would make it super easy for you to collect your fees:
              </p>
              <ul className="space-y-3 text-left">
                {OFFER_POINTS.map(point => (
                  <li key={point} className="flex items-start gap-3">
                    <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#5f30e2] text-white text-xs font-bold">✓</span>
                    <span className="text-slate-700 font-medium">{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Right Column - Payment Image */}
            <div className="lg:col-span-5 flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://firebasestorage.googleapis.com/v0/b/studio-9220106300-f74cb.firebasestorage.app/o/media%2Fimage%2F1781187373618-payment-methods.png?alt=media&token=fbd02a8d-d8cd-4ed7-b4c0-033a8f3bbbaf"
                alt="Supported Mobile Money and Card Payment options on checkout screen"
                className="w-full max-w-[460px] h-auto object-contain"
              />
            </div>
          </div>

          {/* Centered Decision CTA & Countdown (One Column) */}
          <div className="max-w-2xl mx-auto text-center space-y-8 pt-8">
            <p className="text-xl sm:text-2xl font-bold">Would you take me up on that offer?</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-stretch">
              <div className="rounded-2xl border-2 border-slate-200 p-8 flex flex-col justify-center">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Normal Price</p>
                <p className="text-4xl font-extrabold my-2 text-slate-400 line-through">GH&cent; 29.97</p>
                <p className="text-xs text-slate-500">Per Student, Per Term</p>
              </div>
              <div className="rounded-2xl border-2 border-[#5f30e2] bg-[#5f30e2]/5 p-8 shadow-xl flex flex-col justify-center">
                <p className="text-xs font-bold uppercase tracking-widest text-[#5f30e2]">New Offer</p>
                <p className="text-4xl font-extrabold my-2 text-[#5f30e2]">GH&cent; 9.97</p>
                <p className="text-xs text-slate-600">Per Student, Per Term</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-2xl sm:text-3xl font-extrabold text-[#e63946]">Whooping 67% Discount</p>
              <p className="font-semibold text-slate-700">Offer Ends on 31st July, 2026</p>
            </div>
            
            <Countdown />
            <CtaBlock label="Yes, I need a free trial now" />
          </div>
        </div>
      </section>

      {/* ── 7. Guarantee (light blue) ─────────────────────────────────────── */}
      <section className="bg-[#7ca3f8] px-4 sm:px-8 py-14 sm:py-20 text-slate-900">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ASSETS.guaranteeBadge} alt="100% money back guarantee badge" className="h-44 sm:h-56 w-auto mx-auto" />
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Collect Your Fees in 4 Weeks or 100% MONEY BACK ~ GUARANTEED!
          </h2>
          <h3 className="text-xl sm:text-2xl font-bold">This Offer Is Completely Guaranteed!</h3>
          <div className="space-y-2 text-base sm:text-lg font-medium">
            <p>Try it for a full term/semester.</p>
            <p>If you don&rsquo;t Collect your fees in 4 weeks&hellip;</p>
            <p>Or, if you don&rsquo;t feel this made your fee collection faster than anything could...</p>
            <p>Or if you&apos;re not happy for any other reason at all,</p>
            <p>
              Shoot us an email to{' '}
              <a href="mailto:support@SmartSapp.com" className="font-bold underline underline-offset-2">
                support@SmartSapp.com
              </a>
            </p>
            <p>And you&apos;ll get every penny back.</p>
            <p>We won&rsquo;t ask you why.</p>
            <p>We won&rsquo;t ask you a single question.</p>
          </div>
          <CtaBlock label="Yes, I need a free trial now" />
        </div>
      </section>

      {/* ── 8. Testimonials (pale blue, pattern bg) ───────────────────────── */}
      <section
        className="bg-[#f3fafe] px-4 sm:px-8 py-14 sm:py-20 bg-cover bg-top"
        style={{ backgroundImage: `url(${ASSETS.sectionBg})` }}
      >
        <div className="max-w-5xl mx-auto space-y-10">
          <div className="text-center space-y-3">
            <p className="font-semibold text-slate-600">
              Listen to the transformational stories from other schools like yours below. <strong>Are you Next?</strong>
            </p>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Real Schools, Real Stories, <span className="text-[#5f30e2]">Real Transformation!</span>
            </h2>
            <p className="text-slate-600">Real stories of Transformation and Success with smartsapp. Take a listen!</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-8">
            {TESTIMONIALS.map(t => (
              <div key={t.name} className="space-y-3">
                <VideoPlayer src={ASSETS[t.video]} poster={ASSETS[t.poster]} label={`${t.name} testimonial`} />
                <div className="text-center">
                  <p className="font-extrabold text-lg">{t.name}</p>
                  <p className="text-sm text-slate-600">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 9. Final CTA (grey) ───────────────────────────────────────────── */}
      <section className="bg-[#f6f6f6] px-4 sm:px-8 py-14 sm:py-20">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Ready To End Fee Collection Delays?</h2>
          <Button
            size="lg"
            className="h-14 sm:h-16 px-8 sm:px-12 rounded-full bg-[#5f30e2] hover:bg-[#4c26b5] text-white text-base sm:text-lg font-extrabold shadow-xl hover:-translate-y-0.5 transition-all"
            asChild
          >
            <Link href={TRIAL_URL}>Yes, I want to end the delays and frustrations TODAY!</Link>
          </Button>
          <div className="space-y-2">
            <Link href={TRIAL_URL} className="block text-[#5f30e2] font-semibold underline underline-offset-4">
              I&apos;m a parent, and want to recommend my child&apos;s school
            </Link>
            <p className="text-xs text-slate-400 italic">
              No, Thanks. I&apos;ll continue to endure the delays and frustrations
            </p>
          </div>
        </div>
      </section>

      {/* ── 10. FAQ (white, illustration bg) ──────────────────────────────── */}
      <section
        className="bg-white px-4 sm:px-8 py-14 sm:py-20 bg-contain bg-no-repeat bg-left-bottom"
        style={{ backgroundImage: `url(${ASSETS.faqBg})` }}
      >
        <div className="max-w-3xl mx-auto space-y-8">
          <div className="text-center space-y-2">
            <p className="font-semibold text-slate-600">Need Help? We&apos;ve Got You Covered!</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Frequently Asked Questions</h2>
          </div>
          <Accordion type="single" collapsible className="w-full bg-white/90 rounded-2xl border border-slate-100 shadow-sm px-4 sm:px-6">
            {FAQS.map((f, i) => (
              <AccordionItem key={f.q} value={`faq-${i}`} className={i === FAQS.length - 1 ? 'border-b-0' : ''}>
                <AccordionTrigger className="text-left font-bold hover:no-underline">{f.q}</AccordionTrigger>
                <AccordionContent className="text-slate-600 leading-relaxed">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* ── 11. Pre-footer + footer ───────────────────────────────────────── */}
      <section className="bg-[#151b20] text-white px-4 sm:px-8 py-12 text-center space-y-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={ASSETS.logo} alt="SmartSapp" className="h-10 w-auto mx-auto brightness-0 invert" />
        <p className="max-w-2xl mx-auto text-white/80">
          We don&apos;t just help you to collect your fees within 4 weeks. We also help you to ensure the safety of
          your kids in school.
        </p>
        <Link href="https://smartsapp.com/" className="inline-block text-[#ffc629] font-bold underline underline-offset-4">
          Go here to learn more!
        </Link>
      </section>
      <footer className="bg-white border-t border-slate-100 px-4 sm:px-8 py-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-slate-500">
          <p>&copy;2025 Copyrights by SmartSapp. All Rights Reserved.</p>
          <div className="flex items-center gap-5">
            <Link href="https://smartsapp.com/contact-us" className="hover:text-slate-900">Contact Us</Link>
            <Link href="https://smartsapp.com/privacy-policy" className="hover:text-slate-900">Privacy Policy</Link>
            <Link href="https://smartsapp.com/terms-of-use" className="hover:text-slate-900">Terms of Use</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
