import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { and, desc, eq } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";
import {
  ActOnCommentBody,
  ActOnCommentParams,
  ActOnCommentResponse,
  CreateMediaCommentBody,
  CreateMediaCommentParams,
  CreateMediaCommentResponse,
  GetDiscoveryBody,
  GetDiscoveryMediaParams,
  GetMediaCommentsParams,
  GetMediaCommentsResponse,
  GetMyLikesResponse,
  GetMyMatchesResponse,
  InteractWithMediaBody,
  InteractWithMediaParams,
  InteractWithMediaResponse,
  SendHeartBody,
  SendHeartResponse,
  GetDiscoveryResponse,
} from "@workspace/api-zod";
import {
  db,
  pulseAccounts,
  pulseBlocks,
  pulseHearts,
  pulseMatches,
  pulseMediaComments,
  pulseMediaLikes,
  pulsePreferences,
  pulseProfiles,
  pulseSettings,
  pulseVibeDna,
  type PulseProfile,
} from "@workspace/db";
import { ObjectNotFoundError, ObjectStorageService } from "../lib/objectStorage";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";

const router: IRouter = Router();
router.use(requireAuth);

const FREE_HEART_LIMIT = Number(process.env.PULSE_FREE_HEART_LIMIT ?? 10);
const ONLINE_WINDOW_MS = 5 * 60 * 1000;
const RECENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const NEW_USER_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

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

type Candidate = {
  profile: PulseProfile;
  account: typeof pulseAccounts.$inferSelect;
  settings: typeof pulseSettings.$inferSelect | null;
  vibe: typeof pulseVibeDna.$inferSelect | null;
};

function userIdOf(req: Request) {
  return (req as AuthenticatedRequest).userId;
}

