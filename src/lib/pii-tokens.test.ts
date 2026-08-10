import { describe, it, expect } from "vitest";
import { createTokenizer } from "../../supabase/functions/_shared/pii-tokens";
import { redactText } from "../../supabase/functions/_shared/redact";

const KEY = "test-master-key-0123456789";
const WS = "11111111-1111-1111-1111-111111111111";

const make = (names: string[] = ["Kashif Zafar", "Aurora Holdings LLC"]) =>
  createTokenizer(KEY, WS, { names });

describe("pii tokenizer", () => {
  it("produces the same token from two independent instances", async () => {
    const a = await make();
    const b = await make();
    const ta = await a.tokenize("PERSON", "Kashif Zafar");
    const tb = await b.tokenize("PERSON", "kashif zafar");
    expect(ta).toBe(tb);
    expect(ta).toMatch(/^\[PERSON_[A-Z2-7]{7}\]$/);
  });

  it("uses a different token per workspace and per type", async () => {
    const a = await make();
    const other = await createTokenizer(KEY, "22222222-2222-2222-2222-222222222222", {});
    expect(await a.tokenize("PERSON", "Kashif Zafar")).not.toBe(
      await other.tokenize("PERSON", "Kashif Zafar"),
    );
    expect(await a.tokenize("PERSON", "x@y.com")).not.toBe(await a.tokenize("EMAIL", "x@y.com"));
  });

  it("round-trips structured PII in free text", async () => {
    const t = await make();
    const src = "Email demo@corpsync.app about Kashif Zafar, ID 784-1990-1234567-1.";
    const tokenized = await t.tokenizeText(src);
    expect(tokenized).not.toContain("demo@corpsync.app");
    expect(tokenized).not.toContain("Kashif Zafar");
    expect(tokenized).not.toContain("784-1990-1234567-1");
    expect(t.detokenizeText(tokenized)).toContain("demo@corpsync.app");
    expect(t.detokenizeText(tokenized)).toContain("Kashif Zafar");
  });

  it("does not match short or common names inside unrelated text", async () => {
    const t = await make(["Ali", "Gold"]);
    const out = await t.tokenizeText("Ali bought gold bars at Goldman.");
    expect(out).toBe("Ali bought gold bars at Goldman.");
  });

  it("tokenizes tool results by column and keeps non-PII fields", async () => {
    const t = await make();
    const row = {
      count: 1,
      entities: [
        {
          id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
          name: "Aurora Holdings LLC",
          type: "company",
          email: "ops@aurora.example",
          nationality_or_jurisdiction: "UAE",
        },
      ],
    };
    const out = await t.tokenizeValue(row);
    const e = out.entities[0];
    expect(out.count).toBe(1);
    expect(e.nationality_or_jurisdiction).toBe("UAE");
    expect(e.name).toMatch(/^\[COMPANY_/);
    expect(e.email).toMatch(/^\[EMAIL_/);
    expect(e.id).toMatch(/^\[ID_/);
  });

  it("detokenizes tool arguments nested in arrays and objects", async () => {
    const t = await make();
    const token = await t.tokenize("ID", "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
    const input = { filters: { entityIds: [token] }, note: `about ${token}` };
    const real = t.detokenizeValue(input);
    expect(real.filters.entityIds[0]).toBe("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
    expect(real.note).toContain("aaaaaaaa-bbbb");
  });

  it("replaces unknown tokens with a neutral fallback, never raw", async () => {
    const t = await make();
    const out = t.detokenizeText("Ask [PERSON_ZZZZZZZ] and [COMPANY_QQQQQQQ] today.");
    expect(out).toBe("Ask this person and this company today.");
    expect(t.unknownTokens()).toBe(2);
  });
});

describe("detokenize stream", () => {
  const run = async (chunks: string[], t: Awaited<ReturnType<typeof make>>) => {
    const enc = new TextEncoder();
    const src = new ReadableStream({
      start(c) {
        for (const ch of chunks) c.enqueue(enc.encode(ch));
        c.close();
      },
    });
    const reader = src.pipeThrough(t.createDetokenizeTransform()).getReader();
    let out = "";
    const dec = new TextDecoder();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      out += dec.decode(value, { stream: true });
    }
    return out;
  };

  it("resolves a token split across chunks", async () => {
    const t = await make();
    const token = await t.tokenize("PERSON", "Kashif Zafar");
    const mid = Math.floor(token.length / 2);
    const out = await run(["Hi ", token.slice(0, mid), token.slice(mid), " done"], t);
    expect(out).toBe("Hi Kashif Zafar done");
  });

  it("discards a truncated token at stream end", async () => {
    const t = await make();
    const out = await run(["Report for [PERSON_7C"], t);
    expect(out).toBe("Report for ");
  });

  it("json-escapes replacements so SSE payloads stay valid", async () => {
    const t = await make([]);
    const token = await t.tokenize("ADDRESS", 'Villa 3\nDubai "Marina"');
    const out = await run([`data: {"text":"${token}"}\n\n`], t);
    expect(() => JSON.parse(out.replace("data: ", "").trim())).not.toThrow();
  });
});

describe("redact.ts covers UAE PII shapes", () => {
  it("scrubs Emirates ID, UAE IBAN, UAE mobile and emails", () => {
    const out = redactText(
      "ID 784-1990-1234567-1, IBAN AE07 0331 2345 6789 0123 456, mobile +971 50 123 4567, mail a.person@corpsync.app",
    );
    expect(out).not.toContain("784-1990-1234567-1");
    expect(out).not.toContain("0331 2345 6789");
    expect(out).not.toContain("50 123 4567");
    expect(out).not.toContain("a.person@corpsync.app");
  });
});
