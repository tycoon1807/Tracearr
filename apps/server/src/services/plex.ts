/**
 * Plex API integration service
 */

import type { Session, User, Server } from '@tracearr/shared';

export interface PlexAuthResult {
  id: string;
  username: string;
  email: string;
  thumb: string;
  token: string;
}

export interface PlexSession {
  sessionKey: string;
  title: string;
  type: string;
  user: { id: string; title: string };
  player: { title: string; platform: string; address: string };
  media: { bitrate: number; videoDecision: string };
}

export class PlexService {
  private baseUrl: string;
  private token: string;

  constructor(server: Server) {
    this.baseUrl = server.url;
    this.token = ''; // Token will be decrypted from server config
  }

  async getSessions(): Promise<PlexSession[]> {
    // Fetch active sessions from Plex API
    throw new Error('Not implemented');
  }

  async getUsers(): Promise<PlexAuthResult[]> {
    // Fetch users from Plex API
    throw new Error('Not implemented');
  }

  async getLibraries(): Promise<unknown[]> {
    // Fetch library info from Plex API
    throw new Error('Not implemented');
  }

  static async initiateOAuth(): Promise<{ pinId: string; authUrl: string }> {
    // Start Plex OAuth flow
    throw new Error('Not implemented');
  }

  static async checkOAuthPin(pinId: string): Promise<PlexAuthResult | null> {
    // Check if OAuth PIN has been claimed
    throw new Error('Not implemented');
  }

  static async verifyServerAdmin(token: string, serverUrl: string): Promise<boolean> {
    // Verify user is admin of the specified server
    throw new Error('Not implemented');
  }
}
