export interface AuthorizationParams {
    macAddress: string;
    ipAddress?: string;
    rateLimit?: string; // e.g., "5M/10M"
    routerId: string;
    reference: string;
  }
  
  export interface NetworkAdapter {
    authorizeDevice: (params: AuthorizationParams) => Promise<boolean>;
    revokeDevice: (macAddress: string, routerId: string) => Promise<boolean>;
    getDeviceSession: (macAddress: string, routerId: string) => Promise<any>;
  }