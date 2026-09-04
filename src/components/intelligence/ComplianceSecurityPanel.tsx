'use client';

/**
 * @fileOverview CompanyBrain 2.0 Phase 10: Enterprise Multi-Tenant Security & Compliance Panel
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Cryptographic Right-to-be-Forgotten & Auditability:
 *    - Allows operators to generate SOC2 / GDPR audit snapshots and execute cascading deletions
 *      producing an immutable SHA-256 certificate.
 * 2. Mobile Touch Targets (Rule 7):
 *    - All buttons maintain `min-h-[44px]` touch targets.
 * 3. Emil Kowalski Micro-Interactions:
 *    - Buttons feature `active:scale-[0.97]` tactile transitions.
 * 4. Strict Zero-`any` Compliance (Rule 4):
 *    - Strongly typed with `ComplianceAuditReport` and `CryptographicDeletionCertificate`.
 *
 * @testability Covered in `src/lib/intelligence/__tests__/autonomous-intelligence.test.ts`.
 */

import * as React from 'react';
import {
  ShieldCheck,
  FileCheck2,
  Trash2,
  Download,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  Lock,
} from 'lucide-react';
import type {
  ComplianceAuditReport,
  CryptographicDeletionCertificate,
} from '@/lib/intelligence/types';
import { Button } from '@/components/ui/button';

interface ComplianceSecurityPanelProps {
  onVerifyTenantIsolation: () => Promise<{ confirmed: boolean; details: string }>;
  onGenerateAuditReport: () => Promise<ComplianceAuditReport>;
  onExecuteDeletion: (subjectId: string, subjectType: string) => Promise<CryptographicDeletionCertificate>;
  isVerifying?: boolean;
  isExporting?: boolean;
  isDeleting?: boolean;
}

