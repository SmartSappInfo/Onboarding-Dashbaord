/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Public Independent Document Verification Route:
 *    Renders the public verification view for any signed contract or envelope.
 * 2. Immutable Data Resolution:
 *    Queries the Firestore `contracts` collection and `signing_evidence` ledger.
 *    Does not require user authentication so that external counterparties, auditors,
 *    and signers can independently inspect document authenticity.
 * 3. Security & Zero-Any (Rule 4):
 *    Strict typing across props and Firestore document transformations.
 */

import { Metadata } from 'next';
import { adminDb } from '@/lib/firebase-admin';
import { getEvidenceAuditTrail } from '@/lib/documents/evidence-service';
import VerificationConsoleClient from './components/VerificationConsoleClient';
import type { Contract } from '@/lib/types';
import type { SigningEnvelope } from '@/lib/types/document-signing';

interface PageProps {
  params: Promise<{ envelopeId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { envelopeId } = await params;
  return {
    title: `Verify Document ${envelopeId.substring(0, 10)} | SmartSapp Integrity Ledger`,
    description: 'Cryptographic document verification and tamper-evident audit trail.',
  };
}

export default async function VerifyPage({ params }: PageProps) {
  const { envelopeId } = await params;

  // 1. Resolve signing envelope or legacy contract record
  let envelopeData: SigningEnvelope | null = null;
  let contractData: Partial<Contract> | null = null;
  let resolvedEnvelopeId = envelopeId;

  // Check signing_envelopes first (Phase 2 canonical collection)
  const envelopeDoc = await adminDb.collection('signing_envelopes').doc(envelopeId).get();
  if (envelopeDoc.exists) {
    envelopeData = envelopeDoc.data() as SigningEnvelope;
  }

  // If not found in signing_envelopes, check contracts collection (backwards compatibility)
  if (!envelopeData) {
    const contractDoc = await adminDb.collection('contracts').doc(envelopeId).get();
    if (contractDoc.exists) {
      contractData = { id: contractDoc.id, ...contractDoc.data() } as Contract;
    } else {
      // Check if envelopeId is a submissionId in contracts
      const subQuery = await adminDb
        .collection('contracts')
        .where('submissionId', '==', envelopeId)
        .limit(1)
        .get();
      if (!subQuery.empty) {
        contractData = { id: subQuery.docs[0].id, ...subQuery.docs[0].data() } as Contract;
        resolvedEnvelopeId = subQuery.docs[0].id;
      }
    }
  }

  // 2. Fetch immutable audit trail
  const auditTrail = await getEvidenceAuditTrail(resolvedEnvelopeId);

  // If neither envelope nor contract nor evidence records exist, return 404
  if (!envelopeData && !contractData && auditTrail.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center space-y-4 shadow-sm">
          <div className="h-12 w-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto font-bold text-xl">
            ?
          </div>
          <h1 className="text-lg font-black">Verification Record Not Found</h1>
          <p className="text-xs text-slate-500 leading-relaxed">
            No cryptographic signing ledger exists for envelope ID:
            <br />
            <span className="font-mono font-bold text-slate-700 dark:text-slate-300 break-all">{envelopeId}</span>
          </p>
        </div>
      </div>
    );
  }

  // 3. Resolve signers from envelope, contract recipients, or audit trail
  interface SignerDisplay {
    name: string;
    email: string;
    signedAt?: string;
    ipAddress?: string;
    signatureHash?: string;
  }

  let signers: SignerDisplay[] = [];

  if (envelopeData) {
    signers = envelopeData.recipients.map((r) => ({
      name: r.name,
      email: r.email || '',
      signedAt: r.signedAt,
      ipAddress: r.ipAddress,
      signatureHash: r.signatureHash,
    }));
  } else if (contractData) {
    signers = (contractData.recipients || []).map((r) => ({
      name: r.name,
      email: r.email || '',
      signedAt: contractData?.signedAt,
      signatureHash: contractData?.documentDigest,
    }));
  }

  if (signers.length === 0) {
    // Reconstruct signers from 'signed' audit events if no explicit recipients array
    const signedEvents = auditTrail.filter((e) => e.action === 'signed');
    for (const ev of signedEvents) {
      signers.push({
        name: ev.recipientName || 'Signatory',
        email: ev.recipientEmail || '',
        signedAt: ev.timestamp,
        ipAddress: ev.ipAddress,
        signatureHash: ev.documentDigest,
      });
    }
  }

  // Pre-execution digest from initial created event or envelope/contract
  const createdEvent = auditTrail.find((e) => e.action === 'created');
  const completedEvent = auditTrail.find((e) => e.action === 'completed');

  const preExecutionSha256 =
    envelopeData?.preExecutionSha256 || createdEvent?.documentDigest || '';
  const postExecutionSha256 =
    envelopeData?.completedSha256 ||
    completedEvent?.documentDigest ||
    contractData?.documentDigest ||
    (auditTrail.length > 0 ? auditTrail[auditTrail.length - 1].documentDigest : undefined);

  return (
    <VerificationConsoleClient
      envelopeId={resolvedEnvelopeId}
      title={envelopeData?.title || contractData?.pdfName || 'Executed Legal Document'}
      status={envelopeData?.status || contractData?.status || 'signed'}
      createdAt={envelopeData?.createdAt || contractData?.createdAt || auditTrail[0]?.timestamp || new Date().toISOString()}
      completedAt={envelopeData?.completedAt || contractData?.signedAt || completedEvent?.timestamp}
      preExecutionSha256={preExecutionSha256}
      postExecutionSha256={postExecutionSha256}
      downloadUrl={envelopeData?.completedDocumentStoragePath || envelopeData?.documentStoragePath || contractData?.storagePath}
      signers={signers}
      auditTrail={auditTrail}
    />
  );
}
