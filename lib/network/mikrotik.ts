import { NetworkAdapter, AuthorizationParams } from './types';
import { db } from '../db/client';

export const MikrotikAdapter: NetworkAdapter = {
  authorizeDevice: async (params: AuthorizationParams) => {
    const { data: router } = await db
      .from('routers')
      .select('management_ip, api_user, api_password_encrypted')
      .eq('id', params.routerId)
      .single();

    if (!router) throw new Error('Router configuration not found');

    const baseUrl = `http://${router.management_ip}/rest`;
    const credentials = Buffer.from(`${router.api_user}:${router.api_password_encrypted}`).toString('base64');

    try {
      const bypassRes = await fetch(`${baseUrl}/ip/hotspot/ip-binding`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${credentials}`
        },
        body: JSON.stringify({
          'mac-address': params.macAddress,
          type: 'bypassed',
          comment: params.reference
        })
      });

      if (!bypassRes.ok) return false;

      if (params.rateLimit) {
        await fetch(`${baseUrl}/queue/simple`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${credentials}`
          },
          body: JSON.stringify({
            name: `CN_${params.reference}`,
            target: params.macAddress,
            'max-limit': params.rateLimit
          })
        });
      }

      return true;
    } catch (error) {
      console.error('[MIKROTIK_CONNECTION_ERROR]', error);
      return false;
    }
  },

  createHotspotUser: async (params: {
    routerId: string;
    username: string;
    password?: string;
    durationSeconds: number;
    reference: string;
  }) => {
    console.log(`[MIKROTIK] Creating hotspot user ${params.username} on router ${params.routerId}`);
    return true;
  },

  revokeDevice: async (macAddress: string, routerId: string) => {
    return true;
  },

  getDeviceSession: async (macAddress: string, routerId: string) => {
    return null;
  },
};