/**
 * Background job for polling Plex/Jellyfin servers
 */

import { POLLING_INTERVALS } from '@tracearr/shared';

let pollingInterval: NodeJS.Timeout | null = null;

export interface PollerConfig {
  enabled: boolean;
  intervalMs: number;
}

const defaultConfig: PollerConfig = {
  enabled: true,
  intervalMs: POLLING_INTERVALS.SESSIONS,
};

/**
 * Poll all connected servers for active sessions
 */
async function pollServers(): Promise<void> {
  try {
    // 1. Get all connected servers from database
    // 2. For each server, fetch active sessions
    // 3. Compare with cached sessions in Redis
    // 4. Process new/updated/stopped sessions
    // 5. Run rule evaluation on new sessions
    // 6. Update cache and broadcast changes via WebSocket

    console.log('Polling servers for sessions...');
  } catch (error) {
    console.error('Polling error:', error);
  }
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
  pollServers();

  // Then run on interval
  pollingInterval = setInterval(pollServers, mergedConfig.intervalMs);
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
