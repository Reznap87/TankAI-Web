export const MEMORY_EMBEDDING_MODEL = "tank-hash-v1";
export const MEMORY_EMBEDDING_DIMENSIONS = 192;

const MAX_TOKEN_LENGTH = 64;

function tokenize(value: string): string[] {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("de-DE")
    .replace(/[^\p{L}\p{N}_-]+/gu, " ")
    .split(/\s+/u)
    .map((token) => token.slice(0, MAX_TOKEN_LENGTH))
    .filter((token) => token.length > 1);
}

function fnv1a(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function features(value: string): string[] {
  const tokens = tokenize(value);
  const output = [...tokens];
  for (let index = 0; index + 1 < tokens.length; index += 1) {
    output.push(`${tokens[index]}::${tokens[index + 1]}`);
  }
  return output;
}

export function createMemoryEmbedding(value: string): Int8Array {
  const vector = new Float64Array(MEMORY_EMBEDDING_DIMENSIONS);
  const counts = new Map<string, number>();
  for (const feature of features(value)) {
    counts.set(feature, (counts.get(feature) ?? 0) + 1);
  }
  for (const [feature, count] of counts) {
    const hash = fnv1a(feature);
    const position = hash % MEMORY_EMBEDDING_DIMENSIONS;
    const sign = (hash & 0x80000000) === 0 ? 1 : -1;
    vector[position] += sign * Math.log1p(count);
  }
  let normSquared = 0;
  for (const component of vector) normSquared += component * component;
  if (normSquared === 0) return new Int8Array(MEMORY_EMBEDDING_DIMENSIONS);
  const norm = Math.sqrt(normSquared);
  const quantized = new Int8Array(MEMORY_EMBEDDING_DIMENSIONS);
  for (let index = 0; index < vector.length; index += 1) {
    quantized[index] = Math.max(
      -127,
      Math.min(127, Math.round((vector[index] / norm) * 127)),
    );
  }
  return quantized;
}

export function encodeMemoryEmbedding(vector: Int8Array): string {
  if (vector.length !== MEMORY_EMBEDDING_DIMENSIONS) {
    throw new Error("Ungültige Memory-Embedding-Dimension.");
  }
  let binary = "";
  for (const byte of new Uint8Array(vector.buffer, vector.byteOffset, vector.byteLength)) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export function decodeMemoryEmbedding(value: string): Int8Array | undefined {
  try {
    const binary = atob(value);
    if (binary.length !== MEMORY_EMBEDDING_DIMENSIONS) return undefined;
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return new Int8Array(bytes.buffer);
  } catch {
    return undefined;
  }
}

export function memoryCosineSimilarity(
  left: Int8Array,
  right: Int8Array,
): number {
  if (
    left.length !== MEMORY_EMBEDDING_DIMENSIONS ||
    right.length !== MEMORY_EMBEDDING_DIMENSIONS
  ) {
    return 0;
  }
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < MEMORY_EMBEDDING_DIMENSIONS; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }
  if (leftNorm === 0 || rightNorm === 0) return 0;
  return dot / Math.sqrt(leftNorm * rightNorm);
}

export async function memoryContentSha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
