
import NewSchoolSignupForm from '@/app/register-new-signup-form';
import Header from '@/components/header';
import Footer from '@/components/footer';

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic';

export default function RegisterNewSignupPage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#09090b] transition-colors duration-500">
      {/* Header removed for focused experience */}
      
      {/* Background Ambient Glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -right-[10%] w-[40%] h-[40%] bg-primary/5 blur-[120px] rounded-full" />
        <div className="absolute -bottom-[10%] -left-[10%] w-[40%] h-[40%] bg-primary/5 blur-[120px] rounded-full" />
      </div>

      <main className="flex-grow relative z-10">
        <div className="container max-w-4xl mx-auto py-16 px-4">
          <div className="text-center mb-12 space-y-3">
            <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white">
              School Registration
            </h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium text-base">
              Tell us about your school to get started
            </p>
          </div>
          
          <NewSchoolSignupForm />
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
