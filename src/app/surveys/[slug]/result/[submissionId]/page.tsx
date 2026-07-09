import { adminDb } from '@/lib/firebase-admin';
import type { Survey, SurveyResponse, SurveyResultPage, SurveyResultBlock, WorkspaceEntity } from '@/lib/types';
import { notFound, redirect } from 'next/navigation';
import ResultRenderer from '../components/ResultRenderer';
import { Building2 } from 'lucide-react';
import Image from 'next/image';
import type { Metadata, ResolvingMetadata } from 'next';
import { getOrgBranding } from '@/lib/org-branding';
import { cn } from '@/lib/utils';
import { FieldsVariablesService } from '@/lib/services/fields-variables-service-impl';

// Force dynamic rendering - requires Firebase Admin
export const dynamic = 'force-dynamic';

import { stripHtml } from '@/lib/utils';

function sanitizeAndFormatUrl(url: string): string {
    if (!url) return '';
    const trimmed = url.trim();
    if (trimmed.startsWith('/') || trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        return trimmed;
    }
    return `https://${trimmed}`;
}

function replaceVariablesInUrl(
    url: string, 
    variables: Record<string, string | number | boolean | null | undefined>
): string {
    if (!url) return '';
    const formattedUrl = sanitizeAndFormatUrl(url);
    let result = formattedUrl;
    const pattern = /\{\{([^}]+)\}\}/g;
    result = result.replace(pattern, (match, key) => {
        const trimmedKey = key.trim();
        const value = variables[trimmedKey];
        if (value === undefined || value === null) {
            return '';
        }
        return encodeURIComponent(String(value));
    });
    return result;
}

