import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

const jsonObject = jsonb("data").$type<Record<string, unknown>>();

export const pulseAccounts = pgTable("pulse_accounts", {
  clerkUserId: varchar("clerk_user_id", { length: 191 }).primaryKey(),
  ageVerified: boolean("age_verified").notNull().default(false),
  emailVerified: boolean("email_verified").notNull().default(false),
  identityVerified: boolean("identity_verified").notNull().default(false),
  lastActiveAt: timestamp("last_active_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pulseProfiles = pgTable("pulse_profiles", {
  clerkUserId: varchar("clerk_user_id", { length: 191 }).primaryKey(),
  firstName: varchar("first_name", { length: 40 }).notNull().default(""),
  age: integer("age").notNull().default(18),
  gender: varchar("gender", { length: 80 }),
  heightCm: integer("height_cm"),
  country: varchar("country", { length: 120 }),
  region: varchar("region", { length: 160 }),
  city: varchar("city", { length: 160 }),
  languages: jsonb("languages").$type<string[]>().notNull().default([]),
  relationshipIntention: varchar("relationship_intention", { length: 120 }),
  aboutMe: text("about_me"),
  hobbies: jsonb("hobbies").$type<string[]>().notNull().default([]),
  lifestyle: varchar("lifestyle", { length: 160 }),
  familyGoals: varchar("family_goals", { length: 160 }),
  smoking: varchar("smoking", { length: 80 }),
  drinking: varchar("drinking", { length: 80 }),
  futureGoals: jsonObject,
  media: jsonb("media").$type<
    Array<{ id: string; kind: "photo" | "video"; path: string; alt?: string | null; sortOrder: number }>
  >().notNull().default([]),
  voiceVibePath: text("voice_vibe_path"),
  exactBirthDate: varchar("exact_birth_date", { length: 10 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pulseVibeDna = pgTable("pulse_vibe_dna", {
  clerkUserId: varchar("clerk_user_id", { length: 191 }).primaryKey(),
  datingIntention: varchar("dating_intention", { length: 120 }),
  personality: jsonb("personality").$type<string[]>().notNull().default([]),
  communicationStyle: varchar("communication_style", { length: 120 }),
  relationshipGoals: jsonb("relationship_goals").$type<string[]>().notNull().default([]),
  lifestyle: jsonb("lifestyle").$type<string[]>().notNull().default([]),
  interests: jsonb("interests").$type<string[]>().notNull().default([]),
  familyGoals: varchar("family_goals", { length: 160 }),
  lookingFor: jsonb("looking_for").$type<string[]>().notNull().default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pulsePreferences = pgTable("pulse_preferences", {
  clerkUserId: varchar("clerk_user_id", { length: 191 }).primaryKey(),
  ageMin: integer("age_min").notNull().default(18),
  ageMax: integer("age_max").notNull().default(80),
  maxDistanceMiles: integer("max_distance_miles").notNull().default(50),
  country: varchar("country", { length: 120 }),
  region: varchar("region", { length: 160 }),
  criteria: jsonObject,
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pulseSettings = pgTable("pulse_settings", {
  clerkUserId: varchar("clerk_user_id", { length: 191 }).primaryKey(),
  discoverable: boolean("discoverable").notNull().default(true),
  showAge: boolean("show_age").notNull().default(true),
  showRegion: boolean("show_region").notNull().default(true),
  notificationsEnabled: boolean("notifications_enabled").notNull().default(true),
  commentPermission: varchar("comment_permission", { length: 40 }).notNull().default("eligible"),
  deleteRequested: boolean("delete_requested").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pulseOnboarding = pgTable("pulse_onboarding", {
  clerkUserId: varchar("clerk_user_id", { length: 191 }).primaryKey(),
  currentStep: integer("current_step").notNull().default(0),
  completedSteps: jsonb("completed_steps").$type<string[]>().notNull().default([]),
  complete: boolean("complete").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Phase 2 relationship and interaction entities.
export const pulseHearts = pgTable("pulse_hearts", {
  id: varchar("id", { length: 64 }).primaryKey(),
  fromUserId: varchar("from_user_id", { length: 191 }).notNull(),
  toUserId: varchar("to_user_id", { length: 191 }).notNull(),
  kind: varchar("kind", { length: 24 }).notNull().default("heart"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  directionKindIdx: uniqueIndex("pulse_hearts_direction_kind_idx").on(
    table.fromUserId,
    table.toUserId,
    table.kind,
  ),
}));

export const pulseMatches = pgTable("pulse_matches", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userAId: varchar("user_a_id", { length: 191 }).notNull(),
  userBId: varchar("user_b_id", { length: 191 }).notNull(),
  pairKey: varchar("pair_key", { length: 383 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  pairKeyIdx: uniqueIndex("pulse_matches_pair_key_idx").on(table.pairKey),
}));

export const pulseMessages = pgTable("pulse_messages", {
  id: varchar("id", { length: 64 }).primaryKey(),
  matchId: varchar("match_id", { length: 64 }).notNull(),
  senderId: varchar("sender_id", { length: 191 }).notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pulseMediaLikes = pgTable("pulse_media_likes", {
  id: varchar("id", { length: 64 }).primaryKey(),
  mediaId: varchar("media_id", { length: 64 }).notNull(),
  userId: varchar("user_id", { length: 191 }).notNull(),
  reaction: varchar("reaction", { length: 24 }).notNull().default("like"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  mediaUserIdx: uniqueIndex("pulse_media_likes_media_user_idx").on(
    table.mediaId,
    table.userId,
  ),
}));

export const pulseMediaComments = pgTable("pulse_media_comments", {
  id: varchar("id", { length: 64 }).primaryKey(),
  mediaId: varchar("media_id", { length: 64 }).notNull(),
  userId: varchar("user_id", { length: 191 }).notNull(),
  body: text("body").notNull(),
  replyToId: varchar("reply_to_id", { length: 64 }),
  status: varchar("status", { length: 24 }).notNull().default("visible"),
  likedBackAt: timestamp("liked_back_at", { withTimezone: true }),
  ignoredAt: timestamp("ignored_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pulseNotifications = pgTable("pulse_notifications", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("user_id", { length: 191 }).notNull(),
  kind: varchar("kind", { length: 80 }).notNull(),
  payload: jsonObject,
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pulseBlocks = pgTable("pulse_blocks", {
  id: varchar("id", { length: 64 }).primaryKey(),
  blockerId: varchar("blocker_id", { length: 191 }).notNull(),
  blockedId: varchar("blocked_id", { length: 191 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pulseReports = pgTable("pulse_reports", {
  id: varchar("id", { length: 64 }).primaryKey(),
  reporterId: varchar("reporter_id", { length: 191 }).notNull(),
  reportedId: varchar("reported_id", { length: 191 }).notNull(),
  reason: varchar("reason", { length: 160 }).notNull(),
  details: text("details"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pulseSubscriptions = pgTable("pulse_subscriptions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("user_id", { length: 191 }).notNull(),
  tier: varchar("tier", { length: 40 }).notNull().default("free"),
  status: varchar("status", { length: 40 }).notNull().default("inactive"),
  providerReference: varchar("provider_reference", { length: 191 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPulseProfileSchema = createInsertSchema(pulseProfiles);
export type PulseProfile = typeof pulseProfiles.$inferSelect;
export type InsertPulseProfile = z.infer<typeof insertPulseProfileSchema>;