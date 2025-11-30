/**
 * Background job for polling Plex/Jellyfin servers for active sessions
 */

import { eq, and, desc, isNull, sql, gte, inArray } from 'drizzle-orm';
import { POLLING_INTERVALS, WS_EVENTS, type Session, type ActiveSession, type Rule, type RuleParams, type ViolationWithDetails, type ViolationSeverity, type SessionState } from '@tracearr/shared';
import { db } from '../db/client.js';
import { servers, users, sessions, rules, violations } from '../db/schema.js';
import { PlexService, type PlexSession } from '../services/plex.js';
import { JellyfinService, type JellyfinSession } from '../services/jellyfin.js';
import { geoipService, type GeoLocation } from '../services/geoip.js';
import { ruleEngine, type RuleEvaluationResult } from '../services/rules.js';
import { type CacheService, type PubSubService } from '../services/cache.js';

/**
 * Check if an IP address is private/local (won't have GeoIP data)
 * Exported for testing
 */
export function isPrivateIP(ip: string): boolean {
  if (!ip) return true;

  // IPv4 private ranges
  const privateIPv4 = [
    /^10\./,                          // 10.0.0.0/8
    /^172\.(1[6-9]|2\d|3[01])\./,     // 172.16.0.0/12
    /^192\.168\./,                     // 192.168.0.0/16
    /^127\./,                          // Loopback
    /^169\.254\./,                     // Link-local
    /^0\./,                            // Current network
  ];

  // IPv6 private ranges
  const privateIPv6 = [
    /^::1$/i,                          // Loopback
    /^fe80:/i,                         // Link-local
    /^fc/i,                            // Unique local
    /^fd/i,                            // Unique local
  ];

  return privateIPv4.some(r => r.test(ip)) || privateIPv6.some(r => r.test(ip));
}

/**
 * Parse platform and device info from Jellyfin client string
 * Jellyfin clients report as "Jellyfin iOS", "Jellyfin Android", "Jellyfin Web", etc.
 * Exported for testing
 */
export function parseJellyfinClient(client: string, deviceType?: string): { platform: string; device: string } {
  // If deviceType is provided and meaningful, use it
  if (deviceType && deviceType.length > 0 && deviceType !== 'Unknown') {
    return { platform: client, device: deviceType };
  }

  const clientLower = client.toLowerCase();

  // iOS devices
  if (clientLower.includes('ios') || clientLower.includes('iphone')) {
    return { platform: 'iOS', device: 'iPhone' };
  }
  if (clientLower.includes('ipad')) {
    return { platform: 'iOS', device: 'iPad' };
  }

  // Android and NVIDIA Shield
  if (clientLower.includes('android')) {
    if (clientLower.includes('tv') || clientLower.includes('shield')) {
      return { platform: 'Android TV', device: 'Android TV' };
    }
    return { platform: 'Android', device: 'Android' };
  }
  // NVIDIA Shield without "android" in client name
  if (clientLower.includes('shield')) {
    return { platform: 'Android TV', device: 'Android TV' };
  }

  // Smart TVs
  if (clientLower.includes('samsung') || clientLower.includes('tizen')) {
    return { platform: 'Tizen', device: 'Samsung TV' };
  }
  if (clientLower.includes('webos') || clientLower.includes('lg')) {
    return { platform: 'webOS', device: 'LG TV' };
  }
  if (clientLower.includes('roku')) {
    return { platform: 'Roku', device: 'Roku' };
  }

  // Apple TV
  if (clientLower.includes('tvos') || clientLower.includes('apple tv') || clientLower.includes('swiftfin')) {
    return { platform: 'tvOS', device: 'Apple TV' };
  }

  // Desktop/Web
  if (clientLower.includes('web')) {
    return { platform: 'Web', device: 'Browser' };
  }

  // Media players
  if (clientLower.includes('kodi')) {
    return { platform: 'Kodi', device: 'Kodi' };
  }
  if (clientLower.includes('infuse')) {
    return { platform: 'Infuse', device: 'Infuse' };
  }

  // Fallback
  return { platform: client || 'Unknown', device: deviceType || client || 'Unknown' };
}

/**
 * Calculate trust score penalty based on violation severity.
 * HIGH: -20, WARNING: -10, LOW: -5
 * Exported for testing.
 */
export function getTrustScorePenalty(severity: ViolationSeverity): number {
  return severity === 'high' ? 20 : severity === 'warning' ? 10 : 5;
}

/**
 * Calculate pause accumulation when session state changes.
 * Handles transitions between playing and paused states.
 * Exported for testing.
 */
