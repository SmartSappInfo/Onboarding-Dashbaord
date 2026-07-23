import { useMemo } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, where } from 'firebase/firestore';
import { useWorkspace } from '@/context/WorkspaceContext';
import type { UserProfile, OnboardingStage, VariableDefinition, Tag as TagType, Pipeline, Automation } from '@/lib/types';

export function useWorkspaceScopedQueries() {
  const firestore = useFirestore();
  const { activeWorkspaceId } = useWorkspace() as any;

  // Users - global config (authorized users)
  const usersQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, 'users'), where('isAuthorized', '==', true), orderBy('name', 'asc')) : null, 
    [firestore]
  );

  // Stages - global config
  const stagesQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, 'onboardingStages'), orderBy('order')) : null, 
    [firestore]
  );

  // Pipelines - workspace-scoped (workspaceIds array contains activeWorkspaceId)
  const pipelinesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    if (!activeWorkspaceId) {
      return query(collection(firestore, 'pipelines'), orderBy('name', 'asc'));
    }
    return query(collection(firestore, 'pipelines'), where('workspaceIds', 'array-contains', activeWorkspaceId), orderBy('name', 'asc'));
  }, [firestore, activeWorkspaceId]);

  // Variables - global config
  const varsQuery = useMemoFirebase(() => 
    firestore ? query(collection(firestore, 'messaging_variables')) : null, 
    [firestore]
  );

  // Tags - workspace-scoped
  const tagsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    if (!activeWorkspaceId) {
      console.warn('[useWorkspaceScopedQueries] activeWorkspaceId is undefined. Falling back to unscoped tags.');
      return query(collection(firestore, 'tags'), orderBy('name', 'asc'));
    }
    return query(collection(firestore, 'tags'), where('workspaceId', '==', activeWorkspaceId), orderBy('name', 'asc'));
  }, [firestore, activeWorkspaceId]);

  // Forms - workspace-scoped (workspaceIds array contains activeWorkspaceId)
  const formsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    if (!activeWorkspaceId) {
      console.warn('[useWorkspaceScopedQueries] activeWorkspaceId is undefined. Falling back to unscoped forms.');
      return query(collection(firestore, 'forms'), orderBy('name', 'asc'));
    }
    return query(collection(firestore, 'forms'), where('workspaceIds', 'array-contains', activeWorkspaceId), orderBy('name', 'asc'));
  }, [firestore, activeWorkspaceId]);

  // Surveys - workspace-scoped (workspaceIds array contains activeWorkspaceId)
  const surveysQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    if (!activeWorkspaceId) {
      console.warn('[useWorkspaceScopedQueries] activeWorkspaceId is undefined. Falling back to unscoped surveys.');
      return query(collection(firestore, 'surveys'), orderBy('internalName', 'asc'));
    }
    return query(collection(firestore, 'surveys'), where('workspaceIds', 'array-contains', activeWorkspaceId), orderBy('internalName', 'asc'));
  }, [firestore, activeWorkspaceId]);

  // Automations - workspace-scoped
  const automationsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    if (!activeWorkspaceId) {
      return query(collection(firestore, 'automations'), orderBy('name', 'asc'));
    }
    return query(collection(firestore, 'automations'), where('workspaceIds', 'array-contains', activeWorkspaceId), orderBy('name', 'asc'));
  }, [firestore, activeWorkspaceId]);

  // App Fields - workspace-scoped
  const appFieldsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    if (!activeWorkspaceId) {
      return query(collection(firestore, 'app_fields'), orderBy('name', 'asc'));
    }
    return query(collection(firestore, 'app_fields'), where('workspaceId', '==', activeWorkspaceId), orderBy('name', 'asc'));
  }, [firestore, activeWorkspaceId]);

  // Field Groups - workspace-scoped
  const groupsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    if (!activeWorkspaceId) {
      return query(collection(firestore, 'field_groups'), orderBy('order', 'asc'));
    }
    return query(collection(firestore, 'field_groups'), where('workspaceId', '==', activeWorkspaceId), orderBy('order', 'asc'));
  }, [firestore, activeWorkspaceId]);

  // Call Campaigns - workspace-scoped
  const campaignsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    if (!activeWorkspaceId) {
      return query(collection(firestore, 'call_campaigns'));
    }
    return query(collection(firestore, 'call_campaigns'), where('workspaceId', '==', activeWorkspaceId));
  }, [firestore, activeWorkspaceId]);

  const { data: users } = useCollection<UserProfile>(usersQuery);
  const { data: stages } = useCollection<OnboardingStage>(stagesQuery);
  const { data: pipelines } = useCollection<Pipeline>(pipelinesQuery);
  const { data: variables } = useCollection<VariableDefinition>(varsQuery);
  const { data: allTags } = useCollection<TagType>(tagsQuery);
  const { data: forms } = useCollection<{ id: string; name?: string; title?: string }>(formsQuery);
  const { data: surveys } = useCollection<{ id: string; internalName?: string; title?: string }>(surveysQuery);
  const { data: automations } = useCollection<Automation>(automationsQuery);
  const { data: appFields } = useCollection<any>(appFieldsQuery);
  const { data: fieldGroups } = useCollection<any>(groupsQuery);
  const { data: callCampaigns } = useCollection<{ id: string; name: string }>(campaignsQuery);

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    if (!activeWorkspaceId) return users;
    return users.filter(u => u.workspaceIds?.includes(activeWorkspaceId));
  }, [users, activeWorkspaceId]);

  const sortedCallCampaigns = useMemo(() => {
    if (!callCampaigns) return [];
    return [...callCampaigns].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [callCampaigns]);

  const meetingTypesList = useMemo(() => [
    { id: 'masterclass_fee', name: 'Masterclass Fee Collection' },
    { id: 'discovery_call', name: 'Discovery Call' },
    { id: 'onboarding_session', name: 'Onboarding Session' },
    { id: 'support_consultation', name: 'Support Consultation' },
    { id: 'strategy_review', name: 'Strategy Review' },
  ], []);

  return {
    users: filteredUsers,
    stages: stages || [],
    pipelines: pipelines || [],
    variables: variables || [],
    allTags: allTags || [],
    forms: forms || [],
    surveys: surveys || [],
    automations: automations || [],
    appFields: appFields || [],
    fieldGroups: fieldGroups || [],
    callCampaigns: sortedCallCampaigns,
    meetingTypes: meetingTypesList,
    activeWorkspaceId,
  };
}
