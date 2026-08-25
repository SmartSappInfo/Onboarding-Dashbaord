import React from 'react';
import { z } from 'zod';
import { Award, CheckCircle2, Download, ExternalLink, ShieldCheck } from 'lucide-react';
import { registerBlock } from '../../registry';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const certSchema = z.object({
  id: z.string(),
  title: z.string().default('Certified Education Finance Specialist'),
  recipientName: z.string().default('Kwame Mensah'),
  issueDate: z.string().default('February 14, 2026'),
  credentialId: z.string().default('SMARTSAPP-CERT-2026-8891'),
  issuer: z.string().default('SmartSapp Global Academy'),
  badgeImageUrl: z.string().default(''),
  verifyUrl: z.string().default('#'),
});

const schema = z.object({
  heading: z.string().default('Verifiable Certificates & Badges'),
  subtitle: z.string().default('Earn recognized industry credentials upon mastering educational tracks.'),
  certificates: z.array(certSchema).default([]),
}).catchall(z.unknown());

type CertificatesProps = z.infer<typeof schema>;

registerBlock({
  type: 'portal_certificates',
  label: 'Portal: Certificates Showcase',
  category: 'portal',
  icon: Award,
  fields: [
    { kind: 'text', key: 'heading', label: 'Section Heading' },
    { kind: 'textarea', key: 'subtitle', label: 'Subtitle' },
    {
      kind: 'list',
      key: 'certificates',
      label: 'Certificates',
      itemFields: [
        { kind: 'text', key: 'title', label: 'Certificate Title' },
        { kind: 'text', key: 'recipientName', label: 'Recipient Name' },
        { kind: 'text', key: 'issueDate', label: 'Issue Date' },
        { kind: 'text', key: 'credentialId', label: 'Credential ID' },
        { kind: 'text', key: 'issuer', label: 'Issuer' },
        { kind: 'image', key: 'badgeImageUrl', label: 'Badge Image URL' },
        { kind: 'text', key: 'verifyUrl', label: 'Verification URL' },
      ],
    },
  ],
  defaults: schema.parse({
    heading: 'Verifiable Certificates & Badges',
    subtitle: 'Cryptographically verifiable credentials conforming to open standard credentials.',
    certificates: [
      {
        id: '1',
        title: 'Mastery in Automated Tuition Invoicing',
        recipientName: 'Kwame Mensah',
        issueDate: 'February 14, 2026',
        credentialId: 'SMARTSAPP-CERT-2026-8891',
        issuer: 'SmartSapp Experience Platform',
        badgeImageUrl: '',
        verifyUrl: '#',
      },
    ],
  }),
  schema,
  render: (props: CertificatesProps, _block, ctx) => {
    const isDark = ctx.themeMode === 'dark';

    return (
      <section className="py-6 space-y-4 w-full">
        {(props.heading || props.subtitle) && (
          <div className="space-y-1">
            {props.heading && (
              <h3 className="text-xl font-bold tracking-tight text-foreground">{props.heading}</h3>
            )}
            {props.subtitle && (
              <p className="text-xs text-muted-foreground">{props.subtitle}</p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {props.certificates.map(cert => (
            <div
              key={cert.id}
              className={`p-6 rounded-3xl border-2 transition-all flex flex-col justify-between space-y-4 ${
                isDark ? 'border-amber-500/20 bg-amber-500/5' : 'border-amber-500/20 bg-amber-500/5 shadow-xs'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Award className="w-7 h-7" />
                </div>

                <div className="space-y-1">
                  <Badge variant="outline" className="text-[9px] font-bold uppercase border-amber-500/40 text-amber-600 dark:text-amber-400">
                    Official Credential
                  </Badge>
                  <h4 className="font-bold text-base text-foreground leading-snug">{cert.title}</h4>
                  <p className="text-xs text-muted-foreground">
                    Awarded to <strong className="text-foreground">{cert.recipientName}</strong>
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[11px] text-muted-foreground">
                <div>
                  <p className="font-mono text-[10px]">ID: {cert.credentialId}</p>
                  <p className="text-[10px] mt-0.5">Issued: {cert.issueDate}</p>
                </div>

                <div className="flex items-center gap-2">
                  <a href={cert.verifyUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" className="rounded-xl font-bold text-xs gap-1 min-h-[36px]">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Verify
                    </Button>
                  </a>
                  <Button size="sm" className="rounded-xl font-bold text-xs gap-1 bg-amber-500 text-white hover:bg-amber-600 min-h-[36px]">
                    <Download className="w-3.5 h-3.5" /> PDF
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  },
});
