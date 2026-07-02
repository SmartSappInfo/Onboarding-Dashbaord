import type { PageTemplate } from '@/lib/types';
import { blk, sec } from './helpers';

/**
 * Homepage templates leveraging matured sections & new custom blocks.
 */
export const HOMEPAGE_TEMPLATES: PageTemplate[] = [
  {
    id: 'home-onboarding',
    name: 'SmartSapp Homepage & Onboarding Portal',
    description: 'Complete high-fidelity homepage with video hero, persona choice cards, app downloads, and countdowns.',
    goal: 'registration',
    isGlobal: true,
    structureJson: {
      sections: [
        // Section 1: Video Hero
        sec('home-hero-sec', [
          blk('home-hero-blk', 'video_hero', {
            heading: 'Streamlined Onboarding for Schools & Teams',
            subheading: 'Register profiles, collect agreements, and launch automated workflows in minutes.',
            videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-software-developer-working-on-his-computer-34354-large.mp4',
            loop: true,
            muted: true,
            overlayOpacity: 0.7,
            ctaText: 'Start Onboarding Now',
            ctaHref: '#persona-selector',
            secondaryCtaText: 'Download Mobile App',
            secondaryCtaHref: '#downloads',
          }),
        ], {
          paddingTop: '0rem',
          paddingBottom: '0rem',
          paddingLeft: '0rem',
          paddingRight: '0rem',
        }),

        // Section 2: Countdown Timer & Callout
        sec('home-countdown-sec', [
          blk('home-countdown-blk', 'countdown', {
            targetDate: '2026-12-31T23:59:59Z',
            heading: 'Limited Registration Period',
            subtext: 'Secure your team seat and complete onboarding setup before the system window closes.',
            theme: 'accent',
            showDays: true,
            showHours: true,
            showMinutes: true,
            showSeconds: true,
          }),
        ], {
          backgroundType: 'color',
          backgroundColor: '#070a13',
          paddingTop: '3rem',
          paddingBottom: '3rem',
        }),

        // Section 3: Persona Choice Cards
        sec('home-personas-sec', [
          blk('home-personas-blk', 'choice_cards', {
            heading: 'Identify Your Persona Track',
            columns: '2',
            cards: [
              {
                id: 'p1',
                badgeText: 'FOR OFFICIALS',
                title: 'School Administrator',
                description: 'Manage nominal rolls, verify teacher certifications, and coordinate class approvals.',
                imageUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136',
                gradient: 'from-emerald-950/80 to-slate-900/90',
                ctaText: 'Select Admin Track',
                ctaHref: '#modal-admin',
                openInModal: true,
              },
              {
                id: 'p2',
                badgeText: 'FOR STUDENTS & STAFF',
                title: 'General Signup / Nominee',
                description: 'Register credentials, review policies, and check onboarding compliance records.',
                imageUrl: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644',
                gradient: 'from-blue-950/80 to-slate-900/90',
                ctaText: 'Select Nominee Track',
                ctaHref: '#modal-nominee',
                openInModal: true,
              },
            ],
          }),
        ], {
          id: 'persona-selector',
          backgroundType: 'gradient',
          gradientFrom: '#0A1427',
          gradientTo: '#070A13',
          gradientAngle: 180,
          paddingTop: '4rem',
          paddingBottom: '4rem',
        }),

        // Section 4: Process Steps Guides
        sec('home-steps-sec', [
          blk('home-step1', 'step_section', {
            stepNumber: 1,
            heading: 'Account Enrollment',
            description: 'Enter organization details, verify identity parameters, and establish your tenant profile workspace.',
            imageUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f',
            mediaPosition: 'right',
            accentColor: '#10b981',
          }),
          blk('home-step2', 'step_section', {
            stepNumber: 2,
            heading: 'Policy Approvals',
            description: 'Digitally review and authorize compliance documents, nominal rolls, and usage agreements.',
            imageUrl: 'https://images.unsplash.com/photo-1450133064473-71024230f91b',
            mediaPosition: 'left',
            accentColor: '#3b82f6',
          }),
        ], {
          heading: 'Simple 2-Step Onboarding',
          backgroundType: 'color',
          backgroundColor: '#070a13',
          paddingTop: '4rem',
          paddingBottom: '4rem',
        }),

        // Section 5: Video Testimonials
        sec('home-testimonials-sec', [
          blk('home-testimonials-blk', 'testimonial_grid', {
            heading: 'Trusted by Operations Teams Everywhere',
            subheading: 'Listen to verified video responses detailing our fast migration metrics.',
            columns: '2',
            cardStyle: 'video-quote',
            items: [
              {
                id: 't1',
                videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
                quote: 'The automation triggers saved us over 40 hours of manual verification checks during rollout.',
                author: 'Ama K. Mensah',
                role: 'Registrar, Tech Academy',
              },
              {
                id: 't2',
                videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
                quote: 'Using persona choice cards cut our user registration drop-off rate by half.',
                author: 'Kofi Aidoo',
                role: 'Operations Director',
              },
            ],
          }),
        ], {
          backgroundType: 'color',
          backgroundColor: '#0A1427',
          paddingTop: '4rem',
          paddingBottom: '4rem',
        }),

        // Section 6: App Download Badges with Fixed Parallax
        sec('home-downloads-sec', [
          blk('home-downloads-blk', 'app_download', {
            heading: 'Take Onboarding On The Go',
            subtext: 'Scan nominal rosters, capture compliance photos, and execute signups anywhere using the SmartSapp mobile client.',
            backgroundImageUrl: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c',
            parallaxEnabled: true,
            overlayColor: '#070a13',
            overlayOpacity: 0.85,
            showAppStoreBadges: true,
            iosUrl: 'https://apps.apple.com',
            androidUrl: 'https://play.google.com',
          }),
        ], {
          id: 'downloads',
          paddingTop: '4rem',
          paddingBottom: '4rem',
        }),
      ],
    },
  },
];
