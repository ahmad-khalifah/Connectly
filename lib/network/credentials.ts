// Router API credentials.
//
// The app generates each router's API password and immediately encrypts it
// with the Network Controller's public key (RSA-OAEP, SHA-256). Only the
// ciphertext is stored. The plaintext never leaves this function: it is not
// returned to the browser, written to a log, or kept in memory longer than
// the encryption takes. The controller, which alone holds the private key,
// delivers the password to the router over the WireGuard tunnel during setup
// (see setup-script.ts), so no person ever needs to see or type it.

import crypto from 'crypto';
import { db } from '@/lib/db/client';

/** RouterOS user the controller logs in as. Never an administrator. */
export const ROUTER_API_USER = 'connectly-ctrl';

/** Smallest RSA key the app accepts from the controller. */
export const MIN_RSA_BITS = 3072;

export class CredentialKeyError extends Error {}

/** 32 URL-safe characters, 192 bits of entropy, no characters RouterOS escapes. */
export function generateRouterPassword(): string {
  return crypto.randomBytes(24).toString('base64url');
}

/** Checks a PEM public key is RSA and at least MIN_RSA_BITS. Returns the key. */
export function parseControllerPublicKey(pem: string): crypto.KeyObject {
  let key: crypto.KeyObject;
  try {
    key = crypto.createPublicKey(pem);
  } catch {
    throw new CredentialKeyError('The controller public key is not a valid PEM key.');
  }
  const details = key.asymmetricKeyDetails;
  if (key.asymmetricKeyType !== 'rsa' || !details?.modulusLength || details.modulusLength < MIN_RSA_BITS) {
    throw new CredentialKeyError(`The controller public key must be RSA with at least ${MIN_RSA_BITS} bits.`);
  }
  return key;
}

export function encryptForController(plaintext: string, publicKeyPem: string): string {
  const key = parseControllerPublicKey(publicKeyPem);
  return crypto
    .publicEncrypt({ key, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, Buffer.from(plaintext, 'utf8'))
    .toString('base64');
}

export type IssuedCredential = { apiUser: string; ciphertext: string; keyId: string };

/**
 * Generates a fresh router password and returns only its encrypted form.
 * Returns null when the controller has not published its public key yet;
 * the router then waits in "Registered" without a credential.
 */
export async function issueRouterCredential(): Promise<IssuedCredential | null> {
  const { data, error } = await db
    .from('network_settings')
    .select('credential_public_key, credential_key_id')
    .maybeSingle();
  if (error) throw new Error('Could not read network settings.');
  if (!data?.credential_public_key || !data.credential_key_id) return null;

  const ciphertext = encryptForController(generateRouterPassword(), data.credential_public_key);
  return { apiUser: ROUTER_API_USER, ciphertext, keyId: data.credential_key_id };
}
