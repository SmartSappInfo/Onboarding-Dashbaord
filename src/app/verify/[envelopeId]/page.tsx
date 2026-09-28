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
import { notFound } from 'next/navigation';
import { adminDb } from '@/lib/firebase-admin';
import { getEvidenceAuditTrail } from '@/lib/documents/evidence-service';
import VerificationConsoleClient from './components/VerificationConsoleClient';
import type { Contract } from '@/lib/types';
import type { EvidenceAuditLogEntry } from '@/lib/types/document-signing';

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

  // 1. Resolve contract or envelope record
  let contractData: Partial<Contract> | null = null;
  let resolvedEnvelopeId = envelopeId;

  const contractDoc = await adminDb.collection('contracts').doc(envelopeId).get();
  if (contractDoc.exists) {
    contractData = { id: contractDoc.id, ...contractDoc.data() } as Contract;
  } else {
    // Check if envelopeId is a submissionId
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

  // 2. Fetch immutable audit trail
  const auditTrail = await getEvidenceAuditTrail(resolvedEnvelopeId);

  // If no contract and no evidence records exist, return 404
  if (!contractData && auditTrail.length === 0) {
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

  // 3. Resolve signers from contract recipients or audit trail
  interface SignerDisplay {
    name: string;
    email: string;
    signedAt?: string;
    ipAddress?: string;
    signatureHash?: string;
  }

  const signers: SignerDisplay[] = (contractData?.recipients || []).map((r) => ({
    name: r.name,
    email: r.email || '',
    signedAt: contractData?.signedAt,
    signatureHash: contractData?.documentDigest,
  }));

  if (signers.length === 0) {
    // Reconstruct signers from 'signed' audit events if contract had no explicit recipients array
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

  // Pre-execution digest from initial created event or contract
  const createdEvent = auditTrail.find((e) => e.action === 'created');
  const completedEvent = auditTrail.find((e) => e.action === 'completed');

  const preExecutionSha256 = createdEvent?.documentDigest || '';
  const postExecutionSha256 =
    completedEvent?.documentDigest || contractData?.documentDigest || (auditTrail.length > 0 ? auditTrail[auditTrail.length - 1].documentDigest : undefined);

  return (
    <VerificationConsoleClient
      envelopeId={resolvedEnvelopeId}
      title={contractData?.pdfName || 'Executed Legal Document'}
      status={contractData?.status || 'signed'}
      createdAt={contractData?.createdAt || auditTrail[0]?.timestamp || new Date().toISOString()}
      completedAt={contractData?.signedAt || completedEvent?.timestamp}
      preExecutionSha256={preExecutionSha256}
      postExecutionSha256={postExecutionSha256}
      downloadUrl={contractData?.storagePath}
      signers={signers}
      auditTrail={auditTrail}
    />
  );
}
