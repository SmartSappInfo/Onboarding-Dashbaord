'use client';

/**
 * SmartSapp Experience Platform — Public Certificate Verification View
 *
 * Publicly accessible credential validation page.
 * Displays Verified Credential Shield, Graduate details, Course transcript,
 * Open Badges 3.0 JSON-LD export, and 1-click printable PDF view.
 */

import * as React from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { exportOpenBadgeAction } from '@/app/actions/credential-actions';
import type { IssuedCertificate, Portal } from '@/lib/types';
import {
  CheckCircle2,
  ShieldCheck,
  Printer,
  Share2,
  Download,
  AlertTriangle,
  Award,
  Calendar,
  Layers,
  GraduationCap,
  ExternalLink,
  Copy,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';

interface PortalVerifyClientProps {
  portal: Portal;
  certificate: IssuedCertificate | null;
  verificationCode: string;
  isValid: boolean;
  message: string;
}

export function PortalVerifyClient({
  portal,
  certificate,
  verificationCode,
  isValid,
  message,
}: PortalVerifyClientProps) {
  const { toast } = useToast();
  const [isExportingBadge, setIsExportingBadge] = React.useState(false);

  const brandName = portal.branding?.brandName || portal.name;
  const logoUrl = portal.branding?.logoUrl;

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      toast({
        title: 'Verification Link Copied! 🔗',
        description: 'Share this link with employers or professional networks.',
      });
    }
  };

  const handleDownloadOpenBadge = async () => {
    if (!certificate) return;
    setIsExportingBadge(true);
    try {
      const res = await exportOpenBadgeAction(certificate.id);
      if (!res.success || !res.data) throw new Error(res.error || 'Export failed.');

      const jsonStr = JSON.stringify(res.data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/ld+json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `open-badge-${certificate.verificationCode.toLowerCase()}.json`;
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: 'Open Badge 3.0 Exported! 🏅',
        description: 'W3C Verifiable Credential JSON saved to downloads.',
      });
    } catch (err: any) {
      toast({ title: 'Export Failed', description: err?.message });
    } finally {
      setIsExportingBadge(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/20 text-foreground flex flex-col justify-between py-8 px-4 sm:px-6 print:p-0 print:bg-white">
      {/* ── Top Navigation Bar ────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto w-full flex items-center justify-between pb-6 print:hidden">
        <Link href={`/portal/${portal.slug}`}>
          <Button variant="ghost" size="sm" className="rounded-xl text-xs font-bold gap-1.5">
            <ArrowLeft className="w-4 h-4" /> Back to {brandName}
          </Button>
        </Link>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyLink}
            className="rounded-xl text-xs font-bold gap-1.5 shadow-2xs"
          >
            <Copy className="w-3.5 h-3.5" /> Copy Link
          </Button>

          <Button
            size="sm"
            onClick={handlePrint}
            className="rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary/90 gap-1.5 shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" /> Print Certificate
          </Button>
        </div>
      </div>

      {/* ── Main Credential Validation Container ──────────────────────── */}
      <main className="max-w-4xl mx-auto w-full space-y-6">
        {/* Verification Status Banner */}
        <Card
          className={`p-5 rounded-3xl border-2 shadow-sm ${
            isValid
              ? 'border-emerald-500/30 bg-emerald-500/5'
              : 'border-destructive/30 bg-destructive/5'
          } print:hidden`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                  isValid
                    ? 'bg-emerald-500/10 text-emerald-600'
                    : 'bg-destructive/10 text-destructive'
                }`}
              >
                {isValid ? (
                  <ShieldCheck className="w-7 h-7" />
                ) : (
                  <AlertTriangle className="w-7 h-7" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-base text-foreground">
                    {isValid ? 'Official Verified Credential' : 'Invalid or Unverified Credential'}
                  </h3>
                  <Badge
                    className={`text-[10px] font-bold ${
                      isValid
                        ? 'bg-emerald-600 text-white'
                        : 'bg-destructive text-destructive-foreground'
                    }`}
                  >
                    {isValid ? 'VERIFIED' : 'UNVERIFIED'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground pt-0.5">{message}</p>
              </div>
            </div>

            {isValid && certificate && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadOpenBadge}
                disabled={isExportingBadge}
                className="rounded-xl text-xs font-bold gap-1.5 shadow-2xs self-start sm:self-auto bg-card"
              >
                <Download className="w-3.5 h-3.5" />
                {isExportingBadge ? 'Exporting...' : 'Open Badges 3.0 (JSON-LD)'}
              </Button>
            )}
          </div>
        </Card>

        {/* ── Printable Certificate Canvas ─────────────────────────────── */}
        {isValid && certificate && (
          <Card className="p-8 sm:p-12 rounded-3xl border-4 border-amber-600/30 bg-card shadow-xl relative overflow-hidden print:border-2 print:shadow-none print:m-0">
            {/* Background Guilloché / Corner Accents */}
            <div className="absolute top-0 right-0 w-36 h-36 bg-amber-500/5 rounded-bl-full pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-36 h-36 bg-amber-500/5 rounded-tr-full pointer-events-none" />

            <div className="relative space-y-8 text-center max-w-2xl mx-auto">
              {/* Issuing Academy Header */}
              <div className="space-y-2">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-600 mx-auto flex items-center justify-center shadow-inner">
                  <Award className="w-8 h-8" />
                </div>
                <p className="text-xs font-extrabold text-primary uppercase tracking-widest">
                  {brandName}
                </p>
                <h1 className="text-2xl sm:text-3xl font-serif font-bold text-foreground">
                  Certificate of Executive Mastery
                </h1>
                <p className="text-xs text-muted-foreground">
                  This official credential is proudly conferred upon
                </p>
              </div>

              {/* Recipient Name */}
              <div className="py-2 border-b-2 border-primary/30 max-w-md mx-auto">
                <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                  {certificate.recipientName}
                </h2>
              </div>

              {/* Course Title & Distinction */}
              <div className="space-y-2 text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-lg mx-auto">
                <p>
                  for successfully completing all rigorous curriculum modules, tactical practicals,
                  and verified checkpoint assessments in
                </p>
                <p className="font-extrabold text-foreground text-base sm:text-lg">
                  {certificate.courseTitle}
                </p>
                {certificate.scoreAchievedPercent && (
                  <Badge className="bg-amber-500/10 text-amber-700 border-amber-500/30 text-xs font-bold py-0.5">
                    Graduation Score: {certificate.scoreAchievedPercent}% Distinction
                  </Badge>
                )}
              </div>

              {/* Footer / Verification & Issuer Signatures */}
              <div className="pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-6 text-left">
                <div className="space-y-1 text-center sm:text-left">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                    Date Conferred
                  </span>
                  <span className="text-xs font-extrabold text-foreground">
                    {new Date(certificate.issueDate).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>

                <div className="space-y-1 text-center sm:text-center">
                  <div className="w-32 h-8 border-b border-muted-foreground/40 mx-auto flex items-center justify-center text-xs font-serif italic text-muted-foreground">
                    SmartSapp Faculty
                  </div>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                    Verified Signature
                  </span>
                </div>

                <div className="space-y-1 text-center sm:text-right">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                    Verification Code
                  </span>
                  <span className="text-xs font-mono font-extrabold text-primary">
                    {certificate.verificationCode}
                  </span>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* ── Curriculum Transcript Summary ────────────────────────────── */}
        {isValid && certificate && certificate.transcriptSnapshot && (
          <Card className="p-6 rounded-3xl border border-border bg-card shadow-sm space-y-4 print:hidden">
            <h4 className="font-extrabold text-sm text-foreground flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" /> Verified Academic Transcript Snapshot
            </h4>

            <div className="space-y-2">
              {certificate.transcriptSnapshot.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-2xl bg-muted/20 border border-border text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span className="font-bold text-foreground">{item.lessonTitle}</span>
                  </div>

                  <div className="flex items-center gap-3 text-muted-foreground">
                    {item.scorePercent && (
                      <span className="font-bold text-emerald-600">{item.scorePercent}%</span>
                    )}
                    <span className="text-[11px]">
                      {new Date(item.completedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </main>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="max-w-4xl mx-auto w-full pt-8 text-center text-xs text-muted-foreground print:hidden">
        Verified through {brandName} Experience Platform — Interoperable Open Badges 3.0 & xAPI Compliant.
      </footer>
    </div>
  );
}
