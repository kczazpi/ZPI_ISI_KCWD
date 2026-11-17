/**
 * @module cipher
 * @description AES-256-GCM authenticated encryption/decryption for E2EE note payloads.
 *
 * Security properties guaranteed by this module:
 * - Confidentiality: AES-256-GCM with 256-bit key (128-bit security margin).
 * - Integrity & Authenticity: 128-bit GCM authentication tag prevents tampering.
 * - Nonce freshness: Each encryption generates a new random 96-bit IV.
 * - Binding: AAD (Additional Authenticated Data) containing note_id prevents
 *   ciphertext swap attacks (T-07 from threat model).
 * - Separation: auth_tag is stored separately from ciphertext for backend schema.
 *
 * Data format sent to backend:
 *   - ciphertext: Base64(encrypted_payload_bytes)         [without GCM tag]
 *   - nonce_iv:   Base64(12-byte random IV)
 *   - auth_tag:   Base64(16-byte GCM authentication tag)  [extracted from end]
 *
 * WebCrypto AES-GCM appends the 16-byte authentication tag at the end of the
 * ciphertext output. We split it out to match the backend schema.
 */

import { arrayBufferToBase64, base64ToArrayBuffer, stringToUint8Array } from './serialization'

/** GCM authentication tag size in bytes (128 bits — maximum and standard). */
const GCM_TAG_LENGTH_BITS = 128
const GCM_TAG_LENGTH_BYTES = GCM_TAG_LENGTH_BITS / 8

/** IV/nonce size in bytes (96 bits — optimal for AES-GCM per NIST SP 800-38D). */
const IV_LENGTH_BYTES = 12

/**
 * The decrypted note payload stored inside the AES-GCM ciphertext.
 * Title, content, and tags are ALL encrypted together — none are visible to the server.
 */
export interface NotePlaintext {
  title: string
  content: string
  tags?: string[]
}

/**
 * The encrypted note structure returned from the encryption operation.
 * Matches the backend NoteCreateRequest / NoteUpdateRequest schema.
 */
export interface EncryptedNote {
  /** Base64-encoded ciphertext WITHOUT the GCM authentication tag. */
  ciphertext: string
  /** Base64-encoded 12-byte (96-bit) random IV. */
  nonce_iv: string
  /** Base64-encoded 16-byte (128-bit) GCM authentication tag. */
  auth_tag: string
  /** Schema version identifier. */
  crypto_version: number
}

/**
 * Generates a fresh cryptographically secure random 96-bit IV.
 * MUST be called for every new encryption operation — reusing IV with the same
 * key in AES-GCM is catastrophic (reveals key stream, breaks authentication).
 *
 * @returns 12-byte Uint8Array filled with CSPRNG values
 */
function generateIV(): Uint8Array {
  const iv = new Uint8Array(IV_LENGTH_BYTES)
  crypto.getRandomValues(iv)
  return iv
}

/**
 * Encrypts a note payload using AES-256-GCM.
 *
 * The note_id is used as Additional Authenticated Data (AAD) to cryptographically
 * bind the ciphertext to its identifier. This prevents ciphertext-swap attacks
 * where an attacker might substitute the encrypted content of one note with another.
 *
 * @param masterKey - The non-extractable CryptoKey (AES-256-GCM) from key derivation
 * @param noteId    - UUIDv4 of the note (used as AAD for binding)
 * @param plaintext - The note data to encrypt (title + content + optional tags)
 * @returns EncryptedNote with Base64-encoded fields ready for the backend API
 */
export async function encryptNote(
  masterKey: CryptoKey,
  noteId: string,
  plaintext: NotePlaintext,
): Promise<EncryptedNote> {
  // Serialize the plaintext payload to JSON bytes
  const payloadBytes = stringToUint8Array(JSON.stringify(plaintext))

  // Generate a fresh random IV for this encryption
  const iv = generateIV()

  // AAD = UTF-8 bytes of the note UUID — binds ciphertext to this specific note
  const aad = stringToUint8Array(noteId)

  // Perform AES-256-GCM encryption
  // WebCrypto appends the 16-byte authentication tag at the end of the result
  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as BufferSource,
      additionalData: aad as BufferSource,
      tagLength: GCM_TAG_LENGTH_BITS,
    },
    masterKey,
    payloadBytes as BufferSource,
  )

  // Split the GCM output: [ciphertext_bytes | auth_tag_bytes]
  const encryptedBytes = new Uint8Array(encryptedBuffer)
  const ciphertextBytes = encryptedBytes.slice(0, encryptedBytes.length - GCM_TAG_LENGTH_BYTES)
  const authTagBytes = encryptedBytes.slice(encryptedBytes.length - GCM_TAG_LENGTH_BYTES)

  return {
    ciphertext: arrayBufferToBase64(ciphertextBytes.buffer as ArrayBuffer),
    nonce_iv: arrayBufferToBase64(iv.buffer as ArrayBuffer),
    auth_tag: arrayBufferToBase64(authTagBytes.buffer as ArrayBuffer),
    crypto_version: 1,
  }
}

/**
 * Decrypts a note payload using AES-256-GCM.
 *
 * The note_id MUST match the AAD used during encryption. Any mismatch (wrong note_id,
 * tampered ciphertext, wrong key, or replayed data from another note) will cause
 * WebCrypto to throw a DOMException, which is caught and re-thrown as a readable error.
 *
 * @param masterKey     - The non-extractable CryptoKey (AES-256-GCM)
 * @param noteId        - UUIDv4 of the note (must match AAD used at encryption time)
 * @param encryptedNote - The EncryptedNote structure from the backend API
 * @returns Decrypted NotePlaintext containing title, content, and tags
 * @throws Error if authentication tag verification fails (tampered data, wrong key, wrong AAD)
 */
export async function decryptNote(
  masterKey: CryptoKey,
  noteId: string,
  encryptedNote: Pick<EncryptedNote, 'ciphertext' | 'nonce_iv' | 'auth_tag'>,
): Promise<NotePlaintext> {
  // Decode Base64 fields
  const ciphertextBytes = new Uint8Array(base64ToArrayBuffer(encryptedNote.ciphertext))
  const ivBytes = new Uint8Array(base64ToArrayBuffer(encryptedNote.nonce_iv))
  const authTagBytes = new Uint8Array(base64ToArrayBuffer(encryptedNote.auth_tag))

  // WebCrypto expects: [ciphertext_bytes | auth_tag_bytes] concatenated
  const combined = new Uint8Array(ciphertextBytes.length + authTagBytes.length)
  combined.set(ciphertextBytes, 0)
  combined.set(authTagBytes, ciphertextBytes.length)

  // AAD must exactly match what was used during encryption
  const aad = stringToUint8Array(noteId)

  let decryptedBuffer: ArrayBuffer
  try {
    decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: ivBytes as BufferSource,
        additionalData: aad as BufferSource,
        tagLength: GCM_TAG_LENGTH_BITS,
      },
      masterKey,
      combined as BufferSource,
    )
  } catch {
    // Authentication tag mismatch — data is corrupted, tampered, or wrong key
    throw new Error(
      'Decryption failed: authentication tag verification error. ' +
        'The note data may be corrupted or was encrypted with a different key.',
    )
  }

  // Parse the decrypted JSON payload
  const decoder = new TextDecoder()
  const jsonString = decoder.decode(decryptedBuffer)

  try {
    const plaintext = JSON.parse(jsonString) as NotePlaintext
    return plaintext
  } catch {
    throw new Error('Decryption succeeded but payload is not valid JSON. Data may be corrupted.')
  }
}
