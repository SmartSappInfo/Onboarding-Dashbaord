import ThumbnailsClient from './ThumbnailsClient';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Thumbnail Studio',
  description: 'AI-assisted, high-performance thumbnail builder optimized for student and parent engagement CTR.',
};

export default function ThumbnailStudioPage() {
  return <ThumbnailsClient />;
}
