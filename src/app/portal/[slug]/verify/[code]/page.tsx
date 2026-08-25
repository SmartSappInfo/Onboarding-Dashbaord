/**
 * {{Org_name}} Experience Platform — Public Certificate Verification Server Page
 *
 * Route: /portal/[slug]/verify/[code]
 * Publicly accessible route for validating certificate authenticity, recipient details,
 * and Open Badges 3.0 export without requiring login.
 */

import { notFound } from 'next/navigation';
import { PortalService } from '@/lib/services/portal-service';
import { CredentialService } from '@/lib/services/credential-service';
import { PortalVerifyClient } from './PortalVerifyClient';

interface PageProps {
  params: Promise<{
    slug: string;
    code: string;
  }>;
}

export default async function PortalVerifyPage({ params }: PageProps) {
  const { slug, code } = await params;

  const portal = await PortalService.getPortalBySlug(slug);
  if (!portal) {
    notFound();
  }

  const verificationResult = await CredentialService.verifyCertificate(code);

  return (
    <PortalVerifyClient
      portal={portal}
      certificate={verificationResult.certificate || null}
      verificationCode={code}
      isValid={verificationResult.isValid}
      message={verificationResult.message}
    />
  );
}
