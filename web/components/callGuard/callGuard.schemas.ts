import { z } from "zod";

// Client-side mirror of the Call Guard profile limits (services/narada/app/api/v1/schemas/guard.py).
// The server stays the source of truth; these only give instant feedback.

const vipContactSchema = z.object({
  name: z.string().trim().min(1, "Add a name or remove the row").max(60),
  relation: z.string().trim().max(60),
});

/** Gnani's speech recognition listens for up to this many languages per request. */
export const MAX_LISTEN_LANGUAGES = 4;

export const profileSchema = z
  .object({
    ownerName: z.string().trim().min(1, "Tell the assistant your name").max(100),
    availability: z.string().trim().min(1, "Tell callers when you're free").max(300),
    language: z.string().min(1, "Pick an opening language").max(30),
    listenLanguages: z
      .array(z.string().min(1).max(30))
      .min(1, "Pick at least one language")
      .max(MAX_LISTEN_LANGUAGES, `Pick up to ${MAX_LISTEN_LANGUAGES} languages`),
    vipContacts: z.array(vipContactSchema).max(50, "Keep it to 50 contacts"),
    notes: z.string().max(2000),
  })
  .refine((values) => values.listenLanguages.includes(values.language), {
    path: ["language"],
    message: "Pick one of the languages people may speak",
  });

export type ProfileFormValues = z.infer<typeof profileSchema>;

// Paths the server can name that the settings form renders an input (or section message) for.
export const PROFILE_FIELD_PATH = /^(ownerName|availability|language|listenLanguages|notes|vipContacts)$|^vipContacts\.\d+\.(name|relation)$/;

// Mirrors CreateErrandRequest in the same file.
export const errandSchema = z.object({
  recipientName: z.string().trim().min(1, "Who should the assistant call?").max(100),
  recipientRole: z.string().trim().max(100),
  task: z.string().trim().min(1, "Tell the assistant what to say").max(1000),
  deadline: z.string().trim().max(200),
});

export type ErrandFormValues = z.infer<typeof errandSchema>;

export const ERRAND_FIELD_PATH = /^(recipientName|recipientRole|task|deadline)$/;
