import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type CampaignModulePlaceholderProps = {
  title: string;
  description: string;
};

export function CampaignModulePlaceholder({ title, description }: CampaignModulePlaceholderProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-slate-600">{description}</p>
      </CardContent>
    </Card>
  );
}