export function calculatePauseAccumulation(
  previousState: SessionState,
  newState: SessionState,
  existingSession: { lastPausedAt: Date | null; pausedDurationMs: number },
  now: Date
): { lastPausedAt: Date | null; pausedDurationMs: number } {
  let lastPausedAt = existingSession.lastPausedAt;
  let pausedDurationMs = existingSession.pausedDurationMs;

  if (previousState === 'playing' && newState === 'paused') {
    // Started pausing - record timestamp
    lastPausedAt = now;
  } else if (previousState === 'paused' && newState === 'playing') {
    // Resumed playing - accumulate pause duration
    if (existingSession.lastPausedAt) {
      const pausedMs = now.getTime() - existingSession.lastPausedAt.getTime();
      pausedDurationMs = (existingSession.pausedDurationMs || 0) + pausedMs;
    }
    lastPausedAt = null;
  }

  return { lastPausedAt, pausedDurationMs };
}

/**
 * Calculate final duration when a session is stopped.
 * Accounts for any remaining pause time if stopped while paused.
 * Exported for testing.
 */
export function calculateStopDuration(
  session: { startedAt: Date; lastPausedAt: Date | null; pausedDurationMs: number },
  stoppedAt: Date
): { durationMs: number; finalPausedDurationMs: number } {
  const totalElapsedMs = stoppedAt.getTime() - session.startedAt.getTime();

  // Calculate final paused duration - accumulate any remaining pause if stopped while paused
  let finalPausedDurationMs = session.pausedDurationMs || 0;
  if (session.lastPausedAt) {
    // Session was stopped while paused - add the remaining pause time
    finalPausedDurationMs += stoppedAt.getTime() - session.lastPausedAt.getTime();
  }

  // Calculate actual watch duration (excludes all paused time)
  const durationMs = Math.max(0, totalElapsedMs - finalPausedDurationMs);

  return { durationMs, finalPausedDurationMs };
}

/**
 * Check if a session should be marked as "watched" (>=80% progress).
 * Exported for testing.
 */
export function checkWatchCompletion(progressMs: number | null, totalDurationMs: number | null): boolean {
  if (!progressMs || !totalDurationMs) return false;
  return (progressMs / totalDurationMs) >= 0.8;
}

/**
 * Determine if a new session should be grouped with a previous session (resume tracking).
 * Returns the referenceId to link to, or null if sessions shouldn't be grouped.
 * Exported for testing.
 */
export function shouldGroupWithPreviousSession(
  previousSession: {
    referenceId: string | null;
    id: string;
    progressMs: number | null;
    watched: boolean;
    stoppedAt: Date | null;
  },
  newProgressMs: number,
  oneDayAgo: Date
): string | null {
  // Must be recent (within 24h) and not fully watched
  if (!previousSession.stoppedAt || previousSession.stoppedAt < oneDayAgo) return null;
  if (previousSession.watched) return null;

  // New session must be resuming from same or later position
  const prevProgress = previousSession.progressMs || 0;
  if (newProgressMs >= prevProgress) {
    // Link to the first session in the chain
    return previousSession.referenceId || previousSession.id;
  }

  return null;
}

/**
 * Format quality string from bitrate and transcoding info.
 * Exported for testing.
 */
export function formatQualityString(
  transcodeBitrate: number,
  sourceBitrate: number,
  isTranscoding: boolean
): string {
  const bitrate = transcodeBitrate || sourceBitrate;
  return bitrate > 0
    ? `${Math.round(bitrate / 1000000)}Mbps`
    : isTranscoding
      ? 'Transcoding'
      : 'Direct';
}

/**
 * Check if a rule applies to a specific user.
 * Global rules (userId=null) apply to all users.
 * User-specific rules only apply to that user.
 * Exported for testing.
 */
export function doesRuleApplyToUser(rule: { userId: string | null }, userId: string): boolean {
  return rule.userId === null || rule.userId === userId;
}

let pollingInterval: NodeJS.Timeout | null = null;
let cacheService: CacheService | null = null;
let pubSubService: PubSubService | null = null;

export interface PollerConfig {
  enabled: boolean;
  intervalMs: number;
}

const defaultConfig: PollerConfig = {
  enabled: true,
  intervalMs: POLLING_INTERVALS.SESSIONS,
};

