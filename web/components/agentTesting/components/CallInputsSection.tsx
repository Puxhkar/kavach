"use client";

import { Plus, X } from "lucide-react";
import { useFieldArray, useFormContext } from "react-hook-form";

import { Button } from "@ui/components/ui/button";
import { InputField } from "@ui/components/ui/input-field";
import { Typography } from "@ui/components/ui/typography";

import type { DescribeFormValues } from "../agentTesting.schemas";
import FormSection from "./FormSection";

export default function CallInputsSection() {
  const {
    control,
    register,
    formState: { errors },
  } = useFormContext<DescribeFormValues>();
  const { fields, append, remove } = useFieldArray({ control, name: "callInputs" });

  return (
    <FormSection
      id="call-inputs"
      title="Call inputs"
      flow={{ label: "Sent into the call", variant: "primary" }}
      description="Values we fill in for every test call, like the candidate's name. The agent already knows these; it should not ask for them."
      action={
        <Button
          variant="outlined"
          size="sm"
          onClick={() => append({ key: "", label: "", example: "", required: true })}
        >
          <Plus aria-hidden="true" />
          Add input
        </Button>
      }
    >
      {fields.length === 0 ? (
        <Typography size="paragraph3" tone="muted" className="empty-paper px-4 py-6 text-center">
          No call inputs. Add one if the prompt uses variables like {"{{name}}"}.
        </Typography>
      ) : (
        <ul className="flex flex-col gap-3">
          {fields.map((field, i) => {
            const rowErrors = errors.callInputs?.[i];
            return (
              <li
                key={field.id}
                className="note-box grid grid-cols-1 gap-3 bg-white/80 p-3.5 sm:grid-cols-12 sm:items-start"
              >
                <InputField
                  id={`callInputs-${i}-key`}
                  label="Variable"
                  containerClassName="sm:col-span-3"
                  placeholder="name"
                  className="font-mono"
                  spellCheck={false}
                  errorMsg={rowErrors?.key?.message}
                  {...register(`callInputs.${i}.key`)}
                />
                <InputField
                  id={`callInputs-${i}-label`}
                  label="What it is"
                  containerClassName="sm:col-span-4"
                  placeholder="Candidate first name"
                  errorMsg={rowErrors?.label?.message}
                  {...register(`callInputs.${i}.label`)}
                />
                <InputField
                  id={`callInputs-${i}-example`}
                  label="Example value"
                  containerClassName="sm:col-span-4"
                  placeholder="Pushkar"
                  errorMsg={rowErrors?.example?.message}
                  {...register(`callInputs.${i}.example`)}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="sm:col-span-1 sm:mt-6 sm:justify-self-end"
                  aria-label={`Remove input ${i + 1}`}
                  onClick={() => remove(i)}
                >
                  <X aria-hidden="true" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </FormSection>
  );
}
