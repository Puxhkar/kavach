"use client";

import { useFormContext, useWatch } from "react-hook-form";

import { Skeleton } from "@ui/components/ui/skeleton";
import { TextAreaField } from "@ui/components/ui/input-field";
import { Typography } from "@ui/components/ui/typography";
import { cn } from "@ui/lib/utils";

import { LANGUAGE_SWITCH_COPY } from "../agentTesting.constants";
import type { DescribeFormValues } from "../agentTesting.schemas";
import type { LanguageSwitch } from "../agentTesting.types";
import { useGetAgentOptions } from "../hooks/useGetAgentOptions";
import FormSection from "./FormSection";

const SWITCH_OPTIONS = Object.keys(LANGUAGE_SWITCH_COPY) as LanguageSwitch[];

export default function LanguagesSection() {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<DescribeFormValues>();
  const { data: options, isPending, isError } = useGetAgentOptions();
  const switchValue = useWatch({ control, name: "languageSwitch" });

  return (
    <FormSection
      id="languages"
      title="Languages and call ending"
      description="Languages the agent supports, what it does when the candidate switches, and how a good call ends. Language tests are only generated for the languages you tick."
    >
      <div className="flex flex-col gap-6">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-semibold text-ink">Supported languages</legend>
          {isPending ? (
            <div className="flex flex-wrap gap-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-8 w-24" />
              ))}
            </div>
          ) : isError ? (
            <Typography size="paragraph3" tone="error">
              Couldn&apos;t load the language list. Reload the page to try again.
            </Typography>
          ) : (
            <div className="flex flex-wrap gap-2">
              {options.languages.map((lang) => (
                <label
                  key={lang}
                  className="flex cursor-pointer items-center gap-2 rounded-full border-2 border-ink/15 bg-white px-3 py-1.5 text-sm font-semibold text-ink transition-colors hover:border-ink/40 has-checked:border-ink has-checked:bg-sun-light has-focus-visible:ring-4 has-focus-visible:ring-sun/70"
                >
                  <input type="checkbox" value={lang} className="size-4 accent-ink" {...register("languages")} />
                  {lang}
                </label>
              ))}
            </div>
          )}
          {errors.languages?.message && (
            <Typography size="paragraph3" tone="error" role="alert">
              {errors.languages.message}
            </Typography>
          )}
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-semibold text-ink">When the candidate switches language</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {SWITCH_OPTIONS.map((option) => (
              <label
                key={option}
                className={cn(
                  "flex cursor-pointer gap-2.5 rounded-2xl border-2 p-3 transition-colors has-focus-visible:ring-4 has-focus-visible:ring-sun/70",
                  switchValue === option ? "yellow-paper border-ink shadow-tile" : "border-ink/15 bg-white hover:border-ink/40",
                )}
              >
                <input type="radio" value={option} className="mt-0.5 size-4 shrink-0 accent-ink" {...register("languageSwitch")} />
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-bold text-ink">{LANGUAGE_SWITCH_COPY[option].label}</span>
                  <span className="text-xs text-secondary-text">{LANGUAGE_SWITCH_COPY[option].description}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <TextAreaField
          id="call-ending"
          label="How a good call ends"
          rows={3}
          placeholder="After the last question, thank the candidate and end the call."
          hint="Tests flag calls that hang up early, never end, or end without this."
          errorMsg={errors.callEnding?.message}
          {...register("callEnding")}
        />
      </div>
    </FormSection>
  );
}