function lower(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function valuesOverlap(left: string[] | null | undefined, right: string[] | null | undefined) {
  const rightValues = new Set((right ?? []).map(lower));
  return (left ?? []).filter((value) => rightValues.has(lower(value)));
}

function profileMediaUrl(profileId: string, mediaId: string) {
  return `/api/discover/media/${encodeURIComponent(profileId)}/${encodeURIComponent(mediaId)}`;
}

function toDiscoveryProfile(candidate: Candidate, viewerId: string, mediaLikedByMe: Set<string>, compatibility: ReturnType<typeof compatibilityFor>, mode: string) {
  const now = Date.now();
  const lastActive = candidate.account.lastActiveAt.getTime();
  const isOnline = now - lastActive <= ONLINE_WINDOW_MS;
  const isRecentlyActive = now - lastActive <= RECENT_WINDOW_MS;
  const createdAt = candidate.account.createdAt.getTime();
  const badges = [
    createdAt >= now - NEW_USER_WINDOW_MS ? "new_here" : null,
    candidate.account.emailVerified || candidate.account.ageVerified ? "real_person_verified" : null,
    candidate.account.identityVerified ? "identity_verified" : null,
    isOnline ? "online" : null,
    !isOnline && isRecentlyActive ? "recently_active" : null,
    candidate.profile.media.some((item) => item.kind === "video") ? "video" : null,
    candidate.profile.voiceVibePath ? "voice_vibe" : null,
    mode === "global" ? "exploring_globally" : null,
  ].filter((badge): badge is string => Boolean(badge));

  return {
    userId: candidate.profile.clerkUserId,
    firstName: candidate.profile.firstName,
    age: candidate.profile.age,
    gender: candidate.profile.gender,
    heightCm: candidate.profile.heightCm,
    country: candidate.profile.country,
    region: candidate.profile.region,
    languages: candidate.profile.languages ?? [],
    relationshipIntention: candidate.profile.relationshipIntention,
    aboutMe: candidate.profile.aboutMe,
    hobbies: candidate.profile.hobbies ?? [],
    lifestyle: candidate.profile.lifestyle,
    familyGoals: candidate.profile.familyGoals,
    smoking: candidate.profile.smoking,
    drinking: candidate.profile.drinking,
    futureGoals: candidate.profile.futureGoals ?? emptyFutureGoals,
    media: (candidate.profile.media ?? []).map((item) => ({
      ...item,
      path: profileMediaUrl(candidate.profile.clerkUserId, item.id),
    })),
    compatibility: compatibility.score,
    compatibilityReasons: compatibility.reasons,
    badges,
    isOnline,
    isRecentlyActive,
    likedByMe: false,
    mediaLikedByMe: (candidate.profile.media ?? [])
      .filter((item) => mediaLikedByMe.has(item.id))
      .map((item) => item.id),
  };
}

function compatibilityFor(viewer: Candidate, candidate: Candidate) {
  const viewerVibe = viewer.vibe;
  const candidateVibe = candidate.vibe;
  const reasons: string[] = [];
  let weightedScore = 0;
  let totalWeight = 0;

  const addArrayCategory = (
    label: string,
    left: string[] | null | undefined,
    right: string[] | null | undefined,
    weight: number,
  ) => {
    if (!left?.length || !right?.length) return;
    totalWeight += weight;
    const shared = valuesOverlap(left, right);
    weightedScore += (shared.length / new Set([...left, ...right].map(lower)).size) * weight;
    if (shared.length > 0 && reasons.length < 3) {
      reasons.push(`${label}: ${shared.slice(0, 2).join(" and ")}`);
    }
  };

  addArrayCategory("Shared interests", viewerVibe?.interests, candidateVibe?.interests, 24);
  addArrayCategory("Lifestyle overlap", viewerVibe?.lifestyle, candidateVibe?.lifestyle, 18);
  addArrayCategory("Relationship goals", viewerVibe?.relationshipGoals, candidateVibe?.relationshipGoals, 22);
  addArrayCategory("Personality energy", viewerVibe?.personality, candidateVibe?.personality, 14);

  if (viewerVibe?.communicationStyle && candidateVibe?.communicationStyle) {
    totalWeight += 12;
    if (lower(viewerVibe.communicationStyle) === lower(candidateVibe.communicationStyle)) {
      weightedScore += 12;
      reasons.push(`Communication style: ${viewerVibe.communicationStyle}`);
    }
  }
  if (viewerVibe?.familyGoals && candidateVibe?.familyGoals) {
    totalWeight += 10;
    if (lower(viewerVibe.familyGoals) === lower(candidateVibe.familyGoals)) {
      weightedScore += 10;
      reasons.push(`Family goals: ${viewerVibe.familyGoals}`);
    }
  }

  const score = totalWeight === 0 ? 0 : Math.round((weightedScore / totalWeight) * 100);
  return { score, reasons: reasons.slice(0, 3) };
}

function approximateDistance(viewer: Candidate, candidate: Candidate) {
  if (
    lower(viewer.profile.country) &&
    lower(viewer.profile.country) === lower(candidate.profile.country) &&
    lower(viewer.profile.region) &&
    lower(viewer.profile.region) === lower(candidate.profile.region)
  ) {
    return 0;
  }
  if (
    lower(viewer.profile.country) &&
    lower(viewer.profile.country) === lower(candidate.profile.country)
  ) {
    return 50;
  }
  return 5000;
}

function criterionFor(
  criteria: Record<string, string>,
  key: string,
): "required" | "preferred" | "doesnt_matter" {
  return (criteria[key] as "required" | "preferred" | "doesnt_matter" | undefined) ?? "doesnt_matter";
}

function matchesTextCriterion(
  criterion: "required" | "preferred" | "doesnt_matter",
  requested: string | null | undefined,
  actual: string | null | undefined,
) {
  if (!requested || criterion === "doesnt_matter") return { matches: true, preferred: false };
  const matches = lower(actual) === lower(requested) || lower(actual).includes(lower(requested));
  return { matches: criterion !== "required" || matches, preferred: criterion === "preferred" && matches };
}

function matchesArrayCriterion(
  criterion: "required" | "preferred" | "doesnt_matter",
  requested: string[] | undefined,
  actual: string[] | null | undefined,
) {
  if (!requested?.length || criterion === "doesnt_matter") return { matches: true, preferred: false };
  const overlap = valuesOverlap(requested, actual);
  const matches = criterion === "required" ? overlap.length === requested.length : overlap.length > 0;
  return { matches: criterion !== "required" || matches, preferred: criterion === "preferred" && matches };
}

async function ensureAccount(userId: string) {
  const now = new Date();
  const [account] = await db
    .insert(pulseAccounts)
    .values({ clerkUserId: userId, lastActiveAt: now })
    .onConflictDoUpdate({
      target: pulseAccounts.clerkUserId,
      set: { lastActiveAt: now, updatedAt: now },
    })
    .returning();
  return account;
}

async function loadCandidate(userId: string): Promise<Candidate> {
  const account = await ensureAccount(userId);
  const [profile] = await db.select().from(pulseProfiles).where(eq(pulseProfiles.clerkUserId, userId));
  const [settings] = await db.select().from(pulseSettings).where(eq(pulseSettings.clerkUserId, userId));
  const [vibe] = await db.select().from(pulseVibeDna).where(eq(pulseVibeDna.clerkUserId, userId));
  const actualProfile = profile ?? (await db.insert(pulseProfiles).values({ clerkUserId: userId }).returning())[0];
  return { profile: actualProfile, account, settings: settings ?? null, vibe: vibe ?? null };
}

async function blockedBetween(viewerId: string, candidateId: string) {
  const rows = await db
    .select()
    .from(pulseBlocks)
    .where(eq(pulseBlocks.blockerId, viewerId));
  return rows.some((row) => row.blockedId === candidateId) ||
    (await db.select().from(pulseBlocks).where(eq(pulseBlocks.blockerId, candidateId))).some((row) => row.blockedId === viewerId);
}

async function heartAllowance(userId: string) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recent = await db
    .select()
    .from(pulseHearts)
    .where(eq(pulseHearts.fromUserId, userId));
  const hearts = recent
    .filter((heart) => heart.kind === "heart" && heart.createdAt >= since)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const remaining = Math.max(0, FREE_HEART_LIMIT - hearts.length);
  const refillAt = hearts[0]?.createdAt
    ? new Date(hearts[0].createdAt.getTime() + 24 * 60 * 60 * 1000)
    : new Date(Date.now() + 24 * 60 * 60 * 1000);
  return { remaining, limit: FREE_HEART_LIMIT, refillAt };
}

