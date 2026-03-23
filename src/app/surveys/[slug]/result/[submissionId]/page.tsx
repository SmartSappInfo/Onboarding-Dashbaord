import { adminDb } from '@/lib/firebase-admin';
import type { Survey, SurveyResponse, SurveyResultPage } from '@/lib/types';
import { notFound } from 'next/navigation';
import ResultRenderer from '../components/ResultRenderer';
import { SmartSappLogo } from '@/components/icons';
import type { Metadata, ResolvingMetadata } from 'next';

const stripHtml = (html: string) => html?.replace(/<[^>]*>?/gm, '') || '';

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

        if (survey.scoringEnabled && survey.resultRules) {
            const matchedRule = [...survey.resultRules]
                .sort((a, b) => a.priority - b.priority)
                .find(rule => score >= rule.minScore && score <= rule.maxScore);

            if (matchedRule) {
                const pageSnap = await adminDb.collection('surveys').doc(survey.id).collection('resultPages').doc(matchedRule.pageId).get();
                if (pageSnap.exists) {
                    resolvedPage = { id: pageSnap.id, ...pageSnap.data() } as SurveyResultPage;
                }
            }
        }

        // 4. Fallback to default page if no rule matched
        if (!resolvedPage) {
            const defaultPageSnap = await adminDb.collection('surveys').doc(survey.id).collection('resultPages').where('isDefault', '==', true).limit(1).get();
            if (!defaultPageSnap.empty) {
                resolvedPage = { id: defaultPageSnap.docs[0].id, ...defaultPageSnap.docs[0].data() } as SurveyResultPage;
            }
        }

        return { survey, response, page: resolvedPage };
    } catch (error) {
        console.error("Error fetching result data:", error);
        return null;
    }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string; submissionId: string }> }, parent: ResolvingMetadata): Promise<Metadata> {
    const { slug, submissionId } = await params;
    const data = await getResultData(slug, submissionId);

    if (!data) {
        return { title: 'Result Not Found' };
    }

    const { survey } = data;
    const cleanDescription = stripHtml(survey.description);
    const previousImages = (await parent).openGraph?.images || [];

    return {
        title: `Results: ${survey.title}`,
        description: cleanDescription,
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

    return (
        <div className="light min-h-screen bg-slate-100 selection:bg-primary/20">
            <main className="max-w-3xl mx-auto py-12 px-4 sm:px-6 lg:py-24">
                <ResultRenderer 
                    survey={data.survey} 
                    response={data.response} 
                    page={data.page} 
                />
            </main>
            <footer className="py-12 border-t bg-white/50 text-center">
                <div className="flex flex-col items-center gap-4">
                    <SmartSappLogo className="h-8 grayscale opacity-50" />
                    <p className="text-sm text-muted-foreground font-medium italic">
                        Child Security, Parents' Convenience, Smarter Schools
                    </p>
                    <p className="text-xs text-muted-foreground/60">&copy; {new Date().getFullYear()} SmartSapp Onboarding. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
}
