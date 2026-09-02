import type { PageTemplate } from '@/lib/types';
import { blk, sec } from './helpers';

/**
 * School templates — warm, trustworthy layouts for admissions, events, and fees.
 */
export const SCHOOL_TEMPLATES: PageTemplate[] = [
  {
    id: 'school-admissions',
    name: 'Admissions / Enrollment',
    description: 'Hero, key dates, program highlights, and a registration form for admissions drives.',
    goal: 'registration',
    isGlobal: true,
    industry: 'SchoolEnrollment',
    structureJson: {
      sections: [
        sec('school-adm-hero', [
          blk('school-adm-hero-1', 'hero', {
            title: 'Enrollment is now open for {{year}}',
            subtitle: 'Give your child a head start. Apply in minutes.',
            align: 'center',
          }),
        ]),
        sec('school-adm-stats', [
          blk('school-adm-stats-1', 'stats', {
            items: [
              { id: 'a', value: '1:12', label: 'Teacher ratio' },
              { id: 'b', value: '40+', label: 'Programs' },
              { id: 'c', value: '95%', label: 'Graduate rate' },
            ],
          }),
        ], { heading: 'Why families choose us' }),
        sec('school-adm-info', [
          blk('school-adm-info-1', 'text', {
            content: '<h3>Key dates</h3><p>Applications close on the 30th. Interviews begin the following week.</p>',
          }),
        ]),
        sec('school-adm-form', [blk('school-adm-form-1', 'form', { formId: '' })], { heading: 'Start your application' }),
      ],
    },
  },
  {
    id: 'school-open-day',
    name: 'Open Day RSVP',
    description: 'Event hero, agenda, and an RSVP form for campus open days.',
    goal: 'registration',
    isGlobal: true,
    industry: 'SchoolEnrollment',
    structureJson: {
      sections: [
        sec('school-od-hero', [
          blk('school-od-hero-1', 'hero', {
            title: 'Join us for Open Day',
            subtitle: 'Tour the campus, meet our teachers, and see classrooms in action.',
            align: 'center',
          }),
        ]),
        sec('school-od-agenda', [
          blk('school-od-agenda-1', 'text', {
            content: '<h3>What to expect</h3><ul><li>Campus tour</li><li>Meet the faculty</li><li>Q&amp;A with the principal</li></ul>',
          }),
        ], { heading: 'Agenda' }),
        sec('school-od-form', [blk('school-od-form-1', 'form', { formId: '' })], { heading: 'Reserve your place' }),
      ],
    },
  },
  {
    id: 'school-fee-payment',
    name: 'Fee Payment Guide',
    description: 'Bank details and a step-by-step payment procedure for school fees.',
    goal: 'payment',
    isGlobal: true,
    industry: 'SchoolEnrollment',
    structureJson: {
      sections: [
        sec('school-fee-hero', [
          blk('school-fee-hero-1', 'hero', {
            title: 'How to pay your fees',
            subtitle: 'Follow the steps below to complete your payment securely.',
            align: 'center',
          }),
        ]),
        sec('school-fee-methods', [
          blk('school-fee-methods-1', 'payment_methods', {
            methods: [
              { name: 'Bank Transfer', details: [{ label: 'Account Name', value: 'Your School Ltd' }, { label: 'Account Number', value: '0000000000' }] },
            ],
          }),
        ], { heading: 'Bank Details' }),
        sec('school-fee-procedure', [
          blk('school-fee-procedure-1', 'procedure_list', {
            title: 'Payment steps',
            steps: ['Transfer the exact amount to the account above.', 'Use your student ID as the reference.', 'Keep your receipt for confirmation.'],
          }),
        ], { heading: 'Payment Procedure' }),
      ],
    },
  },
  {
    id: 'marigold-montessori-hero-journey',
    name: "Marigold Montessori — Hero's Journey",
    description: "Industry-grade 17-section school homepage structuring the child as the hero, the parent as the guide, and the school as the trusted environment.",
    goal: 'registration',
    isGlobal: true,
    industry: 'SchoolEnrollment',
    structureJson: {
      sections: [
        // 1. Hero Section
        sec('mm-sec-hero', [
          blk('mm-blk-hero', 'hero', {
            title: 'Helping Your Child Discover Who They Can Become.',
            subtitle: 'Where Curious Minds Begin to Bloom. Every child begins life with incredible potential. At Marigold Montessori, we create a nurturing environment where children are encouraged to explore, question, create, and grow—at their own pace and with confidence.',
            align: 'center',
            ctaText: 'Book a School Visit',
            ctaUrl: '#admissions',
            ctaSecondaryText: 'Discover Marigold Montessori',
            ctaSecondaryUrl: '#about',
            gradientText: true,
            fontSize: 'xl',
          }),
        ], {
          backgroundColor: '#FDFBF7',
          backgroundType: 'color',
          paddingTop: 'py-20',
          paddingBottom: 'py-20',
        }),

        // 2. The Parent's Challenge
        sec('mm-sec-challenge', [
          blk('mm-blk-title-challenge', 'title', {
            preset: 'section-heading',
            tagline: 'Every Parent Wants More Than a School',
            title: "You’re Not Just Choosing a Classroom. You’re Choosing the Environment That Will Shape Your Child.",
            subheading: 'As a parent, you want your child to do well in school—but you also want so much more.',
            alignment: 'center',
            textColorMode: 'dark',
          }),
          blk('mm-blk-text-challenge', 'text', {
            preset: 'checklist',
            content: '<p>You want them to be <strong>confident enough to speak up</strong>, <strong>curious enough to ask questions</strong>, <strong>independent enough to try things for themselves</strong>, <strong>kind enough to care about others</strong>, and <strong>resilient enough to keep going</strong> when things become difficult. But finding a school that develops the whole child can be challenging. <em>That’s where Marigold Montessori comes in.</em></p>',
            textAlign: 'center',
          }),
        ], {
          backgroundColor: '#FFFFFF',
          backgroundType: 'color',
          paddingTop: 'py-16',
          paddingBottom: 'py-16',
        }),

        // 3. The Child as the Hero
        sec('mm-sec-child-hero', [
          blk('mm-blk-title-child-hero', 'title', {
            preset: 'hero-title',
            tagline: 'Your Child Has Their Own Journey',
            title: 'Every Child Is Different. Their Learning Journey Should Be Too.',
            subheading: "Children don't all learn in the same way, at the same speed, or with the same interests. At Marigold Montessori, we recognize and respect that.",
            alignment: 'center',
            textColorMode: 'dark',
          }),
          blk('mm-blk-text-child-hero', 'text', {
            preset: 'lead',
            content: "<p>Instead of asking every child to fit into the same mould, we create opportunities for children to discover their interests, develop their abilities, solve problems, and take increasing ownership of their learning. Because education isn't simply about filling a child's mind with information—<strong>it's about helping them discover what they are capable of.</strong></p>",
            textAlign: 'center',
          }),
        ], {
          backgroundColor: '#F8FAFC',
          backgroundType: 'color',
          paddingTop: 'py-16',
          paddingBottom: 'py-16',
        }),

        // 4. The Guide — Marigold Montessori
        sec('mm-sec-guide', [
          blk('mm-blk-title-guide', 'title', {
            preset: 'section-heading',
            tagline: 'A School That Guides, Not Limits',
            title: 'We Give Children the Guidance, Space and Support to Grow.',
            subheading: 'The Montessori approach places the child at the centre of the learning experience. Our educators carefully observe, guide, encourage, and challenge children.',
            alignment: 'center',
            textColorMode: 'dark',
          }),
          blk('mm-blk-guide-pillars', 'procedure_list', {
            title: "Your Child's Journey Is Supported By:",
            steps: [
              'Caring and attentive educators who understand individual developmental rhythms.',
              'Purposeful learning environments designed to foster focus and exploration.',
              'Hands-on experiences that bridge abstract ideas to practical understanding.',
              'Age-appropriate learning activities customized to developmental milestones.',
              'Opportunities for independent exploration and self-directed work cycles.',
              'Collaborative group experiences building teamwork and social bonds.',
              'Character, empathy, and social development embedded daily.',
              'Encouragement to think critically, question thoughtfully, and solve problems.',
            ],
          }),
        ], {
          backgroundColor: '#FFFFFF',
          backgroundType: 'color',
          paddingTop: 'py-16',
          paddingBottom: 'py-16',
        }),

        // 5. The Method
        sec('mm-sec-method', [
          blk('mm-blk-title-method', 'title', {
            preset: 'badge-capsule',
            tagline: 'Learning Through Discovery',
            title: 'Less Memorising. More Understanding. More Doing.',
            subheading: 'Children learn deeply when they are actively involved in the learning process. Learning becomes something they experience, not simply something they are told.',
            alignment: 'center',
            textColorMode: 'dark',
          }),
          blk('mm-blk-method-cards', 'choice_cards', {
            heading: 'The 3-Stage Discovery Framework',
            columns: '3',
            cards: [
              {
                id: 'card-explore',
                badgeText: 'STAGE 1',
                title: 'Explore',
                description: 'Children are encouraged to investigate their environment and follow meaningful, self-directed interests.',
                gradient: 'from-amber-500 to-orange-600',
                ctaText: 'Learn More',
              },
              {
                id: 'card-discover',
                badgeText: 'STAGE 2',
                title: 'Discover',
                description: 'Hands-on sensory experiences help children grasp core concepts deeply rather than simply memorising them.',
                gradient: 'from-emerald-500 to-teal-600',
                ctaText: 'Learn More',
              },
              {
                id: 'card-master',
                badgeText: 'STAGE 3',
                title: 'Master',
                description: 'With practice, guidance, and encouragement, children gradually develop lasting confidence and independence.',
                gradient: 'from-blue-500 to-indigo-600',
                ctaText: 'Learn More',
              },
            ],
          }),
        ], {
          backgroundColor: '#FDFBF7',
          backgroundType: 'color',
          paddingTop: 'py-16',
          paddingBottom: 'py-16',
        }),

        // 6. The Transformation
        sec('mm-sec-transformation', [
          blk('mm-blk-title-transform', 'title', {
            preset: 'accent-tagline',
            tagline: 'Watch Them Grow',
            title: 'From “I Can’t” to “Let Me Try.”',
            subheading: "The most meaningful transformation isn't always measured by a test score.",
            alignment: 'center',
            textColorMode: 'dark',
          }),
          blk('mm-blk-text-transform', 'text', {
            preset: 'lead',
            content: '<p>Sometimes it\'s the child who once waited for help who suddenly says: <strong>“I can do it myself.”</strong> It\'s the quiet child finding their voice, the curious child discovering a new fascination, the frustrated child learning to try again, and the hesitant child becoming willing to explore.</p><p>At Marigold Montessori, we celebrate these moments because they are signs of something much bigger: <strong>A child becoming confident in their own ability to learn.</strong></p>',
            textAlign: 'center',
          }),
        ], {
          backgroundColor: '#FFFFFF',
          backgroundType: 'color',
          paddingTop: 'py-16',
          paddingBottom: 'py-16',
        }),

        // 7. Academic Development
        sec('mm-sec-academics', [
          blk('mm-blk-title-academics', 'title', {
            preset: 'section-heading',
            tagline: 'Strong Foundations',
            title: 'Building the Skills Children Need for Their Next Chapter.',
            subheading: 'Independence and creativity are essential—and so are strong academic foundations across core disciplines.',
            alignment: 'center',
            textColorMode: 'dark',
          }),
          blk('mm-blk-academics-cards', 'choice_cards', {
            heading: '6 Core Learning Areas',
            columns: '3',
            cards: [
              {
                id: 'area-literacy',
                badgeText: 'FOUNDATION',
                title: 'Language & Literacy',
                description: 'Developing communication, vocabulary, reading readiness, expressive writing, and an enduring love for books.',
                gradient: 'from-amber-500 to-amber-700',
                ctaText: 'View Curriculum',
              },
              {
                id: 'area-math',
                badgeText: 'FOUNDATION',
                title: 'Mathematics',
                description: 'Building strong number sense, logical reasoning, problem-solving, and joyful mathematical confidence.',
                gradient: 'from-blue-500 to-blue-700',
                ctaText: 'View Curriculum',
              },
              {
                id: 'area-practical',
                badgeText: 'LIFE SKILLS',
                title: 'Practical Life',
                description: 'Fostering coordination, concentration, self-reliance, responsibility, and everyday life capabilities.',
                gradient: 'from-emerald-500 to-emerald-700',
                ctaText: 'View Curriculum',
              },
              {
                id: 'area-sensorial',
                badgeText: 'COGNITIVE',
                title: 'Sensorial Learning',
                description: 'Helping children organize, classify, and understand their world through deliberate sensory exploration.',
                gradient: 'from-purple-500 to-purple-700',
                ctaText: 'View Curriculum',
              },
              {
                id: 'area-creative',
                badgeText: 'ARTS',
                title: 'Creative Expression',
                description: 'Encouraging boundless imagination through visual arts, music, rhythm, movement, and storytelling.',
                gradient: 'from-pink-500 to-rose-700',
                ctaText: 'View Curriculum',
              },
              {
                id: 'area-social',
                badgeText: 'EMOTIONAL',
                title: 'Social & Emotional Development',
                description: 'Guiding self-awareness, positive communication, collaborative cooperation, and heartfelt empathy.',
                gradient: 'from-teal-500 to-cyan-700',
                ctaText: 'View Curriculum',
              },
            ],
          }),
        ], {
          backgroundColor: '#F8FAFC',
          backgroundType: 'color',
          paddingTop: 'py-16',
          paddingBottom: 'py-16',
        }),

        // 8. The Environment
        sec('mm-sec-environment', [
          blk('mm-blk-title-env', 'title', {
            preset: 'section-heading',
            tagline: 'The Prepared Environment',
            title: 'A Classroom Designed for Children to Think, Move and Discover.',
            subheading: "Walk into a Marigold Montessori classroom and you won't simply see rows of desks.",
            alignment: 'center',
            textColorMode: 'dark',
          }),
          blk('mm-blk-text-env', 'text', {
            preset: 'lead',
            content: '<p>You will see children deeply engaged, materials placed within easy reach, purposeful activities, quiet concentration, joyful conversation, natural movement, and continuous discovery.</p><p>Our learning spaces are intentionally crafted to empower children to make choices, work independently, collaborate with peers, and take genuine responsibility for their surroundings. <strong>The environment becomes part of the teacher.</strong></p>',
            textAlign: 'center',
          }),
        ], {
          backgroundColor: '#FFFFFF',
          backgroundType: 'color',
          paddingTop: 'py-16',
          paddingBottom: 'py-16',
        }),

        // 9. The Teachers
        sec('mm-sec-teachers', [
          blk('mm-blk-title-teachers', 'title', {
            preset: 'section-heading',
            tagline: 'The People Behind the Experience',
            title: 'Teachers Who See the Child, Not Just the Class.',
            subheading: 'Great education begins with great relationships. Our educators take time to understand each child.',
            alignment: 'center',
            textColorMode: 'dark',
          }),
          blk('mm-blk-text-teachers', 'text', {
            preset: 'paragraph',
            content: '<p>Our educators observe, listen, encourage, and guide. And when appropriate, they step back—giving children the opportunity to discover what they can accomplish for themselves. <strong>Because sometimes the best way to help a child grow is to give them the confidence to try.</strong></p>',
            textAlign: 'center',
          }),
        ], {
          backgroundColor: '#FDFBF7',
          backgroundType: 'color',
          paddingTop: 'py-16',
          paddingBottom: 'py-16',
        }),

        // 10. Parents as Partners
        sec('mm-sec-parents', [
          blk('mm-blk-title-parents', 'title', {
            preset: 'section-heading',
            tagline: "The Journey Doesn't Stop at the School Gate",
            title: 'When School and Home Work Together, Children Thrive.',
            subheading: 'Your child’s education is a sacred partnership between school and family.',
            alignment: 'center',
            textColorMode: 'dark',
          }),
          blk('mm-blk-text-parents', 'text', {
            preset: 'lead',
            content: '<p>We maintain active, transparent communication with families, helping parents understand their child’s unique developmental progress, emerging interests, and classroom triumphs. You shouldn’t have to wonder: <em>“How is my child doing?”</em> You should feel like an active part of the journey.</p>',
            textAlign: 'center',
          }),
          blk('mm-blk-cta-team', 'cta', {
            label: 'Meet Our Team',
            url: '#teachers',
            variant: 'secondary',
            buttons: [
              {
                id: 'btn-meet-team',
                label: 'Meet Our Team',
                url: '#teachers',
                variant: 'secondary',
              }
            ],
          }),
        ], {
          backgroundColor: '#FFFFFF',
          backgroundType: 'color',
          paddingTop: 'py-16',
          paddingBottom: 'py-16',
        }),

        // 11. The Marigold Difference
        sec('mm-sec-difference', [
          blk('mm-blk-title-diff', 'title', {
            preset: 'section-heading',
            tagline: 'Why Families Choose Marigold',
            title: 'An Education Built Around the Whole Child.',
            subheading: 'Choosing the right school comes down to finding an environment where your child feels safe, valued, challenged, and inspired.',
            alignment: 'center',
            textColorMode: 'dark',
          }),
          blk('mm-blk-diff-cards', 'choice_cards', {
            heading: 'The 6 Core Marigold Pillars',
            columns: '3',
            cards: [
              {
                id: 'diff-1',
                badgeText: 'INDIVIDUAL',
                title: 'Child-Centred Learning',
                description: 'Tailored learning pathways recognizing every child’s individual developmental timeline.',
                gradient: 'from-amber-500 to-orange-600',
              },
              {
                id: 'diff-2',
                badgeText: 'AUTONOMY',
                title: 'Independence',
                description: 'Daily opportunities for children to build confidence in thinking and doing things for themselves.',
                gradient: 'from-emerald-500 to-teal-600',
              },
              {
                id: 'diff-3',
                badgeText: 'EXPERIENTIAL',
                title: 'Purposeful Learning',
                description: 'Hands-on sensory experiences transforming abstract theories into meaningful mastery.',
                gradient: 'from-blue-500 to-indigo-600',
              },
              {
                id: 'diff-4',
                badgeText: 'VALUES',
                title: 'Character Development',
                description: 'Cultivating respect, responsibility, kindness, self-discipline, and resilient problem-solving.',
                gradient: 'from-purple-500 to-violet-600',
              },
              {
                id: 'diff-5',
                badgeText: 'CONNECTION',
                title: 'Nurturing Relationships',
                description: 'Attentive educators who understand that children learn best when emotionally supported.',
                gradient: 'from-rose-500 to-pink-600',
              },
              {
                id: 'diff-6',
                badgeText: 'LIFELONG',
                title: 'A Love of Learning',
                description: 'Fostering an intrinsic passion for inquiry that stays with children throughout life.',
                gradient: 'from-teal-500 to-cyan-600',
              },
            ],
          }),
        ], {
          backgroundColor: '#F8FAFC',
          backgroundType: 'color',
          paddingTop: 'py-16',
          paddingBottom: 'py-16',
        }),

        // 12. The Future
        sec('mm-sec-future', [
          blk('mm-blk-title-future', 'title', {
            preset: 'section-heading',
            tagline: 'Preparing Them for More',
            title: "We're Not Just Preparing Children for the Next Class.",
            subheading: 'The world your child will grow up in is rapidly evolving. They need more than memorized answers.',
            alignment: 'center',
            textColorMode: 'dark',
          }),
          blk('mm-blk-text-future', 'text', {
            preset: 'lead',
            content: '<p>They will need to think critically, communicate clearly, solve novel problems, work effectively with others, adapt with grace, and take courageous initiative. That is why we focus not only on <em>what children learn</em>, but on <strong>how they learn</strong>.</p><p><strong>Because the greatest gift we can give a child is the confidence and curiosity to keep learning.</strong></p>',
            textAlign: 'center',
          }),
        ], {
          backgroundColor: '#FFFFFF',
          backgroundType: 'color',
          paddingTop: 'py-16',
          paddingBottom: 'py-16',
        }),

        // 13. Parent Testimonials
        sec('mm-sec-testimonials', [
          blk('mm-blk-testimonials', 'testimonial_grid', {
            heading: "Don't Just Take Our Word For It.",
            subheading: 'The best people to tell our story are the families who experience Marigold Montessori every single day.',
            testimonials: [
              {
                id: 't-1',
                quote: "Since joining Marigold Montessori, we've seen such a beautiful change in our child. Their confidence has grown, they are more independent, and they genuinely enjoy learning every morning.",
                author: 'Dr. Kwame & Sarah Mensah',
                role: 'Parents of a Marigold Early Learner',
                rating: 5,
              },
              {
                id: 't-2',
                quote: 'The environment here is unlike anything we saw at traditional schools. Our daughter asks thoughtful questions and takes pride in dressing and reading on her own.',
                author: 'Akosua Boakye',
                role: 'Montessori Parent',
                rating: 5,
              },
            ],
          }),
        ], {
          backgroundColor: '#FDFBF7',
          backgroundType: 'color',
          paddingTop: 'py-16',
          paddingBottom: 'py-16',
        }),

        // 14. School Life
        sec('mm-sec-school-life', [
          blk('mm-blk-title-life', 'title', {
            preset: 'section-heading',
            tagline: 'More Than the Classroom',
            title: 'Every Day Is an Opportunity to Discover Something New.',
            subheading: 'Learning happens while creating, playing, reading, exploring, collaborating, and celebrating milestones.',
            alignment: 'center',
            textColorMode: 'dark',
          }),
          blk('mm-blk-cta-life', 'cta', {
            label: 'Explore School Life',
            url: '#school-life',
            variant: 'secondary',
            buttons: [
              {
                id: 'btn-explore-life',
                label: 'Explore School Life',
                url: '#school-life',
                variant: 'secondary',
              }
            ],
          }),
        ], {
          backgroundColor: '#FFFFFF',
          backgroundType: 'color',
          paddingTop: 'py-16',
          paddingBottom: 'py-16',
        }),

        // 15. Admissions
        sec('mm-sec-admissions', [
          blk('mm-blk-title-adm', 'title', {
            preset: 'section-heading',
            tagline: "Your Child's Next Chapter Starts Here",
            title: 'Ready to Begin the Journey?',
            subheading: 'Choosing a school is an important decision—and we want you to make it with complete clarity and confidence.',
            alignment: 'center',
            textColorMode: 'dark',
          }),
          blk('mm-blk-adm-steps', 'procedure_list', {
            title: 'Simple 3-Step Admissions Flow',
            steps: [
              'Book a personalized campus tour and observe our active Montessori classrooms.',
              'Submit your online application and student profile form.',
              'Attend a warm family welcome conversation and receive your enrollment pack.',
            ],
          }),
          blk('mm-blk-adm-cta', 'cta', {
            label: 'Book a School Visit',
            url: '#book-visit',
            variant: 'primary',
            buttons: [
              {
                id: 'btn-book-visit-adm',
                label: 'Book a School Visit',
                url: '#book-visit',
                variant: 'primary',
              },
              {
                id: 'btn-start-adm',
                label: 'Start the Admissions Process',
                url: '#apply',
                variant: 'secondary',
              }
            ],
          }),
        ], {
          backgroundColor: '#FDFBF7',
          backgroundType: 'color',
          paddingTop: 'py-20',
          paddingBottom: 'py-20',
        }),

        // 16. Final Hero Journey CTA
        sec('mm-sec-final-cta', [
          blk('mm-blk-final-hero', 'hero', {
            title: 'Every Great Journey Begins With a First Step.',
            subtitle: 'Your child’s journey is just beginning. Let Marigold Montessori help them take that first step with curiosity, confidence, and joy. Because today they’re discovering the world. Tomorrow, they’ll be ready to shape it.',
            align: 'center',
            ctaText: 'Book a Visit',
            ctaUrl: '#book-visit',
            ctaSecondaryText: 'Contact Marigold Montessori',
            ctaSecondaryUrl: '#contact',
            gradientText: true,
            fontSize: 'lg',
          }),
        ], {
          backgroundColor: '#0F172A',
          backgroundType: 'color',
          paddingTop: 'py-20',
          paddingBottom: 'py-20',
        }),
      ],
      header: {
        preset: 'full-nav',
        overlap: false,
        sticky: true,
        floating: false,
        showSearch: false,
        showCta: true,
        ctaText: 'Book a Visit',
        ctaUrl: '#book-visit',
        showPhone: true,
        phoneNumber: '+233 24 000 0000',
        navItems: [
          { id: 'nav-about', label: 'About Us', linkType: 'scroll', targetSectionId: 'mm-sec-challenge' },
          { id: 'nav-method', label: 'Montessori Method', linkType: 'scroll', targetSectionId: 'mm-sec-method' },
          { id: 'nav-academics', label: 'Learning', linkType: 'scroll', targetSectionId: 'mm-sec-academics' },
          { id: 'nav-teachers', label: 'Our Teachers', linkType: 'scroll', targetSectionId: 'mm-sec-teachers' },
          { id: 'nav-admissions', label: 'Admissions', linkType: 'scroll', targetSectionId: 'mm-sec-admissions' },
        ],
      },
      footer: {
        preset: 'multi-column',
        overrideOrg: true,
        copyrightText: '© {{year}} Marigold Montessori. Where Curious Minds Begin to Bloom.',
        address: 'Marigold Campus, Accra, Ghana',
        email: 'admissions@marigoldmontessori.edu',
        phone: '+233 24 000 0000',
        website: 'https://marigoldmontessori.edu',
        navItems: [
          { label: 'About Us', url: '#about' },
          { label: 'Our Montessori Approach', url: '#method' },
          { label: 'Learning Areas', url: '#academics' },
          { label: 'Our Teachers', url: '#teachers' },
          { label: 'Admissions', url: '#admissions' },
          { label: 'Parent Resources', url: '#parents' },
          { label: 'Contact Us', url: '#contact' },
        ],
      },
    },
  },
];
