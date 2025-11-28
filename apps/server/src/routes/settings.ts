import type { FastifyPluginAsync } from 'fastify';

export const settingsRoutes: FastifyPluginAsync = async (app) => {
  // GET /settings - Get all settings
  app.get('/', async (request, reply) => {
    return reply.notImplemented('Get settings not yet implemented');
  });

  // PATCH /settings - Update settings
  app.patch('/', async (request, reply) => {
    return reply.notImplemented('Update settings not yet implemented');
  });
};
