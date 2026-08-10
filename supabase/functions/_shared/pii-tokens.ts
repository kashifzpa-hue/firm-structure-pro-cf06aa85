// Deterministic PII tokenization for AI calls.
//
// Real values are replaced by stable placeholders such as [PERSON_K3XQ9AB] before
// anything reaches the model, the gateway or the prompt log. The reverse map lives
// only in memory for the lifetime of one request; determinism comes from the HMAC,
// not from the map, so the same value always yields the same token.

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const TOKEN_LEN = 7;
/** Longest token text we could ever emit, used to size the stream tail buffer. */
export const MAX_TOKEN_TEXT = 48;

export type PiiType =
  | "PERSON"
  | "COMPANY"
  | "EMAIL"
  | "PHONE"
  | "IBAN"
  | "ACCOUNT"
  | "SWIFT"
  | "CIF"
  | "EMIRATES_ID"
  | "ADDRESS"
  | "DOB"
  | "REGNO"
  | "DOCNO"
  | "ID";

const FALLBACK: Record<string, string> = {
  PERSON: "this person",
  COMPANY: "this company",
  EMAIL: "an email address",
  PHONE: "a phone number",
  IBAN: "a bank account",
  ACCOUNT: "a bank account",
  SWIFT: "a bank code",
  CIF: "a bank relationship",
  EMIRATES_ID: "an Emirates ID",
  ADDRESS: "an address",
  DOB: "a date of birth",
  REGNO: "a registration number",
  DOCNO: "a document number",
  ID: "an unknown record",
};

/** Structured columns that are tokenized wherever they appear in a tool result. */
const FIELD_TYPES: Record<string, PiiType> = {
  email: "EMAIL",
  rm_email: "EMAIL",
  primary_contact_email: "EMAIL",
  actor_email: "EMAIL",
  user_email: "EMAIL",
  phone: "PHONE",
  rm_phone: "PHONE",
  iban: "IBAN",
  account_number: "ACCOUNT",
  swift_code: "SWIFT",
  cif_number: "CIF",
  registered_address: "ADDRESS",
  registration_number: "REGNO",
  document_number: "DOCNO",
  relationship_manager: "PERSON",
  primary_contact_name: "PERSON",
  actor_name: "PERSON",
  full_name: "PERSON",
};

/** Free-text columns: never column-tokenized, always passed through the scrubber. */
const FREE_TEXT_FIELDS = new Set([
  "notes",
  "professional_bio",
  "description",
  "outcome_notes",
  "covenant_notes",
  "fee_notes",
  "security_summary",
  "void_reason",
  "deactivation_reason",
  "error_reason",
  "body",
  "title",
]);

const ID_FIELD = /(^id$|_id$)/;

const STRUCTURED_PATTERNS: Array<{ type: PiiType; re: RegExp }> = [
  { type: "EMAIL", re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
  { type: "EMIRATES_ID", re: /\b784-?\d{4}-?\d{7}-?\d\b/g },
  { type: "IBAN", re: /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){2,7}[ ]?[A-Z0-9]{1,3}\b/g },
  { type: "PHONE", re: /(?<![\w.])\+?\d[\d\s().-]{8,17}\d(?![\w.])/g },
];

const MIN_NAME_LEN = 4;
const COMMON_WORDS = new Set([
  "gold", "trading", "group", "holding", "holdings", "company", "limited", "general",
  "international", "services", "capital", "invest", "management", "global", "star",
]);

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function base32(bytes: Uint8Array, len: number) {
  let out = "";
  for (let i = 0; i < len; i++) out += B32[bytes[i] % 32];
  return out;
}

async function hmac(key: CryptoKey, data: string) {
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return new Uint8Array(sig);
}

