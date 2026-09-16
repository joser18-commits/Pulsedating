import { and, desc, eq, inArray, or } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  GetMyPreferencesResponse,
  GetMyNotificationsResponse,
  GetMyProfileResponse,
  GetMySettingsResponse,
  GetMySummaryResponse,
  GetMyVibeDnaResponse,
  OnboardingProgress,
  UpdateMyPreferencesBody,
  UpdateMyProfileBody,
  UpdateMySettingsBody,
  UpdateMyVibeDnaBody,
  UpdateOnboardingProgressBody,
  UpdateMyPreferencesResponse,
  UpdateMyProfileResponse,
  UpdateMySettingsResponse,
  UpdateMyVibeDnaResponse,
  UpdateOnboardingProgressResponse,
  VibeDna,
} from "@workspace/api-zod";
import {
  db,
  pulseAccounts,
  pulseBlocks,
  pulseHearts,
  pulseMatches,
  pulseMediaComments,
  pulseMediaLikes,
  pulseMessages,
  pulseNotifications,
  pulseOnboarding,
  pulsePreferences,
  pulseProfiles,
  pulseReports,
  pulseSettings,
  pulseSubscriptions,
  pulseVibeDna,
} from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";

const router: IRouter = Router();
router.use(requireAuth);

const emptyFutureGoals = {
  fiveYearVision: null,
  marriage: null,
  children: null,
  homeOwnership: null,
  career: null,
  business: null,
  financialFreedom: null,
  travel: null,
  education: null,
  relocation: null,
  wouldRelocate: null,
};

function toPublicProfile(row: typeof pulseProfiles.$inferSelect) {
  return {
    userId: row.clerkUserId,
    firstName: row.firstName,
    age: row.age,
    gender: row.gender,
    heightCm: row.heightCm,
    country: row.country,
    region: row.region,
    city: row.city,
    languages: row.languages ?? [],
    relationshipIntention: row.relationshipIntention,
    aboutMe: row.aboutMe,
    hobbies: row.hobbies ?? [],
    lifestyle: row.lifestyle,
    familyGoals: row.familyGoals,
    smoking: row.smoking,
    drinking: row.drinking,
    futureGoals: row.futureGoals ?? emptyFutureGoals,
    media: row.media ?? [],
  };
}

function toPrivateProfile(row: typeof pulseProfiles.$inferSelect) {
  return {
    ...toPublicProfile(row),
    voiceVibePath: row.voiceVibePath,
    exactBirthDate: row.exactBirthDate,
  };
}

async function ensureAccount(userId: string) {
  await db
    .insert(pulseAccounts)
    .values({ clerkUserId: userId })
    .onConflictDoNothing({ target: pulseAccounts.clerkUserId });
}

async function getOrCreateProfile(userId: string) {
  await ensureAccount(userId);
  const existing = await db
    .select()
    .from(pulseProfiles)
    .where(eq(pulseProfiles.clerkUserId, userId));
  if (existing[0]) return existing[0];
  const [created] = await db
    .insert(pulseProfiles)
    .values({ clerkUserId: userId })
    .returning();
  return created;
}

router.get("/me/summary", async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const profile = await getOrCreateProfile(userId);
  const onboarding = await db
    .select()
    .from(pulseOnboarding)
    .where(eq(pulseOnboarding.clerkUserId, userId));
  const row = onboarding[0];
  const completionFields = [
    profile.firstName,
    profile.aboutMe,
    profile.country,
    profile.relationshipIntention,
    profile.media.length > 0,
    profile.futureGoals,
  ];
  const profileCompletion = Math.round(
    (completionFields.filter(Boolean).length / completionFields.length) * 100,
  );
  res.json(
    GetMySummaryResponse.parse({
      profileCompletion,
      onboardingComplete: row?.complete ?? false,
      profile: toPublicProfile(profile),
      locationLabel:
        [profile.city, profile.region, profile.country].filter(Boolean).join(", ") || null,
    }),
  );
});

router.get("/me/profile", async (req, res): Promise<void> => {
  const profile = await getOrCreateProfile(
    (req as AuthenticatedRequest).userId,
  );
  res.json(GetMyProfileResponse.parse(toPrivateProfile(profile)));
});

