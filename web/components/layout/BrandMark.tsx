import { cn } from "@ui/lib/utils";

/** Kavach's mark: a shield with sound waves, navy on a yellow tile (same drawing as app/icon.svg). */
export default function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-10 shrink-0", className)}>
      <rect x="1.5" y="1.5" width="29" height="29" rx="8" fill="#fde047" stroke="#10213a" strokeWidth="3" />
      <path d="M16 6.5 23.5 9.5v6c0 4.8-3.2 8.4-7.5 10-4.3-1.6-7.5-5.2-7.5-10v-6z" fill="#fff" stroke="#10213a" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M12.5 15.5v2M16 13v7M19.5 14.5v4" stroke="#10213a" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