interface ServerWithToken {
  id: string;
  name: string;
  type: 'plex' | 'jellyfin';
  url: string;
  token: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ProcessedSession {
  sessionKey: string;
  ratingKey: string; // Plex/Jellyfin media identifier
  // User identification from media server
  externalUserId: string; // Plex/Jellyfin user ID for lookup
  username: string; // Display name from media server
  userThumb: string; // Avatar URL from media server
  mediaTitle: string;
  mediaType: 'movie' | 'episode' | 'track';
  // Enhanced media metadata
  grandparentTitle: string; // Show name (for episodes)
  seasonNumber: number; // Season number (for episodes)
  episodeNumber: number; // Episode number (for episodes)
  year: number; // Release year
  thumbPath: string; // Poster path
  // Connection info
  ipAddress: string;
  playerName: string;
  deviceId: string; // Unique device identifier (machineIdentifier)
  product: string; // Product/app name (e.g., "Plex for iOS")
  device: string; // Device type (e.g., "iPhone")
  platform: string;
  quality: string;
  isTranscode: boolean;
  bitrate: number;
  state: 'playing' | 'paused';
  totalDurationMs: number; // Total media length
  progressMs: number; // Current playback position
}

/**
 * Map Plex session to common format
 */
function mapPlexSession(session: PlexSession): ProcessedSession {
  // Use remotePublicAddress for geo-location if client is not local
  // This gives us the real public IP for accurate location tracking
  const ipAddress = !session.player.local && session.player.remotePublicAddress
    ? session.player.remotePublicAddress
    : session.player.address;

  // For episodes, use show poster (grandparentThumb); for movies, use thumb
  const isEpisode = session.type === 'episode';
  const thumbPath = isEpisode && session.grandparentThumb
    ? session.grandparentThumb
    : session.thumb;

  return {
    sessionKey: session.sessionKey,
    ratingKey: session.ratingKey,
    // User data from Plex session
    externalUserId: session.user.id,
    username: session.user.title || 'Unknown',
    userThumb: session.user.thumb || '',
    mediaTitle: session.title,
    mediaType: session.type === 'movie' ? 'movie' : session.type === 'episode' ? 'episode' : 'track',
    // Enhanced media metadata
    grandparentTitle: session.grandparentTitle,
    seasonNumber: session.parentIndex,
    episodeNumber: session.index,
    year: session.year,
    thumbPath,
    // Connection info
    ipAddress,
    playerName: session.player.title,
    deviceId: session.player.machineIdentifier,
    product: session.player.product,
    device: session.player.device,
    platform: session.player.platform,
    quality: `${Math.round(session.media.bitrate / 1000)}Mbps`,
    isTranscode: session.media.videoDecision !== 'directplay',
    bitrate: session.media.bitrate,
    state: session.player.state === 'paused' ? 'paused' : 'playing',
    totalDurationMs: session.duration,
    progressMs: session.viewOffset,
  };
}

/**
 * Map Jellyfin session to common format
 */
function mapJellyfinSession(session: JellyfinSession): ProcessedSession {
  const runTimeTicks = session.nowPlayingItem?.runTimeTicks ?? 0;
  const positionTicks = session.playState?.positionTicks ?? 0;
  const nowPlaying = session.nowPlayingItem;
  const isEpisode = nowPlaying?.type === 'Episode';

  // Build Jellyfin image URL path for media poster
  // For episodes, use series image; for movies, use item image
  let thumbPath = '';
  if (nowPlaying) {
    if (isEpisode && nowPlaying.seriesId && nowPlaying.seriesPrimaryImageTag) {
      thumbPath = `/Items/${nowPlaying.seriesId}/Images/Primary?tag=${nowPlaying.seriesPrimaryImageTag}`;
    } else if (nowPlaying.imageTags?.Primary) {
      thumbPath = `/Items/${nowPlaying.id}/Images/Primary?tag=${nowPlaying.imageTags.Primary}`;
    }
  }

  // Build user avatar URL from Jellyfin
  const userThumb = session.userPrimaryImageTag
    ? `/Users/${session.userId}/Images/Primary?tag=${session.userPrimaryImageTag}`
    : '';

  return {
    sessionKey: session.id,
    ratingKey: nowPlaying?.id ?? '', // Jellyfin item ID
    // User data from Jellyfin session
    externalUserId: session.userId,
    username: session.userName || 'Unknown',
    userThumb,
    mediaTitle: nowPlaying?.name ?? 'Unknown',
    mediaType: isEpisode ? 'episode' : nowPlaying?.type === 'Movie' ? 'movie' : 'track',
    // Enhanced media metadata
    grandparentTitle: nowPlaying?.seriesName ?? '',
    seasonNumber: nowPlaying?.parentIndexNumber ?? 0,
    episodeNumber: nowPlaying?.indexNumber ?? 0,
    year: nowPlaying?.productionYear ?? 0,
    thumbPath,
    // Connection info - filter private IPs to avoid GeoIP lookup failures
    ipAddress: isPrivateIP(session.remoteEndPoint) ? '' : session.remoteEndPoint,
    playerName: session.deviceName,
    deviceId: session.deviceId, // Jellyfin device ID
    product: session.client, // Client app name
    // Parse platform and device from client string
    ...parseJellyfinClient(session.client, session.deviceType),
    // Get bitrate from transcoding info OR source media
    ...(() => {
      const transcodeBitrate = session.transcodingInfo?.bitrate ?? 0;
      const sourceBitrate = session.nowPlayingItem?.mediaSources?.[0]?.bitrate ?? 0;
      const bitrate = transcodeBitrate || sourceBitrate;

      // Build quality string
      const quality = bitrate > 0
        ? `${Math.round(bitrate / 1000000)}Mbps`
        : session.transcodingInfo
          ? 'Transcoding'
          : 'Direct';

      return {
        quality,
        isTranscode: !(session.transcodingInfo?.isVideoDirect ?? true),
        bitrate,
      };
    })(),
    state: session.playState?.isPaused ? 'paused' : 'playing',
    totalDurationMs: runTimeTicks / 10000, // Ticks to ms
    progressMs: positionTicks / 10000,
  };
}

/**
 * Batch load recent sessions for multiple users (eliminates N+1 in polling loop)
 */
async function batchGetRecentUserSessions(userIds: string[], hours = 24): Promise<Map<string, Session[]>> {
  if (userIds.length === 0) return new Map();

  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  const result = new Map<string, Session[]>();

  // Initialize empty arrays for all users
  for (const userId of userIds) {
    result.set(userId, []);
  }

  // Single query to get recent sessions for all users using inArray
  const recentSessions = await db
    .select()
    .from(sessions)
    .where(and(
      inArray(sessions.userId, userIds),
      gte(sessions.startedAt, since)
    ))
    .orderBy(desc(sessions.startedAt));

  // Group by user
  for (const s of recentSessions) {
    const userSessions = result.get(s.userId) ?? [];
    if (userSessions.length < 100) { // Limit per user
      userSessions.push(mapSessionRow(s));
    }
    result.set(s.userId, userSessions);
  }

  return result;
}

/**
 * Map a single session row to Session type
 */
function mapSessionRow(s: typeof sessions.$inferSelect): Session {
  return {
    id: s.id,
    serverId: s.serverId,
    userId: s.userId,
    sessionKey: s.sessionKey,
    state: s.state,
    mediaType: s.mediaType,
    mediaTitle: s.mediaTitle,
    grandparentTitle: s.grandparentTitle,
    seasonNumber: s.seasonNumber,
    episodeNumber: s.episodeNumber,
    year: s.year,
    thumbPath: s.thumbPath,
    ratingKey: s.ratingKey,
    externalSessionId: s.externalSessionId,
    startedAt: s.startedAt,
    stoppedAt: s.stoppedAt,
    durationMs: s.durationMs,
    totalDurationMs: s.totalDurationMs,
    progressMs: s.progressMs,
    lastPausedAt: s.lastPausedAt,
    pausedDurationMs: s.pausedDurationMs,
    referenceId: s.referenceId,
    watched: s.watched,
    ipAddress: s.ipAddress,
    geoCity: s.geoCity,
    geoRegion: s.geoRegion,
    geoCountry: s.geoCountry,
    geoLat: s.geoLat,
    geoLon: s.geoLon,
    playerName: s.playerName,
    deviceId: s.deviceId,
    product: s.product,
    device: s.device,
    platform: s.platform,
    quality: s.quality,
    isTranscode: s.isTranscode,
    bitrate: s.bitrate,
  };
}

/**
 * Get all active rules for evaluation
 */
async function getActiveRules(): Promise<Rule[]> {
  const activeRules = await db.select().from(rules).where(eq(rules.isActive, true));

  return activeRules.map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type,
    params: r.params as unknown as RuleParams,
    userId: r.userId,
    isActive: r.isActive,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

/**
 * Create a violation from rule evaluation result
 * Uses a transaction to ensure violation insert and trust score update are atomic
 */
async function createViolation(
  ruleId: string,
  userId: string,
  sessionId: string,
  result: RuleEvaluationResult,
  rule: Rule
): Promise<void> {
  // Calculate trust penalty based on severity
  const trustPenalty = getTrustScorePenalty(result.severity);

  // Use transaction to ensure violation creation and trust score update are atomic
  const created = await db.transaction(async (tx) => {
    const [violation] = await tx
      .insert(violations)
      .values({
        ruleId,
        userId,
        sessionId,
        severity: result.severity,
        data: result.data,
      })
      .returning();

    // Decrease user trust score based on severity (atomic within transaction)
    await tx
      .update(users)
      .set({
        trustScore: sql`GREATEST(0, ${users.trustScore} - ${trustPenalty})`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    return violation;
  });

  // Get user details for the violation broadcast (outside transaction - read only)
  const [user] = await db
    .select({
      id: users.id,
      username: users.username,
      thumbUrl: users.thumbUrl,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  // Publish violation event for WebSocket broadcast
  if (pubSubService && created && user) {
    const violationWithDetails: ViolationWithDetails = {
      id: created.id,
      ruleId: created.ruleId,
      userId: created.userId,
      sessionId: created.sessionId,
      severity: created.severity,
      data: created.data,
      acknowledgedAt: created.acknowledgedAt,
      createdAt: created.createdAt,
      user: {
        id: user.id,
        username: user.username,
        thumbUrl: user.thumbUrl,
      },
      rule: {
        id: rule.id,
        name: rule.name,
        type: rule.type,
      },
    };

    await pubSubService.publish(WS_EVENTS.VIOLATION_NEW, violationWithDetails);
    console.log(`[Poller] Violation broadcast: ${rule.name} for user ${user.username}`);
  }
}

/**
 * Process a single server's sessions
 */
async function processServerSessions(
  server: ServerWithToken,
  activeRules: Rule[],
  cachedSessionKeys: Set<string>
): Promise<{
  newSessions: ActiveSession[];
  stoppedSessionKeys: string[];
  updatedSessions: ActiveSession[];
}> {
  const newSessions: ActiveSession[] = [];
  const updatedSessions: ActiveSession[] = [];
  const currentSessionKeys = new Set<string>();

  try {
    // Fetch sessions from server
    let processedSessions: ProcessedSession[] = [];

    if (server.type === 'plex') {
      const plexService = new PlexService(server);
      const plexSessions = await plexService.getSessions();
      processedSessions = plexSessions.map(mapPlexSession);
    } else {
      const jellyfinService = new JellyfinService(server);
      const jellyfinSessions = await jellyfinService.getSessions();
      processedSessions = jellyfinSessions.map(mapJellyfinSession);
    }

    // OPTIMIZATION: Pre-load all users for this server to avoid N+1 queries
    const serverUsers = await db
      .select()
      .from(users)
      .where(eq(users.serverId, server.id));

    // Build user caches: externalId -> user and id -> user
    const userByExternalId = new Map<string, typeof serverUsers[0]>();
    const userById = new Map<string, typeof serverUsers[0]>();
    for (const user of serverUsers) {
      if (user.externalId) {
        userByExternalId.set(user.externalId, user);
      }
      userById.set(user.id, user);
    }

    // Track users that need to be created and their session indices
    const usersToCreate: { externalId: string; username: string; thumbUrl: string | null; sessionIndex: number }[] = [];

    // First pass: identify users and resolve from cache or mark for creation
    const sessionUserIds: (string | null)[] = [];

    for (let i = 0; i < processedSessions.length; i++) {
      const processed = processedSessions[i]!;
      const existingUser = userByExternalId.get(processed.externalUserId);

      if (existingUser) {
        // Check if user data needs update
        const needsUpdate =
          existingUser.username !== processed.username ||
          (processed.userThumb && existingUser.thumbUrl !== processed.userThumb);

        if (needsUpdate) {
          await db
            .update(users)
            .set({
              username: processed.username,
              thumbUrl: processed.userThumb || existingUser.thumbUrl,
              updatedAt: new Date(),
            })
            .where(eq(users.id, existingUser.id));

          // Update cache
          existingUser.username = processed.username;
          if (processed.userThumb) existingUser.thumbUrl = processed.userThumb;
        }

        sessionUserIds.push(existingUser.id);
      } else {
        // Need to create user - mark for batch creation
        usersToCreate.push({
          externalId: processed.externalUserId,
          username: processed.username,
          thumbUrl: processed.userThumb || null,
          sessionIndex: i,
        });
        sessionUserIds.push(null); // Will be filled after creation
      }
    }

    // Batch create new users
    if (usersToCreate.length > 0) {
      const newUsers = await db
        .insert(users)
        .values(usersToCreate.map(u => ({
          serverId: server.id,
          externalId: u.externalId,
          username: u.username,
          thumbUrl: u.thumbUrl,
        })))
        .returning();

      // Update sessionUserIds with newly created user IDs
      for (let i = 0; i < usersToCreate.length; i++) {
        const userToCreate = usersToCreate[i]!;
        const newUser = newUsers[i];
        if (newUser) {
          sessionUserIds[userToCreate.sessionIndex] = newUser.id;
          userById.set(newUser.id, newUser);
          userByExternalId.set(userToCreate.externalId, newUser);
        }
      }
    }

    // OPTIMIZATION: Batch load recent sessions for rule evaluation
    // Only load for users with new sessions (not cached)
    const usersWithNewSessions = new Set<string>();
    for (let i = 0; i < processedSessions.length; i++) {
      const processed = processedSessions[i]!;
      const sessionKey = `${server.id}:${processed.sessionKey}`;
      const isNew = !cachedSessionKeys.has(sessionKey);
      const userId = sessionUserIds[i];
      if (isNew && userId) {
        usersWithNewSessions.add(userId);
      }
    }

    const recentSessionsMap = await batchGetRecentUserSessions([...usersWithNewSessions]);

    // Process each session
    for (let i = 0; i < processedSessions.length; i++) {
      const processed = processedSessions[i]!;
      const sessionKey = `${server.id}:${processed.sessionKey}`;
      currentSessionKeys.add(sessionKey);

      const userId = sessionUserIds[i];
      if (!userId) {
        console.error('Failed to get/create user for session');
        continue;
      }

      // Get user details from cache
      const userFromCache = userById.get(userId);
      const userDetail = userFromCache
        ? { id: userFromCache.id, username: userFromCache.username, thumbUrl: userFromCache.thumbUrl }
        : { id: userId, username: 'Unknown', thumbUrl: null };

      // Get GeoIP location
      const geo: GeoLocation = geoipService.lookup(processed.ipAddress);

      const isNew = !cachedSessionKeys.has(sessionKey);

      if (isNew) {
        // Check for session grouping - find recent unfinished session with same user+ratingKey
        let referenceId: string | null = null;
        if (processed.ratingKey) {
          const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
          const recentSameContent = await db
            .select()
            .from(sessions)
            .where(
              and(
                eq(sessions.userId, userId),
                eq(sessions.ratingKey, processed.ratingKey),
                gte(sessions.stoppedAt, oneDayAgo),
                eq(sessions.watched, false) // Not fully watched
              )
            )
            .orderBy(desc(sessions.stoppedAt))
            .limit(1);

          const previousSession = recentSameContent[0];
          // If user is resuming (progress >= previous), link to the original session
          if (previousSession && processed.progressMs !== undefined) {
            const prevProgress = previousSession.progressMs || 0;
            if (processed.progressMs >= prevProgress) {
              // This is a "resume" - link to the first session in the chain
              referenceId = previousSession.referenceId || previousSession.id;
            }
          }
        }

        // Insert new session with pause tracking fields
        const insertedRows = await db
          .insert(sessions)
          .values({
            serverId: server.id,
            userId,
            sessionKey: processed.sessionKey,
            ratingKey: processed.ratingKey || null,
            state: processed.state,
            mediaType: processed.mediaType,
            mediaTitle: processed.mediaTitle,
            // Enhanced media metadata
            grandparentTitle: processed.grandparentTitle || null,
            seasonNumber: processed.seasonNumber || null,
            episodeNumber: processed.episodeNumber || null,
            year: processed.year || null,
            thumbPath: processed.thumbPath || null,
            startedAt: new Date(),
            totalDurationMs: processed.totalDurationMs || null,
            progressMs: processed.progressMs || null,
            // Pause tracking - initialize based on starting state
            lastPausedAt: processed.state === 'paused' ? new Date() : null,
            pausedDurationMs: 0,
            // Session grouping
            referenceId,
            watched: false,
            // Network/device info
            ipAddress: processed.ipAddress,
            geoCity: geo.city,
            geoRegion: geo.region,
            geoCountry: geo.country,
            geoLat: geo.lat,
            geoLon: geo.lon,
            playerName: processed.playerName,
            deviceId: processed.deviceId || null,
            product: processed.product || null,
            device: processed.device || null,
            platform: processed.platform,
            quality: processed.quality,
            isTranscode: processed.isTranscode,
            bitrate: processed.bitrate,
          })
          .returning();

        const inserted = insertedRows[0];
        if (!inserted) {
          console.error('Failed to insert session');
          continue;
        }

        const session: Session = {
          id: inserted.id,
          serverId: server.id,
          userId,
          sessionKey: processed.sessionKey,
          state: processed.state,
          mediaType: processed.mediaType,
          mediaTitle: processed.mediaTitle,
          // Enhanced media metadata
          grandparentTitle: processed.grandparentTitle || null,
          seasonNumber: processed.seasonNumber || null,
          episodeNumber: processed.episodeNumber || null,
          year: processed.year || null,
          thumbPath: processed.thumbPath || null,
          ratingKey: processed.ratingKey || null,
          externalSessionId: null,
          startedAt: inserted.startedAt,
          stoppedAt: null,
          durationMs: null,
          totalDurationMs: processed.totalDurationMs || null,
          progressMs: processed.progressMs || null,
          // Pause tracking
          lastPausedAt: inserted.lastPausedAt,
          pausedDurationMs: inserted.pausedDurationMs,
          referenceId: inserted.referenceId,
          watched: inserted.watched,
          // Network/device info
          ipAddress: processed.ipAddress,
          geoCity: geo.city,
          geoRegion: geo.region,
          geoCountry: geo.country,
          geoLat: geo.lat,
          geoLon: geo.lon,
          playerName: processed.playerName,
          deviceId: processed.deviceId || null,
          product: processed.product || null,
          device: processed.device || null,
          platform: processed.platform,
          quality: processed.quality,
          isTranscode: processed.isTranscode,
          bitrate: processed.bitrate,
        };

        const activeSession: ActiveSession = {
          ...session,
          user: userDetail,
          server: { id: server.id, name: server.name, type: server.type },
        };

        newSessions.push(activeSession);

        // Evaluate rules for new session (using batch-loaded recent sessions)
        const recentSessions = recentSessionsMap.get(userId) ?? [];
        const ruleResults = await ruleEngine.evaluateSession(session, activeRules, recentSessions);

        // Create violations for triggered rules
        for (const result of ruleResults) {
          const matchingRule = activeRules.find(
            (r) =>
              (r.userId === null || r.userId === userId) && result.violated
          );
          if (matchingRule) {
            // createViolation handles both DB insert and WebSocket broadcast
            await createViolation(matchingRule.id, userId, inserted.id, result, matchingRule);
          }
        }
      } else {
        // Get existing session to check for state changes
        const existingRows = await db
          .select()
          .from(sessions)
          .where(
            and(eq(sessions.serverId, server.id), eq(sessions.sessionKey, processed.sessionKey))
          )
          .limit(1);

        const existingSession = existingRows[0];
        if (!existingSession) continue;

        const previousState = existingSession.state;
        const newState = processed.state;
        const now = new Date();

        // Build update payload with pause tracking
        const updatePayload: {
          state: 'playing' | 'paused';
          quality: string;
          bitrate: number;
          progressMs: number | null;
          lastPausedAt?: Date | null;
          pausedDurationMs?: number;
          watched?: boolean;
        } = {
          state: newState,
          quality: processed.quality,
          bitrate: processed.bitrate,
          progressMs: processed.progressMs || null,
        };

        // Handle state transitions for pause tracking
        const pauseResult = calculatePauseAccumulation(
          previousState as SessionState,
          newState,
          { lastPausedAt: existingSession.lastPausedAt, pausedDurationMs: existingSession.pausedDurationMs || 0 },
          now
        );
        updatePayload.lastPausedAt = pauseResult.lastPausedAt;
        updatePayload.pausedDurationMs = pauseResult.pausedDurationMs;

        // Check for watch completion (80% threshold)
        if (!existingSession.watched && checkWatchCompletion(processed.progressMs, processed.totalDurationMs)) {
          updatePayload.watched = true;
        }

        // Update existing session with state changes and pause tracking
        await db
          .update(sessions)
          .set(updatePayload)
          .where(eq(sessions.id, existingSession.id));

        // Build active session for cache/broadcast (with updated pause tracking values)
        const activeSession: ActiveSession = {
          id: existingSession.id,
          serverId: server.id,
          userId,
          sessionKey: processed.sessionKey,
          state: newState,
          mediaType: processed.mediaType,
          mediaTitle: processed.mediaTitle,
          // Enhanced media metadata
          grandparentTitle: processed.grandparentTitle || null,
          seasonNumber: processed.seasonNumber || null,
          episodeNumber: processed.episodeNumber || null,
          year: processed.year || null,
          thumbPath: processed.thumbPath || null,
          ratingKey: processed.ratingKey || null,
          externalSessionId: existingSession.externalSessionId,
          startedAt: existingSession.startedAt,
          stoppedAt: null,
          durationMs: null,
          totalDurationMs: processed.totalDurationMs || null,
          progressMs: processed.progressMs || null,
          // Pause tracking - use updated values
          lastPausedAt: updatePayload.lastPausedAt ?? existingSession.lastPausedAt,
          pausedDurationMs: updatePayload.pausedDurationMs ?? existingSession.pausedDurationMs ?? 0,
          referenceId: existingSession.referenceId,
          watched: updatePayload.watched ?? existingSession.watched ?? false,
          // Network/device info
          ipAddress: processed.ipAddress,
          geoCity: geo.city,
          geoRegion: geo.region,
          geoCountry: geo.country,
          geoLat: geo.lat,
          geoLon: geo.lon,
          playerName: processed.playerName,
          deviceId: processed.deviceId || null,
          product: processed.product || null,
          device: processed.device || null,
          platform: processed.platform,
          quality: processed.quality,
          isTranscode: processed.isTranscode,
          bitrate: processed.bitrate,
          user: userDetail,
          server: { id: server.id, name: server.name, type: server.type },
        };
        updatedSessions.push(activeSession);
      }
    }

    // Find stopped sessions
    const stoppedSessionKeys: string[] = [];
    for (const cachedKey of cachedSessionKeys) {
      if (cachedKey.startsWith(`${server.id}:`) && !currentSessionKeys.has(cachedKey)) {
        stoppedSessionKeys.push(cachedKey);

        // Mark session as stopped in database
        const sessionKey = cachedKey.replace(`${server.id}:`, '');
        const stoppedRows = await db
          .select()
          .from(sessions)
          .where(
            and(
              eq(sessions.serverId, server.id),
              eq(sessions.sessionKey, sessionKey),
              isNull(sessions.stoppedAt)
            )
          )
          .limit(1);

        const stoppedSession = stoppedRows[0];
        if (stoppedSession) {
          const stoppedAt = new Date();

          // Calculate final duration
          const { durationMs, finalPausedDurationMs } = calculateStopDuration(
            {
              startedAt: stoppedSession.startedAt,
              lastPausedAt: stoppedSession.lastPausedAt,
              pausedDurationMs: stoppedSession.pausedDurationMs || 0,
            },
            stoppedAt
          );

          // Check for watch completion 
          const watched = stoppedSession.watched || checkWatchCompletion(
            stoppedSession.progressMs,
            stoppedSession.totalDurationMs
          );

          await db
            .update(sessions)
            .set({
              state: 'stopped',
              stoppedAt,
              durationMs,
              pausedDurationMs: finalPausedDurationMs,
              lastPausedAt: null, // Clear the pause timestamp
              watched,
            })
            .where(eq(sessions.id, stoppedSession.id));
        }
      }
    }

    return { newSessions, stoppedSessionKeys, updatedSessions };
  } catch (error) {
    console.error(`Error polling server ${server.name}:`, error);
    return { newSessions: [], stoppedSessionKeys: [], updatedSessions: [] };
  }
}

/**
 * Poll all connected servers for active sessions
 */
async function pollServers(): Promise<void> {
  try {
    // Get all connected servers
    const allServers = await db.select().from(servers);

    if (allServers.length === 0) {
      return;
    }

    // Get cached session keys
    const cachedSessions = cacheService ? await cacheService.getActiveSessions() : null;
    const cachedSessionKeys = new Set(
      (cachedSessions ?? []).map((s) => `${s.serverId}:${s.sessionKey}`)
    );

    // Get active rules
    const activeRules = await getActiveRules();

    // Collect results from all servers
    const allNewSessions: ActiveSession[] = [];
    const allStoppedKeys: string[] = [];
    const allUpdatedSessions: ActiveSession[] = [];

    // Process each server
    for (const server of allServers) {
      const serverWithToken = server as ServerWithToken;
      const { newSessions, stoppedSessionKeys, updatedSessions } = await processServerSessions(
        serverWithToken,
        activeRules,
        cachedSessionKeys
      );

      allNewSessions.push(...newSessions);
      allStoppedKeys.push(...stoppedSessionKeys);
      allUpdatedSessions.push(...updatedSessions);
    }

    // Update cache with current active sessions
    if (cacheService) {
      const currentActiveSessions = [...allNewSessions, ...allUpdatedSessions];
      await cacheService.setActiveSessions(currentActiveSessions);

      // Update individual session cache
      for (const session of allNewSessions) {
        await cacheService.setSessionById(session.id, session);
        await cacheService.addUserSession(session.userId, session.id);
      }

      for (const session of allUpdatedSessions) {
        await cacheService.setSessionById(session.id, session);
      }

      // Remove stopped sessions from cache
      for (const key of allStoppedKeys) {
        const parts = key.split(':');
        if (parts.length >= 2) {
          const serverId = parts[0];
          const sessionKey = parts.slice(1).join(':');

          // Find the session to get its ID
          const stoppedSession = cachedSessions?.find(
            (s) => s.serverId === serverId && s.sessionKey === sessionKey
          );
          if (stoppedSession) {
            await cacheService.deleteSessionById(stoppedSession.id);
            await cacheService.removeUserSession(stoppedSession.userId, stoppedSession.id);
          }
        }
      }
    }

    // Publish events via pub/sub
    if (pubSubService) {
      for (const session of allNewSessions) {
        await pubSubService.publish('session:started', session);
      }

      for (const session of allUpdatedSessions) {
        await pubSubService.publish('session:updated', session);
      }

      for (const key of allStoppedKeys) {
        const parts = key.split(':');
        if (parts.length >= 2) {
          const serverId = parts[0];
          const sessionKey = parts.slice(1).join(':');
          const stoppedSession = cachedSessions?.find(
            (s) => s.serverId === serverId && s.sessionKey === sessionKey
          );
          if (stoppedSession) {
            await pubSubService.publish('session:stopped', stoppedSession.id);
          }
        }
      }
    }

    if (allNewSessions.length > 0 || allStoppedKeys.length > 0) {
      console.log(
        `Poll complete: ${allNewSessions.length} new, ${allUpdatedSessions.length} updated, ${allStoppedKeys.length} stopped`
      );
    }
  } catch (error) {
    console.error('Polling error:', error);
  }
}

/**
 * Initialize the poller with cache services
 */
export function initializePoller(cache: CacheService, pubSub: PubSubService): void {
  cacheService = cache;
  pubSubService = pubSub;
}

/**
 * Start the polling job
 */
export function startPoller(config: Partial<PollerConfig> = {}): void {
  const mergedConfig = { ...defaultConfig, ...config };

  if (!mergedConfig.enabled) {
    console.log('Session poller disabled');
    return;
  }

  if (pollingInterval) {
    console.log('Poller already running');
    return;
  }

  console.log(`Starting session poller with ${mergedConfig.intervalMs}ms interval`);

  // Run immediately on start
  void pollServers();

  // Then run on interval
  pollingInterval = setInterval(() => void pollServers(), mergedConfig.intervalMs);
}

/**
 * Stop the polling job
 */
export function stopPoller(): void {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    console.log('Session poller stopped');
  }
}

/**
 * Force an immediate poll
 */
export async function triggerPoll(): Promise<void> {
  await pollServers();
}
