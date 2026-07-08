import type { PageSectionTemplate } from '@/lib/types';

export type StaticSectionTemplate = Omit<PageSectionTemplate, 'workspaceId' | 'createdAt'>;

export const STATIC_SECTION_TEMPLATES: StaticSectionTemplate[] = [
  // ─── HERO SECTIONS (6 VARIATIONS) ────────────────────────────────────────
  {
    id: 'tpl-hero-saas-split',
    organizationId: '',
    name: 'SaaS Split Hero (Left Text, Right App Screen)',
    category: 'hero',
    industry: 'SaaS',
    structure: {
      id: 'hero-saas-split-sec',
      type: 'section',
      props: {
        backgroundType: 'gradient',
        gradientFrom: '#0f172a',
        gradientTo: '#1e293b',
        gradientAngle: 135,
        paddingTop: '6rem',
        paddingBottom: '6rem',
        paddingLeft: '2rem',
        paddingRight: '2rem',
      },
      blocks: [
        {
          id: 'hero-saas-split-columns',
          type: 'columns',
          props: {
            columnsCount: 2,
            layout: '1-1',
            gap: '2.5rem',
          },
          blocks: [
            {
              id: 'hero-saas-split-left',
              type: 'container',
              props: {
                alignItems: 'start',
                justifyContent: 'center',
                spacing: '1.5rem',
              },
              blocks: [
                {
                  id: 'hero-saas-split-title',
                  type: 'title',
                  props: {
                    content: 'Automate Your Workspace Workflows In Minutes',
                    tag: 'h1',
                    align: 'left',
                    textColorMode: 'theme',
                    customTitleColor: '#10b981',
                    fontSize: 'text-4xl md:text-5xl font-black tracking-tight leading-tight',
                  }
                },
                {
                  id: 'hero-saas-split-text',
                  type: 'text',
                  props: {
                    content: '<p class="text-slate-400 text-sm leading-relaxed">Centralize nominal rolls, manage secure approvals, and trigger automated verification tasks without writing a single line of code.</p>',
                  }
                },
                {
                  id: 'hero-saas-split-cta',
                  type: 'cta',
                  props: {
                    text: 'Start Free Trial Now',
                    href: '#trials',
                    variant: 'primary',
                    align: 'left',
                  }
                }
              ]
            },
            {
              id: 'hero-saas-split-right',
              type: 'container',
              props: {
                alignItems: 'center',
                justifyContent: 'center',
              },
              blocks: [
                {
                  id: 'hero-saas-split-image',
                  type: 'image',
                  props: {
                    url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f',
                    alt: 'SaaS Dashboard Interface Mockup',
                    borderRadius: 'rounded-2xl',
                    shadow: 'shadow-2xl border border-slate-700/50',
                  }
                }
              ]
            }
          ]
        }
      ]
    }
  },
  {
    id: 'tpl-hero-school-split',
    organizationId: '',
    name: 'School Split Hero (Left Text, Right Video)',
    category: 'hero',
    industry: 'SchoolEnrollment',
    structure: {
      id: 'hero-school-split-sec',
      type: 'section',
      props: {
        backgroundType: 'color',
        backgroundColor: '#0F1A2C',
        paddingTop: '6rem',
        paddingBottom: '6rem',
        paddingLeft: '2rem',
        paddingRight: '2rem',
      },
      blocks: [
        {
          id: 'hero-school-split-columns',
          type: 'columns',
          props: {
            columnsCount: 2,
            layout: '1-1',
            gap: '2.5rem',
          },
          blocks: [
            {
              id: 'hero-school-split-left',
              type: 'container',
              props: {
                alignItems: 'start',
                justifyContent: 'center',
                spacing: '1.5rem',
              },
              blocks: [
                {
                  id: 'hero-school-split-title',
                  type: 'title',
                  props: {
                    content: 'Streamlined Admissions & School Fees Portal',
                    tag: 'h1',
                    align: 'left',
                    textColorMode: 'theme',
                    customTitleColor: '#3b82f6',
                    fontSize: 'text-4xl md:text-5xl font-black tracking-tight leading-tight',
                  }
                },
                {
                  id: 'hero-school-split-text',
                  type: 'text',
                  props: {
                    content: '<p class="text-slate-300 text-sm leading-relaxed">Enroll students, coordinate digital signatures on consent forms, and track term fees seamlessly in one unified workspace.</p>',
                  }
                },
                {
                  id: 'hero-school-split-cta',
                  type: 'cta',
                  props: {
                    text: 'Apply for Admissions',
                    href: '#admissions',
                    variant: 'primary',
                    align: 'left',
                  }
                }
              ]
            },
            {
              id: 'hero-school-split-right',
              type: 'container',
              props: {
                alignItems: 'center',
                justifyContent: 'center',
              },
              blocks: [
                {
                  id: 'hero-school-split-video',
                  type: 'video',
                  props: {
                    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                    provider: 'youtube',
                    thumbnailUrl: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644',
                  }
                }
              ]
            }
          ]
        }
      ]
    }
  },
  {
    id: 'tpl-hero-centered-stack',
    organizationId: '',
    name: 'Centered Stack (Title, Center Video, Bottom CTA)',
    category: 'hero',
    industry: 'all',
    structure: {
      id: 'hero-centered-stack-sec',
      type: 'section',
      props: {
        backgroundType: 'color',
        backgroundColor: '#0a0f1d',
        paddingTop: '6rem',
        paddingBottom: '6rem',
        paddingLeft: '2rem',
        paddingRight: '2rem',
      },
      blocks: [
        {
          id: 'hero-centered-stack-container',
          type: 'container',
          props: {
            alignItems: 'center',
            spacing: '2rem',
            maxWidth: '48rem',
          },
          blocks: [
            {
              id: 'hero-centered-stack-title',
              type: 'title',
              props: {
                content: 'Experience Onboarding Made Simpler',
                tag: 'h1',
                align: 'center',
                textColorMode: 'theme',
                fontSize: 'text-4xl md:text-6xl font-black tracking-tight leading-tight',
              }
            },
            {
              id: 'hero-centered-stack-text',
              type: 'text',
              props: {
                content: '<p class="text-slate-400 text-base text-center leading-relaxed">Watch the 2-minute walkthrough video below to learn how SmartSapp resolves registration bottlenecks automatically.</p>',
              }
            },
            {
              id: 'hero-centered-stack-video',
              type: 'video',
              props: {
                url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                provider: 'youtube',
                thumbnailUrl: 'https://images.unsplash.com/photo-1450133064473-71024230f91b',
              }
            },
            {
              id: 'hero-centered-stack-cta',
              type: 'cta',
              props: {
                text: 'Create Your Workspace Account',
                href: '#signup',
                variant: 'primary',
                align: 'center',
              }
            }
          ]
        }
      ]
    }
  },
  {
    id: 'tpl-hero-glassmorphism',
    organizationId: '',
    name: 'Glassmorphic Overlay Hero (Fullbleed Video Bg)',
    category: 'hero',
    industry: 'all',
    structure: {
      id: 'hero-glassmorphism-sec',
      type: 'section',
      props: {
        backgroundType: 'color',
        backgroundColor: '#070a13',
        paddingTop: '0rem',
        paddingBottom: '0rem',
        paddingLeft: '0rem',
        paddingRight: '0rem',
      },
      blocks: [
        {
          id: 'hero-glassmorphism-video-hero',
          type: 'video_hero',
          props: {
            heading: 'Transformational Team Workspace Integrations',
            subheading: 'Launch campaign pages, collect client approvals, and trigger custom workflows automatically.',
            videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-software-developer-working-on-his-computer-34354-large.mp4',
            loop: true,
            muted: true,
            overlayOpacity: 0.75,
            ctaText: 'Get Started Now',
            ctaHref: '#join',
            secondaryCtaText: 'Read documentation',
            secondaryCtaHref: '#docs',
          }
        }
      ]
    }
  },
  {
    id: 'tpl-hero-bento-grid',
    organizationId: '',
    name: 'Bento Grid Marketing Hero',
    category: 'hero',
    industry: 'Marketing',
    structure: {
      id: 'hero-bento-sec',
      type: 'section',
      props: {
        backgroundType: 'gradient',
        gradientFrom: '#0d0f14',
        gradientTo: '#171a22',
        gradientAngle: 180,
        paddingTop: '5rem',
        paddingBottom: '5rem',
        paddingLeft: '2.5rem',
        paddingRight: '2.5rem',
      },
      blocks: [
        {
          id: 'hero-bento-columns',
          type: 'columns',
          props: {
            columnsCount: 2,
            layout: '3-2',
            gap: '2.5rem',
          },
          blocks: [
            {
              id: 'hero-bento-left',
              type: 'container',
              props: {
                alignItems: 'start',
                spacing: '1.5rem',
              },
              blocks: [
                {
                  id: 'hero-bento-badge',
                  type: 'text',
                  props: {
                    content: '<span class="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-400/10 px-3 py-1 rounded-full border border-emerald-500/20">Creative Agency Console</span>',
                  }
                },
                {
                  id: 'hero-bento-title',
                  type: 'title',
                  props: {
                    content: 'Deliver Highly Converting Digital Experiences',
                    tag: 'h1',
                    textColorMode: 'theme',
                    fontSize: 'text-4xl md:text-5xl font-black tracking-tight leading-tight',
                  }
                },
                {
                  id: 'hero-bento-desc',
                  type: 'text',
                  props: {
                    content: '<p class="text-slate-400 text-sm leading-relaxed">Our advanced campaign page builder empowers creative agencies to spin up fully responsive and customizable client portals, complete with forms, surveys, and digital signatures.</p>',
                  }
                },
                {
                  id: 'hero-bento-cta',
                  type: 'cta',
                  props: {
                    text: 'Book Agency consultation',
                    href: '#consult',
                    variant: 'primary',
                  }
                }
              ]
            },
            {
              id: 'hero-bento-right-grid',
              type: 'container',
              props: {
                alignItems: 'stretch',
                spacing: '1.5rem',
              },
              blocks: [
                {
                  id: 'hero-bento-stat1',
                  type: 'stats',
                  props: {
                    items: [
                      { id: 'bs1', value: '450k+', label: 'Onboarded nominees' },
                      { id: 'bs2', value: '99.8%', label: 'SLA uptime guarantee' },
                    ]
                  }
                },
                {
                  id: 'hero-bento-stat2',
                  type: 'stats',
                  props: {
                    items: [
                      { id: 'bs3', value: '4x', label: 'Speed migration metrics' },
                      { id: 'bs4', value: 'Zero', label: 'Manual database entries' },
                    ]
                  }
                }
              ]
            }
          ]
        }
      ]
    }
  },
  {
    id: 'tpl-hero-page-header',
    organizationId: '',
    name: 'Sub-Hero Page Header (With breadcrumbs & newsletter)',
    category: 'hero',
    industry: 'all',
    structure: {
      id: 'hero-subpage-sec',
      type: 'section',
      props: {
        backgroundType: 'color',
        backgroundColor: '#0a0f1d',
        paddingTop: '4rem',
        paddingBottom: '4rem',
        paddingLeft: '2rem',
        paddingRight: '2rem',
      },
      blocks: [
        {
          id: 'hero-subpage-container',
          type: 'container',
          props: {
            alignItems: 'center',
            spacing: '1rem',
          },
          blocks: [
            {
              id: 'hero-subpage-breadcrumbs',
              type: 'text',
              props: {
                content: '<div class="flex items-center gap-2 text-xs font-semibold text-slate-500 select-none uppercase tracking-wider"><span>Workspace</span><span>/</span><span class="text-violet-400">Campaign Form</span></div>',
              }
            },
            {
              id: 'hero-subpage-title',
              type: 'title',
              props: {
                content: 'Onboarding Policies & Nominal Checklist',
                tag: 'h2',
                align: 'center',
                textColorMode: 'theme',
                fontSize: 'text-3xl md:text-4xl font-bold tracking-tight',
              }
            },
            {
              id: 'hero-subpage-desc',
              type: 'text',
              props: {
                content: '<p class="text-slate-400 text-xs text-center max-w-lg leading-relaxed">Ensure team alignment. Review the nominal rosters, check requirements list, and sign off the compliance agreements below.</p>',
              }
            }
          ]
        }
      ]
    }
  },

  // ─── TESTIMONIALS SECTIONS (2 VARIATIONS) ─────────────────────────────────
  {
    id: 'tpl-testimonial-parents-grid',
    organizationId: '',
    name: 'Happy Parents Testimonials Grid (3 Columns)',
    category: 'testimonials',
    industry: 'SchoolEnrollment',
    structure: {
      id: 'testimonial-parents-grid-sec',
      type: 'section',
      props: {
        backgroundType: 'color',
        backgroundColor: '#0A1427',
        paddingTop: '4rem',
        paddingBottom: '4rem',
        paddingLeft: '2rem',
        paddingRight: '2rem',
      },
      blocks: [
        {
          id: 'testimonial-parents-grid-blk',
          type: 'testimonial_grid',
          props: {
            heading: 'Hear From Our Happy Parents',
            subheading: 'See what parents are saying about their experience with K.NAS.',
            columns: '3',
            cardStyle: 'video-quote',
            items: [
              {
                id: 'tp1',
                videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
                thumbnailUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136',
                badgeText: 'SATISFIED PARENTS',
                quote: 'My child is safe with top security, learning well, growing confident, responsible, and even praying over meals with joy.',
                author: "Ma'am Edlyn",
                avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2',
                role: 'Satisfied Parent',
              },
              {
                id: 'tp2',
                videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
                thumbnailUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d',
                badgeText: 'SATISFIED PARENTS',
                quote: 'Since joining KIS, my kids changed in behavior, learning, and faith. They now sing good songs, learn with joy, and live by Christian values.',
                author: 'Pastor Simpson',
                avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e',
                role: 'Satisfied Parent',
              },
              {
                id: 'tp3',
                videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
                thumbnailUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
                badgeText: 'SATISFIED PARENTS',
                quote: 'At K.NAS, small classes and caring teachers helped my child improve in reading, writing, and confidence through close attention.',
                author: 'Esi Kali',
                avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
                role: 'Satisfied Parent',
              }
            ]
          }
        }
      ]
    }
  },
  {
    id: 'tpl-testimonial-featured-single',
    organizationId: '',
    name: 'Featured Single Testimonial Showcase',
    category: 'testimonials',
    industry: 'all',
    structure: {
      id: 'testimonial-featured-sec',
      type: 'section',
      props: {
        backgroundType: 'color',
        backgroundColor: '#0a0f1d',
        paddingTop: '5rem',
        paddingBottom: '5rem',
        paddingLeft: '2rem',
        paddingRight: '2rem',
      },
      blocks: [
        {
          id: 'testimonial-featured-blk',
          type: 'testimonial',
          props: {
            quote: 'This system cut our team registration cycle time from days to literally under ten minutes. The OTP validation and digital signature consent are incredibly robust.',
            author: 'Amos Boateng',
            role: 'Head of Nominal Approvals, KIS',
            avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d',
            videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
          }
        }
      ]
    }
  },

  // ─── FAQ SECTIONS (2 VARIATIONS) ──────────────────────────────────────────
  {
    id: 'tpl-faq-accordion',
    organizationId: '',
    name: 'Interactive Accordion FAQ Stack',
    category: 'faq',
    industry: 'all',
    structure: {
      id: 'faq-accordion-sec',
      type: 'section',
      props: {
        backgroundType: 'color',
        backgroundColor: '#0F1A2C',
        paddingTop: '4rem',
        paddingBottom: '4rem',
        paddingLeft: '2rem',
        paddingRight: '2rem',
      },
      blocks: [
        {
          id: 'faq-accordion-blk',
          type: 'faq',
          props: {
            heading: 'Frequently Asked Questions',
            subheading: 'Everything you need to know about completing the registration process.',
            items: [
              { id: 'faq1', question: 'How long does the onboarding process take?', answer: 'Most users complete nominal uploads, file verification, and signature consents in under 10 minutes.' },
              { id: 'faq2', question: 'Are digital signatures legally binding?', answer: 'Yes, our platform generates legally compliant cryptographic signature seals matching municipal regulations.' },
              { id: 'faq3', question: 'What payment options do you support?', answer: 'We accept all major credit cards and major West African Mobile Money wallets (MTN MoMo, Telecel Cash, AT Money).' }
            ]
          }
        }
      ]
    }
  },
  {
    id: 'tpl-faq-grid-checklist',
    organizationId: '',
    name: 'Two-Column FAQ Grid Layout',
    category: 'faq',
    industry: 'all',
    structure: {
      id: 'faq-grid-sec',
      type: 'section',
      props: {
        backgroundType: 'color',
        backgroundColor: '#0a0f1d',
        paddingTop: '4rem',
        paddingBottom: '4rem',
      },
      blocks: [
        {
          id: 'faq-grid-columns',
          type: 'columns',
          props: {
            columnsCount: 2,
            layout: '1-1',
            gap: '2rem',
          },
          blocks: [
            {
              id: 'faq-grid-left-col',
              type: 'container',
              props: {
                spacing: '1rem',
              },
              blocks: [
                {
                  id: 'faq-grid-left-title',
                  type: 'title',
                  props: {
                    content: 'Security & Integrity',
                    tag: 'h3',
                    fontSize: 'text-xl font-bold text-violet-400',
                  }
                },
                {
                  id: 'faq-grid-left-text1',
                  type: 'text',
                  props: {
                    content: '<h4>Is my student/personal data secure?</h4><p class="text-slate-400 text-xs mt-1">We utilize bank-level AES-256 databases and secure cloud networks. Your personal data is fully encrypted at rest and in transit.</p>',
                  }
                },
                {
                  id: 'faq-grid-left-text2',
                  type: 'text',
                  props: {
                    content: '<h4>Can I audit signature records?</h4><p class="text-slate-400 text-xs mt-1">Yes. Each signature event triggers an immutable audit log detailing timestamps, IP logs, and browser metadata hashes.</p>',
                  }
                }
              ]
            },
            {
              id: 'faq-grid-right-col',
              type: 'container',
              props: {
                spacing: '1rem',
              },
              blocks: [
                {
                  id: 'faq-grid-right-title',
                  type: 'title',
                  props: {
                    content: 'Payments & Refunds',
                    tag: 'h3',
                    fontSize: 'text-xl font-bold text-emerald-400',
                  }
                },
                {
                  id: 'faq-grid-right-text1',
                  type: 'text',
                  props: {
                    content: '<h4>Are receipts generated automatically?</h4><p class="text-slate-400 text-xs mt-1">Yes. Once your Mobile Money or credit card transaction finishes, an official invoice receipt is immediately delivered to your contact email.</p>',
                  }
                },
                {
                  id: 'faq-grid-right-text2',
                  type: 'text',
                  props: {
                    content: '<h4>What is your subscription cancellation policy?</h4><p class="text-slate-400 text-xs mt-1">Tenant accounts can cancel monthly subscription tracks anytime directly inside their billing settings panel.</p>',
                  }
                }
              ]
            }
          ]
        }
      ]
    }
  },

  // ─── GALLERY SECTIONS (2 VARIATIONS) ──────────────────────────────────────
  {
    id: 'tpl-gallery-grid',
    organizationId: '',
    name: 'Responsive Image Showcase Grid',
    category: 'gallery',
    industry: 'Marketing',
    structure: {
      id: 'gallery-grid-sec',
      type: 'section',
      props: {
        backgroundType: 'color',
        backgroundColor: '#0F1A2C',
        paddingTop: '4rem',
        paddingBottom: '4rem',
        paddingLeft: '2rem',
        paddingRight: '2rem',
      },
      blocks: [
        {
          id: 'gallery-grid-title-container',
          type: 'container',
          props: {
            alignItems: 'center',
            spacing: '0.5rem',
          },
          blocks: [
            {
              id: 'gallery-grid-title',
              type: 'title',
              props: {
                content: 'Campaign Portfolios & Captures',
                tag: 'h3',
                align: 'center',
                fontSize: 'text-2xl md:text-3xl font-black text-slate-100',
              }
            },
            {
              id: 'gallery-grid-sub',
              type: 'text',
              props: {
                content: '<p class="text-slate-400 text-xs text-center max-w-md">Browse photos capturing our active classroom systems, student registration days, and tech lab facilities.</p>',
              }
            }
          ]
        },
        {
          id: 'gallery-grid-columns',
          type: 'columns',
          props: {
            columnsCount: 3,
            layout: '1-1-1',
            gap: '1.5rem',
          },
          blocks: [
            {
              id: 'gallery-grid-col1',
              type: 'container',
              props: {},
              blocks: [
                {
                  id: 'gallery-img1',
                  type: 'image',
                  props: {
                    url: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644',
                    alt: 'Student Group Discussion',
                    borderRadius: 'rounded-xl',
                    shadow: 'shadow-md border border-slate-700/30',
                  }
                }
              ]
            },
            {
              id: 'gallery-grid-col2',
              type: 'container',
              props: {},
              blocks: [
                {
                  id: 'gallery-img2',
                  type: 'image',
                  props: {
                    url: 'https://images.unsplash.com/photo-1544717305-2782549b5136',
                    alt: 'Teacher Classroom Instruction',
                    borderRadius: 'rounded-xl',
                    shadow: 'shadow-md border border-slate-700/30',
                  }
                }
              ]
            },
            {
              id: 'gallery-grid-col3',
              type: 'container',
              props: {},
              blocks: [
                {
                  id: 'gallery-img3',
                  type: 'image',
                  props: {
                    url: 'https://images.unsplash.com/photo-1450133064473-71024230f91b',
                    alt: 'Nominal Registration Counter',
                    borderRadius: 'rounded-xl',
                    shadow: 'shadow-md border border-slate-700/30',
                  }
                }
              ]
            }
          ]
        }
      ]
    }
  },
  {
    id: 'tpl-gallery-alternating',
    organizationId: '',
    name: 'Alternating Features (Zig-Zag Text & Image)',
    category: 'gallery',
    industry: 'all',
    structure: {
      id: 'gallery-alternating-sec',
      type: 'section',
      props: {
        backgroundType: 'color',
        backgroundColor: '#0a0f1d',
        paddingTop: '5rem',
        paddingBottom: '5rem',
        paddingLeft: '2rem',
        paddingRight: '2rem',
      },
      blocks: [
        {
          id: 'gallery-alternating-row1',
          type: 'columns',
          props: {
            columnsCount: 2,
            layout: '1-1',
            gap: '3rem',
          },
          blocks: [
            {
              id: 'gallery-alt-row1-text',
              type: 'container',
              props: {
                alignItems: 'start',
                justifyContent: 'center',
                spacing: '1rem',
              },
              blocks: [
                {
                  id: 'gallery-alt-row1-title',
                  type: 'title',
                  props: {
                    content: '01. Enroll Nominee Records',
                    tag: 'h3',
                    fontSize: 'text-2xl font-bold text-violet-400',
                  }
                },
                {
                  id: 'gallery-alt-row1-body',
                  type: 'text',
                  props: {
                    content: '<p class="text-slate-400 text-sm leading-relaxed">Upload spreadsheet logs or type nominee profiles directly. Our validator screens phone formats, emails, and student ID constraints in real-time.</p>',
                  }
                }
              ]
            },
            {
              id: 'gallery-alt-row1-img',
              type: 'container',
              props: {
                alignItems: 'center',
                justifyContent: 'center',
              },
              blocks: [
                {
                  id: 'gallery-alt-img1',
                  type: 'image',
                  props: {
                    url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f',
                    alt: 'Nominee upload spreadsheet screen mockup',
                    borderRadius: 'rounded-2xl',
                    shadow: 'shadow-lg border border-slate-700/30',
                  }
                }
              ]
            }
          ]
        }
      ]
    }
  }
];
