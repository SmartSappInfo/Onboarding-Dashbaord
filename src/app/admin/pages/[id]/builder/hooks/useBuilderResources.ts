'use client';

import { useState, useEffect, useCallback } from 'react';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useTenant } from '@/context/TenantContext';
import { getThemesAction, } from '@/lib/theme-actions';
import { getSectionTemplatesAction } from '@/lib/section-actions';
import type { CampaignPageTheme, PageSectionTemplate } from '@/lib/types';

export interface BuilderResources {
    automations: any[];
    surveys: any[];
    forms: any[];
    themes: CampaignPageTheme[];
    savedSections: PageSectionTemplate[];
    loadingResources: boolean;
    refreshSections: () => Promise<void>;
}

export function useBuilderResources(): BuilderResources {
    const firestore = useFirestore();
    const { activeOrganizationId: organizationId } = useTenant();
    
    const [automations, setAutomations] = useState<any[]>([]);
    const [surveys, setSurveys] = useState<any[]>([]);
    const [forms, setForms] = useState<any[]>([]);
    const [themes, setThemes] = useState<CampaignPageTheme[]>([]);
    const [savedSections, setSavedSections] = useState<PageSectionTemplate[]>([]);
    const [loadingResources, setLoadingResources] = useState(false);

    // Load all resources in parallel
    useEffect(() => {
        if (!firestore || !organizationId) return;

        const load = async () => {
            setLoadingResources(true);
            try {
                const [aSnap, sSnap, fSnap, tList, sList] = await Promise.all([
                    getDocs(query(collection(firestore, 'automations'), where('isActive', '==', true))),
                    getDocs(query(collection(firestore, 'surveys'), where('status', '==', 'published'))),
                    getDocs(query(collection(firestore, 'forms'), where('status', '==', 'published'))),
                    getThemesAction(organizationId),
                    getSectionTemplatesAction(organizationId),
                ]);
                setAutomations(aSnap.docs.map(d => ({ id: d.id, ...d.data() })));
                setSurveys(sSnap.docs.map(d => ({ id: d.id, ...d.data() })));
                setForms(fSnap.docs.map(d => ({ id: d.id, ...d.data() })));
                setThemes(tList);
                setSavedSections(sList);
            } catch (err) {
                console.error('Failed to load builder resources', err);
            } finally {
                setLoadingResources(false);
            }
        };

        load();
    }, [firestore, organizationId]);

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
        loadingResources,
        refreshSections,
    };
}
