import { NetworkAdapter } from './types';
import { MockNetworkAdapter } from './mock';
import { MikrotikAdapter } from './mikrotik';

const MODE = process.env.NETWORK_MODE || 'mock';

export const network: NetworkAdapter = 
  MODE === 'mikrotik' ? MikrotikAdapter : MockNetworkAdapter;