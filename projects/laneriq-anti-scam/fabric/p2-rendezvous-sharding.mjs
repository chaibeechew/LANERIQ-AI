import { createHash } from 'node:crypto';
import { requireNonEmpty } from './contracts.mjs';

function score(key, nodeId) {
  const digest = createHash('sha256').update(`${key}|${nodeId}`).digest();
  return digest.readBigUInt64BE(0);
}

export function selectRendezvousShard(key, nodes = []) {
  key = requireNonEmpty(key, 'key');
  const candidates = nodes
    .filter((n) => n && n.healthy !== false)
    .map((n) => ({ id: requireNonEmpty(n.id, 'node.id'), weight: Number(n.weight) > 0 ? Number(n.weight) : 1 }));
  if (candidates.length === 0) return null;

  let winner = null;
  let winnerScore = null;
  for (const node of candidates) {
    const raw = score(key, node.id);
    const weighted = raw * BigInt(Math.max(1, Math.round(node.weight * 1000)));
    if (winnerScore == null || weighted > winnerScore || (weighted === winnerScore && node.id < winner.id)) {
      winner = node;
      winnerScore = weighted;
    }
  }
  return winner.id;
}

export function mapKeysToShards(keys = [], nodes = []) {
  const result = new Map();
  for (const key of keys) result.set(key, selectRendezvousShard(String(key), nodes));
  return result;
}
