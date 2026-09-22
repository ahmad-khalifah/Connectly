import { NetworkAdapter, AuthorizationParams } from './types';

export const MockNetworkAdapter: NetworkAdapter = {
  authorizeDevice: async (params: AuthorizationParams) => {
    console.log(`[MOCK NETWORK] Authorizing device ${params.macAddress} on router ${params.routerId}`);
    console.log(`[MOCK NETWORK] Rate Limit: ${params.rateLimit || 'unlimited'} | Ref: ${params.reference}`);
    
    // Simulate a realistic network delay (2 seconds) so your UI loading state is visible
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Force the "Manual Fallback" error state if this specific MAC or reference is used
    // (If your params include the phone number, you can change this to check params.phone === '08099999999')
    if (params.macAddress === '00:00:00:00:00:00' || params.reference === 'test_fail') {
      console.log(`[MOCK NETWORK] ❌ Simulating Mikrotik API failure.`);
      return false; 
    }

    console.log(`[MOCK NETWORK] ✅ Authorized successfully.`);
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