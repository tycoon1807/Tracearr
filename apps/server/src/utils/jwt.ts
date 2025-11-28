/**
 * Standalone JWT verification utility
 * Used by WebSocket middleware where Fastify's jwt plugin isn't available
 */

import jwt from 'jsonwebtoken';
import type { AuthUser } from '@tracearr/shared';

export interface JwtVerifyResult {
  valid: true;
  user: AuthUser;
}

export interface JwtVerifyError {
  valid: false;
  error: string;
}

export type JwtVerifyResponse = JwtVerifyResult | JwtVerifyError;

/**
 * Verify a JWT token and extract the user payload
 * @param token - JWT token string
 * @returns Verification result with user data or error
 */
export function verifyJwt(token: string): JwtVerifyResponse {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    return { valid: false, error: 'JWT_SECRET not configured' };
  }

  try {
    const payload = jwt.verify(token, secret, {
      algorithms: ['HS256'],
    }) as AuthUser;

    // Validate required fields
    if (!payload.userId || !payload.username || !payload.role) {
      return { valid: false, error: 'Invalid token payload' };
    }

    return {
      valid: true,
      user: {
        userId: payload.userId,
        username: payload.username,
        role: payload.role,
        serverIds: payload.serverIds ?? [],
      },
    };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return { valid: false, error: 'Token expired' };
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return { valid: false, error: 'Invalid token' };
    }
    return { valid: false, error: 'Token verification failed' };
  }
}
