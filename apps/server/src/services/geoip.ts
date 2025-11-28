/**
 * GeoIP lookup service using MaxMind
 */

import { GEOIP_CONFIG } from '@tracearr/shared';

export interface GeoLocation {
  city: string | null;
  country: string | null;
  countryCode: string | null;
  lat: number | null;
  lon: number | null;
}

export class GeoIPService {
  private reader: unknown = null;

  async initialize(dbPath: string): Promise<void> {
    // Initialize MaxMind reader with database file
    // const maxmind = await import('maxmind');
    // this.reader = await maxmind.open(dbPath);
    throw new Error('Not implemented');
  }

  lookup(ip: string): GeoLocation {
    if (!this.reader) {
      return {
        city: null,
        country: null,
        countryCode: null,
        lat: null,
        lon: null,
      };
    }

    // Perform lookup using MaxMind reader
    // const result = this.reader.get(ip);
    throw new Error('Not implemented');
  }

  isPrivateIP(ip: string): boolean {
    // Check if IP is in private range
    const parts = ip.split('.').map(Number);

    if (parts.length !== 4) {
      return false;
    }

    // 10.0.0.0 - 10.255.255.255
    if (parts[0] === 10) {
      return true;
    }

    // 172.16.0.0 - 172.31.255.255
    if (parts[0] === 172 && parts[1] !== undefined && parts[1] >= 16 && parts[1] <= 31) {
      return true;
    }

    // 192.168.0.0 - 192.168.255.255
    if (parts[0] === 192 && parts[1] === 168) {
      return true;
    }

    // 127.0.0.0 - 127.255.255.255 (localhost)
    if (parts[0] === 127) {
      return true;
    }

    return false;
  }
}

export const geoipService = new GeoIPService();
