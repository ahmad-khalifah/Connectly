export interface AuthorizationParams {
  macAddress: string;
  routerId: string;
  rateLimit?: string;
  reference?: string;
  ipAddress?: string;
}

export interface NetworkAdapter {
  authorizeDevice: (params: AuthorizationParams) => Promise<boolean>;
  revokeDevice: (macAddress: string, routerId: string) => Promise<boolean>;
  getDeviceSession: (macAddress: string, routerId: string) => Promise<any>;
  createHotspotUser: (params: {
    routerId: string;
    username: string;
    password?: string;
    durationSeconds: number;
    reference: string;
  }) => Promise<boolean>;
}