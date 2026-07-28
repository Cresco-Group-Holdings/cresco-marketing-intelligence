import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type ModuleEmptyStateProps = {
  title: string;
  description: string;
  futureCapabilities: string[];
  comingSoon?: boolean;
};

export function ModuleEmptyState({
  title,
  description,
  futureCapabilities,
  comingSoon = true,
}: ModuleEmptyStateProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <CardTitle>{title}</CardTitle>
          {comingSoon ? <Badge variant="warning">Coming soon</Badge> : null}
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6">
          <p className="text-sm font-medium text-slate-900">This module is not connected yet</p>
          <p className="mt-2 text-sm text-slate-600">
            The platform foundation is in place. Configuration and data connections will be added in
            upcoming releases.
          </p>
          <h2 className="mt-6 text-sm font-semibold text-slate-900">What you will configure later</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-600">
            {futureCapabilities.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
