/**
 * Tasks routes - Unified running tasks API
 *
 * Aggregates status from all background job queues into a single endpoint
 * for UI display (navbar dropdown showing running operations).
 */

import type { FastifyPluginAsync } from 'fastify';
import type { RunningTask } from '@tracearr/shared';
import { getAllActiveImports } from '../jobs/importQueue.js';
import { getAllActiveLibrarySyncs } from '../jobs/librarySyncQueue.js';
import { getMaintenanceProgress } from '../jobs/maintenanceQueue.js';
import { db } from '../db/client.js';
import { servers } from '../db/schema.js';
import { eq } from 'drizzle-orm';

/**
 * Get server name by ID (for context in task display)
 */
async function getServerName(serverId: string): Promise<string> {
  const [server] = await db
    .select({ name: servers.name })
    .from(servers)
    .where(eq(servers.id, serverId))
    .limit(1);
  return server?.name ?? 'Unknown Server';
}

export const tasksRoutes: FastifyPluginAsync = async (app) => {
  /**
   * GET /tasks/running - Get all currently running background tasks
   *
   * Returns unified list of running tasks from:
   * - Library sync queue
   * - Import queue (Tautulli, Jellystat)
   * - Maintenance queue
   */
  app.get('/running', { preHandler: [app.authenticate] }, async () => {
    const tasks: RunningTask[] = [];

    // Get library sync tasks
    // Only show scheduled syncs if actively running (hide queued cron jobs)
    const librarySyncs = await getAllActiveLibrarySyncs();
    for (const sync of librarySyncs) {
      const isRunning = sync.state === 'active';
      const isScheduled = sync.triggeredBy === 'scheduled';

      // Skip scheduled jobs that are just queued - only show when running
      if (isScheduled && !isRunning) {
        continue;
      }

      const serverName = await getServerName(sync.serverId);
      tasks.push({
        id: sync.jobId,
        type: 'library_sync',
        name: 'Library Sync',
        status: isRunning ? 'running' : 'pending',
        progress: sync.progress,
        message: isRunning ? `Syncing ${serverName}...` : 'Waiting to start',
        startedAt: new Date(sync.createdAt).toISOString(),
        context: serverName,
      });
    }

    // Get import tasks
    const imports = await getAllActiveImports();
    for (const imp of imports) {
      const serverName = await getServerName(imp.serverId);
      const importType = imp.type === 'tautulli' ? 'Tautulli' : 'Jellystat';

      // Extract progress percentage from progress object if available
      let progressPct: number | null = null;
      let message = 'Starting import...';

      if (typeof imp.progress === 'number') {
        progressPct = imp.progress;
        message = `Importing... ${imp.progress}%`;
      } else if (imp.progress && typeof imp.progress === 'object') {
        const p = imp.progress as {
          processedRecords?: number;
          totalRecords?: number;
          message?: string;
        };
        if (p.totalRecords && p.totalRecords > 0 && p.processedRecords !== undefined) {
          progressPct = Math.round((p.processedRecords / p.totalRecords) * 100);
        }
        if (p.message) {
          message = p.message;
        }
      }

      tasks.push({
        id: imp.jobId,
        type: imp.type === 'tautulli' ? 'tautulli_import' : 'jellystat_import',
        name: `${importType} Import`,
        status: imp.state === 'active' ? 'running' : 'pending',
        progress: progressPct,
        message,
        startedAt: new Date(imp.createdAt).toISOString(),
        context: serverName,
      });
    }

    // Get maintenance task
    const maintenance = getMaintenanceProgress();
    if (maintenance && (maintenance.status === 'running' || maintenance.status === 'idle')) {
      const progressPct =
        maintenance.totalRecords > 0
          ? Math.round((maintenance.processedRecords / maintenance.totalRecords) * 100)
          : null;

      // Format maintenance job type for display
      const typeNames: Record<string, string> = {
        normalize_players: 'Normalize Players',
        normalize_countries: 'Normalize Countries',
        fix_imported_progress: 'Fix Import Progress',
        rebuild_timescale_views: 'Rebuild Analytics',
        normalize_codecs: 'Normalize Codecs',
        backfill_user_dates: 'Backfill User Dates',
        backfill_library_snapshots: 'Generate Library History',
      };

      tasks.push({
        id: `maintenance-${maintenance.type}`,
        type: 'maintenance',
        name: typeNames[maintenance.type] ?? 'Maintenance',
        status: maintenance.status === 'running' ? 'running' : 'pending',
        progress: progressPct,
        message: maintenance.message,
        startedAt: maintenance.startedAt ?? new Date().toISOString(),
        context: maintenance.type,
      });
    }

    return { tasks };
  });
};
