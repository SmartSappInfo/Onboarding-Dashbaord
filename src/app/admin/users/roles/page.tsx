import { Metadata } from 'next';
import RolesClient from './RolesClient';

export const metadata: Metadata = {
    title: 'Role Architecture',
    description: 'Define and manage hierarchical structural authorization silos.',
};

export default function RolesPage() {
    return <RolesClient />;
}
