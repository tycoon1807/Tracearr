/**
 * Stats Route Utilities
 *
 * Shared helpers for statistics routes including date range calculation
 * and TimescaleDB aggregate availability checking.
 */

import { TIME_MS } from '@tracearr/shared';
import { sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { getTimescaleStatus } from '../../db/timescale.js';

// Cache whether aggregates are available (checked once at startup)
let aggregatesAvailable: boolean | null = null;
let hyperLogLogAvailable: boolean | null = null;

/**
 * Check if TimescaleDB continuous aggregates are available.
 * Result is cached after first check.
 */
export async function hasAggregates(): Promise<boolean> {
  if (aggregatesAvailable !== null) {
    return aggregatesAvailable;
  }
  try {
    const status = await getTimescaleStatus();
    aggregatesAvailable = status.continuousAggregates.length >= 3;
    return aggregatesAvailable;
  } catch {
    aggregatesAvailable = false;
    return false;
  }
}

/**
 * Check if TimescaleDB Toolkit (HyperLogLog) is available AND the aggregates
 * have HLL columns. This is important because:
 * 1. Extension might be installed but aggregates created without HLL
 * 2. Aggregates might exist but without HLL columns if toolkit wasn't available at migration time
 *
 * Result is cached after first check.
 */
export async function hasHyperLogLog(): Promise<boolean> {
  if (hyperLogLogAvailable !== null) {
    return hyperLogLogAvailable;
  }
  try {
    // Check both: extension installed AND aggregate has plays_hll column
    const result = await db.execute(sql`
      SELECT
        EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'timescaledb_toolkit') as extension_installed,
        EXISTS(
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'daily_stats_summary'
            AND column_name = 'plays_hll'
        ) as hll_column_exists
    `);
    const row = result.rows[0] as { extension_installed: boolean; hll_column_exists: boolean } | undefined;
    hyperLogLogAvailable = (row?.extension_installed && row?.hll_column_exists) ?? false;
    return hyperLogLogAvailable;
  } catch {
    hyperLogLogAvailable = false;
    return false;
  }
}

/**
 * Reset cached state (useful for testing)
 */
export function resetCachedState(): void {
  aggregatesAvailable = null;
  hyperLogLogAvailable = null;
}

/**
 * Calculate start date based on period string.
 *
 * @param period - Time period: 'day', 'week', 'month', or 'year'
 * @returns Date representing the start of the period
 */
export function getDateRange(period: 'day' | 'week' | 'month' | 'year'): Date {
  const now = new Date();
  switch (period) {
    case 'day':
      return new Date(now.getTime() - TIME_MS.DAY);
    case 'week':
      return new Date(now.getTime() - TIME_MS.WEEK);
    case 'month':
      return new Date(now.getTime() - 30 * TIME_MS.DAY);
    case 'year':
      return new Date(now.getTime() - 365 * TIME_MS.DAY);
  }
}
