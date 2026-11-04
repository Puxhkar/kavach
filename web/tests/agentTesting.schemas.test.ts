import { describe, expect, it } from "vitest";

import { SCREENING_TEMPLATE } from "@/components/agentTesting/agentTesting.constants";
import {
  connectSchema,
  describeSchema,
  splitServerErrors,
  textToChoices,
} from "@/components/agentTesting/agentTesting.schemas";

const FLOW_ID = "c9218bfd-65f7-4bc9-ac00-cfaaf3107394";
const validDescribe = { ...SCREENING_TEMPLATE, prompt: "You are a recruiting assistant." };

function issuePaths(result: ReturnType<typeof describeSchema.safeParse>) {
  return result.success ? [] : result.error.issues.map((i) => i.path.join("."));
}

describe("connectSchema", () => {
  it("accepts a Plivo flow UUID", () => {
    expect(connectSchema.safeParse({ name: "Screening", vendor: "plivo", assistantId: FLOW_ID }).success).toBe(true);
  });

  it("rejects a partial ID", () => {
    const result = connectSchema.safeParse({ name: "Screening", vendor: "plivo", assistantId: "c9218bfd" });
    expect(result.success).toBe(false);
  });
});

describe("describeSchema", () => {
  it("accepts the screening template once a prompt is pasted", () => {
    expect(describeSchema.safeParse(validDescribe).success).toBe(true);
  });

  it("requires a prompt (the template ships without one)", () => {
    expect(issuePaths(describeSchema.safeParse(SCREENING_TEMPLATE))).toEqual(["prompt"]);
  });

  it("rejects an answer that reuses a call input key", () => {
    const result = describeSchema.safeParse({
      ...validDescribe,
      callInputs: [{ key: "current_ctc", label: "CTC", example: "", required: true }],
    });
    expect(issuePaths(result)).toEqual(["answers.0.key"]);
  });

  it("rejects dotted keys", () => {
    const [first, ...rest] = validDescribe.answers;
    const result = describeSchema.safeParse({
      ...validDescribe,
      answers: [{ ...first!, key: "ctc.fixed" }, ...rest],
    });
    expect(issuePaths(result)).toEqual(["answers.0.key"]);
  });

  it("needs two choices for a list answer", () => {
    const [first, ...rest] = validDescribe.answers;
    const result = describeSchema.safeParse({
      ...validDescribe,
      answers: [{ ...first!, format: "choice", choices: ["Remote"] }, ...rest],
    });
    expect(issuePaths(result)).toEqual(["answers.0.choices"]);
  });
});

describe("splitServerErrors", () => {
  it("places known fields and keeps the rest as a message", () => {
    const known = new Set(["answers.0.key"]);
    const { fieldErrors, unplaced } = splitServerErrors(
      [
        { field: "answers.0.key", message: "taken" },
        { field: "somethingElse", message: "Server says no" },
      ],
      (p) => known.has(p),
    );
    expect(fieldErrors).toEqual([{ field: "answers.0.key", message: "taken" }]);
    expect(unplaced).toEqual(["Server says no"]);
  });
});

describe("textToChoices", () => {
  it("splits, trims and drops empties", () => {
    expect(textToChoices(" Remote, Hybrid ,, Office ")).toEqual(["Remote", "Hybrid", "Office"]);
  });
});
