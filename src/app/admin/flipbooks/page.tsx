import FlipbookStudioClient from './FlipbookStudioClient';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Flipbook Studio',
  description: 'Convert PDFs, Word documents, and eBooks into interactive 3D Flipbooks and public landing pages.',
};

export default function FlipbookStudioPage() {
  return <FlipbookStudioClient />;
}
