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

The existing regex scrubber in `redact.ts` stays as a safety net for anything typed freehand by the user that the column-level map doesn't catch.

## Behaviour details

- **User's own message** is tokenized too: any workspace entity name/email/phone appearing in the question is swapped for its token before the model sees it.
- **Tool arguments** coming back from the model may contain tokens (e.g. an entity id it saw earlier) — these are detokenized before the database query runs, so tools keep working normally.
- **Streaming answer** is detokenized on the fly with a small buffer so a token split across two chunks is still replaced correctly.
- **Stored chat history** (`ai_messages`) keeps the real, detokenized text so the conversation reads normally when reloaded.
- **`ai_prompt_logs`** stores only the tokenized payloads — the log becomes genuinely PII-free rather than regex-best-effort.
- A short note is added to the system prompt telling the model that bracketed tokens are opaque identifiers it should carry through verbatim and never invent.

## Technical section

New file `supabase/functions/_shared/pii-tokens.ts`:
- `createTokenizer(workspaceId)` — builds a per-request bidirectional map; HMAC-SHA256 over `ENCRYPTION_MASTER_KEY + workspaceId + normalizedValue`, base32-ish, truncated to 4 chars with collision extension to 6.
- `tokenizeRow(row, fieldMap)` — column-driven tokenization for tool results.
- `tokenizeText(text)` — swaps any known real value found in free text (longest-match first).
- `detokenizeText(text)` / `createDetokenizeStream()` — reverse direction, the stream variant holding a tail buffer of up to the max token length.

Changes in `supabase/functions/ai-assistant/index.ts`:
- Instantiate the tokenizer after `workspaceId` is resolved.
- Wrap each tool's `execute` return value in `tokenizeRow`, and each tool's input in `detokenize` before use.
- Tokenize `modelMessages` before `streamText` and before the prompt-log insert.
- Pipe the UI message stream through the detokenize transform in `toUIMessageStreamResponse`, and detokenize `responseMessage.parts` before saving to `ai_messages`.
- Keep `redactValue` / `redactText` on the prompt-log path as the second layer.

No database migration and no frontend change required.
