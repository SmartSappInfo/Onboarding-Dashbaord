const fs = require('fs');
const file = 'src/app/admin/messaging/call-centre/scripts/new/ScriptBuilderClient.tsx';
let content = fs.readFileSync(file, 'utf-8');

const queries = `  const portalsQuery = useMemoFirebase(() => {
    if (!firestore || !organizationId) return null;
    return query(
      collection(firestore, 'portals'),
      where('organizationId', '==', organizationId),
      limit(50)
    );
  }, [firestore, organizationId]);
  const { data: portalsData } = useCollection<{ id: string; name: string }>(portalsQuery);

  const plansQuery = useMemoFirebase(() => {
    if (!firestore || !organizationId) return null;
    return query(
      collection(firestore, 'membership_plans'),
      where('organizationId', '==', organizationId),
      limit(100)
    );
  }, [firestore, organizationId]);
  const { data: plansData } = useCollection<{ id: string; name: string; portalId: string }>(plansQuery);

  const meetingsQuery`;

content = content.replace('  const meetingsQuery', queries);

const dataSources = `    callCampaigns: callCampaignsData ?? [],
    workspaceUsers: workspaceUsers,
    portals: portalsData ?? [],
    membershipPlans: plansData ?? [],
  }), [tagsData, stagesData, pipelinesData, activeMeetings, callCampaignsData, workspaceUsers, portalsData, plansData]);`;

content = content.replace(/    callCampaigns: callCampaignsData \?\? \[\],\n    workspaceUsers,\n  }\), \[tagsData, stagesData, pipelinesData, activeMeetings, callCampaignsData, workspaceUsers\]\);/g, dataSources);

fs.writeFileSync(file, content);
