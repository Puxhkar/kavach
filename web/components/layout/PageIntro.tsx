import { Typography } from "@ui/components/ui/typography";

type PageIntroProps = {
  /** Section label above the title ("Call Guard"). */
  kicker: string;
  title: string;
  /** One sentence: what this page is for. */
  description: string;
  actions?: React.ReactNode;
};

/** The header every app page starts with: kicker, title, one line on what it's for, and its actions. */
export default function PageIntro({ kicker, title, description, actions }: PageIntroProps) {
  return (
    <header className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <p className="kicker">{kicker}</p>
          <Typography as="h1" size="heading2" fontWeight="bold">{title}</Typography>
          <Typography tone="muted" className="max-w-2xl text-[15px]">{description}</Typography>
        </div>
        {actions && <div className="flex flex-wrap gap-2.5">{actions}</div>}
      </div>
    </header>
  );
}