export function ComplianceSecurityPanel({
  onVerifyTenantIsolation,
  onGenerateAuditReport,
  onExecuteDeletion,
  isVerifying,
  isExporting,
  isDeleting,
}: ComplianceSecurityPanelProps) {
  const [isolationResult, setIsolationResult] = React.useState<{
    confirmed: boolean;
    details: string;
  } | null>(null);

  const [lastReport, setLastReport] = React.useState<ComplianceAuditReport | null>(null);
  const [lastCertificate, setLastCertificate] = React.useState<CryptographicDeletionCertificate | null>(null);

  const [deletionSubjectId, setDeletionSubjectId] = React.useState('');
  const [deletionSubjectType, setDeletionSubjectType] = React.useState('entity');
  const [confirmDeletionModal, setConfirmDeletionModal] = React.useState(false);

  const handleVerify = async () => {
    const res = await onVerifyTenantIsolation();
    setIsolationResult(res);
  };

  const handleExport = async () => {
    const rep = await onGenerateAuditReport();
    setLastReport(rep);

    // Trigger instant JSON file download
    const blob = new Blob([JSON.stringify(rep, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `companybrain-compliance-audit-${rep.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExecuteDeletion = async () => {
    if (!deletionSubjectId) return;
    const cert = await onExecuteDeletion(deletionSubjectId, deletionSubjectType);
    setLastCertificate(cert);
    setConfirmDeletionModal(false);
    setDeletionSubjectId('');
  };

  return (
    <div className="space-y-6">
      {/* 1. Mathematical Tenant Isolation Card */}
      <div className="rounded-2xl border border-border/60 bg-card/90 p-4 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/40">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
                <Lock className="w-4 h-4" />
              </span>
              <h3 className="text-base font-bold text-foreground">
                Multi-Tenant Boundary Isolation Guard
              </h3>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Audits Firestore must-clauses and Qdrant vector space pre-filtering to guarantee zero cross-tenant bleeding.
            </p>
          </div>

          <Button
            onClick={handleVerify}
            disabled={isVerifying}
            variant="outline"
            className="min-h-[44px] px-4 rounded-xl text-xs font-semibold gap-2 active:scale-[0.97]"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            {isVerifying ? 'Probing Security Boundaries...' : 'Verify Tenant Isolation'}
          </Button>
        </div>

        {isolationResult && (
          <div
            className={`p-4 rounded-xl border flex items-start gap-3 ${
              isolationResult.confirmed
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-300'
            }`}
          >
            {isolationResult.confirmed ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            )}
            <div className="text-xs space-y-1">
              <p className="font-bold">
                {isolationResult.confirmed
                  ? 'Tenant Isolation Authenticated & Guaranteed'
                  : 'Boundary Violation Warning'}
              </p>
              <p className="opacity-90">{isolationResult.details}</p>
            </div>
          </div>
        )}
      </div>

      {/* 2. SOC2 / GDPR Audit Exporter & Cryptographic Deletion */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* Audit Exporter */}
        <div className="rounded-2xl border border-border/60 bg-card/90 p-4 sm:p-6 shadow-sm flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
                <FileCheck2 className="w-4 h-4" />
              </span>
              <h3 className="text-base font-bold text-foreground">
                SOC2 / GDPR Compliance Snapshot
              </h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Export an auditable, verifiable JSON package containing all memories, vector citations, and execution telemetry for compliance certification.
            </p>
          </div>

          {lastReport && (
            <div className="p-3 rounded-xl bg-muted/40 border border-border/40 font-mono text-[11px] text-muted-foreground break-all">
              <span className="font-bold text-foreground">SHA-256 Digest:</span> {lastReport.hashDigest}
            </div>
          )}

          <Button
            onClick={handleExport}
            disabled={isExporting}
            className="min-h-[44px] w-full rounded-xl text-xs font-semibold gap-2 active:scale-[0.97]"
          >
            <Download className="w-4 h-4" />
            {isExporting ? 'Compiling Audit Bundle...' : 'Export Verified Audit Package'}
          </Button>
        </div>

        {/* Cryptographic Right-to-be-Forgotten Deletion */}
        <div className="rounded-2xl border border-border/60 bg-card/90 p-4 sm:p-6 shadow-sm flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-rose-500/10 text-rose-500">
                <Trash2 className="w-4 h-4" />
              </span>
              <h3 className="text-base font-bold text-foreground">
                Cryptographic GDPR Article 17 Erasure
              </h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Permanently and completely eradicate all atomic memories, Qdrant vectors, and graph edges for an entity, issuing an immutable cryptographic certificate.
            </p>
          </div>

          {lastCertificate && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 font-mono text-[11px] text-emerald-600 dark:text-emerald-400 break-all space-y-1">
              <div className="font-bold flex items-center gap-1">
                <KeyRound className="w-3.5 h-3.5" /> Certificate #{lastCertificate.certificateId}
              </div>
              <div>Digest: {lastCertificate.sha256Digest.substring(0, 32)}...</div>
              <div>Eradicated: {lastCertificate.deletedMemoriesCount} memories, {lastCertificate.deletedVectorsCount} vectors.</div>
            </div>
          )}

          <Button
            variant="destructive"
            onClick={() => setConfirmDeletionModal(true)}
            className="min-h-[44px] w-full rounded-xl text-xs font-semibold gap-2 active:scale-[0.97]"
          >
            <Trash2 className="w-4 h-4" />
            Initiate Right-to-be-Forgotten Deletion
          </Button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmDeletionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="max-w-md w-full rounded-2xl border border-rose-500/30 bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-500">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h4 className="text-lg font-bold">Authorizing Permanent Erasure</h4>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              This action is permanent and irreversible. It will wipe all customer memories, dense vector points, and graph relations across the workspace.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-foreground">Target Subject ID (Entity/Lead ID):</label>
                <input
                  type="text"
                  placeholder="e.g. ent_12345 or lead_98765"
                  value={deletionSubjectId}
                  onChange={(e) => setDeletionSubjectId(e.target.value)}
                  className="mt-1 w-full min-h-[44px] px-3 text-xs rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">Subject Type:</label>
                <select
                  value={deletionSubjectType}
                  onChange={(e) => setDeletionSubjectType(e.target.value)}
                  className="mt-1 w-full min-h-[44px] px-3 text-xs rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-rose-500"
                >
                  <option value="entity">Entity (Company / Client)</option>
                  <option value="contact">Contact (Individual Person)</option>
                  <option value="deal">Deal Record</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border/40">
              <Button
                variant="ghost"
                onClick={() => setConfirmDeletionModal(false)}
                className="min-h-[44px] px-4 rounded-xl text-xs font-semibold"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleExecuteDeletion}
                disabled={isDeleting || !deletionSubjectId}
                className="min-h-[44px] px-5 rounded-xl text-xs font-semibold gap-2 active:scale-[0.97]"
              >
                {isDeleting ? 'Eradicating...' : 'Sign & Certify Deletion'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
