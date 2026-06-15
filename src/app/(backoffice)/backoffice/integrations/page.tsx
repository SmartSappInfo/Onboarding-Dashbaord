import WhatsAppRegistryClient from './WhatsAppRegistryClient';

/**
 * Backoffice WhatsApp Registry — platform-wide view of every organization's
 * WhatsApp Business connection (redacted; no secrets). System admin only.
 */
export default function WhatsAppIntegrationsPage() {
  return <WhatsAppRegistryClient />;
}
