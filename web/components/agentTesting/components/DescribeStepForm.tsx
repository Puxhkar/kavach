"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Info } from "lucide-react";
import { FormProvider, useForm, type FieldPath } from "react-hook-form";
import { toast } from "sonner";

import { ApiError } from "@/apis/utils/apiClient";
import { Button } from "@ui/components/ui/button";
import { Typography } from "@ui/components/ui/typography";

import { SCREENING_TEMPLATE } from "../agentTesting.constants";
import { describeSchema, splitServerErrors, type DescribeFormValues } from "../agentTesting.schemas";
import type { Agent } from "../agentTesting.types";
import { useSaveAgentDefinition } from "../hooks/useAgentMutations";
import AnswersSection from "./AnswersSection";
import CallInputsSection from "./CallInputsSection";
import LanguagesSection from "./LanguagesSection";
import PromptSection from "./PromptSection";
import RulesSection from "./RulesSection";

// Paths the server can name that this form renders an input (or section message) for.
const KNOWN_PATH =
  /^(prompt|languages|languageSwitch|callEnding|answers|callInputs|rules)$|^(callInputs\.\d+\.(key|label|example)|answers\.\d+\.(key|question|format|choices|hint)|rules\.\d+\.(text|kind))$/;

type DescribeStepFormProps = { agent: Agent; onSaved: (agent: Agent) => void };

export default function DescribeStepForm({ agent, onSaved }: DescribeStepFormProps) {
  const saveDefinition = useSaveAgentDefinition(agent.id);
  const usingTemplate = agent.definition === null;

  const form = useForm<DescribeFormValues>({
    resolver: zodResolver(describeSchema),
    defaultValues: agent.definition ?? SCREENING_TEMPLATE,
  });
  const {
    handleSubmit,
    setError,
    formState: { isDirty, isSubmitted, isValid },
  } = form;

  const previousVersion = agent.promptVersions.at(-1)?.version ?? null;

  const submit = handleSubmit(
    async (values) => {
      if (saveDefinition.isPending) return;
      try {
        const saved = await saveDefinition.mutateAsync(values);
        const version = saved.promptVersions.at(-1)?.version ?? null;
        toast.success(
          version !== previousVersion ? `Saved. The prompt is now version ${version}.` : "Saved.",
        );
        form.reset(saved.definition ?? values);
        onSaved(saved);
      } catch (err) {
        if (!(err instanceof ApiError)) throw err;
        const { fieldErrors, unplaced } = splitServerErrors(err.fieldErrors, (p) => KNOWN_PATH.test(p));
        fieldErrors.forEach((e) =>
          setError(e.field as FieldPath<DescribeFormValues>, { message: e.message }),
        );
        if (unplaced.length || !fieldErrors.length) toast.error(unplaced[0] ?? err.message);
      }
    },
    () => toast.error("Some fields need fixing. They're marked in red."),
  );

  return (
    <FormProvider {...form}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-5">
        {usingTemplate && (
          <div className="note-box flex gap-3 border-ink/20 bg-sky/70 p-4">
            <Info className="mt-0.5 size-4 shrink-0 text-ink" aria-hidden="true" />
            <Typography size="paragraph3" tone="inherit" className="text-ink">
              We filled in a starting template for a screening agent. Paste your prompt, then change the inputs,
              answers and rules so they match it.
            </Typography>
          </div>
        )}

        <PromptSection currentVersion={agent.promptVersions.at(-1) ?? null} />
        <CallInputsSection />
        <AnswersSection />
        <RulesSection />
        <LanguagesSection />

        <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-end gap-3 rounded-2xl border-2 border-ink bg-paper/95 px-4 py-3 shadow-board backdrop-blur">
          {isSubmitted && !isValid && (
            <Typography size="paragraph3" tone="error" className="mr-auto">
              Fix the fields marked in red to continue.
            </Typography>
          )}
          <Button type="submit" disabled={saveDefinition.isPending || (!usingTemplate && !isDirty)}>
            {saveDefinition.isPending ? "Saving…" : "Save and continue"}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
