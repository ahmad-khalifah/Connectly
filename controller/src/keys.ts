// The credential key pair. The app encrypts each router's API password with
// the public half (lib/network/credentials.ts: RSA-OAEP, SHA-256); only this
// process holds the private half, in an owner-only file on the controller's
// own disk. It is generated here the first time and never leaves the machine
// except in the operator's offline backup.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const KEY_FILE = 'credential-key.pem';
export const KEY_BITS = 3072;

export type CredentialKeys = { privateKey: crypto.KeyObject; publicPem: string; keyId: string };

export class KeyError extends Error {}

export function keyIdFor(publicKey: crypto.KeyObject): string {
  const der = publicKey.export({ type: 'spki', format: 'der' });
  return 'ck_' + crypto.createHash('sha256').update(der).digest('hex').slice(0, 16);
}

function fromPrivatePem(pem: string): CredentialKeys {
  const privateKey = crypto.createPrivateKey(pem);
  if (privateKey.asymmetricKeyType !== 'rsa' || (privateKey.asymmetricKeyDetails?.modulusLength ?? 0) < KEY_BITS) {
    throw new KeyError(`The credential key must be RSA with at least ${KEY_BITS} bits.`);
  }
  const publicKey = crypto.createPublicKey(privateKey);
  return { privateKey, publicPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(), keyId: keyIdFor(publicKey) };
}

/** Loads the key from dataDir, creating it (mode 0600) on first start. */
export function loadOrCreateCredentialKeys(dataDir: string): CredentialKeys & { created: boolean } {
  fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const dirMode = fs.statSync(dataDir).mode & 0o077;
  if (dirMode !== 0) throw new KeyError(`${dataDir} must be readable by its owner only (chmod 700).`);

  const file = path.join(dataDir, KEY_FILE);
  if (fs.existsSync(file)) {
    if ((fs.statSync(file).mode & 0o077) !== 0) throw new KeyError(`${file} must be readable by its owner only (chmod 600).`);
    return { ...fromPrivatePem(fs.readFileSync(file, 'utf8')), created: false };
  }

  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: KEY_BITS, publicExponent: 0x10001 });
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  fs.writeFileSync(file, pem, { mode: 0o600, flag: 'wx' }); // wx: never overwrite an existing key
  return { ...fromPrivatePem(pem), created: true };
}

/** Router passwords are 32 URL-safe characters (lib/network/credentials.ts). */
const PASSWORD_SHAPE = /^[A-Za-z0-9_-]{16,64}$/;

export function decryptRouterPassword(keys: CredentialKeys, ciphertext: string, keyId: string | null): string {
  if (keyId !== keys.keyId) {
    throw new KeyError(`This router's credential was encrypted for key ${keyId ?? 'none'}, not this controller's key ${keys.keyId}. Issue a new credential.`);
  }
  let plain: string;
  try {
    plain = crypto
      .privateDecrypt({ key: keys.privateKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, Buffer.from(ciphertext, 'base64'))
      .toString('utf8');
  } catch {
    throw new KeyError("The router's credential could not be decrypted. Issue a new credential.");
  }
  if (!PASSWORD_SHAPE.test(plain)) throw new KeyError("The router's credential has an unexpected format. Issue a new credential.");
  return plain;
}
