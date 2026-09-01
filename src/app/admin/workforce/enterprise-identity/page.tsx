import * as React from 'react';
import { EnterpriseIdentityClient } from './EnterpriseIdentityClient';

export const metadata = {
  title: 'Enterprise Identity & Federation | SmartSapp Workforce',
  description: 'Single Sign-On (SAML/OIDC), WebAuthn Passkeys, SCIM 2.0 Directory Sync, and Session Policies',
};

export default function AdminEnterpriseIdentityPage() {
  return <EnterpriseIdentityClient />;
}
