"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Plus, Star, X } from "lucide-react";
import { useFieldArray, useForm, useWatch, type FieldPath } from "react-hook-form";
import { toast } from "sonner";

import { ApiError } from "@/apis/utils/apiClient";
import { splitServerErrors } from "@/components/agentTesting/agentTesting.schemas";
import FormSection from "@/components/agentTesting/components/FormSection";
import PageIntro from "@/components/layout/PageIntro";
import { Button } from "@ui/components/ui/button";
import { EmptyState } from "@ui/components/ui/empty-state";
import { InputField, SelectField, TextAreaField } from "@ui/components/ui/input-field";
import { Skeleton } from "@ui/components/ui/skeleton";
import { Typography } from "@ui/components/ui/typography";
import { cn } from "@ui/lib/utils";

import { MAX_LISTEN_LANGUAGES, PROFILE_FIELD_PATH, profileSchema, type ProfileFormValues } from "../callGuard.schemas";
import type { Profile } from "../callGuard.types";
import { useGetProfile, useSaveProfile } from "../hooks/useGuardProfile";

const toValues = ({ ownerName, availability, language, listenLanguages, vipContacts, notes }: Profile): ProfileFormValues => ({ ownerName, availability, language, listenLanguages, vipContacts, notes });

function ProfileForm({ profile }: { profile: Profile }) {
  const save = useSaveProfile();
  const form = useForm<ProfileFormValues>({ resolver: zodResolver(profileSchema), defaultValues: toValues(profile) });
  const { register, control, handleSubmit, setError, setValue, getValues, formState: { errors, isDirty, isSubmitted, isValid } } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "vipContacts" });
  const listen = useWatch({ control, name: "listenLanguages" });
  const full = listen.length >= MAX_LISTEN_LANGUAGES;

  // Ticked languages stay in the offered order. Unticking the opening language moves it to the first one left.
  const toggleListen = (option: string) => {
    const ticked = listen.includes(option);
    const next = profile.listenOptions.filter((o) => (o === option ? !ticked : listen.includes(o)));
    setValue("listenLanguages", next, { shouldDirty: true, shouldValidate: isSubmitted });
    if (!next.includes(getValues("language")) && next[0]) setValue("language", next[0], { shouldDirty: true, shouldValidate: isSubmitted });
  };

  const submit = handleSubmit(
    async (values) => {
      if (save.isPending) return;
      try {
        const saved = await save.mutateAsync(values);
        toast.success("Saved. The assistant uses this from the next call.");
        form.reset(toValues(saved));
      } catch (err) {
        if (!(err instanceof ApiError)) throw err;
        const { fieldErrors, unplaced } = splitServerErrors(err.fieldErrors, (p) => PROFILE_FIELD_PATH.test(p));
        fieldErrors.forEach((e) => setError(e.field as FieldPath<ProfileFormValues>, { message: e.message }));
        if (unplaced.length || !fieldErrors.length) toast.error(unplaced[0] ?? err.message);
      }
    },
    () => toast.error("Some fields need fixing. They're marked in red."),
  );

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <FormSection id="about" title="About you" description="What the assistant tells callers on your behalf.">
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <InputField id="ownerName" label="Your name" placeholder="Ganesh" autoComplete="name" errorMsg={errors.ownerName?.message} {...register("ownerName")} />
            <InputField id="availability" label="When are you free?" placeholder="after 6 PM today" hint="Callers hear this, e.g. 'after 6 PM today'" errorMsg={errors.availability?.message} {...register("availability")} />
          </div>
          <TextAreaField id="notes" label="Notes for the assistant" rows={4} placeholder="I'm expecting a call from the landlord" hint="Anything the assistant should know, e.g. 'I'm expecting a call from the landlord'" errorMsg={errors.notes?.message} {...register("notes")} />
        </div>
      </FormSection>

      <FormSection id="languages" title="Languages" description="Callers can speak to the assistant in any of these; it answers in the language it hears.">
        <div className="flex flex-col gap-5">
          <fieldset className="flex flex-col gap-2" aria-describedby="listenLanguages-help">
            <legend className="mb-1.5 flex w-full items-center justify-between gap-3 text-sm font-semibold text-ink">
              Languages people may speak
              <span className={cn("rounded-full border px-2 py-0.5 text-xs font-bold", full ? "border-violet-300 bg-violet-50 text-violet-800" : "border-ink/15 bg-white text-ink")}>{listen.length}/{MAX_LISTEN_LANGUAGES}</span>
            </legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {profile.listenOptions.map((option) => {
                const ticked = listen.includes(option);
                const disabled = ticked ? listen.length === 1 : full;
                return (
                  <label key={option} title={ticked && disabled ? "Keep at least one language" : !ticked && disabled ? `Up to ${MAX_LISTEN_LANGUAGES} languages. Untick one first.` : undefined} className={cn("flex min-w-0 items-center gap-2.5 rounded-xl border-2 border-ink/15 bg-white px-3 py-2.5 text-sm font-medium text-ink has-checked:border-violet-400 has-checked:bg-violet-50 has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink", disabled ? "cursor-not-allowed" : "cursor-pointer hover:border-violet-400", !ticked && disabled && "opacity-50")}>
                    <input type="checkbox" className="size-4 shrink-0 accent-violet-700" checked={ticked} disabled={disabled} onChange={() => toggleListen(option)} />
                    <span className="truncate">{option}</span>
                  </label>
                );
              })}
            </div>
            {errors.listenLanguages?.message ? (
              <p id="listenLanguages-help" className="text-xs font-medium text-red-700" role="alert">{errors.listenLanguages.message}</p>
            ) : (
              <p id="listenLanguages-help" className="text-xs text-secondary-text">Gnani&apos;s speech recognition listens for up to {MAX_LISTEN_LANGUAGES} languages on each call and tells the assistant which one it heard.</p>
            )}
          </fieldset>
          <SelectField id="language" label="Opening language" containerClassName="sm:max-w-xs" hint="The assistant greets callers in this, then switches to whatever language they speak." errorMsg={errors.language?.message} {...register("language")}>
            {listen.map((l) => <option key={l} value={l}>{l}</option>)}
          </SelectField>
        </div>
      </FormSection>

      <FormSection
        id="vip"
        title="VIP contacts"
        description="The assistant marks calls from these people with a star so they stand out."
        errorMsg={errors.vipContacts?.message ?? errors.vipContacts?.root?.message}
        action={<Button variant="quiet" size="sm" onClick={() => append({ name: "", relation: "" })}><Plus aria-hidden="true" />Add contact</Button>}
      >
        {fields.length === 0 ? (
          <Typography size="paragraph3" tone="muted" className="flex items-center gap-2"><Star className="size-4 text-amber-500" aria-hidden="true" />No VIP contacts yet. Add family or anyone you never want to miss.</Typography>
        ) : (
          <ul className="flex flex-col gap-3">
            {fields.map((field, i) => {
              const rowErrors = errors.vipContacts?.[i];
              return (
                <li key={field.id} className="note-box grid grid-cols-[minmax(0,1fr)_auto] gap-3 bg-white/80 p-3.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-start">
                  <InputField id={`vipContacts-${i}-name`} label="Name" placeholder="Mummy" errorMsg={rowErrors?.name?.message} {...register(`vipContacts.${i}.name`)} />
                  <InputField id={`vipContacts-${i}-relation`} label="Relation" placeholder="Mother" containerClassName="col-start-1 sm:col-start-auto" errorMsg={rowErrors?.relation?.message} {...register(`vipContacts.${i}.relation`)} />
                  <Button variant="ghost" size="icon" className="col-start-2 row-start-1 mt-7 sm:col-start-auto sm:row-start-auto" aria-label={`Remove contact ${i + 1}`} onClick={() => remove(i)}><X aria-hidden="true" /></Button>
                </li>
              );
            })}
          </ul>
        )}
      </FormSection>

      <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-end gap-3 rounded-2xl border-2 border-ink bg-paper/95 px-4 py-3 shadow-board backdrop-blur">
        {!isDirty && !(isSubmitted && !isValid) && <Typography size="paragraph3" tone="muted" className="mr-auto">Change anything above to enable Save.</Typography>}
        {isSubmitted && !isValid && <Typography size="paragraph3" tone="error" className="mr-auto">Fix the fields marked in red to save.</Typography>}
        <Button type="submit" disabled={save.isPending || !isDirty}>{save.isPending ? "Saving…" : "Save settings"}</Button>
      </div>
    </form>
  );
}

export default function SettingsForm() {
  const { data: profile, isPending, isError, error, refetch } = useGetProfile();
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-7">
      <PageIntro
        kicker="Call Guard"
        title="Settings"
        description="Tell the assistant who you are, when you're free, which languages callers may speak and who your VIPs are."
      />
      {isPending ? (
        <div className="flex flex-col gap-4"><Skeleton className="h-72 w-full" /><Skeleton className="h-40 w-full" /></div>
      ) : isError ? (
        <EmptyState variant="error" icon={<AlertCircle className="size-5" aria-hidden="true" />} title="Couldn't load your settings" description={error.message} action={<Button variant="outlined" onClick={() => void refetch()}>Try again</Button>} />
      ) : (
        <ProfileForm profile={profile} />
      )}
    </div>
  );
}
