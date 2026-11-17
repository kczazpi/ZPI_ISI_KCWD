/**
 * @module keys
 * @description Secure in-memory session storage for the master encryption key (K_master).
 *
 * Security model:
 * - K_master exists ONLY in this module's closure scope (RAM only).
 * - It is NEVER written to localStorage, sessionStorage, IndexedDB, or cookies.
 * - It is NEVER transmitted over the network.
 * - On logout or session end, the reference is explicitly cleared.
 *
 * The CryptoKey object itself is non-extractable (enforced at import time in kdf.ts),
 * providing an additional layer of protection against accidental serialization.
 *
 * Limitation: JavaScript garbage collection is non-deterministic. After calling
 * clearMasterKey(), the underlying memory may not be zeroed immediately.
 * This is a fundamental limitation of managed runtimes and is accepted.
 * The non-extractable property of the CryptoKey provides the primary protection.
 */

/** The session-scoped master encryption key. Null when not authenticated. */
let sessionMasterKey: CryptoKey | null = null

/**
 * Stores K_master in the in-memory session store.
 * Should be called immediately after successful key derivation during login/register.
 *
 * @param key - The non-extractable AES-256-GCM CryptoKey derived from the user's password
 */
export function setMasterKey(key: CryptoKey): void {
  sessionMasterKey = key
}

/**
 * Retrieves K_master from the in-memory session store.
 *
 * @returns The CryptoKey if the user is authenticated, null otherwise
 */
export function getMasterKey(): CryptoKey | null {
  return sessionMasterKey
}

/**
 * Checks whether a valid master key is currently held in memory.
 *
 * @returns true if the user has an active encryption key (is authenticated and key is loaded)
 */
export function hasMasterKey(): boolean {
  return sessionMasterKey !== null
}

/**
 * Clears K_master from memory.
 * MUST be called on logout or whenever the cryptographic session ends.
 *
 * Note: Due to JavaScript's garbage collector, actual memory zeroing is not guaranteed.
 * However, clearing the reference removes access to the key from application code.
 */
export function clearMasterKey(): void {
  sessionMasterKey = null
}
