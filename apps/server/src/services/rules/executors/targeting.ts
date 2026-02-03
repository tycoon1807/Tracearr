import type { Session, SessionTarget } from '@tracearr/shared';

export interface TargetResolutionInput {
  target: SessionTarget | undefined;
  triggeringSession: Session;
  serverUserId: string;
  activeSessions: Session[];
}

/**
 * Resolve which sessions should be targeted by an action.
 */
export function resolveTargetSessions(input: TargetResolutionInput): Session[] {
  const { target, triggeringSession, serverUserId, activeSessions } = input;

  // Filter to only this user's sessions, sorted oldest first
  const userSessions = activeSessions
    .filter((s) => s.serverUserId === serverUserId)
    .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());

  switch (target) {
    case 'triggering':
      return [triggeringSession];

    case 'oldest':
      return userSessions.length > 0 ? [userSessions[0]!] : [];

    case 'newest':
      return userSessions.length > 0 ? [userSessions[userSessions.length - 1]!] : [];

    case 'all_except_one':
      return userSessions.slice(1);

    case 'all_user':
      return userSessions;

    default:
      return [triggeringSession];
  }
}
