// Automatic redaction of PII and secrets before anything is persisted to logs.

const REDACTED = "[REDACTED]";

type Rule = { name: string; re: RegExp; replace?: (m: string) => string };

const maskEmail = (email: string) => {
  const [local, domain] = email.split("@");
  if (!domain) return REDACTED;
  const head = local.slice(0, 1);
  return `${head}${"*".repeat(Math.max(local.length - 1, 2))}@${domain}`;
};

const keepTail = (value: string, tail = 4) =>
  value.length <= tail ? "[REDACTED]" : `[REDACTED:****${value.slice(-tail)}]`;

const RULES: Rule[] = [
  // Secrets / credentials
  { name: "jwt", re: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g },
  { name: "bearer", re: /\bBearer\s+[A-Za-z0-9._\-]{12,}/gi },
  { name: "apikey", re: /\b(sk|pk|rk|api|key|token|secret)[-_][A-Za-z0-9]{16,}\b/gi },
  { name: "openai", re: /\bsk-[A-Za-z0-9_-]{16,}\b/g },
  { name: "privatekey", re: /-----BEGIN[\s\S]*?PRIVATE KEY-----[\s\S]*?-----END[\s\S]*?PRIVATE KEY-----/g },
  { name: "awskey", re: /\bAKIA[0-9A-Z]{16}\b/g },
  // Financial / identity PII
  { name: "iban", re: /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){2,7}[ ]?[A-Z0-9]{1,3}\b/g, replace: keepTail },
  { name: "card", re: /\b(?:\d[ -]?){13,19}\b/g, replace: (m) => (luhn(m) ? keepTail(m.replace(/\D/g, "")) : m) },
  { name: "ssn", re: /\b\d{3}-\d{2}-\d{4}\b/g },
  { name: "emiratesId", re: /\b784-?\d{4}-?\d{7}-?\d\b/g, replace: keepTail },
  { name: "email", re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, replace: maskEmail },
  { name: "phone", re: /(?<![\w.])\+?\d[\d\s().-]{8,17}\d(?![\w.])/g, replace: (m) => keepTail(m.replace(/\D/g, ""), 3) },
];

function luhn(raw: string): boolean {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = Number(digits[i]);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

// Object keys whose values are always dropped, regardless of content.
const SENSITIVE_KEY = /(password|passwd|secret|token|api[_-]?key|authorization|auth|credential|private[_-]?key|iban|swift|account[_-]?number|card|cvv|ssn|passport|national[_-]?id|signature)/i;

export function redactText(input: string): string {
  let out = input;
  for (const rule of RULES) {
    out = out.replace(rule.re, (m) => (rule.replace ? rule.replace(m) : REDACTED));
  }
  return out;
}

export function redactValue<T>(value: T, depth = 0): T {
  if (depth > 12) return REDACTED as unknown as T;
  if (value == null) return value;
  if (typeof value === "string") return redactText(value) as unknown as T;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map((v) => redactValue(v, depth + 1)) as unknown as T;
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEY.test(k) && v != null && typeof v !== "object" ? REDACTED : redactValue(v, depth + 1);
    }
    return out as unknown as T;
  }
  return value;
}

export function redactEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  return maskEmail(email);
}
