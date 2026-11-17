/**
 * @module kdf
 * @description Key derivation functions for the E2EE system.
 *
 * Implements the Dual-Derivation Scheme described in stage_1_architecture.md §8.1:
 *
 * 1. Argon2id(password, salt) → K_derived (256-bit)
 * 2. HKDF-Expand(K_derived, "zpi-notes-auth-v1") → K_auth (32 bytes)
 * 3. HKDF-Expand(K_derived, "zpi-notes-encryption-v1") → K_master (32 bytes, non-extractable CryptoKey)
 *
 * K_auth is then SHA-256-hashed to produce auth_hash which is sent to the server.
 * K_master NEVER leaves the browser. It is imported as a non-extractable CryptoKey.
 *
 * Security rationale:
 * - Using hash-wasm (WebAssembly port) for Argon2id provides memory-hard KDF
 *   that cannot be accelerated on GPU hardware during offline brute-force.
 * - SubtleCrypto HKDF operates in native C++ and cannot be intercepted by JS.
 * - The non-extractable CryptoKey prevents accidental serialization or XSS leakage.
 */

import { argon2id } from 'hash-wasm'
import {
  arrayBufferToBase64,
  arrayBufferToHex,
  base64ToArrayBuffer,
  stringToUint8Array,
} from './serialization'

/** Argon2id parameters matching the backend defaults (kdf_params). */
export interface Argon2Params {
  /** Memory cost in KiB (backend default: 65536 = 64 MiB) */
  m: number
  /** Number of iterations / time cost (backend default: 3) */
  t: number
  /** Parallelism degree (backend default: 1) */
  p: number
}

export const DEFAULT_ARGON2_PARAMS: Argon2Params = {
  m: 65536,
  t: 3,
  p: 1,
}

/** Length of the output K_derived in bytes. */
const DERIVED_KEY_LENGTH_BYTES = 32

/** HKDF info labels — must exactly match what the backend documentation specifies. */
const AUTH_KEY_INFO = 'zpi-notes-auth-v1'
const ENCRYPTION_KEY_INFO = 'zpi-notes-encryption-v1'

/**
 * Derives a 256-bit key using Argon2id from the user's password and salt.
 *
 * @param password  - The user's plaintext password (never sent to server)
 * @param saltBase64 - The user-specific salt in Base64 encoding (from server or generated locally)
 * @param params     - Argon2id parameters
 * @returns Raw 256-bit derived key bytes (K_derived)
 */
async function deriveRawKeyWithArgon2id(
  password: string,
  saltBase64: string,
  params: Argon2Params,
): Promise<Uint8Array> {
  // Decode Base64 salt to raw bytes
  const saltBuffer = base64ToArrayBuffer(saltBase64)
  const saltBytes = new Uint8Array(saltBuffer)

  // Run Argon2id — this is the memory-hard KDF step
  // outputType 'binary' gives us a Uint8Array directly
  const derivedKey = await argon2id({
    password,
    salt: saltBytes,
    parallelism: params.p,
    iterations: params.t,
    memorySize: params.m,
    hashLength: DERIVED_KEY_LENGTH_BYTES,
    outputType: 'binary',
  })

  return derivedKey
}

/**
 * Expands a raw key material using Web Crypto HKDF into a specific-length key.
 *
 * @param keyMaterial - Raw key bytes (K_derived from Argon2id)
 * @param info        - Domain separation label for the specific key
 * @param lengthBytes - Desired output key length in bytes
 * @returns Raw expanded key bytes
 */
async function hkdfExpand(
  keyMaterial: Uint8Array,
  info: string,
  lengthBytes: number,
): Promise<ArrayBuffer> {
  // Import K_derived as HKDF key material (not extractable by design)
  const baseKey = await crypto.subtle.importKey(
    'raw',
    keyMaterial as BufferSource,
    { name: 'HKDF' },
    false, // non-extractable
    ['deriveKey', 'deriveBits'],
  )

  // HKDF with SHA-256, empty salt (all-zeros as per RFC 5869 §2.2)
  // The salt is intentionally omitted (zero-bytes) since K_derived already has high entropy
  return crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(32) as BufferSource, // 32 zero bytes
      info: stringToUint8Array(info) as BufferSource,
    },
    baseKey,
    lengthBytes * 8, // length in bits
  )
}

/**
 * Hashes K_auth with SHA-256 to produce the auth_hash sent to the server.
 * The server never sees K_auth directly — only this derivative.
 */
async function hashKAuth(kAuth: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', kAuth)
  return arrayBufferToHex(hashBuffer)
}

/**
 * Result of the full key derivation pipeline.
 */
export interface DerivedKeys {
  /**
   * auth_hash — SHA-256(K_auth) — sent to the server for authentication.
   * This is the only cryptographic material that leaves the browser for auth.
   */
  authHash: string

  /**
   * K_master as a non-extractable CryptoKey for AES-256-GCM.
   * Never leaves the browser. Used to encrypt/decrypt note payloads.
   */
  masterKey: CryptoKey
}

/**
 * Derives authentication hash and master encryption key from password and salt.
 *
 * Full pipeline:
 *   password + salt → Argon2id → K_derived
 *   K_derived → HKDF("zpi-notes-auth-v1") → K_auth → SHA-256 → auth_hash
 *   K_derived → HKDF("zpi-notes-encryption-v1") → K_master (non-extractable CryptoKey)
 *
 * @param password   - The user's plaintext password
 * @param saltBase64 - Base64-encoded 16-byte user salt
 * @param params     - Argon2id parameters (from server or defaults)
 */
export async function deriveKeys(
  password: string,
  saltBase64: string,
  params: Argon2Params = DEFAULT_ARGON2_PARAMS,
): Promise<DerivedKeys> {
  // Step 1: Memory-hard KDF
  const kDerived = await deriveRawKeyWithArgon2id(password, saltBase64, params)

  // Step 2: Derive K_auth (32 bytes) via HKDF
  const kAuthBuffer = await hkdfExpand(kDerived, AUTH_KEY_INFO, 32)

  // Step 3: Derive K_master (32 bytes) via HKDF
  const kMasterBuffer = await hkdfExpand(kDerived, ENCRYPTION_KEY_INFO, 32)

  // Step 4: Hash K_auth for server authentication
  const authHash = await hashKAuth(kAuthBuffer)

  // Step 5: Import K_master as non-extractable AES-256-GCM key
  // extractable=false ensures the key cannot be serialized or leaked via JS
  const masterKey = await crypto.subtle.importKey(
    'raw',
    kMasterBuffer,
    { name: 'AES-GCM', length: 256 },
    false, // CRITICAL: non-extractable — prevents XSS leakage
    ['encrypt', 'decrypt'],
  )

  // Scrub intermediate key material from memory
  // Note: JS GC is non-deterministic; this is best-effort cleanup
  kDerived.fill(0)

  return { authHash, masterKey }
}

/**
 * Generates a cryptographically secure random salt for a new user.
 * Returns a Base64-encoded 16-byte (128-bit) value.
 * This salt is sent to the server during registration.
 */
export function generateUserSalt(): string {
  const saltBytes = new Uint8Array(16)
  crypto.getRandomValues(saltBytes)
  return arrayBufferToBase64(saltBytes.buffer)
}
