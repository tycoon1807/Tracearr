import type { FastifyPluginAsync } from 'fastify';

export const userRoutes: FastifyPluginAsync = async (app) => {
  // GET /users - List users
  app.get('/', async (request, reply) => {
    return reply.notImplemented('List users not yet implemented');
  });

  // GET /users/:id - User detail
  app.get('/:id', async (request, reply) => {
    return reply.notImplemented('Get user not yet implemented');
  });

  // PATCH /users/:id - Update user
  app.patch('/:id', async (request, reply) => {
    return reply.notImplemented('Update user not yet implemented');
  });

  // GET /users/:id/sessions - User's session history
  app.get('/:id/sessions', async (request, reply) => {
    return reply.notImplemented('Get user sessions not yet implemented');
  });
};