function pairKey(left: string, right: string) {
  return [left, right].sort().join(":");
}

async function matchForUsers(left: string, right: string) {
  const [match] = await db.select().from(pulseMatches).where(eq(pulseMatches.pairKey, pairKey(left, right)));
  return match;
}

async function createMatchIfMutual(fromUserId: string, toUserId: string) {
  const reverse = await db
    .select()
    .from(pulseHearts)
    .where(and(eq(pulseHearts.fromUserId, toUserId), eq(pulseHearts.toUserId, fromUserId)));
  if (reverse.length === 0) return null;
  const key = pairKey(fromUserId, toUserId);
  await db
    .insert(pulseMatches)
    .values({ id: randomUUID(), userAId: fromUserId, userBId: toUserId, pairKey: key })
    .onConflictDoNothing({ target: pulseMatches.pairKey });
  return matchForUsers(fromUserId, toUserId);
}

async function matchResponse(match: typeof pulseMatches.$inferSelect | null | undefined, viewerId: string) {
  if (!match) return null;
  const otherId = match.userAId === viewerId ? match.userBId : match.userAId;
  const [profile] = await db.select().from(pulseProfiles).where(eq(pulseProfiles.clerkUserId, otherId));
  if (!profile) return null;
  return {
    id: match.id,
    userId: otherId,
    firstName: profile.firstName,
    age: profile.age,
    region: profile.region,
    country: profile.country,
    createdAt: match.createdAt.toISOString(),
  };
}

async function findMedia(mediaId: string) {
  const profiles = await db.select().from(pulseProfiles);
  for (const profile of profiles) {
    const media = (profile.media ?? []).find((item) => item.id === mediaId);
    if (media) return { profile, media };
  }
  return null;
}

async function canViewProfile(viewerId: string, profileId: string) {
  if (viewerId === profileId) return true;
  const [settings] = await db.select().from(pulseSettings).where(eq(pulseSettings.clerkUserId, profileId));
  if (settings?.discoverable === false) return false;
  return !(await blockedBetween(viewerId, profileId));
}

