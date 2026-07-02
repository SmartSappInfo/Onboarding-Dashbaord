import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { LeadIntelligenceEngine } from '@/lib/lead-intelligence/LeadIntelligenceEngine';
import type { LeadIntelligenceSettings, Prospect } from '@/lib/lead-intelligence/types';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, HEAD',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { headers: corsHeaders });
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or malformed Authorization header' },
        { status: 401, headers: corsHeaders }
      );
    }
    const token = authHeader.substring(7);

    // 1. Resolve workspace from token query
    const settingsSnap = await adminDb.collection('system_settings')
      .where('chromeExtensionToken', '==', token)
      .limit(1)
      .get();

    if (settingsSnap.empty) {
      return NextResponse.json(
        { error: 'Invalid workspace API token' },
        { status: 401, headers: corsHeaders }
      );
    }

    const settingsDoc = settingsSnap.docs[0];
    const settings = settingsDoc.data() as LeadIntelligenceSettings & { workspaceId: string; organizationId: string };
    const workspaceId = settings.workspaceId;
    const organizationId = settings.organizationId;

    const urlParam = request.nextUrl.searchParams.get('url') || '';
    if (!urlParam) {
      return NextResponse.json(
        { error: 'url parameter is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    // 2. Extract clean domain
    const domain = extractDomain(urlParam);

    // 3. Check if this prospect already exists in the workspace
    const prospectsSnap = await adminDb.collection('prospects')
      .where('workspaceId', '==', workspaceId)
      .where('domain', '==', domain)
      .limit(1)
      .get();

    let prospect: Prospect;

    if (!prospectsSnap.empty) {
      prospect = prospectsSnap.docs[0].data() as Prospect;
    } else {
      // 4. Create and enrich a new unregistered prospect on-the-fly
      const rawProspect: Prospect = {
        id: `cscan_${workspaceId}_${Date.now()}`,
        organizationId,
        workspaceId,
        name: extractNameFromDomain(domain),
        domain,
        contacts: [],
        scoring: {
          overallScore: 50,
          needScore: 10,
          digitalMaturity: 8,
          buyingIntent: 12,
          budgetProbability: 10,
          decisionMakerFound: 5,
          engagement: 5
        },
        syncStatus: 'unregistered',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      prospect = await LeadIntelligenceEngine.enrichProspect(rawProspect, settings);

      // Save as unregistered prospect
      await adminDb.collection('prospects').doc(prospect.id).set(prospect);
    }

    return NextResponse.json({ prospect }, { status: 200, headers: corsHeaders });

  } catch (err: unknown) {
    console.error('[API:LEAD_INTEL:SCAN] Error:', err);
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json(
      { error: message },
      { status: 500, headers: corsHeaders }
    );
  }
}

function extractDomain(url: string): string {
  let hostname = url.trim();
  if (hostname.indexOf('://') > -1) {
    hostname = hostname.split('/')[2];
  } else {
    hostname = hostname.split('/')[0];
  }
  hostname = hostname.split(':')[0];
  hostname = hostname.split('?')[0];
  if (hostname.startsWith('www.')) {
    hostname = hostname.substring(4);
  }
  return hostname;
}

function extractNameFromDomain(domain: string): string {
  const parts = domain.split('.');
  const namePart = parts[0] || 'Unknown Business';
  return namePart.charAt(0).toUpperCase() + namePart.slice(1);
}
