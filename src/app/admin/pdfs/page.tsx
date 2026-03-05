import PdfsClient from './PdfsClient';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Doc Signing Studio',
  description: 'Interactive PDF field mapping and digital signature management for secure school forms.',
};

export default function PdfsPage() {
  return <PdfsClient />;
}