function commentIsBlocked(body: string) {
  return [
    /\bi(?:'| wi)ll kill you\b/i,
    /\bkill yourself\b/i,
    /\brape\b/i,
    /\bstalk(?:ing)?\b/i,
    /\bhate you because\b/i,
    /\b(?:whore|slut|cunt)\b/i,
  ].some((pattern) => pattern.test(body));
}

async function commentPermissionAllowed(viewerId: string, ownerId: string, setting: string) {
  if (setting === "nobody") return false;
  if (setting === "eligible") return true;
  if (setting === "verified") {
    const account = await ensureAccount(viewerId);
    return account.emailVerified || account.ageVerified || account.identityVerified;
  }
  if (setting === "liked") {
    return (await db.select().from(pulseHearts).where(and(eq(pulseHearts.fromUserId, ownerId), eq(pulseHearts.toUserId, viewerId)))).length > 0;
  }
  if (setting === "matches") return Boolean(await matchForUsers(viewerId, ownerId));
  return false;
}

async function commentResponse(row: typeof pulseMediaComments.$inferSelect, viewerId: string) {
  const [author] = await db.select().from(pulseProfiles).where(eq(pulseProfiles.clerkUserId, row.userId));
  return {
    id: row.id,
    mediaId: row.mediaId,
    userId: row.userId,
    authorName: author?.firstName || "PULSE member",
    body: row.body,
    replyToId: row.replyToId,
    createdAt: row.createdAt.toISOString(),
    canLikeBack: row.userId !== viewerId,
  };
}

router.post("/discover", async (req, res): Promise<void> => {
  const parsed = GetDiscoveryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const viewerId = userIdOf(req);
  const viewer = await loadCandidate(viewerId);
  const [preferences] = await db.select().from(pulsePreferences).where(eq(pulsePreferences.clerkUserId, viewerId));
  const filters = parsed.data;
  const mode = filters.mode;
  const allowance = await heartAllowance(viewerId);
  if (mode === "right-now") {
    res.json(GetDiscoveryResponse.parse({ mode, profiles: [], heartAllowance: { ...allowance, refillAt: allowance.refillAt.toISOString() } }));
    return;
  }

  const accounts = await db.select().from(pulseAccounts);
  const profiles = await db.select().from(pulseProfiles);
  const settings = await db.select().from(pulseSettings);
  const vibes = await db.select().from(pulseVibeDna);
  const settingsMap = new Map(settings.map((item) => [item.clerkUserId, item]));
  const vibesMap = new Map(vibes.map((item) => [item.clerkUserId, item]));
  const accountMap = new Map(accounts.map((item) => [item.clerkUserId, item]));
  const hearts = await db.select().from(pulseHearts).where(eq(pulseHearts.fromUserId, viewerId));
  const mediaLikes = await db.select().from(pulseMediaLikes).where(eq(pulseMediaLikes.userId, viewerId));
  const mediaLikedByMe = new Set(mediaLikes.map((item) => item.mediaId));
  const blocked = await db.select().from(pulseBlocks).where(eq(pulseBlocks.blockerId, viewerId));
  const blockedIds = new Set(blocked.map((item) => item.blockedId));
  const [reverseBlocks] = await Promise.all([db.select().from(pulseBlocks).where(eq(pulseBlocks.blockedId, viewerId))]);
  reverseBlocks.forEach((item) => blockedIds.add(item.blockerId));

  const requestedAgeMin = filters.ageMin ?? preferences?.ageMin ?? 18;
  const requestedAgeMax = filters.ageMax ?? preferences?.ageMax ?? 80;
  const requestedDistance = filters.distanceMiles ?? preferences?.maxDistanceMiles ?? 50;
  const candidates: Array<{ candidate: Candidate; compatibility: ReturnType<typeof compatibilityFor>; rank: number }> = [];

  for (const profile of profiles) {
    const account = accountMap.get(profile.clerkUserId);
    if (!account || profile.clerkUserId === viewerId || blockedIds.has(profile.clerkUserId) || !profile.firstName) continue;
    const candidate: Candidate = {
      profile,
      account,
      settings: settingsMap.get(profile.clerkUserId) ?? null,
      vibe: vibesMap.get(profile.clerkUserId) ?? null,
    };
    if (candidate.settings?.discoverable === false) continue;
    if (profile.age < requestedAgeMin || profile.age > requestedAgeMax) continue;
    if (mode === "nearby" && !filters.worldwide && approximateDistance(viewer, candidate) > requestedDistance) continue;
    if (filters.gender && criterionFor(filters.criteria, "gender") === "required" && lower(profile.gender) !== lower(filters.gender)) continue;
    if (filters.city && criterionFor(filters.criteria, "city") === "required" && !lower(profile.region).includes(lower(filters.city))) continue;
    if (filters.country && criterionFor(filters.criteria, "country") === "required" && lower(profile.country) !== lower(filters.country)) continue;
    if (filters.verified && !(account.emailVerified || account.ageVerified || account.identityVerified)) continue;
    if (filters.newUsers && account.createdAt.getTime() < Date.now() - NEW_USER_WINDOW_MS) continue;
    if (filters.onlineOnly && account.lastActiveAt.getTime() < Date.now() - ONLINE_WINDOW_MS) continue;
    if (filters.hasVideo && !profile.media.some((item) => item.kind === "video")) continue;
    if (filters.hasVoiceVibe && !profile.voiceVibePath) continue;

    const intentionMatch = matchesTextCriterion(criterionFor(filters.criteria, "relationshipIntention"), filters.relationshipIntention, profile.relationshipIntention);
    if (!intentionMatch.matches) continue;
    const childrenMatch = matchesTextCriterion(criterionFor(filters.criteria, "children"), filters.children, profile.familyGoals);
    if (!childrenMatch.matches) continue;
    const smokingMatch = matchesTextCriterion(criterionFor(filters.criteria, "smoking"), filters.smoking, profile.smoking);
    if (!smokingMatch.matches) continue;
    const drinkingMatch = matchesTextCriterion(criterionFor(filters.criteria, "drinking"), filters.drinking, profile.drinking);
    if (!drinkingMatch.matches) continue;
    const languageMatch = matchesArrayCriterion(criterionFor(filters.criteria, "language"), filters.language ? [filters.language] : undefined, profile.languages);
    if (!languageMatch.matches) continue;
    const interestMatch = matchesArrayCriterion(criterionFor(filters.criteria, "interests"), filters.interests, [...(candidate.vibe?.interests ?? []), ...(profile.hobbies ?? [])]);
    if (!interestMatch.matches) continue;

    const compatibility = compatibilityFor(viewer, candidate);
    const preferredCount = [intentionMatch, childrenMatch, smokingMatch, drinkingMatch, languageMatch, interestMatch].filter((item) => item.preferred).length;
    const rank = compatibility.score + preferredCount * 8 + (account.lastActiveAt.getTime() > Date.now() - ONLINE_WINDOW_MS ? 4 : 0);
    candidates.push({ candidate, compatibility, rank });
  }

  candidates.sort((a, b) => b.rank - a.rank);
  const results = candidates.slice(0, 40).map(({ candidate, compatibility }) => {
    const result = toDiscoveryProfile(candidate, viewerId, mediaLikedByMe, compatibility, mode);
    result.likedByMe = hearts.some((heart) => heart.toUserId === candidate.profile.clerkUserId);
    return result;
  });
  res.json(GetDiscoveryResponse.parse({
    mode,
    profiles: results,
    heartAllowance: { ...allowance, refillAt: allowance.refillAt.toISOString() },
  }));
});

router.post("/discover/heart", async (req, res): Promise<void> => {
  const parsed = SendHeartBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const viewerId = userIdOf(req);
  const { toUserId, kind } = parsed.data;
  if (viewerId === toUserId || !(await canViewProfile(viewerId, toUserId))) {
    res.status(400).json({ error: "That profile is not available." });
    return;
  }
  const existing = await db.select().from(pulseHearts).where(and(eq(pulseHearts.fromUserId, viewerId), eq(pulseHearts.toUserId, toUserId), eq(pulseHearts.kind, kind)));
  const allowance = await heartAllowance(viewerId);
  if (existing[0]) {
    const match = await createMatchIfMutual(viewerId, toUserId);
    res.json(SendHeartResponse.parse({ heartId: existing[0].id, kind, ...allowance, refillAt: allowance.refillAt.toISOString(), matched: Boolean(match), match: await matchResponse(match, viewerId) }));
    return;
  }
  if (kind === "heart" && allowance.remaining <= 0) {
    res.status(429).json(SendHeartResponse.parse({ heartId: null, kind, ...allowance, refillAt: allowance.refillAt.toISOString(), matched: false, match: null }));
    return;
  }
  const [heart] = await db.insert(pulseHearts).values({ id: randomUUID(), fromUserId: viewerId, toUserId, kind }).returning();
  const match = await createMatchIfMutual(viewerId, toUserId);
  const nextAllowance = await heartAllowance(viewerId);
  res.json(SendHeartResponse.parse({ heartId: heart.id, kind, ...nextAllowance, refillAt: nextAllowance.refillAt.toISOString(), matched: Boolean(match), match: await matchResponse(match, viewerId) }));
});

router.get("/me/matches", async (req, res): Promise<void> => {
  const viewerId = userIdOf(req);
  const rows = await db.select().from(pulseMatches).where(eq(pulseMatches.userAId, viewerId));
  const otherRows = await db.select().from(pulseMatches).where(eq(pulseMatches.userBId, viewerId));
  const matches = await Promise.all([...rows, ...otherRows].map(async (row) => {
    const otherId = row.userAId === viewerId ? row.userBId : row.userAId;
    const [profile] = await db.select().from(pulseProfiles).where(eq(pulseProfiles.clerkUserId, otherId));
    return profile ? { id: row.id, userId: otherId, firstName: profile.firstName, age: profile.age, region: profile.region, country: profile.country, createdAt: row.createdAt.toISOString() } : null;
  }));
  res.json(GetMyMatchesResponse.parse({ matches: matches.filter(Boolean) }));
});

router.get("/me/likes", async (req, res): Promise<void> => {
  const viewerId = userIdOf(req);
  const likes = await db.select().from(pulseHearts).where(eq(pulseHearts.toUserId, viewerId));
  const uniqueLikeUsers = [...new Map(likes.filter((like) => like.kind === "heart").map((like) => [like.fromUserId, like])).values()];
  const previews = await Promise.all(uniqueLikeUsers.slice(0, 24).map(async (like) => {
    const [profile] = await db.select().from(pulseProfiles).where(eq(pulseProfiles.clerkUserId, like.fromUserId));
    const photo = profile?.media.find((item) => item.kind === "photo");
    return {
      userId: like.fromUserId,
      firstInitial: profile?.firstName?.slice(0, 1).toUpperCase() || "?",
      photoPath: photo ? profileMediaUrl(like.fromUserId, photo.id) : null,
      createdAt: like.createdAt.toISOString(),
      blurred: true,
    };
  }));
  res.json(GetMyLikesResponse.parse({ count: uniqueLikeUsers.length, previews }));
});

router.post("/discover/media/:mediaId/interaction", async (req, res): Promise<void> => {
  const params = InteractWithMediaParams.safeParse(req.params);
  const body = InteractWithMediaBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid media interaction." });
    return;
  }
  const found = await findMedia(params.data.mediaId);
  if (!found || !(await canViewProfile(userIdOf(req), found.profile.clerkUserId))) {
    res.status(404).json({ error: "Media not found." });
    return;
  }
  const viewerId = userIdOf(req);
  const reaction = body.data.kind === "reaction" ? body.data.reaction ?? "like" : body.data.kind;
  const [existing] = await db.select().from(pulseMediaLikes).where(and(eq(pulseMediaLikes.mediaId, params.data.mediaId), eq(pulseMediaLikes.userId, viewerId)));
  let active = true;
  if (existing) {
    if (existing.reaction === reaction) {
      await db.delete(pulseMediaLikes).where(eq(pulseMediaLikes.id, existing.id));
      active = false;
    } else {
      await db.update(pulseMediaLikes).set({ reaction, createdAt: new Date() }).where(eq(pulseMediaLikes.id, existing.id));
    }
  } else {
    await db.insert(pulseMediaLikes).values({ id: randomUUID(), mediaId: params.data.mediaId, userId: viewerId, reaction });
  }
  res.json(InteractWithMediaResponse.parse({ mediaId: params.data.mediaId, kind: body.data.kind, reaction: active ? reaction : null, active }));
});

