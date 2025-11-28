import type { FastifyPluginAsync } from 'fastify';

export const authRoutes: FastifyPluginAsync = async (app) => {
  // POST /auth/login - Initiate OAuth flow
  app.post('/login', async (request, reply) => {
    return reply.notImplemented('OAuth login not yet implemented');
  });

  // POST /auth/callback - OAuth callback
  app.post('/callback', async (request, reply) => {
    return reply.notImplemented('OAuth callback not yet implemented');
  });

  // POST /auth/logout - Revoke token
  app.post('/logout', async (request, reply) => {
    return reply.notImplemented('Logout not yet implemented');
  });

  // GET /auth/me - Current user info
  app.get('/me', async (request, reply) => {
    return reply.notImplemented('Get current user not yet implemented');
  });
};
