import { Metadata } from 'next';
import SeedsClient from './SeedsClient';

export const metadata: Metadata = {
    title: 'System Seeding Hub',
    description: 'Provide system seeding and data initialization.',
};

export default function SeedsPage() {
    return <SeedsClient />;
}