async function getResultData(slug: string, submissionId: string) {
    try {
        // 1. Fetch Survey
        const surveySnap = await adminDb.collection('surveys').where('slug', '==', slug).limit(1).get();
        if (surveySnap.empty) return null;
        const survey = { id: surveySnap.docs[0].id, ...surveySnap.docs[0].data() } as Survey;

        // 2. Fetch Submission
        const subSnap = await adminDb.collection('surveys').doc(survey.id).collection('responses').doc(submissionId).get();
        if (!subSnap.exists) return null;
        const response = { id: subSnap.id, ...subSnap.data() } as SurveyResponse;

        // 3. Resolve Result Page
        let resolvedPage: SurveyResultPage | null = null;
        const score = response.score ?? 0;
        let redirectUrl: string | null = null;

        if (survey.scoringEnabled && survey.resultRules) {
            const matchedRule = [...survey.resultRules]
                .sort((a, b) => a.priority - b.priority)
                .find(rule => score >= rule.minScore && score <= rule.maxScore);

            if (matchedRule) {
                if (matchedRule.redirectEnabled && matchedRule.redirectUrl) {
                    redirectUrl = matchedRule.redirectUrl;
                } else {
                    const pageSnap = await adminDb.collection('surveys').doc(survey.id).collection('resultPages').doc(matchedRule.pageId).get();
                    if (pageSnap.exists) {
                        resolvedPage = { id: pageSnap.id, ...pageSnap.data() } as SurveyResultPage;
                    }
                }
            }
        } else if (!survey.scoringEnabled && survey.thankYouRedirectEnabled && survey.thankYouRedirectUrl) {
            redirectUrl = survey.thankYouRedirectUrl;
        }

        // 4. Fallback to default page if no rule matched and not redirecting
        if (!resolvedPage && !redirectUrl) {
            const defaultPageSnap = await adminDb.collection('surveys').doc(survey.id).collection('resultPages').where('isDefault', '==', true).limit(1).get();
            if (!defaultPageSnap.empty) {
                resolvedPage = { id: defaultPageSnap.docs[0].id, ...defaultPageSnap.docs[0].data() } as SurveyResultPage;
            }
        }

        // 5. Resolve organization logo & branding
        let orgId = survey.organizationId;
        if (!orgId && survey.workspaceIds?.length) {
            const wsSnap = await adminDb.collection('workspaces').doc(survey.workspaceIds[0]).get();
            if (wsSnap.exists) {
                orgId = wsSnap.data()?.organizationId;
            }
        }

        let organizationLogoUrl: string | null = null;
        let orgBranding = null;
        if (orgId) {
            orgBranding = await getOrgBranding(orgId);
            organizationLogoUrl = orgBranding?.logoUrl || null;
        }

        // Logo resolution chain: survey logo → org logo → null
        const logoUrl = survey.logoUrl || organizationLogoUrl || null;

        // Fetch all result pages for mapping in dynamic categories
        const resultPagesSnap = await adminDb.collection('surveys').doc(survey.id).collection('resultPages').get();
        const resultPages = resultPagesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SurveyResultPage));

        if (redirectUrl) {
            const variables: Record<string, string | number | boolean | null | undefined> = {
                submission_id: response.id,
                survey_title: survey.title,
                score: score,
                max_score: survey.maxScore || 100,
                submission_date: response.submittedAt,
                entityId: survey.entityId || '',
                entityName: survey.entityName || 'SmartSapp'
            };
            
            const questions = (survey.elements || []).filter(el => 
                el && 
                typeof el === 'object' && 
                'type' in el && 
                !['heading', 'description', 'divider', 'image', 'video', 'audio', 'document', 'embed', 'section', 'logic'].includes(el.type)
            );
            
            questions.forEach(q => {
                const ans = (response.answers || []).find(a => a.questionId === q.id);
                if (ans) {
                    const valStr = String(ans.value);
                    variables[q.id] = valStr;
                    
                    const titleLower = (q.title || '').toLowerCase();
                    if (titleLower.includes('name') && !variables.contact_name) variables.contact_name = valStr;
                    if ((titleLower.includes('phone') || titleLower.includes('contact')) && !variables.contact_phone) variables.contact_phone = valStr;
                    if (titleLower.includes('email') && !variables.contact_email) variables.contact_email = valStr;
                }
            });
            
            const finalRedirectUrl = replaceVariablesInUrl(redirectUrl, variables);
            return { survey, response, page: resolvedPage, logoUrl, orgBranding, redirectUrl: finalRedirectUrl, resultPages };
        }

        // Compile variables on resolvedPage blocks
        if (resolvedPage && resolvedPage.blocks) {
            // Load contact/entity
            let workspaceEntity: WorkspaceEntity | null = null;
            if (response.entityId) {
                const weSnap = await adminDb.collection('workspace_entities').doc(response.entityId).get();
                if (weSnap.exists) {
                    workspaceEntity = { id: weSnap.id, ...weSnap.data() } as WorkspaceEntity;
                }
            }

            const varContext = {
                workspaceId: survey.workspaceIds?.[0] || '',
                entityId: response.entityId || undefined,
                submissionId: response.id,
                surveyId: survey.id
            };

            const compiledBlocks: SurveyResultBlock[] = [];
            for (const block of resolvedPage.blocks) {
                const newBlock = { ...block };
                
                // Resolve text fields
                if (newBlock.title) {
                    newBlock.title = await FieldsVariablesService.resolveTemplateVariables(newBlock.title, varContext);
                }
                if (newBlock.content) {
                    newBlock.content = await FieldsVariablesService.resolveTemplateVariables(newBlock.content, varContext);
                }
                if (newBlock.items && newBlock.items.length > 0) {
                    newBlock.items = await Promise.all(
                        newBlock.items.map(item => FieldsVariablesService.resolveTemplateVariables(item, varContext))
                    );
                }

                // Pre-resolve button action links
                if (newBlock.type === 'button') {
                    let resolvedLink = newBlock.link || '#';
                    const actionType = newBlock.actionType || 'url';

                    if (actionType === 'page' && newBlock.targetPageId) {
                        const pageDoc = await adminDb.collection('campaign_pages').doc(newBlock.targetPageId).get();
                        if (pageDoc.exists) {
                            resolvedLink = `/p/${pageDoc.data()?.slug || newBlock.targetPageId}`;
                        }
                    } else if (actionType === 'survey' && newBlock.targetSurveyId) {
                        const surveyDoc = await adminDb.collection('surveys').doc(newBlock.targetSurveyId).get();
                        if (surveyDoc.exists) {
                            resolvedLink = `/surveys/${surveyDoc.data()?.slug || newBlock.targetSurveyId}`;
                        }
                    } else if (actionType === 'form' && newBlock.targetFormId) {
                        resolvedLink = `/f/${newBlock.targetFormId}`;
                    } else if (actionType === 'meeting' && newBlock.targetMeetingId) {
                        const meetingDoc = await adminDb.collection('meetings').doc(newBlock.targetMeetingId).get();
                        if (meetingDoc.exists) {
                            const mData = meetingDoc.data();
                            const typeSlug = mData?.type?.id === 'parent' ? 'parent-engagement' : (mData?.type?.slug || 'parent-engagement');
                            const targetSlug = mData?.slug || newBlock.targetMeetingId;
                            resolvedLink = `/meetings/${typeSlug}/${targetSlug}`;
                        }
                    } else if (actionType === 'qr' && newBlock.targetQrId) {
                        const qrDoc = await adminDb.collectionGroup('qr_codes').where('id', '==', newBlock.targetQrId).limit(1).get();
                        if (!qrDoc.empty) {
                            const qrData = qrDoc.docs[0].data();
                            resolvedLink = qrData.slug ? `/q/${qrData.slug}` : (qrData.redirectUrl || '#');
                        }
                    }

                    // Append entity parameters if passEntityAsQuery is enabled
                    if (newBlock.passEntityAsQuery && workspaceEntity) {
                        const hasQuery = resolvedLink.includes('?');
                        const params = new URLSearchParams();
                        params.set('contactId', workspaceEntity.entityId || workspaceEntity.id);
                        if (workspaceEntity.primaryEmail) params.set('email', workspaceEntity.primaryEmail);
                        if (workspaceEntity.primaryPhone) params.set('phone', workspaceEntity.primaryPhone);
                        if (workspaceEntity.displayName) params.set('name', workspaceEntity.displayName);
                        
                        resolvedLink = `${resolvedLink}${hasQuery ? '&' : '?'}${params.toString()}`;
                    }

                    newBlock.link = resolvedLink;
                }

                compiledBlocks.push(newBlock);
            }
            resolvedPage.blocks = compiledBlocks;
        }

        return { survey, response, page: resolvedPage, logoUrl, orgBranding, redirectUrl: null, resultPages };
    } catch (error) {
        console.error("Error fetching result data:", error);
        return null;
    }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string; submissionId: string }> }, parent: ResolvingMetadata): Promise<Metadata> {
    const { slug, submissionId } = await params;
    const data = await getResultData(slug, submissionId);

    if (!data) {
        return { title: 'Result Not Found', robots: { index: false, follow: false } };
    }

    const { survey } = data;
    const cleanDescription = stripHtml(survey.description);
    const previousImages = (await parent).openGraph?.images || [];

    return {
        title: `Results: ${survey.title}`,
        description: cleanDescription,
        // A specific respondent's result is private — keep it out of search indexes.
        robots: { index: false, follow: false },
        openGraph: {
            title: `Results: ${survey.title}`,
            description: cleanDescription,
            images: survey.bannerImageUrl ? [survey.bannerImageUrl, ...previousImages] : previousImages,
            type: 'article',
        },
        twitter: {
            card: 'summary_large_image',
            title: `Results: ${survey.title}`,
            description: cleanDescription,
            images: survey.bannerImageUrl ? [survey.bannerImageUrl] : [],
        }
    };
}

