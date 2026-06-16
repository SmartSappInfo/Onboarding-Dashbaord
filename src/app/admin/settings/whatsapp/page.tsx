import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import { getBaseUrl } from '@/lib/utils/url-helpers';
import { PageContainer } from '@/components/ui/page-container';
import WhatsAppCredentialForm from '../components/WhatsAppCredentialForm';
import WhatsAppGuidePanel from '../components/WhatsAppGuidePanel';

export const metadata: Metadata = {
  title: 'WhatsApp Setup | Settings',
  description: 'Connect your organization’s WhatsApp Business Account (Meta Cloud API).',
};

/**
 * Dedicated WhatsApp (manual) setup page. Two columns: the credential form
 * (interactive, client) on the left, a static step-by-step guide (server-
 * rendered, no JS) on the right. The webhook callback URL is computed on the
 * server and passed to the guide.
 */
export default function WhatsAppSetupPage() {
  const webhookUrl = `${getBaseUrl()}/api/webhooks/whatsapp`;

  return (
    <PageContainer>
      <div className="space-y-6">
        <div className="space-y-2">
          <Link
            href="/admin/settings"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Settings
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <MessageCircle className="h-6 w-6 text-primary" /> WhatsApp Business Setup
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Connect your organization's own WhatsApp Business Account via the Meta Cloud API. Enter your
            credentials on the left; follow the guide on the right.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <WhatsAppCredentialForm />
          <WhatsAppGuidePanel webhookUrl={webhookUrl} />
        </div>
      </div>
    </PageContainer>
  );
}
