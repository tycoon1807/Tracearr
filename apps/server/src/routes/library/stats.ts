/**
 * Library Stats Route
 *
 * GET /stats - Current library statistics from latest snapshots
 *
 * Uses library_snapshots for consistency with growth charts. Snapshots already
 * filter out invalid items (missing episodes with no file size), ensuring
 * accurate counts that match the graph data.
 */

import type { FastifyPluginAsync } from 'fastify';
import { sql } from 'drizzle-orm';
import {
  REDIS_KEYS,
  CACHE_TTL,
  libraryStatsQuerySchema,
  type LibraryStatsQueryInput,
} from '@tracearr/shared';
import { db } from '../../db/client.js';
import { validateServerAccess } from '../../utils/serverFiltering.js';
import { buildLibraryCacheKey } from './utils.js';

/** Library stats response shape */
interface LibraryStatsResponse {
  totalItems: number;
  totalSizeBytes: string;
  movieCount: number;
  episodeCount: number;
  showCount: number;
  qualityBreakdown: {
    count4k: number;
    count1080p: number;
    count720p: number;
    countSd: number;
  };
  asOf: string | null;
}

export const libraryStatsRoute: FastifyPluginAsync = async (app) => {
  /**
   * GET /stats - Current library statistics
   *
   * Returns aggregated library statistics from the latest day's data.
   * Supports filtering by serverId and libraryId.
   */
  app.get<{ Querystring: LibraryStatsQueryInput }>(
    '/stats',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const query = libraryStatsQuerySchema.safeParse(request.query);
      if (!query.success) {
        return reply.badRequest('Invalid query parameters');
      }

      const { serverId, libraryId, timezone } = query.data;
      const authUser = request.user;
      const tz = timezone ?? 'UTC';

      // Validate server access if specific server requested
      if (serverId) {
        const error = validateServerAccess(authUser, serverId);
        if (error) {
          return reply.forbidden(error);
        }
      }

      // Build cache key with all varying params
      const cacheKey = buildLibraryCacheKey(REDIS_KEYS.LIBRARY_STATS, serverId, libraryId, tz);

      // Try cache first
      const cached = await app.redis.get(cacheKey);
      if (cached) {
        try {
          return JSON.parse(cached) as LibraryStatsResponse;
        } catch {
          // Fall through to compute
        }
      }

      // Build server filter for library_snapshots table
      const serverFilter = serverId
        ? sql`AND ls.server_id = ${serverId}::uuid`
        : authUser.serverIds?.length
          ? sql`AND ls.server_id IN (${sql.join(
              authUser.serverIds.map((id: string) => sql`${id}::uuid`),
              sql`, `
            )})`
          : sql``;

      // Optional library filter
      const libraryFilter = libraryId ? sql`AND ls.library_id = ${libraryId}` : sql``;

      // Query latest snapshot per library, then aggregate across all matching libraries.
      // This ensures stats match the graph data (both use snapshots which filter out
      // invalid items like missing episodes with no file size). Fixes #240.
      const result = await db.execute(sql`
        WITH latest_snapshots AS (
          SELECT DISTINCT ON (ls.server_id, ls.library_id)
            ls.item_count,
            ls.total_size,
            ls.movie_count,
            ls.episode_count,
            ls.show_count,
            ls.count_4k,
            ls.count_1080p,
            ls.count_720p,
            ls.count_sd,
            ls.snapshot_time
          FROM library_snapshots ls
          WHERE 1=1
            ${serverFilter}
            ${libraryFilter}
          ORDER BY ls.server_id, ls.library_id, ls.snapshot_time DESC
        )
        SELECT
          COALESCE(SUM(item_count), 0)::int AS total_items,
          COALESCE(SUM(total_size), 0)::bigint AS total_size_bytes,
          COALESCE(SUM(movie_count), 0)::int AS movie_count,
          COALESCE(SUM(episode_count), 0)::int AS episode_count,
          COALESCE(SUM(show_count), 0)::int AS show_count,
          COALESCE(SUM(count_4k), 0)::int AS count_4k,
          COALESCE(SUM(count_1080p), 0)::int AS count_1080p,
          COALESCE(SUM(count_720p), 0)::int AS count_720p,
          COALESCE(SUM(count_sd), 0)::int AS count_sd,
          MAX(snapshot_time) AS as_of
        FROM latest_snapshots
      `);

      const row = result.rows[0] as
        | {
            total_items: number;
            total_size_bytes: string;
            movie_count: number;
            episode_count: number;
            show_count: number;
            count_4k: number;
            count_1080p: number;
            count_720p: number;
            count_sd: number;
            as_of: string | null;
          }
        | undefined;

      const stats: LibraryStatsResponse = {
        totalItems: row?.total_items ?? 0,
        totalSizeBytes: row?.total_size_bytes ?? '0',
        movieCount: row?.movie_count ?? 0,
        episodeCount: row?.episode_count ?? 0,
        showCount: row?.show_count ?? 0,
        qualityBreakdown: {
          count4k: row?.count_4k ?? 0,
          count1080p: row?.count_1080p ?? 0,
          count720p: row?.count_720p ?? 0,
          countSd: row?.count_sd ?? 0,
        },
        asOf: row?.as_of ?? null,
      };

      // Cache for 5 minutes
      await app.redis.setex(cacheKey, CACHE_TTL.LIBRARY_STATS, JSON.stringify(stats));

      return stats;
    }
  );
};
