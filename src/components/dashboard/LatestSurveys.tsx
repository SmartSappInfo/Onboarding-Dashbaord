
import DashboardCard from "./DashboardCard";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Button } from "../ui/button";

export function LatestSurveys({ surveys }: { surveys: any[] }) {
  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'published': return 'default';
      case 'draft': return 'secondary';
      case 'archived': return 'outline';
      default: return 'secondary';
    }
  }

  return (
    <DashboardCard title="Latest Surveys">
       {surveys.length > 0 ? (
        <ul className="space-y-3">
          {surveys.map(survey => (
            <li key={survey.id}>
                 <Link href={`/admin/surveys/${survey.id}/results`} className="flex justify-between items-center p-2 rounded-md hover:bg-muted/50 transition-colors -m-2">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{survey.title}</p>
                      <p className="text-sm text-muted-foreground">{survey.responseCount} {survey.responseCount === 1 ? 'response' : 'responses'}</p>
                    </div>
                    <Badge variant={getStatusVariant(survey.status)} className="capitalize">{survey.status}</Badge>
                </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-center justify-center h-full text-center text-sm text-muted-foreground">
            <p>No surveys created yet.</p>
            <Button variant="link" asChild><Link href="/admin/surveys/new">Create one now</Link></Button>
        </div>
      )}
    </DashboardCard>
  )
}
