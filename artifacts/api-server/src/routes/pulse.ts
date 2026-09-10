import { and, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  GetMyPreferencesResponse,
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
  pulseOnboarding,
  pulsePreferences,
  pulseProfiles,
  pulseSettings,
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
    languages: row.languages ?? [],
    relationshipIntention: row.relationshipIntention,
    aboutMe: row.aboutMe,
    hobbies: row.hobbies ?? [],
    lifestyle: row.lifestyle,
    familyGoals: row.familyGoals,
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
      locationLabel: profile.region && profile.country
        ? `${profile.region}, ${profile.country}`
        : profile.country,
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

export default router;