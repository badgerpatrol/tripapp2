import { z } from "zod";

export const SequenceStepType = z.enum([
  "CREATE_TRIP",
  "INVITE_PEOPLE",
  "SET_DATES",
  "CREATE_CHOICE",
  "ADD_CHOICE_ITEMS",
  "ADD_CHECKLIST",
  "CUSTOM_FORM"
]);

export const zAddChecklistConfig = z.object({
  items: z.array(z.string()).default([])
});

export const zCreateChoiceConfig = z.object({
  defaultTitle: z.string().default("Menu"),
  descriptionHint: z.string().optional()
});

export const zAddChoiceItemsConfig = z.object({
  items: z.array(z.object({
    name: z.string(),
    description: z.string().optional(),
    price: z.number().nonnegative().optional()
  })).default([])
});

export const zCustomFormConfig = z.object({
  fields: z.array(z.object({
    key: z.string(),
    label: z.string(),
    type: z.enum(["short_text", "long_text", "number", "date"]),
    required: z.boolean().default(false),
  })).default([])
});

export const zCreateTripConfig = z.object({
  titleDefault: z.string().optional()
});

export const zInvitePeopleConfig = z.object({});

export const zSetDatesConfig = z.object({});

export type AddChecklistConfig = z.infer<typeof zAddChecklistConfig>;
export type CreateChoiceConfig = z.infer<typeof zCreateChoiceConfig>;
export type AddChoiceItemsConfig = z.infer<typeof zAddChoiceItemsConfig>;
export type CustomFormConfig = z.infer<typeof zCustomFormConfig>;
export type CreateTripConfig = z.infer<typeof zCreateTripConfig>;
export type InvitePeopleConfig = z.infer<typeof zInvitePeopleConfig>;
export type SetDatesConfig = z.infer<typeof zSetDatesConfig>;
