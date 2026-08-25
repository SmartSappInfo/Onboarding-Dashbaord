'use client';

/**
 * {{Org_name}} Experience Platform — Admin Credentials & Badges Studio Manager
 *
 * Dedicated studio tab inside Portal Studio for Certificate Templates,
 * Issued Certificates Ledger, Badges Engine, and xAPI Statements Stream.
 */

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  listCertificateTemplatesAction,
  createCertificateTemplateAction,
  listIssuedCertificatesAction,
  revokeCertificateAction,
  listBadgeDefinitionsAction,
  createBadgeDefinitionAction,
  listXApiStatementsAction,
} from '@/app/actions/credential-actions';
import type {
  CertificateTemplate,
  IssuedCertificate,
  BadgeDefinition,
  XApiStatement,
  CertificateLayout,
  BadgeCriteriaType,
} from '@/lib/types/credentials';
import {
  Award,
  ShieldCheck,
  Medal,
  Activity,
  Plus,
  Copy,
  ExternalLink,
  Ban,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Layers,
  Sparkles,
  FileCheck,
} from 'lucide-react';

interface PortalCredentialManagerProps {
  portalId: string;
  portalSlug: string;
  organizationId: string;
  workspaceIds?: string[];
}

export function PortalCredentialManager({
  portalId,
  portalSlug,
  organizationId,
}: PortalCredentialManagerProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = React.useState('certificates');

  // Templates State
  const [templates, setTemplates] = React.useState<CertificateTemplate[]>([]);
  const [isCreateTemplateOpen, setIsCreateTemplateOpen] = React.useState(false);
  const [templateTitle, setTemplateTitle] = React.useState('');
  const [templateLayout, setTemplateLayout] = React.useState<CertificateLayout>('classic_gold');
  const [issuerName, setIssuerName] = React.useState('Executive Academy Dean');
  const [issuerTitle, setIssuerTitle] = React.useState('Director of Professional Learning');
  const [isSavingTemplate, setIsSavingTemplate] = React.useState(false);

  // Issued Certificates State
  const [issuedCerts, setIssuedCerts] = React.useState<IssuedCertificate[]>([]);
  const [isLoadingCerts, setIsLoadingCerts] = React.useState(false);
  const [revokeCertId, setRevokeCertId] = React.useState<string | null>(null);
  const [revokeReason, setRevokeReason] = React.useState('');
  const [isRevoking, setIsRevoking] = React.useState(false);

  // Badges State
  const [badges, setBadges] = React.useState<BadgeDefinition[]>([]);
  const [isCreateBadgeOpen, setIsCreateBadgeOpen] = React.useState(false);
  const [badgeTitle, setBadgeTitle] = React.useState('');
  const [badgeDescription, setBadgeDescription] = React.useState('');
  const [badgeIcon, setBadgeIcon] = React.useState('🏅');
  const [badgeCriteria, setBadgeCriteria] = React.useState<BadgeCriteriaType>('course_completion');
  const [badgeThreshold, setBadgeThreshold] = React.useState(1);
  const [badgePoints, setBadgePoints] = React.useState(100);
  const [isSavingBadge, setIsSavingBadge] = React.useState(false);

  // xAPI Statements State
  const [xApiLogs, setXApiLogs] = React.useState<XApiStatement[]>([]);

  // ── Load Data ──────────────────────────────────────────────────────────────

  const loadData = React.useCallback(async () => {
    setIsLoadingCerts(true);
    try {
      const [tRes, cRes, bRes, xRes] = await Promise.all([
        listCertificateTemplatesAction(portalId),
        listIssuedCertificatesAction(portalId),
        listBadgeDefinitionsAction(portalId),
        listXApiStatementsAction(portalId),
      ]);

      if (tRes.success && tRes.data) setTemplates(tRes.data);
      if (cRes.success && cRes.data) setIssuedCerts(cRes.data);
      if (bRes.success && bRes.data) setBadges(bRes.data);
      if (xRes.success && xRes.data) setXApiLogs(xRes.data);
    } catch (err: any) {
      toast({ title: 'Data Load Failed', description: err?.message });
    } finally {
      setIsLoadingCerts(false);
    }
  }, [portalId, toast]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateTitle.trim()) return;

    setIsSavingTemplate(true);
    try {
      const res = await createCertificateTemplateAction(
        {
          organizationId,
          portalId,
          title: templateTitle.trim(),
          layout: templateLayout,
          issuerName: issuerName.trim(),
          issuerTitle: issuerTitle.trim(),
          hasQrVerification: true,
        },
        portalSlug
      );

      if (!res.success) throw new Error(res.error);

      toast({ title: 'Template Created! 📜', description: 'Available for automated course issuance.' });
      setIsCreateTemplateOpen(false);
      setTemplateTitle('');
      loadData();
    } catch (err: any) {
      toast({ title: 'Save Failed', description: err?.message });
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokeCertId || !revokeReason.trim()) return;

    setIsRevoking(true);
    try {
      const res = await revokeCertificateAction(revokeCertId, revokeReason.trim(), portalId);
      if (!res.success) throw new Error(res.error);

      toast({ title: 'Certificate Revoked', description: 'Public verification will now reflect revoked status.' });
      setRevokeCertId(null);
      setRevokeReason('');
      loadData();
    } catch (err: any) {
      toast({ title: 'Revocation Failed', description: err?.message });
    } finally {
      setIsRevoking(false);
    }
  };

  const handleCreateBadge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!badgeTitle.trim()) return;

    setIsSavingBadge(true);
    try {
      const res = await createBadgeDefinitionAction(
        {
          organizationId,
          portalId,
          title: badgeTitle.trim(),
          description: badgeDescription.trim(),
          icon: badgeIcon.trim() || '🏅',
          criteriaType: badgeCriteria,
          criteriaThreshold: badgeThreshold,
          pointsReward: badgePoints,
        },
        portalSlug
      );

      if (!res.success) throw new Error(res.error);

      toast({ title: 'Badge Definition Saved! 🎖️', description: 'Ready for automated learner gamification.' });
      setIsCreateBadgeOpen(false);
      setBadgeTitle('');
      setBadgeDescription('');
      loadData();
    } catch (err: any) {
      toast({ title: 'Badge Creation Failed', description: err?.message });
    } finally {
      setIsSavingBadge(false);
    }
  };

  const copyVerifyUrl = (code: string) => {
    const url = typeof window !== 'undefined' ? `${window.location.origin}/portal/${portalSlug}/verify/${code}` : `/portal/${portalSlug}/verify/${code}`;
    navigator.clipboard.writeText(url);
    toast({ title: 'Verification URL Copied! 🔗', description: url });
  };

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-muted/20 border border-border">
        <div>
          <h3 className="font-extrabold text-base text-foreground flex items-center gap-2">
            <Award className="w-4 h-4 text-primary" /> Credentials & Learning Interoperability
          </h3>
          <p className="text-xs text-muted-foreground">
            Verifiable Certificates, Open Badges 3.0 W3C JSON-LD export, and xAPI statement streams.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setIsCreateTemplateOpen(true)}
            className="rounded-xl font-bold text-xs bg-primary text-white gap-1.5 shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" /> New Template
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsCreateBadgeOpen(true)}
            className="rounded-xl font-bold text-xs gap-1.5 shadow-2xs"
          >
            <Medal className="w-3.5 h-3.5" /> New Badge
          </Button>
        </div>
      </div>

      {/* ── Main Studio Tabs ────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full h-11 p-1 bg-muted/60 rounded-2xl grid grid-cols-4">
          <TabsTrigger value="certificates" className="rounded-xl text-xs font-bold gap-1.5">
            <FileCheck className="w-3.5 h-3.5" /> Issued ({issuedCerts.length})
          </TabsTrigger>
          <TabsTrigger value="templates" className="rounded-xl text-xs font-bold gap-1.5">
            <Layers className="w-3.5 h-3.5" /> Templates ({templates.length})
          </TabsTrigger>
          <TabsTrigger value="badges" className="rounded-xl text-xs font-bold gap-1.5">
            <Medal className="w-3.5 h-3.5" /> Badges ({badges.length})
          </TabsTrigger>
          <TabsTrigger value="xapi" className="rounded-xl text-xs font-bold gap-1.5">
            <Activity className="w-3.5 h-3.5" /> xAPI Stream ({xApiLogs.length})
          </TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Issued Certificates Ledger ───────────────────────── */}
        <TabsContent value="certificates" className="space-y-4 mt-6">
          {issuedCerts.length === 0 ? (
            <div className="p-10 text-center border-2 border-dashed rounded-3xl space-y-3 bg-muted/10">
              <Award className="w-10 h-10 mx-auto text-muted-foreground/60" />
              <h4 className="font-bold text-sm">No Issued Certificates Yet</h4>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Certificates are automatically conferred when students complete 100% of a course pathway.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {issuedCerts.map(cert => (
                <Card
                  key={cert.id}
                  className="p-4 rounded-2xl border border-border bg-card shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-foreground">{cert.recipientName}</span>
                      <Badge
                        className={`text-[10px] font-bold ${
                          cert.status === 'issued'
                            ? 'bg-emerald-500/10 text-emerald-600'
                            : 'bg-destructive/10 text-destructive'
                        }`}
                      >
                        {cert.status.toUpperCase()}
                      </Badge>
                      <span className="text-xs font-mono font-bold text-primary">
                        {cert.verificationCode}
                      </span>
                    </div>

                    <div className="text-xs text-muted-foreground flex flex-wrap gap-2">
                      <span>Course: {cert.courseTitle}</span>
                      <span>•</span>
                      <span>Issued: {new Date(cert.issueDate).toLocaleDateString()}</span>
                      {cert.scoreAchievedPercent && (
                        <>
                          <span>•</span>
                          <span className="font-semibold text-foreground">
                            Score: {cert.scoreAchievedPercent}%
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyVerifyUrl(cert.verificationCode)}
                      className="h-8 text-xs font-bold gap-1 rounded-xl shadow-2xs"
                    >
                      <Copy className="w-3.5 h-3.5" /> Verification URL
                    </Button>

                    <a
                      href={`/portal/${portalSlug}/verify/${cert.verificationCode}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs font-bold gap-1 rounded-xl"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> View
                      </Button>
                    </a>

                    {cert.status === 'issued' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setRevokeCertId(cert.id)}
                        className="h-8 text-xs text-destructive hover:bg-destructive/10 rounded-xl"
                      >
                        <Ban className="w-3.5 h-3.5" /> Revoke
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Tab 2: Certificate Templates ────────────────────────────── */}
        <TabsContent value="templates" className="space-y-4 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates.map(tmpl => (
              <Card key={tmpl.id} className="p-5 rounded-3xl border border-border bg-card shadow-2xs space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-extrabold text-sm text-foreground">{tmpl.title}</h4>
                    <p className="text-xs text-muted-foreground">
                      Layout: <span className="font-semibold capitalize">{tmpl.layout.replace('_', ' ')}</span>
                    </p>
                  </div>
                  <Badge className="bg-primary/10 text-primary text-[10px]">QR Verification</Badge>
                </div>

                <div className="p-3 rounded-2xl bg-muted/20 border border-border text-xs space-y-1">
                  <div className="text-muted-foreground">
                    Issuer: <span className="font-bold text-foreground">{tmpl.issuerName}</span>
                  </div>
                  <div className="text-muted-foreground">
                    Title: <span className="text-foreground">{tmpl.issuerTitle}</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ── Tab 3: Gamification Badges ──────────────────────────────── */}
        <TabsContent value="badges" className="space-y-4 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {badges.map(b => (
              <Card key={b.id} className="p-4 rounded-2xl border border-border bg-card shadow-2xs space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-xl">
                    {b.icon}
                  </div>
                  <div>
                    <span className="font-bold text-xs text-foreground block">{b.title}</span>
                    <Badge variant="outline" className="text-[9px] py-0 capitalize">
                      {b.criteriaType.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground line-clamp-2">{b.description}</p>
                <div className="pt-2 border-t border-border flex items-center justify-between text-[11px] font-semibold text-primary">
                  <span>Threshold: {b.criteriaThreshold}</span>
                  <span>+{b.pointsReward} Pts</span>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ── Tab 4: xAPI Statements Stream ───────────────────────────── */}
        <TabsContent value="xapi" className="space-y-4 mt-6">
          <div className="space-y-2">
            {xApiLogs.map((log, idx) => (
              <Card key={idx} className="p-3 rounded-2xl border border-border bg-card shadow-2xs text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="font-bold text-foreground">{log.actor.name}</span>
                  <Badge variant="outline" className="text-[9px] uppercase">
                    {log.verb.display['en-US'] || 'action'}
                  </Badge>
                  <span className="text-muted-foreground truncate max-w-[240px]">
                    {log.object.definition.name['en-US']}
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Create Template Modal ────────────────────────────────────── */}
      <Dialog open={isCreateTemplateOpen} onOpenChange={setIsCreateTemplateOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6 space-y-4">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">New Certificate Template</DialogTitle>
            <DialogDescription className="text-xs">
              Configure visual layout and signing authority for credentials.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateTemplate} className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs font-bold">Template Title</Label>
              <Input
                value={templateTitle}
                onChange={e => setTemplateTitle(e.target.value)}
                placeholder="e.g. Executive Bursar Certificate"
                className="h-10 text-xs rounded-xl"
                required
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold">Visual Layout</Label>
              <select
                value={templateLayout}
                onChange={e => setTemplateLayout(e.target.value as CertificateLayout)}
                className="w-full h-10 px-3 rounded-xl border border-border text-xs bg-background"
              >
                <option value="classic_gold">Classic Gold Border</option>
                <option value="executive_navy">Executive Navy Accent</option>
                <option value="modern_minimal">Modern Minimalist</option>
                <option value="academic_crest">Academic Crest</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold">Issuer Name</Label>
                <Input
                  value={issuerName}
                  onChange={e => setIssuerName(e.target.value)}
                  className="h-10 text-xs rounded-xl"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold">Issuer Title</Label>
                <Input
                  value={issuerTitle}
                  onChange={e => setIssuerTitle(e.target.value)}
                  className="h-10 text-xs rounded-xl"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={isSavingTemplate}
              className="w-full h-10 rounded-xl font-bold text-xs bg-primary text-white"
            >
              {isSavingTemplate ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Template'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Create Badge Modal ───────────────────────────────────────── */}
      <Dialog open={isCreateBadgeOpen} onOpenChange={setIsCreateBadgeOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6 space-y-4">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">New Gamification Badge</DialogTitle>
            <DialogDescription className="text-xs">
              Configure achievement trigger criteria and point rewards.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateBadge} className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs font-bold">Badge Title</Label>
              <Input
                value={badgeTitle}
                onChange={e => setBadgeTitle(e.target.value)}
                placeholder="e.g. Master Auditor"
                className="h-10 text-xs rounded-xl"
                required
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold">Description</Label>
              <Input
                value={badgeDescription}
                onChange={e => setBadgeDescription(e.target.value)}
                placeholder="Awarded for achieving 100% on course audit assessment"
                className="h-10 text-xs rounded-xl"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold">Icon Emoji</Label>
                <Input
                  value={badgeIcon}
                  onChange={e => setBadgeIcon(e.target.value)}
                  placeholder="🏅"
                  className="h-10 text-xs rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold">Trigger Criteria</Label>
                <select
                  value={badgeCriteria}
                  onChange={e => setBadgeCriteria(e.target.value as BadgeCriteriaType)}
                  className="w-full h-10 px-3 rounded-xl border border-border text-xs bg-background"
                >
                  <option value="course_completion">Course Completion</option>
                  <option value="assessment_perfection">100% Quiz Score</option>
                  <option value="community_contributor">Community Posts</option>
                  <option value="event_attendance">Live Workshop Attendee</option>
                </select>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isSavingBadge}
              className="w-full h-10 rounded-xl font-bold text-xs bg-primary text-white"
            >
              {isSavingBadge ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Badge'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Revocation Dialog ────────────────────────────────────────── */}
      <Dialog open={!!revokeCertId} onOpenChange={open => !open && setRevokeCertId(null)}>
        <DialogContent className="max-w-md rounded-3xl p-6 space-y-4">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-destructive flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Revoke Certificate
            </DialogTitle>
            <DialogDescription className="text-xs">
              This will permanently invalidate public verification for this credential.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs font-bold">Revocation Reason</Label>
              <Input
                value={revokeReason}
                onChange={e => setRevokeReason(e.target.value)}
                placeholder="e.g. Assessment violation / Administrative audit"
                className="h-10 text-xs rounded-xl"
                required
              />
            </div>

            <Button
              onClick={handleRevoke}
              disabled={isRevoking || !revokeReason.trim()}
              className="w-full h-10 rounded-xl font-bold text-xs bg-destructive text-white hover:bg-destructive/90"
            >
              {isRevoking ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Revocation'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
