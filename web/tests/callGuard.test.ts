import { describe, expect, it } from "vitest";

import { errandBadge, heardDiffers, isErrandActive, languageSwitches, lastAiLanguage, OUTCOME, riskTone, timeAgo } from "@/components/callGuard/callGuard.constants";
import { ERRAND_FIELD_PATH, errandSchema, PROFILE_FIELD_PATH, profileSchema } from "@/components/callGuard/callGuard.schemas";

const profile = {
  ownerName: "Ganesh",
  availability: "after 6 PM today",
  language: "English",
  listenLanguages: ["English", "Hindi", "Kannada", "Tamil"],
  vipContacts: [{ name: "Mummy", relation: "Mother" }],
  notes: "",
};

describe("heardDiffers", () => {
  it("ignores case and punctuation", () => {
    expect(heardDiffers("Hello, is Ganesh there?", "hello is ganesh there")).toBe(false);
  });
  it("flags a mishearing and an empty hearing", () => {
    expect(heardDiffers("Your parcel is here", "your partial is here")).toBe(true);
    expect(heardDiffers("Hello", "")).toBe(true);
  });
  it("is false when nothing was transcribed separately", () => {
    expect(heardDiffers("Hello", null)).toBe(false);
  });
});

describe("timeAgo", () => {
  const now = Date.parse("2026-11-10T12:00:00Z");
  it("reads naturally", () => {
    expect(timeAgo("2026-11-10T11:59:50Z", now)).toBe("just now");
    expect(timeAgo("2026-11-10T11:55:00Z", now)).toBe("5 min ago");
    expect(timeAgo("2026-11-10T09:00:00Z", now)).toBe("3 h ago");
    expect(timeAgo("2026-11-09T12:00:00Z", now)).toBe("yesterday");
  });
});

describe("riskTone", () => {
  it("goes red from 70", () => {
    expect(riskTone(70).bar).toBe("bg-red-500");
    expect(riskTone(45).bar).toBe("bg-amber-500");
    expect(riskTone(5).bar).toBe("bg-emerald-500");
  });
});

describe("profileSchema", () => {
  it("accepts a filled-in profile", () => {
    expect(profileSchema.safeParse(profile).success).toBe(true);
  });
  it("needs a name for every VIP row", () => {
    const result = profileSchema.safeParse({ ...profile, vipContacts: [{ name: " ", relation: "" }] });
    expect(result.success ? [] : result.error.issues.map((i) => i.path.join("."))).toEqual(["vipContacts.0.name"]);
  });
  it("listens for 1 to 4 languages", () => {
    const paths = (listenLanguages: string[]) => {
      const result = profileSchema.safeParse({ ...profile, listenLanguages });
      return result.success ? [] : result.error.issues.map((i) => i.path.join("."));
    };
    expect(paths([])).toEqual(["listenLanguages", "language"]);
    expect(paths(["English", "Hindi", "Kannada", "Tamil", "Telugu"])).toEqual(["listenLanguages"]);
  });
  it("needs the opening language to be one of the listen languages", () => {
    const result = profileSchema.safeParse({ ...profile, language: "Telugu" });
    expect(result.success ? [] : result.error.issues.map((i) => i.path.join("."))).toEqual(["language"]);
  });
  it("knows which server paths the form can show", () => {
    expect(PROFILE_FIELD_PATH.test("vipContacts.3.relation")).toBe(true);
    expect(PROFILE_FIELD_PATH.test("availability")).toBe(true);
    expect(PROFILE_FIELD_PATH.test("listenLanguages")).toBe(true);
    expect(PROFILE_FIELD_PATH.test("languages")).toBe(false);
  });
});

describe("languageSwitches", () => {
  const ai = (language: string | null) => ({ speaker: "ai" as const, language });
  const person = (language: string | null) => ({ speaker: "person" as const, language });
  it("marks the AI line where the language changes, never the first", () => {
    expect(languageSwitches([ai("English"), person("Kannada"), ai("Kannada"), person("Kannada"), ai("Kannada")])).toEqual([null, null, "Kannada", null, null]);
  });
  it("ignores the person's language and lines without one", () => {
    expect(languageSwitches([ai("Hindi"), person("Tamil"), ai(null), ai("Hindi")])).toEqual([null, null, null, null]);
    expect(languageSwitches([ai(null), ai("Tamil"), ai("English")])).toEqual([null, null, "English"]);
  });
});

describe("lastAiLanguage", () => {
  it("is the AI's latest language, skipping the person", () => {
    expect(lastAiLanguage([{ speaker: "ai", language: "English" }, { speaker: "ai", language: "Kannada" }, { speaker: "person", language: "Tamil" }])).toBe("Kannada");
    expect(lastAiLanguage([{ speaker: "person", language: "Tamil" }])).toBeNull();
    expect(lastAiLanguage([])).toBeNull();
  });
});

describe("errandBadge", () => {
  it("shows the outcome once the report is in", () => {
    expect(errandBadge("done", "agreed")).toEqual({ label: "Agreed", className: OUTCOME.agreed.className });
    expect(errandBadge("done", "needs_follow_up").label).toBe("Needs follow-up");
    expect(errandBadge("done", "declined").className).toContain("red");
    expect(errandBadge("done", "not_reached").className).toContain("slate");
  });
  it("shows where the call is before that", () => {
    expect(errandBadge("pending", null).label).toBe("Not called yet");
    expect(errandBadge("running", null).label).toBe("On call…");
    expect(errandBadge("triaging", null).label).toBe("Writing report…");
    expect(errandBadge("error", null).label).toBe("Failed");
  });
  it("polls only while on a call or writing the report", () => {
    expect(isErrandActive("running")).toBe(true);
    expect(isErrandActive("triaging")).toBe(true);
    expect(isErrandActive("pending")).toBe(false);
    expect(isErrandActive("done")).toBe(false);
  });
});

describe("errandSchema", () => {
  const errand = { recipientName: "Neha", recipientRole: "", task: "Finish the client deck", deadline: "" };
  it("needs who and what; role and deadline are optional", () => {
    expect(errandSchema.safeParse(errand).success).toBe(true);
    const result = errandSchema.safeParse({ ...errand, recipientName: " ", task: "" });
    expect(result.success ? [] : result.error.issues.map((i) => i.path.join("."))).toEqual(["recipientName", "task"]);
  });
  it("knows which server paths the form can show", () => {
    expect(ERRAND_FIELD_PATH.test("deadline")).toBe(true);
    expect(ERRAND_FIELD_PATH.test("language")).toBe(false);
  });
});

describe("toApiError", () => {
  it("maps FastAPI's own 422 issues to field errors", async () => {
    const { AxiosError, AxiosHeaders } = await import("axios");
    const { toApiError } = await import("@/apis/utils/apiClient");
    const error = new AxiosError("422", "ERR_BAD_REQUEST", undefined, undefined, {
      status: 422,
      statusText: "Unprocessable",
      headers: {},
      config: { headers: new AxiosHeaders() },
      data: { detail: [{ loc: ["body", "vipContacts", 0, "name"], msg: "String should have at most 60 characters" }] },
    });
    const apiError = toApiError(error);
    expect(apiError.code).toBe("validation_failed");
    expect(apiError.fieldErrors).toEqual([{ field: "vipContacts.0.name", message: "String should have at most 60 characters" }]);
  });
});
