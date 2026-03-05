import MediaClient from './MediaClient';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Media Repository',
  description: 'Centralized digital asset library for school logos, brochures, and promotional content.',
};

export default function MediaLibraryPage() {
  return <MediaClient />;
}
