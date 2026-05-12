
import { Calendar, Users, Video, Presentation } from 'lucide-react';

export const MEETING_TEMPLATES = [
    {
        id: 'parent-engagement',
        title: 'Parent Engagement Session',
        description: 'Standard session for parent orientation and onboarding.',
        typeId: 'parent',
        icon: Users,
        color: 'bg-blue-500',
        defaults: {
            title: 'Parent Orientation Session',
            heroTitle: 'Welcome to Our School Community',
            heroDescription: 'Join us for an essential orientation session to learn about our curriculum, values, and how we support your child\'s growth.',
            heroTagline: 'ORIENTATION & ONBOARDING',
            heroCtaLabel: 'Register Now',
            registrationEnabled: true,
            brandingEnabled: true,
            heroLayout: 'image'
        }
    },
    {
        id: 'kickoff-meeting',
        title: 'Project Kickoff',
        description: 'Strategic alignment and launch for new institutional partnerships.',
        typeId: 'kickoff',
        icon: Calendar,
        color: 'bg-violet-500',
        defaults: {
            title: 'Project Kickoff Meeting',
            heroTitle: 'Setting the Foundation for Success',
            heroDescription: 'Let\'s align on goals, timelines, and key milestones for our partnership launch.',
            heroTagline: 'STRATEGIC ALIGNMENT',
            heroCtaLabel: 'Join Kickoff',
            registrationEnabled: false,
            brandingEnabled: true,
            heroLayout: 'form'
        }
    },
    {
        id: 'training-workshop',
        title: 'Staff Training Workshop',
        description: 'Professional development and skill-building for school staff.',
        typeId: 'training',
        icon: Presentation,
        color: 'bg-emerald-500',
        defaults: {
            title: 'Staff Professional Development',
            heroTitle: 'Empowering Educators',
            heroDescription: 'A deep dive into advanced classroom management and digital pedagogy tools.',
            heroTagline: 'PROFESSIONAL DEVELOPMENT',
            heroCtaLabel: 'Enroll in Workshop',
            registrationEnabled: true,
            registrationRequiredToJoin: true,
            brandingEnabled: true,
            heroLayout: 'image'
        }
    },
    {
        id: 'webinar-broadcast',
        title: 'Public Webinar',
        description: 'Large-scale broadcast for educational insights and marketing.',
        typeId: 'webinar',
        icon: Video,
        color: 'bg-amber-500',
        defaults: {
            title: 'Educational Insights Webinar',
            heroTitle: 'The Future of Digital Learning',
            heroDescription: 'Discover emerging trends and technologies shaping the educational landscape in 2024 and beyond.',
            heroTagline: 'LIVE WEBINAR',
            heroCtaLabel: 'Reserve Your Spot',
            registrationEnabled: true,
            capacityLimit: 500,
            brandingEnabled: true,
            heroLayout: 'form'
        }
    }
];
