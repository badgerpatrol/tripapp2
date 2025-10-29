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
// Type exports
// ============================================================================

export type SignUpInput = z.infer<typeof SignUpSchema>;
export type SignInInput = z.infer<typeof SignInSchema>;
export type AuthToken = z.infer<typeof AuthTokenSchema>;
export type UserProfile = z.infer<typeof UserProfileSchema>;
export type SignUpResponse = z.infer<typeof SignUpResponseSchema>;
export type SignInResponse = z.infer<typeof SignInResponseSchema>;
