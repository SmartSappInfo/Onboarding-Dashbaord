
import NewSchoolSignupForm from '@/components/new-school-signup-form';
import Header from '@/components/header';
import Footer from '@/components/footer';

export default function RegisterNewSignupPage() {
  return (
    <>
      <Header />
      <main className="flex-grow">
        <div className="mx-auto w-[70%] py-20 text-center">
          <h1 className="mb-4 font-headline text-4xl font-bold md:text-5xl">
            New School Signup Form
          </h1>
          <p className="mb-10 text-lg text-muted-foreground">
            Kindly provide the details below to register a new school signup.
          </p>
          <NewSchoolSignupForm />
        </div>
      </main>
      <Footer />
    </>
  );
}
