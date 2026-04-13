import BuilderClient from './BuilderClient';

export const metadata = {
  title: 'Campaign Page Builder | SmartSapp',
};

export default function BuilderRoute({ params }: { params: Promise<{ id: string }> }) {
  // Use React.use() unwrapping in the client component or pass the promise down.
  // Standard Next.js v15 route pattern
  return <BuilderClient params={params} />;
}
