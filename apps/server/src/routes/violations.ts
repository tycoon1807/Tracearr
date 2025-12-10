/**
 * Violation management routes
 */

import type { FastifyPluginAsync } from 'fastify';
import { eq, and, desc, gte, lte, isNull, isNotNull, sql, inArray } from 'drizzle-orm';
import {
  violationQuerySchema,
  violationIdParamSchema,
} from '@tracearr/shared';
import { db } from '../db/client.js';
import { violations, rules, serverUsers, sessions, servers } from '../db/schema.js';
import { hasServerAccess } from '../utils/serverFiltering.js';

export const violationRoutes: FastifyPluginAsync = async (app) => {
  /**
   * GET /violations - List violations with pagination and filters
   *
   * Violations are filtered by server access. Users only see violations
   * from servers they have access to.
   */
  app.get(
    '/',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const query = violationQuerySchema.safeParse(request.query);
      if (!query.success) {
        return reply.badRequest('Invalid query parameters');
      }

      const {
        page = 1,
        pageSize = 50,
        serverId,
        serverUserId,
        ruleId,
        severity,
        acknowledged,
        startDate,
        endDate,
      } = query.data;

      const authUser = request.user;
      const offset = (page - 1) * pageSize;

      // Validate server access if specific server requested
      if (serverId && !hasServerAccess(authUser, serverId)) {
        return reply.forbidden('You do not have access to this server');
      }

      // Build conditions
      const conditions = [];

      // Server filter - either specific server or user's accessible servers
      if (serverId) {
        // Specific server requested
        conditions.push(eq(serverUsers.serverId, serverId));
      } else if (authUser.role !== 'owner') {
        // No specific server, filter by user's accessible servers
        if (authUser.serverIds.length === 0) {
          // No server access - return empty
          return {
            data: [],
            page,
            pageSize,
            total: 0,
            totalPages: 0,
          };
        } else if (authUser.serverIds.length === 1) {
          conditions.push(eq(serverUsers.serverId, authUser.serverIds[0]!));
        } else {
          conditions.push(inArray(serverUsers.serverId, authUser.serverIds));
        }
      }

      if (serverUserId) {
        conditions.push(eq(violations.serverUserId, serverUserId));
      }

      if (ruleId) {
        conditions.push(eq(violations.ruleId, ruleId));
      }

      if (severity) {
        conditions.push(eq(violations.severity, severity));
      }

      if (acknowledged === true) {
        conditions.push(isNotNull(violations.acknowledgedAt));
      } else if (acknowledged === false) {
        conditions.push(isNull(violations.acknowledgedAt));
      }

      if (startDate) {
        conditions.push(gte(violations.createdAt, startDate));
      }

      if (endDate) {
        conditions.push(lte(violations.createdAt, endDate));
      }

      // Query violations with joins, including server info
      const violationData = await db
        .select({
          id: violations.id,
          ruleId: violations.ruleId,
          ruleName: rules.name,
          ruleType: rules.type,
          serverUserId: violations.serverUserId,
          username: serverUsers.username,
          userThumb: serverUsers.thumbUrl,
          serverId: serverUsers.serverId,
          serverName: servers.name,
          sessionId: violations.sessionId,
          mediaTitle: sessions.mediaTitle,
          severity: violations.severity,
          data: violations.data,
          createdAt: violations.createdAt,
          acknowledgedAt: violations.acknowledgedAt,
        })
        .from(violations)
        .innerJoin(rules, eq(violations.ruleId, rules.id))
        .innerJoin(serverUsers, eq(violations.serverUserId, serverUsers.id))
        .innerJoin(servers, eq(serverUsers.serverId, servers.id))
        .innerJoin(sessions, eq(violations.sessionId, sessions.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(violations.createdAt))
        .limit(pageSize)
        .offset(offset);

      // Get total count with same filters
      // Need to use raw SQL for count with the same joins
      const countConditions = [];

      // Server filter for count query
      if (serverId) {
        countConditions.push(sql`su.server_id = ${serverId}`);
      } else if (authUser.role !== 'owner') {
        if (authUser.serverIds.length === 1) {
          countConditions.push(sql`su.server_id = ${authUser.serverIds[0]}`);
        } else if (authUser.serverIds.length > 1) {
          const serverIdList = authUser.serverIds.map((id: string) => sql`${id}`);
          countConditions.push(sql`su.server_id IN (${sql.join(serverIdList, sql`, `)})`);
        }
      }

      if (serverUserId) {
        countConditions.push(sql`v.server_user_id = ${serverUserId}`);
      }

      if (ruleId) {
        countConditions.push(sql`v.rule_id = ${ruleId}`);
      }

      if (severity) {
        countConditions.push(sql`v.severity = ${severity}`);
      }

      if (acknowledged === true) {
        countConditions.push(sql`v.acknowledged_at IS NOT NULL`);
      } else if (acknowledged === false) {
        countConditions.push(sql`v.acknowledged_at IS NULL`);
      }

      if (startDate) {
        countConditions.push(sql`v.created_at >= ${startDate}`);
      }

      if (endDate) {
        countConditions.push(sql`v.created_at <= ${endDate}`);
      }

      const whereClause = countConditions.length > 0
        ? sql`WHERE ${sql.join(countConditions, sql` AND `)}`
        : sql``;

      const countResult = await db.execute(sql`
        SELECT count(*)::int as count
        FROM violations v
        INNER JOIN server_users su ON su.id = v.server_user_id
        ${whereClause}
      `);

      const total = (countResult.rows[0] as { count: number })?.count ?? 0;

      // Transform flat data into nested structure expected by frontend
      const formattedData = violationData.map((v) => ({
        id: v.id,
        ruleId: v.ruleId,
        serverUserId: v.serverUserId,
        sessionId: v.sessionId,
        severity: v.severity,
        data: v.data,
        createdAt: v.createdAt,
        acknowledgedAt: v.acknowledgedAt,
        rule: {
          id: v.ruleId,
          name: v.ruleName,
          type: v.ruleType,
        },
        user: {
          id: v.serverUserId,
          username: v.username,
          thumbUrl: v.userThumb,
          serverId: v.serverId,
        },
        server: {
          id: v.serverId,
          name: v.serverName,
        },
      }));

      return {
        data: formattedData,
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      };
    }
  );

  /**
   * GET /violations/:id - Get a specific violation
   */
  app.get(
    '/:id',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const params = violationIdParamSchema.safeParse(request.params);
      if (!params.success) {
        return reply.badRequest('Invalid violation ID');
      }

      const { id } = params.data;
      const authUser = request.user;

      // Query with server info for access check
      const violationRows = await db
        .select({
          id: violations.id,
          ruleId: violations.ruleId,
          ruleName: rules.name,
          ruleType: rules.type,
          serverUserId: violations.serverUserId,
          username: serverUsers.username,
          userThumb: serverUsers.thumbUrl,
          serverId: serverUsers.serverId,
          serverName: servers.name,
          sessionId: violations.sessionId,
          mediaTitle: sessions.mediaTitle,
          ipAddress: sessions.ipAddress,
          geoCity: sessions.geoCity,
          geoCountry: sessions.geoCountry,
          playerName: sessions.playerName,
          platform: sessions.platform,
          severity: violations.severity,
          data: violations.data,
          createdAt: violations.createdAt,
          acknowledgedAt: violations.acknowledgedAt,
        })
        .from(violations)
        .innerJoin(rules, eq(violations.ruleId, rules.id))
        .innerJoin(serverUsers, eq(violations.serverUserId, serverUsers.id))
        .innerJoin(servers, eq(serverUsers.serverId, servers.id))
        .innerJoin(sessions, eq(violations.sessionId, sessions.id))
        .where(eq(violations.id, id))
        .limit(1);

      const violation = violationRows[0];
      if (!violation) {
        return reply.notFound('Violation not found');
      }

      // Check server access
      if (!hasServerAccess(authUser, violation.serverId)) {
        return reply.forbidden('You do not have access to this violation');
      }

      return violation;
    }
  );

  /**
   * PATCH /violations/:id - Acknowledge a violation
   */
  app.patch(
    '/:id',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const params = violationIdParamSchema.safeParse(request.params);
      if (!params.success) {
        return reply.badRequest('Invalid violation ID');
      }

      const { id } = params.data;
      const authUser = request.user;

      // Only owners can acknowledge violations
      if (authUser.role !== 'owner') {
        return reply.forbidden('Only server owners can acknowledge violations');
      }

      // Check violation exists and get server info for access check
      const violationRows = await db
        .select({
          id: violations.id,
          serverId: serverUsers.serverId,
        })
        .from(violations)
        .innerJoin(serverUsers, eq(violations.serverUserId, serverUsers.id))
        .where(eq(violations.id, id))
        .limit(1);

      const violation = violationRows[0];
      if (!violation) {
        return reply.notFound('Violation not found');
      }

      // Check server access
      if (!hasServerAccess(authUser, violation.serverId)) {
        return reply.forbidden('You do not have access to this violation');
      }

      // Update acknowledgment
      const updated = await db
        .update(violations)
        .set({
          acknowledgedAt: new Date(),
        })
        .where(eq(violations.id, id))
        .returning({
          id: violations.id,
          acknowledgedAt: violations.acknowledgedAt,
        });

      const updatedViolation = updated[0];
      if (!updatedViolation) {
        return reply.internalServerError('Failed to acknowledge violation');
      }

      return {
        success: true,
        acknowledgedAt: updatedViolation.acknowledgedAt,
      };
    }
  );

  /**
   * DELETE /violations/:id - Dismiss (delete) a violation
   */
  app.delete(
    '/:id',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const params = violationIdParamSchema.safeParse(request.params);
      if (!params.success) {
        return reply.badRequest('Invalid violation ID');
      }

      const { id } = params.data;
      const authUser = request.user;

      // Only owners can delete violations
      if (authUser.role !== 'owner') {
        return reply.forbidden('Only server owners can dismiss violations');
      }

      // Check violation exists and get server info for access check
      const violationRows = await db
        .select({
          id: violations.id,
          serverId: serverUsers.serverId,
        })
        .from(violations)
        .innerJoin(serverUsers, eq(violations.serverUserId, serverUsers.id))
        .where(eq(violations.id, id))
        .limit(1);

      const violation = violationRows[0];
      if (!violation) {
        return reply.notFound('Violation not found');
      }

      // Check server access
      if (!hasServerAccess(authUser, violation.serverId)) {
        return reply.forbidden('You do not have access to this violation');
      }

      // Delete violation
      await db.delete(violations).where(eq(violations.id, id));

      return { success: true };
    }
  );
};
