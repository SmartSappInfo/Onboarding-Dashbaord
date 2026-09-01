import * as React from 'react';
import { WorkforceIntelligenceClient } from './WorkforceIntelligenceClient';

export const metadata = {
  title: 'Workforce Intelligence & Executive Analytics | SmartSapp Workforce',
  description: 'Organizational health index, squad utilization, entitlement density, and AI strategic insights',
};

export default function AdminWorkforceIntelligencePage() {
  return <WorkforceIntelligenceClient />;
}