router.get("/discover/media/:mediaId/comments", async (req, res): Promise<void> => {
  const params = GetMediaCommentsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid media." });
    return;
  }
  const found = await findMedia(params.data.mediaId);
  if (!found || !(await canViewProfile(userIdOf(req), found.profile.clerkUserId))) {
    res.status(404).json({ error: "Media not found." });
    return;
  }
  const rows = await db.select().from(pulseMediaComments).where(and(eq(pulseMediaComments.mediaId, params.data.mediaId), eq(pulseMediaComments.status, "visible"))).orderBy(desc(pulseMediaComments.createdAt));
  res.json(GetMediaCommentsResponse.parse({ comments: await Promise.all(rows.map((row) => commentResponse(row, userIdOf(req)))) }));
});

router.post("/discover/media/:mediaId/comments", async (req, res): Promise<void> => {
  const params = CreateMediaCommentParams.safeParse(req.params);
  const body = CreateMediaCommentBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid comment." });
    return;
  }
  const found = await findMedia(params.data.mediaId);
  const viewerId = userIdOf(req);
  if (!found || !(await canViewProfile(viewerId, found.profile.clerkUserId))) {
    res.status(404).json({ error: "Media not found." });
    return;
  }
  const [settings] = await db.select().from(pulseSettings).where(eq(pulseSettings.clerkUserId, found.profile.clerkUserId));
  if (!(await commentPermissionAllowed(viewerId, found.profile.clerkUserId, settings?.commentPermission ?? "eligible"))) {
    res.status(403).json({ error: "Comments are limited by this profile owner." });
    return;
  }
  if (commentIsBlocked(body.data.body)) {
    res.status(400).json({ error: "That comment cannot be posted." });
    return;
  }
  const [comment] = await db.insert(pulseMediaComments).values({
    id: randomUUID(),
    mediaId: params.data.mediaId,
    userId: viewerId,
    body: body.data.body.trim(),
    replyToId: body.data.replyToId ?? null,
  }).returning();
  res.status(201).json(CreateMediaCommentResponse.parse(await commentResponse(comment, viewerId)));
});

