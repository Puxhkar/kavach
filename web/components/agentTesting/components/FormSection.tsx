import { Badge } from "@ui/components/ui/badge";
import { Card, CardContent, CardHeader } from "@ui/components/ui/card";
import { Typography } from "@ui/components/ui/typography";

type FormSectionProps = {
  id: string;
  title: string;
  description: string;
  flow?: { label: string; variant: "primary" | "success" | "default" };
  action?: React.ReactNode;
  errorMsg?: string;
  children: React.ReactNode;
};

export default function FormSection({
  id,
  title,
  description,
  flow,
  action,
  errorMsg,
  children,
}: FormSectionProps) {
  return (
    <Card aria-labelledby={`${id}-title`}>
      <CardHeader>
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <Typography as="h3" id={`${id}-title`} size="heading4" fontWeight="bold">
              {title}
            </Typography>
            {flow && <Badge variant={flow.variant}>{flow.label}</Badge>}
          </div>
          <Typography size="paragraph3" tone="muted" className="max-w-2xl">
            {description}
          </Typography>
          {errorMsg && (
            <Typography size="paragraph3" tone="error" role="alert">
              {errorMsg}
            </Typography>
          )}
        </div>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
