import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { Typography } from "@ui/components/ui/typography";

type Crumb = { label: string; href?: string };

type PageHeaderProps = {
  crumbs: Crumb[];
  title: string;
  description?: string;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
};

export default function PageHeader({ crumbs, title, description, actions, meta }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-4">
      <nav aria-label="Breadcrumb">
        <ol className="kicker flex flex-wrap items-center gap-1.5">
          {crumbs.map((crumb, i) => (
            <li key={crumb.label} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="size-3.5" aria-hidden="true" />}
              {crumb.href ? (
                <Link href={crumb.href} className="underline decoration-sun decoration-2 underline-offset-4 hover:text-ink hover:decoration-ink">
                  {crumb.label}
                </Link>
              ) : (
                <span aria-current="page" className="text-ink">
                  {crumb.label}
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Typography as="h1" size="heading2" fontWeight="bold">
              {title}
            </Typography>
            {meta}
          </div>
          {description && (
            <Typography tone="muted" className="max-w-2xl">
              {description}
            </Typography>
          )}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </header>
  );
}
