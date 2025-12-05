/**
 * Quality and Performance Statistics Routes
 *
 * GET /quality - Transcode vs direct play breakdown
 * GET /platforms - Plays by platform
 * GET /watch-time - Total watch time breakdown
 * GET /concurrent - Concurrent stream history
 */

import type { FastifyPluginAsync } from 'fastify';
import { sql, gte } from 'drizzle-orm';
import { statsQuerySchema } from '@tracearr/shared';
import { db } from '../../db/client.js';
import { sessions } from '../../db/schema.js';
import {
  playsByPlatformSince,
  qualityStatsSince,
  watchTimeSince,
  watchTimeByTypeSince,
} from '../../db/prepared.js';
import { getDateRange, hasAggregates } from './utils.js';

export const qualityRoutes: FastifyPluginAsync = async (app) => {
  /**
   * GET /quality - Transcode vs direct play breakdown
   * Uses prepared statement for 10-30% query plan reuse speedup
   */
  app.get(
    '/quality',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const query = statsQuerySchema.safeParse(request.query);
      if (!query.success) {
        return reply.badRequest('Invalid query parameters');
      }

      const { period } = query.data;
      const startDate = getDateRange(period);

      // Use prepared statement for better performance
      const qualityStats = await qualityStatsSince.execute({ since: startDate });

      const directPlay = qualityStats.find((q) => !q.isTranscode)?.count ?? 0;
      const transcode = qualityStats.find((q) => q.isTranscode)?.count ?? 0;
      const total = directPlay + transcode;

      return {
        directPlay,
        transcode,
        total,
        directPlayPercent: total > 0 ? Math.round((directPlay / total) * 100) : 0,
        transcodePercent: total > 0 ? Math.round((transcode / total) * 100) : 0,
      };
    }
  );

  /**
   * GET /platforms - Plays by platform
   * Uses prepared statement for 10-30% query plan reuse speedup
   */
  app.get(
    '/platforms',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const query = statsQuerySchema.safeParse(request.query);
      if (!query.success) {
        return reply.badRequest('Invalid query parameters');
      }

      const { period } = query.data;
      const startDate = getDateRange(period);

      // Use prepared statement for better performance
      const platformStats = await playsByPlatformSince.execute({ since: startDate });

      return { data: platformStats };
    }
  );

  /**
   * GET /watch-time - Total watch time breakdown
   * Uses prepared statements for 10-30% query plan reuse speedup
   */
  app.get(
    '/watch-time',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const query = statsQuerySchema.safeParse(request.query);
      if (!query.success) {
        return reply.badRequest('Invalid query parameters');
      }

      const { period } = query.data;
      const startDate = getDateRange(period);

      // Use prepared statements for better performance
      const [totalResult, byTypeResult] = await Promise.all([
        watchTimeSince.execute({ since: startDate }),
        watchTimeByTypeSince.execute({ since: startDate }),
      ]);

      return {
        totalHours: Math.round((Number(totalResult[0]?.totalMs ?? 0) / (1000 * 60 * 60)) * 10) / 10,
        byType: byTypeResult.map((t) => ({
          mediaType: t.mediaType,
          hours: Math.round((Number(t.totalMs) / (1000 * 60 * 60)) * 10) / 10,
        })),
      };
    }
  );

  /**
   * GET /concurrent - Peak concurrent streams per hour with direct/transcode breakdown
   *
   * Calculates TRUE peak concurrent: the maximum number of sessions running
   * simultaneously at any moment within each hour.
   *
   * Algorithm:
   * 1. Create "initial state" events for sessions already running at startDate
   * 2. Create events for session starts (+1) and stops (-1) within the window
   * 3. Use window function to calculate running count at each event
   * 4. Group by hour and take MAX for peak concurrent
   */
  app.get(
    '/concurrent',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const query = statsQuerySchema.safeParse(request.query);
      if (!query.success) {
        return reply.badRequest('Invalid query parameters');
      }

      const { period } = query.data;
      const startDate = getDateRange(period);

      // Event-based calculation with proper boundary handling
      // Uses TimescaleDB-optimized time-based filtering on hypertable
      const result = await db.execute(sql`
        WITH events AS (
          -- Sessions already running at startDate (started before, not yet stopped)
          -- These need a +1 event at startDate to establish initial state
          SELECT
            ${startDate}::timestamp AS event_time,
            1 AS delta,
            CASE WHEN is_transcode THEN 0 ELSE 1 END AS direct_delta,
            CASE WHEN is_transcode THEN 1 ELSE 0 END AS transcode_delta
          FROM sessions
          WHERE started_at < ${startDate}
            AND (stopped_at IS NULL OR stopped_at >= ${startDate})

          UNION ALL

          -- Session start events within the window
          SELECT
            started_at AS event_time,
            1 AS delta,
            CASE WHEN is_transcode THEN 0 ELSE 1 END AS direct_delta,
            CASE WHEN is_transcode THEN 1 ELSE 0 END AS transcode_delta
          FROM sessions
          WHERE started_at >= ${startDate}

          UNION ALL

          -- Session stop events within the window
          SELECT
            stopped_at AS event_time,
            -1 AS delta,
            CASE WHEN is_transcode THEN 0 ELSE -1 END AS direct_delta,
            CASE WHEN is_transcode THEN -1 ELSE 0 END AS transcode_delta
          FROM sessions
          WHERE stopped_at IS NOT NULL
            AND stopped_at >= ${startDate}
        ),
        running_counts AS (
          -- Running sum gives concurrent count at each event point
          SELECT
            event_time,
            SUM(delta) OVER w AS concurrent,
            SUM(direct_delta) OVER w AS direct_concurrent,
            SUM(transcode_delta) OVER w AS transcode_concurrent
          FROM events
          WHERE event_time IS NOT NULL
          WINDOW w AS (ORDER BY event_time ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
        )
        SELECT
          date_trunc('hour', event_time)::text AS hour,
          COALESCE(MAX(concurrent), 0)::int AS total,
          COALESCE(MAX(direct_concurrent), 0)::int AS direct,
          COALESCE(MAX(transcode_concurrent), 0)::int AS transcode
        FROM running_counts
        GROUP BY date_trunc('hour', event_time)
        ORDER BY hour
      `);

      const hourlyData = (result.rows as {
        hour: string;
        total: number;
        direct: number;
        transcode: number;
      }[]).map((r) => ({
        hour: r.hour,
        total: r.total,
        direct: r.direct,
        transcode: r.transcode,
      }));

      return { data: hourlyData };
    }
  );
};
