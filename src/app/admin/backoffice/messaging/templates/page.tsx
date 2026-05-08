

import { Metadata } from 'next';
import TemplatesClient from './TemplatesClient';

export const metadata: Metadata = {
    title: 'Global Template Management | Back Office',
    description: 'Manage system-wide messaging blueprints and defaults.',
};

export default async function BackOfficeTemplatesPage() {
    return <TemplatesClient />;
}
