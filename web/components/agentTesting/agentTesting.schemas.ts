import { z } from "zod";

import type { FieldError } from "@/apis/utils/apiClient";

// Client-side mirror of the narada domain rules (app/domain/agents/rules.py). The server
// stays the source of truth; these only give instant feedback. Kept out of the component
// files because two steps and the tests share them.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KEY_RE = /^[a-z][a-z0-9_]{0,63}$/;
const KEY_HINT = "Lowercase letters, digits and _ only, starting with a letter";

export const connectSchema = z.object({
  name: z.string().trim().min(1, "Give the agent a name").max(120),
  vendor: z.enum(["plivo", "vapi"]),
  assistantId: z
    .string()
    .trim()
    .regex(UUID_RE, "Paste the full ID. It looks like 8-4-4-4-12 letters and digits"),
});

export type ConnectFormValues = z.infer<typeof connectSchema>;

const callInputSchema = z.object({
  key: z.string().trim().regex(KEY_RE, KEY_HINT),
  label: z.string().trim().min(1, "Add a label").max(120),
  example: z.string().max(500),
  required: z.boolean(),
});

const answerSchema = z.object({
  key: z.string().trim().regex(KEY_RE, KEY_HINT),
  question: z.string().trim().min(1, "Add the question the agent asks").max(500),
  format: z.enum(["text", "number", "amount_lpa", "duration_days", "date", "yes_no", "choice"]),
  required: z.boolean(),
  choices: z.array(z.string()),
  hint: z.string().max(300),
});

const ruleSchema = z.object({
  kind: z.enum(["must", "must_not"]),
  text: z.string().trim().min(1, "Write the rule or remove it").max(500),
});

export const describeSchema = z
  .object({
    prompt: z.string().trim().min(1, "Paste the agent's prompt").max(50000),
    callInputs: z.array(callInputSchema).max(30),
    answers: z.array(answerSchema).min(1, "Add at least one answer the agent must collect").max(30),
    rules: z.array(ruleSchema).max(50),
    languages: z.array(z.string()).min(1, "Pick at least one language"),
    languageSwitch: z.enum(["follow", "ask", "stay"]),
    callEnding: z.string().trim().min(1, "Describe how a good call should end").max(1000),
  })
  .superRefine((values, ctx) => {
    const inputKeys = new Set<string>();
    values.callInputs.forEach((input, i) => {
      if (inputKeys.has(input.key)) {
        ctx.addIssue({ code: "custom", path: ["callInputs", i, "key"], message: `'${input.key}' is listed twice` });
      }
      inputKeys.add(input.key);
    });
    const answerKeys = new Set<string>();
    values.answers.forEach((answer, i) => {
      if (answerKeys.has(answer.key)) {
        ctx.addIssue({ code: "custom", path: ["answers", i, "key"], message: `'${answer.key}' is listed twice` });
      } else if (inputKeys.has(answer.key)) {
        ctx.addIssue({
          code: "custom",
          path: ["answers", i, "key"],
          message: `'${answer.key}' is already a call input. Answers come from the candidate; inputs are sent into the call`,
        });
      }
      answerKeys.add(answer.key);
      if (answer.format === "choice" && answer.choices.filter((c) => c.trim()).length < 2) {
        ctx.addIssue({ code: "custom", path: ["answers", i, "choices"], message: "Add at least two choices" });
      }
    });
  });

export type DescribeFormValues = z.infer<typeof describeSchema>;

/** Split server field errors into ones the form knows how to show and a fallback message. */
export function splitServerErrors(
  errors: FieldError[],
  isKnownPath: (path: string) => boolean,
): { fieldErrors: FieldError[]; unplaced: string[] } {
  const fieldErrors: FieldError[] = [];
  const unplaced: string[] = [];
  for (const error of errors) {
    if (isKnownPath(error.field)) fieldErrors.push(error);
    else unplaced.push(error.message);
  }
  return { fieldErrors, unplaced };
}

/** Choices are edited as one comma-separated text box. */
export const choicesToText = (choices: string[]) => choices.join(", ");
export const textToChoices = (text: string) =>
  text
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
