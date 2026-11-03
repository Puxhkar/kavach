"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";
import { Controller, useFieldArray, useFormContext, useWatch } from "react-hook-form";

import { Button } from "@ui/components/ui/button";
import { InputField, SelectField } from "@ui/components/ui/input-field";

import { ANSWER_FORMAT_COPY } from "../agentTesting.constants";
import {
  choicesToText,
  textToChoices,
  type DescribeFormValues,
} from "../agentTesting.schemas";
import type { AnswerFormat } from "../agentTesting.types";
import FormSection from "./FormSection";

const FORMATS = Object.keys(ANSWER_FORMAT_COPY) as AnswerFormat[];

function ChoicesInput({
  id,
  value,
  onChange,
  errorMsg,
}: {
  id: string;
  value: string[];
  onChange: (choices: string[]) => void;
  errorMsg?: string;
}) {
  // Local text so a trailing comma survives while typing; the form value stays a clean list.
  const [text, setText] = useState(() => choicesToText(value));
  return (
    <InputField
      id={id}
      label="Allowed answers"
      containerClassName="sm:col-span-6"
      placeholder="Remote, Hybrid, Office"
      hint="Separate with commas"
      errorMsg={errorMsg}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        onChange(textToChoices(e.target.value));
      }}
    />
  );
}

export default function AnswersSection() {
  const {
    control,
    register,
    formState: { errors },
  } = useFormContext<DescribeFormValues>();
  const { fields, append, remove } = useFieldArray({ control, name: "answers" });
  const answers = useWatch({ control, name: "answers" });

  return (
    <FormSection
      id="answers"
      title="Answers to collect"
      flow={{ label: "Collected from the candidate", variant: "success" }}
      description="What the agent must find out and save. Tests check each saved answer against what the fake candidate really said, using the format you pick here."
      errorMsg={errors.answers?.message ?? errors.answers?.root?.message}
      action={
        <Button
          variant="outlined"
          size="sm"
          onClick={() =>
            append({ key: "", question: "", format: "text", required: true, choices: [], hint: "" })
          }
        >
          <Plus aria-hidden="true" />
          Add answer
        </Button>
      }
    >
      <ul className="flex flex-col gap-3">
        {fields.map((field, i) => {
          const rowErrors = errors.answers?.[i];
          const format = answers[i]?.format ?? "text";
          return (
            <li key={field.id} className="note-box flex flex-col gap-3 bg-white/80 p-3.5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 sm:items-start">
                <InputField
                  id={`answers-${i}-key`}
                  label="Saved as"
                  containerClassName="sm:col-span-4"
                  placeholder="current_ctc"
                  className="font-mono"
                  spellCheck={false}
                  errorMsg={rowErrors?.key?.message}
                  {...register(`answers.${i}.key`)}
                />
                <InputField
                  id={`answers-${i}-question`}
                  label="Question the agent asks"
                  containerClassName="sm:col-span-7"
                  placeholder="What is your current CTC?"
                  errorMsg={rowErrors?.question?.message}
                  {...register(`answers.${i}.question`)}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="sm:col-span-1 sm:mt-6 sm:justify-self-end"
                  aria-label={`Remove answer ${i + 1}`}
                  onClick={() => remove(i)}
                >
                  <X aria-hidden="true" />
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 sm:items-start">
                <SelectField
                  id={`answers-${i}-format`}
                  label="Saved format"
                  containerClassName="sm:col-span-4"
                  hint={ANSWER_FORMAT_COPY[format].example}
                  errorMsg={rowErrors?.format?.message}
                  {...register(`answers.${i}.format`)}
                >
                  {FORMATS.map((f) => (
                    <option key={f} value={f}>
                      {ANSWER_FORMAT_COPY[f].label}
                    </option>
                  ))}
                </SelectField>
                {format === "choice" ? (
                  <Controller
                    control={control}
                    name={`answers.${i}.choices`}
                    render={({ field: choicesField, fieldState }) => (
                      <ChoicesInput
                        id={`answers-${i}-choices`}
                        value={choicesField.value}
                        onChange={choicesField.onChange}
                        errorMsg={fieldState.error?.message}
                      />
                    )}
                  />
                ) : (
                  <InputField
                    id={`answers-${i}-hint`}
                    label="Note for the evaluator (optional)"
                    containerClassName="sm:col-span-6"
                    placeholder="Optional"
                    errorMsg={rowErrors?.hint?.message}
                    {...register(`answers.${i}.hint`)}
                  />
                )}
                <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-ink sm:col-span-2 sm:mt-9">
                  <input type="checkbox" className="size-4 accent-ink" {...register(`answers.${i}.required`)} />
                  Required
                </label>
              </div>
            </li>
          );
        })}
      </ul>
    </FormSection>
  );
}
