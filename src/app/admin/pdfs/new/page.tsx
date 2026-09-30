import { Metadata } from 'next';
import NewPdfClient from './NewPdfClient';

export const metadata: Metadata = {
  title: 'New Signing Document | Doc Signing Studio',
  description: 'Create, upload, or generate institutional document blueprints and signing templates.',
};

export default function NewPdfPage() {
  return <NewPdfClient />;
}
