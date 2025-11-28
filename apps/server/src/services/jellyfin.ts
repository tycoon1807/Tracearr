/**
 * Jellyfin API integration service
 */

import type { Session, User, Server } from '@tracearr/shared';

export interface JellyfinAuthResult {
  id: string;
  username: string;
  token: string;
  serverId: string;
  isAdmin: boolean;
}

export interface JellyfinSession {
  id: string;
  userId: string;
  userName: string;
  client: string;
  deviceName: string;
  remoteEndPoint: string;
  nowPlayingItem?: {
    name: string;
    type: string;
    runTimeTicks: number;
  };
  playState?: {
    positionTicks: number;
    isPaused: boolean;
  };
  transcodingInfo?: {
    isVideoDirect: boolean;
    bitrate: number;
  };
}

export class JellyfinService {
  private baseUrl: string;
  private apiKey: string;

  constructor(server: Server) {
    this.baseUrl = server.url;
    this.apiKey = ''; // API key will be decrypted from server config
  }

  async getSessions(): Promise<JellyfinSession[]> {
    // Fetch active sessions from Jellyfin API
    throw new Error('Not implemented');
  }

  async getUsers(): Promise<unknown[]> {
    // Fetch users from Jellyfin API
    throw new Error('Not implemented');
  }

  async getLibraries(): Promise<unknown[]> {
    // Fetch library info from Jellyfin API
    throw new Error('Not implemented');
  }

  static async authenticate(
    serverUrl: string,
    username: string,
    password: string
  ): Promise<JellyfinAuthResult | null> {
    // Authenticate with Jellyfin server
    throw new Error('Not implemented');
  }

  static async verifyServerAdmin(apiKey: string, serverUrl: string): Promise<boolean> {
    // Verify API key has admin access
    throw new Error('Not implemented');
  }
}
