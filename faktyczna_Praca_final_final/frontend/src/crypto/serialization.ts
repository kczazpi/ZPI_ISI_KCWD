/**
 * @module serialization
 * @description Utility functions for converting between ArrayBuffer, Base64, and hex strings.
 *
 * Security note: These functions operate on raw cryptographic material.
 * They do NOT sanitize or validate the semantic meaning of the data —
 * callers are responsible for ensuring they receive correct byte arrays.
 */

/**
 * Encodes an ArrayBuffer to a standard Base64 string (URL-unsafe).
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/**
 * Decodes a standard Base64 string back to an ArrayBuffer.
 * Throws if the input is not valid Base64.
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  try {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes.buffer
  } catch {
    throw new Error('Invalid Base64 string provided to base64ToArrayBuffer.')
  }
}

/**
 * Encodes an ArrayBuffer as a lowercase hexadecimal string.
 */
export function arrayBufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Decodes a hex string back into an ArrayBuffer.
 * Throws if the hex string has an odd length or invalid characters.
 */
export function hexToArrayBuffer(hex: string): ArrayBuffer {
  if (hex.length % 2 !== 0) {
    throw new Error('Hex string must have an even number of characters.')
  }
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    const byte = parseInt(hex.slice(i, i + 2), 16)
    if (isNaN(byte)) {
      throw new Error(`Invalid hex character at position ${i}.`)
    }
    bytes[i / 2] = byte
  }
  return bytes.buffer
}

/**
 * Converts a plain UTF-8 string to a Uint8Array suitable for use in WebCrypto operations.
 */
export function stringToUint8Array(str: string): Uint8Array {
  return new TextEncoder().encode(str)
}

/**
 * Converts a Uint8Array back to a UTF-8 string.
 */
export function uint8ArrayToString(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes)
}