async function importKey(raw: Uint8Array | string) {
  const bytes = typeof raw === "string" ? new TextEncoder().encode(raw) : raw;
  return await crypto.subtle.importKey("raw", bytes as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}

export interface Tokenizer {
  tokenize(type: PiiType, value: string): Promise<string>;
  /** Replace structured PII and known entity names inside free text. */
  tokenizeText(text: string): Promise<string>;
  /** Deep walk: column-driven tokenization of a tool result. */
  tokenizeValue<T>(value: T): Promise<T>;
  /** Deep walk: tokenize every string as free text (used for chat messages). */
  tokenizeAllText<T>(value: T): Promise<T>;
  detokenizeText(text: string): string;
  detokenizeValue<T>(value: T): T;
  createDetokenizeTransform(): TransformStream<Uint8Array, Uint8Array>;
  unknownTokens(): number;
}

/**
 * Build a per-request tokenizer.
 * The HMAC key is a purpose-scoped subkey: HMAC(master, "pii-token:" + workspaceId).
 * The master key itself is never used to derive tokens.
 */
export async function createTokenizer(
  masterKey: string,
  workspaceId: string,
  options: { names?: string[] } = {},
): Promise<Tokenizer> {
  const master = await importKey(masterKey);
  const subkeyBytes = await hmac(master, `pii-token:${workspaceId}`);
  const subkey = await importKey(subkeyBytes);

  const forward = new Map<string, string>(); // "TYPE:value" -> token text
  const reverse = new Map<string, string>(); // token text -> real value
  let unknown = 0;

  const names = (options.names ?? [])
    .map((n) => (n ?? "").trim())
    .filter((n) => n.length >= MIN_NAME_LEN && !COMMON_WORDS.has(n.toLowerCase()))
    .sort((a, b) => b.length - a.length);
  const nameLookup = new Map(names.map((n) => [n.toLowerCase(), n]));
  const nameRe = names.length
    ? new RegExp(`(?<![\\w])(${names.map(escapeRe).join("|")})(?![\\w])`, "gi")
    : null;

  async function tokenize(type: PiiType, value: string): Promise<string> {
    const normalized = value.trim();
    if (!normalized) return value;
    const cacheKey = `${type}:${normalized.toLowerCase()}`;
    const cached = forward.get(cacheKey);
    if (cached) return cached;
    const digest = await hmac(subkey, cacheKey);
    const token = `[${type}_${base32(digest, TOKEN_LEN)}]`;
    forward.set(cacheKey, token);
    reverse.set(token, normalized);
    return token;
  }

  async function tokenizeText(text: string): Promise<string> {
    if (!text) return text;
    let out = text;
    for (const { type, re } of STRUCTURED_PATTERNS) {
      const matches = [...out.matchAll(re)].map((m) => m[0]);
      for (const m of new Set(matches)) {
        out = out.split(m).join(await tokenize(type, m));
      }
    }
    if (nameRe) {
      const matches = [...out.matchAll(nameRe)].map((m) => m[0]);
      for (const m of new Set(matches)) {
        const canonical = nameLookup.get(m.toLowerCase()) ?? m;
        out = out.split(m).join(await tokenize("PERSON", canonical));
      }
    }
    return out;
  }

  async function tokenizeValue<T>(value: T, key?: string, parentType?: string): Promise<T> {
    if (value == null) return value;
    if (Array.isArray(value)) {
      const out = [];
      for (const v of value) out.push(await tokenizeValue(v, key, parentType));
      return out as unknown as T;
    }
    if (typeof value === "object") {
      const src = value as Record<string, unknown>;
      const rowType = typeof src.type === "string" ? src.type : parentType;
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(src)) {
        out[k] = await tokenizeField(k, v, rowType);
      }
      return out as unknown as T;
    }
    if (typeof value === "string" && key) return (await tokenizeField(key, value, parentType)) as unknown as T;
    return value;
  }

  async function tokenizeField(key: string, value: unknown, rowType?: string): Promise<unknown> {
    if (value == null) return value;
    if (typeof value === "object") return await tokenizeValue(value, key, rowType);
    if (typeof value !== "string") return value;

    if (FREE_TEXT_FIELDS.has(key)) return await tokenizeText(value);
    if (key === "name" || key === "entity_name") {
      return await tokenize(rowType === "company" ? "COMPANY" : "PERSON", value);
    }
    if (key === "date_of_birth_or_incorporation") {
      return rowType === "company" ? value : await tokenize("DOB", value);
    }
    const mapped = FIELD_TYPES[key];
    if (mapped) return await tokenize(mapped, value);
    if (ID_FIELD.test(key) && /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(value)) return await tokenize("ID", value);
    return value;
  }

  async function tokenizeAllText<T>(value: T): Promise<T> {
    if (value == null) return value;
    if (typeof value === "string") return (await tokenizeText(value)) as unknown as T;
    if (Array.isArray(value)) {
      const out = [];
      for (const v of value) out.push(await tokenizeAllText(v));
      return out as unknown as T;
    }
    if (typeof value === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = await tokenizeAllText(v);
      return out as unknown as T;
    }
    return value;
  }

  // Matches well-formed tokens and near-misses (wrong length) so nothing bracket-shaped leaks.
  const TOKEN_RE = /\[([A-Z]+(?:_[A-Z]+)*)_([A-Z2-7]{2,12})\]/g;

  function detokenizeText(text: string, jsonEscape = false): string {
    if (!text || !text.includes("[")) return text;
    return text.replace(TOKEN_RE, (full, prefix: string) => {
      let real = reverse.get(full);
      if (!real) {
        unknown++;
        real = FALLBACK[prefix] ?? "a redacted value";
      }
      // Inside an SSE payload the replacement sits in a JSON string literal.
      return jsonEscape ? JSON.stringify(real).slice(1, -1) : real;
    });
  }


  function detokenizeValue<T>(value: T): T {
    if (value == null) return value;
    if (typeof value === "string") return detokenizeText(value) as unknown as T;
    if (Array.isArray(value)) return value.map((v) => detokenizeValue(v)) as unknown as T;
    if (typeof value === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = detokenizeValue(v);
      return out as unknown as T;
    }
    return value;
  }

  function createDetokenizeTransform(): TransformStream<Uint8Array, Uint8Array> {
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    let buffer = "";
    return new TransformStream({
      transform(chunk, controller) {
        buffer += decoder.decode(chunk, { stream: true });
        const open = buffer.lastIndexOf("[");
        let keep = "";
        if (open !== -1 && !buffer.slice(open).includes("]") && buffer.length - open < MAX_TOKEN_TEXT) {
          keep = buffer.slice(open);
          buffer = buffer.slice(0, open);
        }
        if (buffer) controller.enqueue(encoder.encode(detokenizeText(buffer)));
        buffer = keep;
      },
      flush(controller) {
        buffer += decoder.decode();
        if (!buffer) return;
        let tail = buffer;
        // Drop a trailing bracket fragment that never completed.
        const open = tail.lastIndexOf("[");
        if (open !== -1 && !tail.slice(open).includes("]")) tail = tail.slice(0, open);
        const out = detokenizeText(tail);
        if (out) controller.enqueue(encoder.encode(out));
        buffer = "";
      },
    });
  }

  return {
    tokenize,
    tokenizeText,
    tokenizeValue: (v) => tokenizeValue(v),
    tokenizeAllText,
    detokenizeText,
    detokenizeValue,
    createDetokenizeTransform,
    unknownTokens: () => unknown,
  };
}