router.post("/discover/comments/:commentId/action", async (req, res): Promise<void> => {
  const params = ActOnCommentParams.safeParse(req.params);
  const body = ActOnCommentBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid comment action." });
    return;
  }
  const [comment] = await db.select().from(pulseMediaComments).where(eq(pulseMediaComments.id, params.data.commentId));
  if (!comment) {
    res.status(404).json({ error: "Comment not found." });
    return;
  }
  const found = await findMedia(comment.mediaId);
  if (!found || found.profile.clerkUserId !== userIdOf(req)) {
    res.status(404).json({ error: "Comment not found." });
    return;
  }
  let matched = false;
  let nextComment = comment;
  if (body.data.action === "ignore") {
    [nextComment] = await db.update(pulseMediaComments).set({ status: "ignored", ignoredAt: new Date() }).where(eq(pulseMediaComments.id, comment.id)).returning();
  } else if (body.data.action === "like_back") {
    const [heart] = await db.select().from(pulseHearts).where(and(eq(pulseHearts.fromUserId, found.profile.clerkUserId), eq(pulseHearts.toUserId, comment.userId), eq(pulseHearts.kind, "heart")));
    if (!heart) await db.insert(pulseHearts).values({ id: randomUUID(), fromUserId: found.profile.clerkUserId, toUserId: comment.userId, kind: "heart" });
    [nextComment] = await db.update(pulseMediaComments).set({ likedBackAt: new Date() }).where(eq(pulseMediaComments.id, comment.id)).returning();
    matched = Boolean(await createMatchIfMutual(found.profile.clerkUserId, comment.userId));
  } else if (body.data.body?.trim() && !commentIsBlocked(body.data.body)) {
    [nextComment] = await db.insert(pulseMediaComments).values({
      id: randomUUID(),
      mediaId: comment.mediaId,
      userId: found.profile.clerkUserId,
      body: body.data.body.trim(),
      replyToId: comment.id,
    }).returning();
  }
  res.json(ActOnCommentResponse.parse({ comment: await commentResponse(nextComment, userIdOf(req)), matched }));
});

router.get("/discover/media/:profileId/:mediaId", async (req, res): Promise<void> => {
  const params = GetDiscoveryMediaParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid media." });
    return;
  }
  const viewerId = userIdOf(req);
  if (!(await canViewProfile(viewerId, params.data.profileId))) {
    res.status(403).json({ error: "This profile is not available." });
    return;
  }
  const [profile] = await db.select().from(pulseProfiles).where(eq(pulseProfiles.clerkUserId, params.data.profileId));
  const media = profile?.media.find((item) => item.id === params.data.mediaId);
  if (!media) {
    res.status(404).json({ error: "Media not found." });
    return;
  }
  try {
    const file = await new ObjectStorageService().getObjectEntityFile(media.path);
    const response = await new ObjectStorageService().downloadObject(file);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    if (response.body) Readable.fromWeb(response.body as ReadableStream<Uint8Array>).pipe(res);
    else res.end();
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Media not found." });
      return;
    }
    req.log.error({ err: error }, "Error serving discovery media");
    res.status(500).json({ error: "Failed to serve media." });
  }
});

export default router;