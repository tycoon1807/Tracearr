import type { FastifyPluginAsync } from 'fastify';

export const statsRoutes: FastifyPluginAsync = async (app) => {
  // GET /stats/dashboard - Dashboard summary
  app.get('/dashboard', async (request, reply) => {
    return reply.notImplemented('Get dashboard stats not yet implemented');
  });

  // GET /stats/plays - Plays over time
  app.get('/plays', async (request, reply) => {
    return reply.notImplemented('Get play stats not yet implemented');
  });

  // GET /stats/users - Top users
  app.get('/users', async (request, reply) => {
    return reply.notImplemented('Get user stats not yet implemented');
  });

  // GET /stats/platforms - Plays by platform
  app.get('/platforms', async (request, reply) => {
    return reply.notImplemented('Get platform stats not yet implemented');
  });

  // GET /stats/locations - Geo data for map
  app.get('/locations', async (request, reply) => {
    return reply.notImplemented('Get location stats not yet implemented');
  });

  // GET /stats/watch-time - Total watch time
  app.get('/watch-time', async (request, reply) => {
    return reply.notImplemented('Get watch time stats not yet implemented');
  });

  // GET /stats/libraries - Library counts
  app.get('/libraries', async (request, reply) => {
    return reply.notImplemented('Get library stats not yet implemented');
  });

  // GET /stats/top-content - Top movies, shows, artists
  app.get('/top-content', async (request, reply) => {
    return reply.notImplemented('Get top content not yet implemented');
  });

  // GET /stats/top-users - User leaderboard
  app.get('/top-users', async (request, reply) => {
    return reply.notImplemented('Get top users not yet implemented');
  });

  // GET /stats/concurrent - Concurrent stream history
  app.get('/concurrent', async (request, reply) => {
    return reply.notImplemented('Get concurrent stats not yet implemented');
  });

  // GET /stats/quality - Transcode vs direct play breakdown
  app.get('/quality', async (request, reply) => {
    return reply.notImplemented('Get quality stats not yet implemented');
  });
};
