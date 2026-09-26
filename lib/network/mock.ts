import { NetworkAdapter, AuthorizationParams } from './types';

export const MockNetworkAdapter: NetworkAdapter = {
  authorizeDevice: async (params: AuthorizationParams) => {
    console.log(`[MOCK NETWORK] Authorizing device ${params.macAddress} on router ${params.routerId}`);
    console.log(`[MOCK NETWORK] Rate Limit: ${params.rateLimit || 'unlimited'} | Ref: ${params.reference}`);
    
    await new Promise((resolve) => setTimeout(resolve, 2000));

    if (params.macAddress === '00:00:00:00:00:00' || params.reference === 'test_fail') {
      console.log(`[MOCK NETWORK] ❌ Simulating Mikrotik API failure.`);
      return false; 
    }

    console.log(`[MOCK NETWORK] ✅ Authorized successfully.`);
    return true;
  },

  createHotspotUser: async (params: {
    routerId: string;
    username: string;
    password?: string;
    durationSeconds: number;
    reference: string;
  }) => {
    console.log(`[MOCK NETWORK] Creating hotspot user for ${params.username} on router ${params.routerId}`);
    
    await new Promise((resolve) => setTimeout(resolve, 1000));

    if (params.username === '08099999999' || params.reference === 'test_fail') {
      console.log(`[MOCK NETWORK] ❌ Simulating Mikrotik API failure.`);
      return false; 
    }

    console.log(`[MOCK NETWORK] ✅ Hotspot user created successfully.`);
    return true;
  },

  revokeDevice: async (macAddress: string, routerId: string) => {
    console.log(`[MOCK NETWORK] Revoking access for ${macAddress} on router ${routerId}`);
    return true;
  },

  getDeviceSession: async (macAddress: string, routerId: string) => {
    return {
      active: true,
      bytes_in: 1024500,
      bytes_out: 5048200,
      uptime: '01:23:45',
    };
  },
};