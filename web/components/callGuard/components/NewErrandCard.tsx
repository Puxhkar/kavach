"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { PhoneOutgoing } from "lucide-react";
import { useForm, type FieldPath } from "react-hook-form";
import { toast } from "sonner";

import { ApiError } from "@/apis/utils/apiClient";
import { splitServerErrors } from "@/components/agentTesting/agentTesting.schemas";
import { Button } from "@ui/components/ui/button";
import { Card, CardContent, CardHeader } from "@ui/components/ui/card";
import { InputField, TextAreaField } from "@ui/components/ui/input-field";
import { Typography } from "@ui/components/ui/typography";

import { ERRAND_FIELD_PATH, errandSchema, type ErrandFormValues } from "../callGuard.schemas";
import { useCreateErrand } from "../hooks/useErrands";

const EMPTY: ErrandFormValues = { recipientName: "", recipientRole: "", task: "", deadline: "" };

/** "New call": who the assistant should phone and what to tell them. */
export default function NewErrandCard({ onCreated }: { onCreated: (errandId: string) => void }) {
  const create = useCreateErrand();
  const { register, handleSubmit, setError, reset, formState: { errors } } = useForm<ErrandFormValues>({ resolver: zodResolver(errandSchema), defaultValues: EMPTY });

  const submit = handleSubmit(async ({ recipientName, recipientRole, task, deadline }) => {
    if (create.isPending) return;
    try {
      const errand = await create.mutateAsync({ recipientName, recipientRole: recipientRole || undefined, task, deadline: deadline || undefined });
      toast.success(`Saved. Call ${errand.recipientName} now or simulate the call.`);
      reset(EMPTY);
      onCreated(errand.id);
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
      const { fieldErrors, unplaced } = splitServerErrors(err.fieldErrors, (p) => ERRAND_FIELD_PATH.test(p));
      fieldErrors.forEach((e) => setError(e.field as FieldPath<ErrandFormValues>, { message: e.message }));
      if (unplaced.length || !fieldErrors.length) toast.error(unplaced[0] ?? err.message);
    }
  });

  return (
    <Card>
      <CardHeader className="py-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <Typography as="h2" size="heading4" fontWeight="bold">New call</Typography>
          <Typography size="paragraph3" tone="muted">The assistant calls them for you, speaks their language, and reports back.</Typography>
        </div>
        <span className="hidden size-10 place-items-center rounded-2xl border-2 border-ink bg-white sm:grid"><PhoneOutgoing className="size-5 text-ink" aria-hidden="true" /></span>
      </CardHeader>
      <CardContent className="py-5">
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <InputField id="errand-name" label="Who" placeholder="Pushkar" autoComplete="off" required errorMsg={errors.recipientName?.message} {...register("recipientName")} />
            <InputField id="errand-role" label="Who are they to you" placeholder="team member" errorMsg={errors.recipientRole?.message} {...register("recipientRole")} />
            <InputField id="errand-deadline" label="By when" placeholder="today EOD" errorMsg={errors.deadline?.message} {...register("deadline")} />
          </div>
          <TextAreaField id="errand-task" label="What should the assistant tell them" rows={2} required placeholder="Finish the client deck and share it on Slack" errorMsg={errors.task?.message} {...register("task")} />
          <Button type="submit" className="w-full sm:w-auto sm:self-end sm:px-6" disabled={create.isPending} title="Saves the call; you choose how to place it next">{create.isPending ? "Saving…" : "Save"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
