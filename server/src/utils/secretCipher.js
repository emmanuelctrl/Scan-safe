// Reversible encryption for secrets that must be used later (not just checked),
// such as a Gmail app password we need to hand to the SMTP client. Passwords
// and PINs stay bcrypt-hashed; only credentials that must be replayed live here.
//
// AES-256-GCM with a random 12-byte IV per value. The 32-byte key is derived
// from config.credentialSecret via scrypt. Output format (hex, colon-joined):
//   <iv>:<authTag>:<ciphertext>
import crypto from 'node:crypto';
import config from '../config/env.js';

const ALGO = 'aes-256-gcm';
// A fixed salt is fine here: it only namespaces the KDF for this one use, and
// the per-value random IV is what provides semantic security.
const KEY = crypto.scryptSync(config.credentialSecret, 'scan-safe-credential-salt', 32);

/** Encrypt a plaintext string. Returns an "iv:tag:ciphertext" hex blob. */
export function encryptSecret(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, KEY, iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

/** Decrypt a blob produced by encryptSecret. Returns null if it can't be read. */
export function decryptSecret(blob) {
  if (!blob) return null;
  try {
    const [ivHex, tagHex, dataHex] = String(blob).split(':');
    if (!ivHex || !tagHex || !dataHex) return null;
    const decipher = crypto.createDecipheriv(ALGO, KEY, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const dec = Buffer.concat([
      decipher.update(Buffer.from(dataHex, 'hex')),
      decipher.final(),
    ]);
    return dec.toString('utf8');
  } catch {
    return null;
  }
}