router.put("/me/profile", async (req, res): Promise<void> => {
  const parsed = UpdateMyProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = (req as AuthenticatedRequest).userId;
  const data = parsed.data;
  const [profile] = await db
    .insert(pulseProfiles)
    .values({ clerkUserId: userId, ...data })
    .onConflictDoUpdate({
      target: pulseProfiles.clerkUserId,
      set: { ...data, updatedAt: new Date() },
    })
    .returning();
  await ensureAccount(userId);
  await db
    .update(pulseAccounts)
    .set({ ageVerified: data.age >= 18, updatedAt: new Date() })
    .where(eq(pulseAccounts.clerkUserId, userId));
  res.json(UpdateMyProfileResponse.parse(toPrivateProfile(profile)));
});

router.get("/me/vibe-dna", async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  await ensureAccount(userId);
  const existing = await db
    .select()
    .from(pulseVibeDna)
    .where(eq(pulseVibeDna.clerkUserId, userId));
  const row = existing[0] ?? {
    clerkUserId: userId,
    datingIntention: null,
    personality: [],
    communicationStyle: null,
    relationshipGoals: [],
    lifestyle: [],
    interests: [],
    familyGoals: null,
    lookingFor: [],
  };
  res.json(GetMyVibeDnaResponse.parse(row));
});

router.put("/me/vibe-dna", async (req, res): Promise<void> => {
  const parsed = UpdateMyVibeDnaBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = (req as AuthenticatedRequest).userId;
  const [row] = await db
    .insert(pulseVibeDna)
    .values({ clerkUserId: userId, ...parsed.data })
    .onConflictDoUpdate({
      target: pulseVibeDna.clerkUserId,
      set: { ...parsed.data, updatedAt: new Date() },
    })
    .returning();
  res.json(UpdateMyVibeDnaResponse.parse(row));
});

router.get("/me/preferences", async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  await ensureAccount(userId);
  const existing = await db
    .select()
    .from(pulsePreferences)
    .where(eq(pulsePreferences.clerkUserId, userId));
  const row = existing[0] ?? {
    clerkUserId: userId,
    ageMin: 18,
    ageMax: 80,
    maxDistanceMiles: 50,
    country: null,
    region: null,
    criteria: {},
  };
  res.json(GetMyPreferencesResponse.parse(row));
});

router.put("/me/preferences", async (req, res): Promise<void> => {
  const parsed = UpdateMyPreferencesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = (req as AuthenticatedRequest).userId;
  const [row] = await db
    .insert(pulsePreferences)
    .values({ clerkUserId: userId, ...parsed.data })
    .onConflictDoUpdate({
      target: pulsePreferences.clerkUserId,
      set: { ...parsed.data, updatedAt: new Date() },
    })
    .returning();
  res.json(UpdateMyPreferencesResponse.parse(row));
});

router.get("/me/settings", async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  await ensureAccount(userId);
  const existing = await db
    .select()
    .from(pulseSettings)
    .where(eq(pulseSettings.clerkUserId, userId));
  const row = existing[0] ?? {
    clerkUserId: userId,
    discoverable: true,
    showAge: true,
    showRegion: true,
    notificationsEnabled: true,
    commentPermission: "eligible",
    deleteRequested: false,
  };
  res.json(GetMySettingsResponse.parse(row));
});

router.put("/me/settings", async (req, res): Promise<void> => {
  const parsed = UpdateMySettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = (req as AuthenticatedRequest).userId;
  const [row] = await db
    .insert(pulseSettings)
    .values({ clerkUserId: userId, ...parsed.data })
    .onConflictDoUpdate({
      target: pulseSettings.clerkUserId,
      set: { ...parsed.data, updatedAt: new Date() },
    })
    .returning();
  res.json(UpdateMySettingsResponse.parse(row));
});

router.put("/me/onboarding", async (req, res): Promise<void> => {
  const parsed = UpdateOnboardingProgressBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = (req as AuthenticatedRequest).userId;
  const [row] = await db
    .insert(pulseOnboarding)
    .values({ clerkUserId: userId, ...parsed.data })
    .onConflictDoUpdate({
      target: pulseOnboarding.clerkUserId,
      set: { ...parsed.data, updatedAt: new Date() },
    })
    .returning();
  res.json(UpdateOnboardingProgressResponse.parse(row));
});

