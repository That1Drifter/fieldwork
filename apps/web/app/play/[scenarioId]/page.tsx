import { PlayClient } from './PlayClient';

interface PageProps {
  params: Promise<{ scenarioId: string }>;
}

export default async function PlayPage({ params }: PageProps) {
  const { scenarioId } = await params;
  return <PlayClient scenarioId={scenarioId} />;
}
