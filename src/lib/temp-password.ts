/** Readable, reasonably strong temporary password (no ambiguous chars).
 *  Shared by client onboarding and team-member creation. */
export function genTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  let out = "";
  for (const b of bytes) out += chars[b % chars.length];
  return `${out}!7`; // guarantee a symbol + digit for password policies
}