function notificationCopy(kind: string, payload: Record<string, unknown> | null) {
  const name = typeof payload?.firstName === "string" ? payload.firstName : "Someone";
  if (kind === "match") return { title: "It’s a mutual signal", body: `You and ${name} matched.` };
  if (kind === "heart_received") return { title: "You received a Heart", body: `${name} sent you a Heart.` };
  if (kind === "super_pulse_received") return { title: "You received a Super Pulse", body: `${name} sent you a Super Pulse.` };
  if (kind === "like_received") return { title: "Someone liked your profile", body: "A new Like is waiting in your private notifications." };
  if (kind === "media_interaction") return { title: "Someone reacted to your media", body: `${name} interacted with something you shared.` };
  if (kind === "media_comment") return { title: "New profile comment", body: `${name} left a comment on your media.` };
  return { title: "New PULSE activity", body: "There is new activity in your private space." };
}

function toNotification(row: typeof pulseNotifications.$inferSelect) {
  const copy = notificationCopy(row.kind, row.payload);
  return {
    id: row.id,
    kind: row.kind,
    title: copy.title,
    body: copy.body,
    payload: row.payload ?? {},
    readAt: row.readAt,
    createdAt: row.createdAt,
  };
}

router.get("/me/notifications", async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const rows = await db
    .select()
    .from(pulseNotifications)
    .where(eq(pulseNotifications.userId, userId))
    .orderBy(desc(pulseNotifications.createdAt))
    .limit(50);
  res.json(GetMyNotificationsResponse.parse({
    unreadCount: rows.filter((row) => !row.readAt).length,
    notifications: rows.map(toNotification),
  }));
});

router.post("/me/notifications/read", async (req, res): Promise<void> => {
  await db
    .update(pulseNotifications)
    .set({ readAt: new Date() })
    .where(eq(pulseNotifications.userId, (req as AuthenticatedRequest).userId));
  res.status(204).send();
});

router.delete("/me/account", async (req, res): Promise<void> => {
  const userId = (req as AuthenticatedRequest).userId;
  const profile = await db
    .select({ media: pulseProfiles.media })
    .from(pulseProfiles)
    .where(eq(pulseProfiles.clerkUserId, userId));
  const mediaIds = (profile[0]?.media ?? []).map((item) => item.id);
  if (mediaIds.length > 0) {
    await db.delete(pulseMediaLikes).where(inArray(pulseMediaLikes.mediaId, mediaIds));
    await db.delete(pulseMediaComments).where(inArray(pulseMediaComments.mediaId, mediaIds));
  }
  await db.delete(pulseMediaLikes).where(eq(pulseMediaLikes.userId, userId));
  await db.delete(pulseMediaComments).where(eq(pulseMediaComments.userId, userId));
  await db.delete(pulseNotifications).where(eq(pulseNotifications.userId, userId));
  await db.delete(pulseHearts).where(or(eq(pulseHearts.fromUserId, userId), eq(pulseHearts.toUserId, userId)));
  const matches = await db.select({ id: pulseMatches.id }).from(pulseMatches).where(or(eq(pulseMatches.userAId, userId), eq(pulseMatches.userBId, userId)));
  const matchIds = matches.map((match) => match.id);
  await db.delete(pulseMessages).where(eq(pulseMessages.senderId, userId));
  if (matchIds.length > 0) await db.delete(pulseMessages).where(inArray(pulseMessages.matchId, matchIds));
  await db.delete(pulseMatches).where(or(eq(pulseMatches.userAId, userId), eq(pulseMatches.userBId, userId)));
  await db.delete(pulseBlocks).where(or(eq(pulseBlocks.blockerId, userId), eq(pulseBlocks.blockedId, userId)));
  await db.delete(pulseReports).where(or(eq(pulseReports.reporterId, userId), eq(pulseReports.reportedId, userId)));
  await db.delete(pulseSubscriptions).where(eq(pulseSubscriptions.userId, userId));
  await db.delete(pulseVibeDna).where(eq(pulseVibeDna.clerkUserId, userId));
  await db.delete(pulseOnboarding).where(eq(pulseOnboarding.clerkUserId, userId));
  await db.delete(pulsePreferences).where(eq(pulsePreferences.clerkUserId, userId));
  await db.delete(pulseSettings).where(eq(pulseSettings.clerkUserId, userId));
  await db.delete(pulseProfiles).where(eq(pulseProfiles.clerkUserId, userId));
  await db.delete(pulseAccounts).where(eq(pulseAccounts.clerkUserId, userId));
  res.status(204).send();
});

export default router;