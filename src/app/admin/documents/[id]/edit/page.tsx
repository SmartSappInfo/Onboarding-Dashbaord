import DocumentEditorClient from './DocumentEditorClient';
import { Metadata } from 'next';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Document Experience Studio Editor Route:
 *    Admin route `/admin/documents/[id]/edit` for configuring publications.
 * 2. Next.js 16 App Router Standards:
 *    Asynchronously resolves route params (`await params`).
 * 3. Strict Typing:
 *    Zero `any` or `any[]` types are permitted.
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Edit Document | Document Studio',
  description: 'Configure pages, layers, viewer modes, and versions.',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function DocumentEditorPage({ params }: PageProps) {
  const { id } = await params;
  return <DocumentEditorClient documentId={id} />;
}
