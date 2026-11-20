import {createCipheriv, createDecipheriv, randomBytes} from 'node:crypto'
import {hkdf} from '@noble/hashes/hkdf.js'
import {sha256} from '@noble/hashes/sha2.js'
import {
  IMPORTED_KEY_CIPHER_INFO,
  IMPORTED_KEY_CIPHER_IV_LENGTH,
  IMPORTED_KEY_CIPHER_KEY_LENGTH,
  IMPORTED_KEY_CIPHER_TAG_LENGTH,
} from '../constants/importedKeys'

// Domain-separated from every key the seed derives, so the ciphertext cannot be
// mistaken for wallet material if the database is dumped.
function cipherKey(seed: Uint8Array): Buffer {
  return Buffer.from(hkdf(sha256, seed, undefined, IMPORTED_KEY_CIPHER_INFO, IMPORTED_KEY_CIPHER_KEY_LENGTH))
}

// Layout: iv(12) | ciphertext | tag(16), hex encoded for a text column.
export function encryptImportedKey(privateKey: string, seed: Uint8Array): string {
  const key = cipherKey(seed)
  try {
    const iv = randomBytes(IMPORTED_KEY_CIPHER_IV_LENGTH)
    const cipher = createCipheriv('aes-256-gcm', key, iv)
    const ciphertext = Buffer.concat([cipher.update(privateKey, 'utf8'), cipher.final()])
    return Buffer.concat([iv, ciphertext, cipher.getAuthTag()]).toString('hex')
  } finally {
    key.fill(0)
  }
}

export function decryptImportedKey(blob: string, seed: Uint8Array): string {
  const data = Buffer.from(blob, 'hex')
  if (data.length <= IMPORTED_KEY_CIPHER_IV_LENGTH + IMPORTED_KEY_CIPHER_TAG_LENGTH) {
    throw new Error('Not an encrypted imported key')
  }
  const key = cipherKey(seed)
  try {
    const iv = data.subarray(0, IMPORTED_KEY_CIPHER_IV_LENGTH)
    const ciphertext = data.subarray(IMPORTED_KEY_CIPHER_IV_LENGTH, data.length - IMPORTED_KEY_CIPHER_TAG_LENGTH)
    const tag = data.subarray(data.length - IMPORTED_KEY_CIPHER_TAG_LENGTH)
    const decipher = createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
  } finally {
    key.fill(0)
  }
}