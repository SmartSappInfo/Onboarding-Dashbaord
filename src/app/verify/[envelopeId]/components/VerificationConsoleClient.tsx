'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Independent Public Verification Console:
 *    Allows signers, relying parties, auditors, and counterparties to verify the cryptographic
 *    authenticity and ESIGN/eIDAS compliance of any SmartSapp signed document.
 * 2. Client-Side Web Crypto Digest Verification:
 *    Calculates SHA-256 binary digests in the user's browser using `window.crypto.subtle`
 *    without uploading user files back to the server, verifying byte-for-byte immutability.
 * 3. Mobile & Accessibility First:
 *    Touch targets comply with >=44px, micro-interactions use `active:scale-[0.97]`.
 * 4. Strict Typing (Rule 4): Zero tolerance for `any` or `any[]`.
 */

import * as React from 'react';
import type { EvidenceAuditLogEntry } from '@/lib/types/document-signing';
import { 
  ShieldCheck, 
  ShieldAlert, 
  CheckCircle2, 
  Copy, 
  Check, 
  Upload, 
  Download,
  Clock, 
  Lock, 
  User, 
  Globe 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

export interface VerificationConsoleClientProps {
  envelopeId: string;
  title: string;
  status: string;
  createdAt: string;
  completedAt?: string;
  preExecutionSha256?: string;
  postExecutionSha256?: string;
  downloadUrl?: string;
  signers: Array<{
    name: string;
    email: string;
    signedAt?: string;
    ipAddress?: string;
    signatureHash?: string;
  }>;
  auditTrail: EvidenceAuditLogEntry[];
}

export default function VerificationConsoleClient({
  envelopeId,
  title,
  status,
  createdAt,
  completedAt,
  preExecutionSha256,
  postExecutionSha256,
  downloadUrl,
  signers,
  auditTrail,
}: VerificationConsoleClientProps) {
  const { toast } = useToast();
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);

  // In-browser client-side file verification state
  const [isVerifyingFile, setIsVerifyingFile] = React.useState(false);
  const [fileVerificationResult, setFileVerificationResult] = React.useState<{
    status: 'match' | 'mismatch' | 'error';
    computedHash: string;
    fileName: string;
  } | null>(null);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast({ title: 'Copied to Clipboard', description: text.substring(0, 32) + '...' });
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleFileDrop = async (e: React.DragEvent<HTMLDivElement> | React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    let file: File | undefined;

    if ('dataTransfer' in e && e.dataTransfer.files.length > 0) {
      file = e.dataTransfer.files[0];
    } else if ('target' in e && e.target instanceof HTMLInputElement && e.target.files && e.target.files.length > 0) {
      file = e.target.files[0];
    }

    if (!file) return;

    setIsVerifyingFile(true);
    setFileVerificationResult(null);

    try {
      const buffer = await file.arrayBuffer();
      const digestBuffer = await window.crypto.subtle.digest('SHA-256', buffer);
      const computedHash = Array.from(new Uint8Array(digestBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      const isMatch = !!postExecutionSha256 && computedHash.toLowerCase() === postExecutionSha256.toLowerCase();

      setFileVerificationResult({
        status: isMatch ? 'match' : 'mismatch',
        computedHash,
        fileName: file.name,
      });
    } catch (err: unknown) {
      console.error('File digest verification failed:', err);
      setFileVerificationResult({
        status: 'error',
        computedHash: '',
        fileName: file.name,
      });
    } finally {
      setIsVerifyingFile(false);
    }
  };

  const isCompleted = status.toLowerCase() === 'completed' || status.toLowerCase() === 'signed';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* ── 1. Hero Header & Trust Badge ───────────────────────────────────── */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <ShieldCheck className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight">Independent Verification Console</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Authoritative Cryptographic Evidence Ledger • ESIGN & eIDAS Standard
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              {downloadUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="rounded-xl h-8 px-3 text-xs font-bold gap-1.5 active:scale-[0.97]"
                >
                  <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
                    <Download className="h-3.5 w-3.5" />
                    <span>Download PDF</span>
                  </a>
                </Button>
              )}
              <Badge
                variant="outline"
                className={
                  isCompleted
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-3 py-1 font-bold text-xs'
                    : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 px-3 py-1 font-bold text-xs'
                }
              >
                {isCompleted ? 'Cryptographically Sealed' : 'Execution In Progress'}
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800/80">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Document Title</span>
              <span className="text-sm font-bold truncate block">{title}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Envelope ID</span>
              <span className="text-xs font-mono font-semibold text-slate-600 dark:text-slate-300 block truncate">
                {envelopeId}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                {completedAt ? 'Completed Date' : 'Created Date'}
              </span>
              <span className="text-xs font-semibold block text-slate-600 dark:text-slate-300">
                {format(new Date(completedAt || createdAt), 'MMM d, yyyy HH:mm')} UTC
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Execution Status</span>
              <span className="text-xs font-bold block text-emerald-600 dark:text-emerald-400">
                {isCompleted ? 'Executed & Certified' : 'Pending Signatures'}
              </span>
            </div>
          </div>
        </div>

        {/* ── 2. Cryptographic Document Fingerprints ─────────────────────────── */}
        <Card className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Lock className="h-4 w-4 text-primary" />
              Cryptographic SHA-256 Fingerprints
            </CardTitle>
            <CardDescription className="text-xs">
              Deterministic 256-bit hashes calculated before execution and after vector sealing. Any byte change produces a completely different digest.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {preExecutionSha256 && (
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Pre-Execution Template Digest</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(preExecutionSha256, 'pre')}
                    className="h-7 px-2 text-xs gap-1 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 active:scale-[0.97]"
                  >
                    {copiedKey === 'pre' ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                    <span>{copiedKey === 'pre' ? 'Copied' : 'Copy'}</span>
                  </Button>
                </div>
                <p className="font-mono text-xs text-slate-700 dark:text-slate-300 break-all select-all">
                  {preExecutionSha256}
                </p>
              </div>
            )}

            {postExecutionSha256 && (
              <div className="p-3.5 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-2xl border border-emerald-500/20 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                    Post-Execution Sealed Document Digest
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(postExecutionSha256, 'post')}
                    className="h-7 px-2 text-xs gap-1 rounded-lg text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 active:scale-[0.97]"
                  >
                    {copiedKey === 'post' ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                    <span>{copiedKey === 'post' ? 'Copied' : 'Copy'}</span>
                  </Button>
                </div>
                <p className="font-mono text-xs text-emerald-950 dark:text-emerald-200 font-semibold break-all select-all">
                  {postExecutionSha256}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── 3. In-Browser Integrity Verification Dropzone ──────────────────── */}
        <Card className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              Verify Your Local File Copy
            </CardTitle>
            <CardDescription className="text-xs">
              Drop your downloaded executed PDF here. Your browser computes its SHA-256 digest locally via Web Crypto API and checks it against the immutable record.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
              className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 text-center flex flex-col items-center justify-center gap-3 hover:border-emerald-500/50 hover:bg-emerald-500/[0.02] transition-colors cursor-pointer"
              onClick={() => document.getElementById('verify-file-input')?.click()}
            >
              <input
                id="verify-file-input"
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={handleFileDrop}
              />
              <div className="h-12 w-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                <Upload className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold">Drop your executed PDF here or click to browse</p>
                <p className="text-xs text-slate-400">PDF documents up to 50MB verified entirely client-side</p>
              </div>
            </div>

            {isVerifyingFile && (
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl text-center space-y-1">
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300">Computing SHA-256 digest in browser...</p>
              </div>
            )}

            {fileVerificationResult && (
              <div
                className={
                  fileVerificationResult.status === 'match'
                    ? 'p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-500/30 rounded-2xl space-y-2'
                    : 'p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-500/30 rounded-2xl space-y-2'
                }
              >
                <div className="flex items-center gap-2">
                  {fileVerificationResult.status === 'match' ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : (
                    <ShieldAlert className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0" />
                  )}
                  <p className="text-sm font-bold">
                    {fileVerificationResult.status === 'match'
                      ? 'Integrity Verified: Match Confirmed'
                      : 'Integrity Warning: Hash Mismatch'}
                  </p>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  {fileVerificationResult.status === 'match'
                    ? `File "${fileVerificationResult.fileName}" is byte-for-byte identical to the executed document certified by SmartSapp.`
                    : `File "${fileVerificationResult.fileName}" does not match the post-execution record. The file may have been modified or re-saved.`}
                </p>
                <div className="font-mono text-[11px] p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 break-all select-all">
                  Computed: {fileVerificationResult.computedHash}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── 4. Signatory Execution Details ─────────────────────────────────── */}
        <Card className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              Signatory Execution Ledger
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {signers.length === 0 ? (
              <p className="text-xs text-slate-500">No signatory execution events recorded yet.</p>
            ) : (
              signers.map((signer, idx) => (
                <div
                  key={idx}
                  className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm">{signer.name}</span>
                      <span className="text-xs text-slate-500 font-medium">&lt;{signer.email}&gt;</span>
                    </div>
                    {signer.signedAt && (
                      <span className="text-xs text-slate-500 font-medium">
                        {format(new Date(signer.signedAt), 'MMM d, yyyy HH:mm:ss')} UTC
                      </span>
                    )}
                  </div>
                  {signer.ipAddress && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Globe className="h-3.5 w-3.5" />
                      <span>IP Address: {signer.ipAddress}</span>
                    </div>
                  )}
                  {signer.signatureHash && (
                    <div className="text-[11px] font-mono text-slate-500 break-all">
                      Signature Hash: {signer.signatureHash}
                    </div>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* ── 5. Chronological Audit Trail ──────────────────────────────────── */}
        <Card className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Append-Only Audit Trail
            </CardTitle>
            <CardDescription className="text-xs">
              Every action in the document lifecycle is cryptographically recorded with actor identity and timestamp.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800 pl-8">
              {auditTrail.map((entry, idx) => (
                <div key={idx} className="relative space-y-1">
                  <div className="absolute -left-8 top-1 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" />
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs uppercase tracking-wide text-slate-900 dark:text-slate-100">
                      {entry.action.replace('_', ' ')}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {format(new Date(entry.timestamp), 'yyyy-MM-dd HH:mm:ss')} UTC
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Actor: {entry.recipientEmail || entry.recipientName || entry.ipAddress || 'System Protocol'}
                  </p>
                  {entry.documentDigest && (
                    <p className="text-[10px] font-mono text-slate-400 break-all">
                      Digest: {entry.documentDigest}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
