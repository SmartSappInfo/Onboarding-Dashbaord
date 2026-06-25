You are an expert in TypeScript, Node.js, Next.js App Router, React, Shadcn UI, Radix UI and Tailwind.

Code Style and Structure
- Write concise, technical TypeScript code with accurate examples.
- Use functional and declarative programming patterns; avoid classes.
- Prefer iteration and modularization over code duplication.
- Use descriptive variable names with auxiliary verbs (e.g., isLoading, hasError).
- Structure files: exported component, subcomponents, helpers, static content, types.

Naming Conventions
- Use lowercase with dashes for directories (e.g., components/auth-wizard).
- Favor named exports for components.

TypeScript Usage
- Use TypeScript for all code; prefer interfaces over types.
- Avoid enums; use maps instead.
- Use functional components with TypeScript interfaces.

Syntax and Formatting
- Use the "function" keyword for pure functions.
- Avoid unnecessary curly braces in conditionals; use concise syntax for simple statements.
- Use declarative JSX.

UI and Styling
- Use Shadcn UI, Radix, and Tailwind for components and styling.
- Implement responsive design with Tailwind CSS; use a mobile-first approach.
- Use common UI workds, Simple english and easy to understand terms for UI copy for titles, descriptions, buttons, etc.

Performance Optimization
- Minimize 'use client', 'useEffect', and 'setState'; favor React Server Components (RSC).
- Wrap client components in Suspense with fallback.
- Use dynamic loading for non-critical components.
- Optimize images: use WebP format, include size data, implement lazy loading.

Key Conventions
- Use 'nuqs' for URL search parameter state management.
- Optimize Web Vitals (LCP, CLS, FID).
- Limit 'use client':
  - Favor server components and Next.js SSR.
  - Use only for Web API access in small components.
  - Avoid for data fetching or state management.


Code Review Before Implementations
- Ensure all types are defined
- Ensure all lucid react icons are properly imported
- review all imports and ensure they are well implemented

Follow Next.js docs for Data Fetching, Rendering, and Routing.

Important:
1. conform to next-best-practices, vercel-react-best-practices, emilkowal-animations and frontend-design skills, ensure all functionalities are maintained and improved. the skills in the .agents folder. if you need any other skill, use the find-skills/skills/skill.md to find and install it for your perusal. make this implementation plan professional and industry standard. essentially code review the implementation plan

2. what could go wrong in this implementation and how can it be resolved? how can the code be clean, testable, refactored and scalable without losing functionality. use your findings to update the  phase by phase implementation plan, with git commit when completed. do not run build or typescript, or lint or git commit. let me know so i run it locally to save ai credit.

3. what other features will be broken or affected an how can we include them in the phase by phase implementation plan?

4. While coding, avoid the user of any() or any[]

Use all 4 important rules in all operations.