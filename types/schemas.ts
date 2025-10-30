import { z } from "zod";
import { UserRole, SubscriptionTier } from "@/lib/generated/prisma";

// ============================================================================
// Auth Schemas
// ============================================================================

export const SignUpSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  displayName: z.string().optional(),
});

export const SignInSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const AuthTokenSchema = z.object({
  idToken: z.string().min(1, "ID token is required"),
});

export const UserProfileSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  displayName: z.string().nullable(),
  photoURL: z.string().nullable(),
  phoneNumber: z.string().nullable(),
  role: z.nativeEnum(UserRole),
  subscription: z.nativeEnum(SubscriptionTier),
  timezone: z.string(),
  language: z.string(),
  defaultCurrency: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const SignUpResponseSchema = z.object({
  success: z.boolean(),
  user: UserProfileSchema.optional(),
  error: z.string().optional(),
});

export const SignInResponseSchema = z.object({
  success: z.boolean(),
  user: UserProfileSchema.optional(),
  error: z.string().optional(),
});

// ============================================================================
// Trip Schemas
// ============================================================================

export const CreateTripSchema = z.object({
  name: z.string().min(1, "Trip name is required").max(200, "Trip name is too long"),
  description: z.string().optional(),
  baseCurrency: z.string().length(3, "Currency must be a 3-letter code (e.g., USD)").default("USD"),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  location: z.string().optional(),
}).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return data.endDate >= data.startDate;
    }
    return true;
  },
  {
    message: "End date must be after start date",
    path: ["endDate"],
  }
);

export const UpdateTripSchema = z.object({
  name: z.string().min(1, "Trip name is required").max(200, "Trip name is too long").optional(),
  description: z.string().optional(),
  baseCurrency: z.string().length(3, "Currency must be a 3-letter code (e.g., USD)").optional(),
  startDate: z.coerce.date().optional().nullable(),
  endDate: z.coerce.date().optional().nullable(),
  location: z.string().optional().nullable(),
}).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return data.endDate >= data.startDate;
    }
    return true;
  },
  {
    message: "End date must be after start date",
    path: ["endDate"],
  }
);

export const TripResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  baseCurrency: z.string(),
  startDate: z.coerce.date().nullable(),
  endDate: z.coerce.date().nullable(),
  status: z.string(),
  createdById: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const CreateTripResponseSchema = z.object({
  success: z.boolean(),
  trip: TripResponseSchema.optional(),
  error: z.string().optional(),
});

export const UserSummarySchema = z.object({
  id: z.string(),
  email: z.string(),
  displayName: z.string().nullable(),
  photoURL: z.string().nullable(),
});

export const TripMemberSummarySchema = z.object({
  id: z.string(),
  role: z.string(),
  rsvpStatus: z.string(),
  joinedAt: z.coerce.date(),
  user: UserSummarySchema,
});

export const TimelineItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  date: z.coerce.date().nullable(),
  isCompleted: z.boolean(),
  completedAt: z.coerce.date().nullable(),
  order: z.number(),
});

export const SpendSummarySchema = z.object({
  id: z.string(),
  description: z.string(),
  amount: z.number(),
  currency: z.string(),
  normalizedAmount: z.number(),
  date: z.coerce.date(),
  paidBy: UserSummarySchema,
  category: z.object({
    id: z.string(),
    name: z.string(),
  }).nullable(),
});

export const SpendAssignmentSummarySchema = z.object({
  id: z.string(),
  userId: z.string(),
  shareAmount: z.number(),
  normalizedShareAmount: z.number(),
  splitType: z.string(),
});

// Trip overview for invitees (minimal info)
export const TripOverviewInviteeSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  baseCurrency: z.string(),
  startDate: z.coerce.date().nullable(),
  endDate: z.coerce.date().nullable(),
  status: z.string(),
  createdAt: z.coerce.date(),
  organizer: UserSummarySchema,
  participants: z.array(TripMemberSummarySchema),
  userRole: z.string().nullable(),
  userRsvpStatus: z.string().nullable(),
});

// Trip overview for accepted members (full info)
export const TripOverviewMemberSchema = TripOverviewInviteeSchema.extend({
  timeline: z.array(TimelineItemSchema),
  spends: z.array(SpendSummarySchema),
  userAssignments: z.array(SpendAssignmentSummarySchema),
  totalSpent: z.number(),
  userOwes: z.number(),
  userIsOwed: z.number(),
});

// ============================================================================
// Invitation Schemas
// ============================================================================

export const InviteUsersSchema = z.object({
  emails: z.array(z.string().email("Invalid email address")).min(1, "At least one email is required"),
});

export const UpdateRsvpSchema = z.object({
  rsvpStatus: z.enum(["ACCEPTED", "DECLINED", "MAYBE"]),
});

export const InvitationResponseSchema = z.object({
  success: z.boolean(),
  invited: z.array(z.object({
    email: z.string(),
    userId: z.string(),
    status: z.literal("invited"),
  })),
  alreadyMembers: z.array(z.object({
    email: z.string(),
    userId: z.string(),
    status: z.literal("already_member"),
  })),
  notFound: z.array(z.object({
    email: z.string(),
    status: z.literal("not_found"),
  })),
  error: z.string().optional(),
});

// ============================================================================
// Type exports
// ============================================================================

export type SignUpInput = z.infer<typeof SignUpSchema>;
export type SignInInput = z.infer<typeof SignInSchema>;
export type AuthToken = z.infer<typeof AuthTokenSchema>;
export type UserProfile = z.infer<typeof UserProfileSchema>;
export type SignUpResponse = z.infer<typeof SignUpResponseSchema>;
export type SignInResponse = z.infer<typeof SignInResponseSchema>;
export type CreateTripInput = z.infer<typeof CreateTripSchema>;
export type UpdateTripInput = z.infer<typeof UpdateTripSchema>;
export type TripResponse = z.infer<typeof TripResponseSchema>;
export type CreateTripResponse = z.infer<typeof CreateTripResponseSchema>;
export type UserSummary = z.infer<typeof UserSummarySchema>;
export type TripMemberSummary = z.infer<typeof TripMemberSummarySchema>;
export type TimelineItem = z.infer<typeof TimelineItemSchema>;
export type SpendSummary = z.infer<typeof SpendSummarySchema>;
export type SpendAssignmentSummary = z.infer<typeof SpendAssignmentSummarySchema>;
export type TripOverviewInvitee = z.infer<typeof TripOverviewInviteeSchema>;
export type TripOverviewMember = z.infer<typeof TripOverviewMemberSchema>;
export type InviteUsersInput = z.infer<typeof InviteUsersSchema>;
export type UpdateRsvpInput = z.infer<typeof UpdateRsvpSchema>;
export type InvitationResponse = z.infer<typeof InvitationResponseSchema>;
