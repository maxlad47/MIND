// Chiffrement AES-GCM de la clé Garmin (WebCrypto : Deno, Node 20+, navigateurs). Le secret vit dans GARMIN_KEY_SECRET
// (32 octets en base64, `openssl rand -base64 32`), jamais dans le code ni dans la base.

const b64 = (b: Uint8Array): string => btoa(String.fromCharCode(...b))
const unb64 = (s: string): Uint8Array => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

async function keyOf(secretB64: string): Promise<CryptoKey> {
  const raw = unb64(secretB64)
  if (raw.length !== 32) throw new Error('GARMIN_KEY_SECRET doit faire 32 octets (base64).')
  return crypto.subtle.importKey('raw', raw as BufferSource, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

/** `v1.<iv>.<chiffré>` : un IV aléatoire par valeur. */
export async function encryptSecret(plain: string, secretB64: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await keyOf(secretB64), new TextEncoder().encode(plain)))
  return `v1.${b64(iv)}.${b64(ct)}`
}

export async function decryptSecret(token: string, secretB64: string): Promise<string> {
  const [v, iv, ct] = token.split('.')
  if (v !== 'v1' || !iv || !ct) throw new Error('Valeur chiffrée invalide.')
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) as BufferSource }, await keyOf(secretB64), unb64(ct) as BufferSource)
  return new TextDecoder().decode(pt)
}
