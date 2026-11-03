"use client";

import { Plus, X } from "lucide-react";
import { useFieldArray, useFormContext } from "react-hook-form";

import { Button } from "@ui/components/ui/button";
import { InputField, SelectField } from "@ui/components/ui/input-field";
import { Typography } from "@ui/components/ui/typography";

import { RULE_KIND_COPY } from "../agentTesting.constants";
import type { DescribeFormValues } from "../agentTesting.schemas";
import type { RuleKind } from "../agentTesting.types";
import FormSection from "./FormSection";

const KINDS = Object.keys(RULE_KIND_COPY) as RuleKind[];

export default function RulesSection() {
  const {
    control,
    register,
    formState: { errors },
  } = useFormContext<DescribeFormValues>();
  const { fields, append, remove } = useFieldArray({ control, name: "rules" });

  return (
    <FormSection
      id="rules"
      title="Rules"
      flow={{ label: "Checked in every test", variant: "default" }}
      description="Behaviour the agent must always or never show. The AI judge checks each call against these."
      action={
        <Button variant="outlined" size="sm" onClick={() => append({ kind: "must", text: "" })}>
          <Plus aria-hidden="true" />
          Add rule
        </Button>
      }
    >
      {fields.length === 0 ? (
        <Typography size="paragraph3" tone="muted" className="empty-paper px-4 py-6 text-center">
          No rules yet. Add things like &quot;never promise a salary&quot;.
        </Typography>
      ) : (
        <ul className="flex flex-col gap-2">
          {fields.map((field, i) => (
            <li key={field.id} className="flex flex-wrap items-start gap-2 sm:flex-nowrap">
              <SelectField
                id={`rules-${i}-kind`}
                aria-label={`Rule ${i + 1} type`}
                containerClassName="w-36 shrink-0"
                {...register(`rules.${i}.kind`)}
              >
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {RULE_KIND_COPY[k]}
                  </option>
                ))}
              </SelectField>
              <InputField
                id={`rules-${i}-text`}
                aria-label={`Rule ${i + 1}`}
                containerClassName="order-last basis-full sm:order-none sm:basis-auto sm:flex-1"
                placeholder="Ask one question at a time"
                errorMsg={errors.rules?.[i]?.text?.message}
                {...register(`rules.${i}.text`)}
              />
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto sm:ml-0"
                aria-label={`Remove rule ${i + 1}`}
                onClick={() => remove(i)}
              >
                <X aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </FormSection>
  );
}
