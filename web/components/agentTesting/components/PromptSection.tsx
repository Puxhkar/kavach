"use client";

import { Sparkles } from "lucide-react";
import { useFormContext, useWatch } from "react-hook-form";

import { Badge } from "@ui/components/ui/badge";
import { Button } from "@ui/components/ui/button";
import { TextAreaField } from "@ui/components/ui/input-field";

import type { DescribeFormValues } from "../agentTesting.schemas";
import type { PromptVersion } from "../agentTesting.types";
import FormSection from "./FormSection";

export default function PromptSection({ currentVersion }: { currentVersion: PromptVersion | null }) {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<DescribeFormValues>();
  const length = useWatch({ control, name: "prompt" }).length;

  return (
    <FormSection
      id="prompt"
      title="Agent prompt"
      description="Paste the prompt exactly as it is in Plivo or Vapi. This is a copy for writing tests and judging calls; editing it here does not change the live agent."
      action={
        <div className="flex flex-col items-end gap-1">
          <Button variant="outlined" size="sm" disabled title="Needs an AI model to be connected">
            <Sparkles aria-hidden="true" />
            Fill the sections below from the prompt
          </Button>
          <span className="text-xs text-secondary-text">Available once an AI model is connected</span>
        </div>
      }
    >
      <div className="flex flex-col gap-2">
        <TextAreaField
          id="prompt"
          aria-label="Agent prompt"
          rows={14}
          placeholder="You are Meera, a recruiting assistant calling {{name}} about the {{job_role}} role…"
          errorMsg={errors.prompt?.message}
          {...register("prompt")}
        />
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-secondary-text">
          <span className="tabular-nums">{length.toLocaleString("en-IN")} characters</span>
          {currentVersion ? (
            <Badge variant="primary">
              Saved as prompt v{currentVersion.version} · {currentVersion.fingerprint}
            </Badge>
          ) : (
            <span>Saving creates prompt v1. Each real change creates the next version.</span>
          )}
        </div>
      </div>
    </FormSection>
  );
}
