import { describe, it, expect } from 'vitest';
import { normaliseWifiCode, codeLoginHref } from '@/lib/network/code-login';
import { connectLink } from '@/lib/network/customer-access';

describe('WiFi code login', () => {
  it('accepts a code typed in lower case, with spaces or a dash', () => {
    expect(normaliseWifiCode('k7m2q9xp')).toBe('K7M2Q9XP');
    expect(normaliseWifiCode(' K7M2 Q9XP ')).toBe('K7M2Q9XP');
    expect(normaliseWifiCode('K7M2-Q9XP')).toBe('K7M2Q9XP');
  });

  it('refuses what cannot be a code: wrong length, I, O, 0, 1 or symbols', () => {
    for (const bad of ['', 'K7M2Q9X', 'K7M2Q9XPA', 'K7M2Q9X0', 'K7M2Q9XO', 'K7M2Q9XI', 'K7M2Q9X1', 'K7M2Q9X!']) {
      expect(normaliseWifiCode(bad)).toBeNull();
    }
  });

  it('sends the code as username and password to the router login page', () => {
    const href = codeLoginHref('http://wifi.getconnectly.net/login', 'K7M2Q9XP');
    const u = new URL(href);
    expect(u.origin + u.pathname).toBe('http://wifi.getconnectly.net/login');
    expect(u.searchParams.get('username')).toBe('K7M2Q9XP');
    expect(u.searchParams.get('password')).toBe('K7M2Q9XP');
    expect(u.searchParams.get('dst')).toBe('https://getconnectly.net');
  });

  it('builds the same link as the success page uses', () => {
    expect(connectLink('http://x/login', 'K7M2Q9XP')).toBe(codeLoginHref('http://x/login', 'K7M2Q9XP'));
  });
});

import { smsStatusLabel } from '@/lib/sms';
describe('SMS status as an admin reads it', () => {
  it('shows "pending approval" for messages attempted before Termii was set up', () => {
    expect(smsStatusLabel('failed', 'Termii is not configured (TERMII_API_KEY / TERMII_SENDER_ID)')).toEqual({ text: 'not sent: pending approval', tone: 'neutral' });
  });
  it('still shows real Termii failures as failed', () => {
    expect(smsStatusLabel('failed', 'Termii 400: {"message":"Insufficient balance"}')).toEqual({ text: 'failed', tone: 'bad' });
    expect(smsStatusLabel('sent', null).text).toBe('sent');
  });
});
