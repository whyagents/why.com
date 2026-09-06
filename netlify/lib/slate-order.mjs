// Presentation order is a confound, not a detail: with a fixed order, slot and
// preference are not separately identified, so every strength estimate inherits
// the bias. The permutation is a deterministic function of the voter's own
// token, which means the server can recompute the slot a door occupied without
// trusting anything the client sends, and the per-episode token stays
// per-episode - votes remain unlinkable across days.

// FNV-1a 32-bit. Dependency-free and identical in browser and Node, which is
// what makes client render order and server-side position agree.
export const fnv1a = (value) => {
  let hash = 0x811c9dc5;
  const text = String(value || "");
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
};

// FNV alone is not enough here. Every key shares the token and node prefix and
// differs only in the trailing door id, so the raw hashes stay correlated and
// the resulting order is far from uniform - measured at 113/15026 across six
// permutations where 10000 each is ideal. A murmur3 finalizer decorrelates the
// low bits and brings it to 9912/10098.
const avalanche = (value) => {
  let hash = value >>> 0;
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b) >>> 0;
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35) >>> 0;
  hash ^= hash >>> 16;
  return hash >>> 0;
};

export const slotKey = (token, nodeId, doorId) => avalanche(fnv1a(`${token}:${nodeId}:${doorId}`));

// A keyed shuffle by sort. Ties break on id so the ordering is total and
// reproducible for any (token, node) pair.
export const permuteDoors = (doors, token, nodeId) => {
  const list = Array.isArray(doors) ? doors.slice() : [];
  if (!token) return list;
  return list
    .map((door) => ({ door, key: slotKey(token, nodeId, door?.id || "") }))
    .sort((a, b) => (a.key - b.key) || (String(a.door?.id) < String(b.door?.id) ? -1 : 1))
    .map((entry) => entry.door);
};

// 1-based slot the door occupied for this voter, or null when no token exists.
export const positionOf = (doors, token, nodeId, doorId) => {
  if (!token) return null;
  const index = permuteDoors(doors, token, nodeId).findIndex((door) => door?.id === doorId);
  return index < 0 ? null : index + 1;
};
