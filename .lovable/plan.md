# PII Tokenization for the AI Copilot

Replace real personal data with stable placeholder tokens before anything reaches the AI model or the prompt log, and swap the real values back in before the answer reaches the user.

## What changes for the user

Nothing visible. The Copilot still answers with real names, emails and account numbers — but the model, the gateway and the AI Prompt Log only ever see placeholders like `[PERSON_7C2A]`, `[EMAIL_4B1E]`, `[IBAN_19FD]`.

## How it works

```text
User question ──tokenize──> Model
Workspace data ──tokenize──> Model
Model answer ──detokenize──> User
Everything logged = tokenized only
```

- Each real value gets a deterministic token derived from an HMAC of a workspace-scoped subkey plus the value (or the entity id). Same person = same token every time, in every thread — so the model can still reason about relationships and prompt-log diffs stay meaningful.
- Tokens are **7 base32 characters (~35 bits)** and fixed length. No collision-extension logic: at that size collisions are negligible even for very large workspaces, and — critically — a fixed length is the only way the "same person = same token" guarantee survives a map that is rebuilt fresh on every request. Nothing about the token depends on which other values happened to be in the same request.
- The token map is built per request in the backend and never sent to the model, never written to the database.
- Tokens keep a type prefix (`PERSON`, `COMPANY`, `EMAIL`, `PHONE`, `IBAN`, `ACCOUNT`, `EMIRATES_ID`, `ADDRESS`, `DOB`) so the model knows what kind of value it is holding.


## Scope of what gets tokenized

Tokenized by column, wherever tool results return them:
- Entity name, email, phone, registered address, date of birth, registration number, professional bio
- Profile / actor names and emails
- Bank account number, IBAN, SWIFT, RM name/email/phone, CIF number
- Document number
- Entity UUIDs (so tool arguments round-trip through tokens too)

Not tokenized (needed for reasoning, not identifying): entity type, jurisdiction, percentages, share counts, dates other than DOB, statuses, document types.

The existing regex scrubber in `redact.ts` stays as a safety net for freehand fields (bios, notes, covenant notes, service-request outcome notes) that the column map can't catch by design. Its patterns already cover the UAE shapes that matter here — Emirates ID `784-YYYY-XXXXXXX-X`, IBAN starting `AE`, international mobile numbers, JWTs and key-shaped strings — so no new patterns are needed; the build will add a test fixture with real-shaped UAE values to prove it.

## Behaviour details

- **User's own message** is tokenized too: workspace entity names/emails/phones appearing in the question are swapped for their tokens before the model sees it.
- **Free-text matching is explicit, not naive.** Emails, phones, IBANs and Emirates IDs are matched by pattern (cheap, no false positives). Names are matched only when they are **4+ characters** and only on **word boundaries**, longest-first, in a **single pass** over the text using one combined alternation (built once per request), not one scan per entity. Names shorter than the threshold, or that are common English words, are skipped in free text — they are still tokenized when they arrive as a structured column value, where there is no ambiguity.
- **Tool arguments** are detokenized with a **deep recursive walk** over the whole argument object — strings nested inside arrays and objects (`{ filters: { entityIds: ["…"] } }`) are covered, not just top-level fields.
- **Unresolvable tokens never reach the user.** Detokenization defines explicit behaviour for a bracket pattern that isn't in the map (model hallucinated or mistyped it): it is replaced with a neutral fallback derived from the type prefix ("this person", "this company", "a redacted value") and counted in the prompt log, never emitted raw. A `[PERSON_…]`-shaped string must never appear in the UI.
- **Streaming answer** is detokenized on the fly. The transform holds a tail buffer sized to the longest possible token and **flushes on close**: a partial bracket left at stream end (truncation, error, aborted run) is resolved if complete, otherwise discarded — never emitted as `[PERSON_7C`.
- **Stored chat history** (`ai_messages`) keeps the real, detokenized text so the conversation reads normally when reloaded.
- **`ai_prompt_logs`** stores only the tokenized payloads — the log becomes genuinely PII-free rather than regex-best-effort.
- A short note is added to the system prompt telling the model that bracketed tokens are opaque identifiers it should carry through verbatim and never invent or shorten.

## Technical section

New file `supabase/functions/_shared/pii-tokens.ts`:
- `createTokenizer(workspaceId)` — builds a per-request bidirectional map. Key derivation is purpose-scoped: `subkey = HMAC-SHA256(ENCRYPTION_MASTER_KEY, "pii-token:" + workspaceId)`, then `token = base32(HMAC-SHA256(subkey, type + ":" + normalizedValue))[0..7]`. The master key is never used directly, so the token HMAC is cryptographically independent of the document-encryption path.
- Fixed 7-character tokens, no collision extension, no persisted map — determinism comes entirely from the HMAC, so tokens are stable across requests, threads and deployments.
- `tokenizeRow(row, fieldMap)` — column-driven tokenization for tool results.
- `tokenizeText(text)` — single-pass combined-regex replacement (patterns for structured PII + word-boundary alternation of known names ≥4 chars, longest-first).
- `detokenizeValue(value)` — deep recursive walk for tool inputs.
- `detokenizeText(text, { onUnknown })` / `createDetokenizeTransform()` — reverse direction with the tail buffer and flush-on-close described above.

Changes in `supabase/functions/ai-assistant/index.ts`:
- Instantiate the tokenizer after `workspaceId` is resolved; prime the name alternation from the workspace's entity names in one query.
- Wrap each tool's `execute` return value in `tokenizeRow`, and pass each tool's input through `detokenizeValue` before use.
- Tokenize `modelMessages` before `streamText` and before the prompt-log insert.
- Pipe the UI message stream through the detokenize transform in `toUIMessageStreamResponse`, and detokenize `responseMessage.parts` before saving to `ai_messages`.
- Keep `redactValue` / `redactText` on the prompt-log path as the second layer.

Tests (`src/lib`-style vitest against the shared module logic): token stability across two independent tokenizer instances, unknown-token fallback, stream flush with a truncated token, deep tool-input detokenization, and UAE-format redaction fixtures.


No database migration and no frontend change required.
