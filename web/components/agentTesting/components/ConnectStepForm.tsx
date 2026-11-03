"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { ApiError } from "@/apis/utils/apiClient";
import { Button } from "@ui/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@ui/components/ui/card";
import { InputField } from "@ui/components/ui/input-field";
import { Typography } from "@ui/components/ui/typography";
import { cn } from "@ui/lib/utils";

import { VENDOR_COPY } from "../agentTesting.constants";
import { connectSchema, splitServerErrors, type ConnectFormValues } from "../agentTesting.schemas";
import type { Agent, Vendor } from "../agentTesting.types";

const CONNECT_FIELDS = new Set<keyof ConnectFormValues>(["name", "vendor", "assistantId"]);
const VENDORS: Vendor[] = ["plivo", "vapi"];

type ConnectStepFormProps = {
  agent?: Agent;
  submitLabel: string;
  isSaving: boolean;
  onSubmit: (values: ConnectFormValues) => Promise<Agent>;
  onSaved: (agent: Agent) => void;
};

export default function ConnectStepForm({
  agent,
  submitLabel,
  isSaving,
  onSubmit,
  onSaved,
}: ConnectStepFormProps) {
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isDirty },
  } = useForm<ConnectFormValues>({
    resolver: zodResolver(connectSchema),
    defaultValues: {
      name: agent?.name ?? "",
      vendor: agent && agent.vendor !== "none" ? agent.vendor : "plivo",
      assistantId: agent?.assistantId ?? "",
    },
  });

  const vendor = useWatch({ control, name: "vendor" });
  const copy = VENDOR_COPY[vendor];

  const submit = handleSubmit(async (values) => {
    if (isSaving) return;
    try {
      const saved = await onSubmit(values);
      onSaved(saved);
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
      const { fieldErrors, unplaced } = splitServerErrors(err.fieldErrors, (path) =>
        CONNECT_FIELDS.has(path as keyof ConnectFormValues),
      );
      fieldErrors.forEach((e) => setError(e.field as keyof ConnectFormValues, { message: e.message }));
      if (unplaced.length || !fieldErrors.length) toast.error(unplaced[0] ?? err.message);
    }
  });

  return (
    <form onSubmit={submit} noValidate>
      <Card tone="blue">
        <CardHeader>
          <div className="flex flex-col gap-1">
            <Typography as="h2" size="heading4" fontWeight="bold">
              Which agent are we testing?
            </Typography>
            <Typography size="paragraph3" tone="muted">
              We only store a pointer to the agent. Its prompt, voice and tools stay in{" "}
              {copy.name.split(" ")[0]}.
            </Typography>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <InputField
            id="agent-name"
            label="Agent name"
            placeholder="e.g. Candidate Screening (test copy)"
            hint="A name your team will recognise. Shown in the agents list and reports."
            errorMsg={errors.name?.message}
            {...register("name")}
          />

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 text-sm font-semibold text-ink">Where the agent is built</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {VENDORS.map((v) => (
                <label
                  key={v}
                  className={cn(
                    "flex cursor-pointer gap-3 rounded-2xl border-2 p-3.5 transition-colors has-focus-visible:ring-4 has-focus-visible:ring-sun/70",
                    vendor === v ? "yellow-paper border-ink shadow-tile" : "border-ink/15 bg-white hover:border-ink/40",
                  )}
                >
                  <input type="radio" value={v} className="mt-1 size-4 accent-ink" {...register("vendor")} />
                  <span className="flex flex-col gap-0.5">
                    <span className="text-sm font-bold text-ink">{VENDOR_COPY[v].name}</span>
                    <span className="text-xs text-secondary-text">{VENDOR_COPY[v].description}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <InputField
            id="assistant-id"
            label={copy.idLabel}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            autoComplete="off"
            spellCheck={false}
            className="font-mono"
            hint={copy.idHint}
            errorMsg={errors.assistantId?.message}
            {...register("assistantId")}
          />
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isSaving || (!!agent && !isDirty)}>
            {isSaving ? "Saving…" : submitLabel}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