export default async function SurveyResultPage({ 
    params,
    searchParams 
}: { 
    params: Promise<{ slug: string; submissionId: string }>,
    searchParams: Promise<{ theme?: string, embed?: string, preview?: string, workspaceId?: string }>
}) {
    const { slug, submissionId } = await params;
    const { theme, embed, preview, workspaceId } = await searchParams;
    const data = await getResultData(slug, submissionId);

    if (!data) notFound();

    if (data.redirectUrl) {
        redirect(data.redirectUrl);
    }

    const primaryColor = data.orgBranding?.brandPrimaryColor || '#3B5FFF';
    const secondaryColor = data.orgBranding?.brandSecondaryColor || '#8B5CF6';
    const brandFont = data.orgBranding?.brandFontFamily || 'Inter';

    const resolvedWorkspaceId = workspaceId || data.survey.workspaceIds?.[0] || '';

    // Helper to convert hex to space-separated HSL channels (e.g. "221 83% 53%")
    const hexToHslChannels = (hexColor: string): string => {
        let cleanHex = hexColor.replace('#', '');
        if (cleanHex.length === 3) {
            cleanHex = cleanHex[0] + cleanHex[0] + cleanHex[1] + cleanHex[1] + cleanHex[2] + cleanHex[2];
        }
        
        const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
        const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
        const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
        
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h = 0;
        let s = 0;
        const l = (max + min) / 2;
        
        if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        
        const hDeg = Math.round(h * 360);
        const sPct = Math.round(s * 100);
        const lPct = Math.round(l * 100);
        
        return `${hDeg} ${sPct}% ${lPct}%`;
    };

    // Helper to calculate text contrast (returns hex)
    const getContrastColor = (hexColor: string): string => {
        let cleanHex = hexColor.replace('#', '');
        if (cleanHex.length === 3) {
            cleanHex = cleanHex[0] + cleanHex[0] + cleanHex[1] + cleanHex[1] + cleanHex[2] + cleanHex[2];
        }
        const r = parseInt(cleanHex.substring(0, 2), 16);
        const g = parseInt(cleanHex.substring(2, 4), 16);
        const b = parseInt(cleanHex.substring(4, 6), 16);
        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        return (yiq >= 140) ? '#020617' : '#ffffff';
    };

    const primaryHsl = hexToHslChannels(primaryColor);
    const secondaryHsl = hexToHslChannels(secondaryColor);
    const primaryFgHsl = hexToHslChannels(getContrastColor(primaryColor));
    const secondaryFgHsl = hexToHslChannels(getContrastColor(secondaryColor));

    const isEmbedded = embed === 'true';
    const isDark = theme === 'dark';

    const themeStyles = `
        :root {
            --primary: ${primaryHsl};
            --primary-foreground: ${primaryFgHsl};
            --secondary: ${secondaryHsl};
            --secondary-foreground: ${secondaryFgHsl};
            --radius: 1rem;
        }
        html, body {
            background-color: ${isEmbedded ? 'transparent !important' : 'var(--background)'};
        }
        body {
            font-family: ${brandFont}, sans-serif;
        }
    `;

    return (
        <>
            <style dangerouslySetInnerHTML={{ __html: themeStyles }} />
            <div 
                className={cn(
                    isDark ? "dark text-slate-100" : "light text-slate-900",
                    "min-h-screen flex flex-col selection:bg-primary/20 transition-colors duration-300"
                )}
                style={{ backgroundColor: isEmbedded ? 'transparent' : (isDark ? '#090d16' : '#F1F5F9') }}
            >
                <main className="flex-grow max-w-3xl w-full mx-auto py-12 px-4 sm:px-6 lg:py-24">
                    <ResultRenderer 
                        survey={data.survey} 
                        response={data.response} 
                        page={data.page}
                        logoUrl={data.logoUrl}
                        allowResubmission={data.survey.allowResubmission}
                        resultPages={data.resultPages}
                        preview={preview === 'true'}
                        workspaceId={resolvedWorkspaceId}
                    />
                </main>
                <footer className={cn(
                    "py-12 border-t text-center mt-auto",
                    isDark ? "bg-slate-900/50 border-slate-800" : "bg-white/50 border-slate-200"
                )}>
                    <div className="flex flex-col items-center gap-4">
                        {data.logoUrl ? (
                            <div className="relative h-8 w-32 grayscale opacity-50">
                                <Image src={data.logoUrl} alt="Logo" fill sizes="128px" className="object-contain" />
                            </div>
                        ) : (
                            <Building2 className="h-8 w-8 text-muted-foreground/30" />
                        )}
                        <p className="text-xs text-muted-foreground/60">&copy; {new Date().getFullYear()} Powered by SmartSapp</p>
                    </div>
                </footer>
            </div>
        </>
    );
}
