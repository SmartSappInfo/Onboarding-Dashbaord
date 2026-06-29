'use client';

import { useState, useEffect, useCallback } from 'react';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useTenant } from '@/context/TenantContext';
import { getThemesAction } from '@/lib/theme-actions';
import { getSectionTemplatesAction } from '@/lib/section-actions';
import type { CampaignPageTheme, PageSectionTemplate, Meeting, QRCode, Survey, Form, Automation } from '@/lib/types';

export interface BuilderResources {
    automations: Automation[];
    surveys: Survey[];
    forms: Form[];
    themes: CampaignPageTheme[];
    savedSections: PageSectionTemplate[];
    meetings: Meeting[];
    qrCodes: QRCode[];
    loadingResources: boolean;
    refreshSections: () => Promise<void>;
}

export function useBuilderResources(): BuilderResources {
    const firestore = useFirestore();
    const { activeOrganizationId: organizationId, activeWorkspaceId } = useTenant();
    
    const [automations, setAutomations] = useState<Automation[]>([]);
    const [surveys, setSurveys] = useState<Survey[]>([]);
    const [forms, setForms] = useState<Form[]>([]);
    const [themes, setThemes] = useState<CampaignPageTheme[]>([]);
    const [savedSections, setSavedSections] = useState<PageSectionTemplate[]>([]);
    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [qrCodes, setQrCodes] = useState<QRCode[]>([]);
    const [loadingResources, setLoadingResources] = useState(false);

    // Load all resources in parallel
    useEffect(() => {
        if (!firestore || !organizationId) return;

        const load = async () => {
            setLoadingResources(true);
            try {
                const [aSnap, sSnap, fSnap, tList, sList, mSnap, qrSnap] = await Promise.all([
                    getDocs(query(collection(firestore, 'automations'), where('isActive', '==', true))),
                    getDocs(query(collection(firestore, 'surveys'), where('status', '==', 'published'))),
                    getDocs(query(collection(firestore, 'forms'), where('status', '==', 'published'))),
                    getThemesAction(organizationId),
                    getSectionTemplatesAction(organizationId),
                    activeWorkspaceId 
                        ? getDocs(query(collection(firestore, 'meetings'), where('workspaceIds', 'array-contains', activeWorkspaceId)))
                        : Promise.resolve({ docs: [] }),
                    (organizationId && activeWorkspaceId)
                        ? getDocs(collection(firestore, 'organizations', organizationId, 'workspaces', activeWorkspaceId, 'qr_codes'))
                        : Promise.resolve({ docs: [] }),
                ]);
                
                setAutomations(aSnap.docs.map(d => ({ id: d.id, ...d.data() } as Automation)));
                setSurveys(sSnap.docs.map(d => ({ id: d.id, ...d.data() } as Survey)));
                setForms(fSnap.docs.map(d => ({ id: d.id, ...d.data() } as Form)));
                setThemes(tList);
                setSavedSections(sList);
                setMeetings((mSnap.docs || []).map(d => ({ id: d.id, ...d.data() } as Meeting)));
                setQrCodes((qrSnap.docs || []).map(d => ({ id: d.id, ...d.data() } as QRCode)));
            } catch (err) {
                console.error('Failed to load builder resources', err);
            } finally {
                setLoadingResources(false);
            }
        };

        load();
    }, [firestore, organizationId, activeWorkspaceId]);

    const refreshSections = useCallback(async () => {
        if (!organizationId) return;
        const sList = await getSectionTemplatesAction(organizationId);
        setSavedSections(sList);
    }, [organizationId]);

    return {
        automations,
        surveys,
        forms,
        themes,
        savedSections,
        meetings,
        qrCodes,
        loadingResources,
        refreshSections,
    };
}
