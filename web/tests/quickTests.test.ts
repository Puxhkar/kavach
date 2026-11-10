import { describe, expect, it } from "vitest";

import { quickTestIds } from "@/components/agentTesting/agentTesting.constants";

const catalog = [
  { id: "silence", voiceOnly: false },
  { id: "injection", voiceOnly: false },
  { id: "noisy-line", voiceOnly: true },
  { id: "language-hinglish", voiceOnly: false },
  { id: "switch-hinglish-kannada", voiceOnly: false },
];

describe("quickTestIds", () => {
  it("picks a language switch, prompt injection and the noisy line for voice runs", () => {
    expect(quickTestIds(catalog, true)).toEqual(["switch-hinglish-kannada", "injection", "noisy-line"]);
  });

  it("swaps the voice-only noisy line for silence in chat runs", () => {
    expect(quickTestIds(catalog, false)).toEqual(["switch-hinglish-kannada", "injection", "silence"]);
  });

  it("falls back to the Hinglish case when the agent has no switch case", () => {
    expect(quickTestIds(catalog.filter((s) => !s.id.startsWith("switch-")), true)).toEqual(["language-hinglish", "injection", "noisy-line"]);
  });
});

describe("withScheme", () => {
  it("adds https to a bare host and leaves full URLs alone", async () => {
    const { withScheme } = await import("@/apis/utils/apiClient");
    expect(withScheme("kavach-api.onrender.com")).toBe("https://kavach-api.onrender.com");
    expect(withScheme("http://localhost:8010")).toBe("http://localhost:8010");
  });
});
