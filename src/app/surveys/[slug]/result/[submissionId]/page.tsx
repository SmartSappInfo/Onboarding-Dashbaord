import { adminDb } from '@/lib/firebase-admin';
import type { Survey, SurveyResponse, SurveyResultPage } from '@/lib/types';
import { notFound, redirect } from 'next/navigation';
import ResultRenderer from '../components/ResultRenderer';
import { Building2 } from 'lucide-react';
import Image from 'next/image';
import type { Metadata, ResolvingMetadata } from 'next';

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

        // 5. Resolve organization logo
        let organizationLogoUrl: string | null = null;
        if (survey.organizationId) {
            const orgSnap = await adminDb.collection('organizations').doc(survey.organizationId).get();
            if (orgSnap.exists) {
                organizationLogoUrl = orgSnap.data()?.logoUrl || null;
            }
        }

        // Logo resolution chain: survey logo → org logo → null
        const logoUrl = survey.logoUrl || organizationLogoUrl || null;

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
            return { survey, response, page: resolvedPage, logoUrl, redirectUrl: finalRedirectUrl };
        }

        return { survey, response, page: resolvedPage, logoUrl, redirectUrl: null };
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

export default async function SurveyResultPage({ params }: { params: Promise<{ slug: string; submissionId: string }> }) {
    const { slug, submissionId } = await params;
    const data = await getResultData(slug, submissionId);

    if (!data) notFound();

    if (data.redirectUrl) {
        redirect(data.redirectUrl);
    }

    return (
        <div className="light min-h-screen flex flex-col bg-slate-100 selection:bg-primary/20">
            <main className="flex-grow max-w-3xl w-full mx-auto py-12 px-4 sm:px-6 lg:py-24">
                <ResultRenderer 
                    survey={data.survey} 
                    response={data.response} 
                    page={data.page}
                    logoUrl={data.logoUrl}
                    allowResubmission={data.survey.allowResubmission}
                />
            </main>
            <footer className="py-12 border-t bg-white/50 text-center mt-auto">
                <div className="flex flex-col items-center gap-4">
                    {data.logoUrl ? (
                        <div className="relative h-8 w-32 grayscale opacity-50">
                            <Image src={data.logoUrl} alt="Logo" fill className="object-contain" />
                        </div>
                    ) : (
                        <Building2 className="h-8 w-8 text-muted-foreground/30" />
                    )}
                    <p className="text-xs text-muted-foreground/60">&copy; {new Date().getFullYear()} Powered by SmartSapp</p>
                </div>
            </footer>
        </div>
    );
}
