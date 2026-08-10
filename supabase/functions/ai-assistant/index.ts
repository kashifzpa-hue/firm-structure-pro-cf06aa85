import { corsFor } from "../_shared/http.ts";
import { redactValue, redactText, redactEmail } from "../_shared/redact.ts";
import { convertToModelMessages, stepCountIs, streamText, tool, type UIMessage } from "npm:ai@^7";
import { createOpenAI } from "npm:@ai-sdk/openai@^4";
import { createClient } from "npm:@supabase/supabase-js@^2";
import { z } from "npm:zod@^4";
import { createLovableAiGatewayRunIdFetch, getLovableAiGatewayRunId } from "../_shared/ai-gateway.ts";
import { createTokenizer } from "../_shared/pii-tokens.ts";



const PRODUCT_GUIDE = `
CorpSync is a multi-tenant corporate entity management platform for law firms and corporate service providers.
Modules and where to find them in the app:
- Dashboard (/dashboard): compliance overview, expiring documents, alerts.
- Entities (/entities): companies and individuals. Each entity has a detail page with documents, ownership, appointments, share capital.
- Documents (/documents): document register per entity, with issue/expiry dates, renewal frequency and status badges (green Valid, amber Expiring Soon, red Expired). Statuses are calculated from expiry_date.
- Ownership (/ownership): equity links between an owner entity and an owned entity with a percentage, share class and effective date. "Setup mode" lets you seed the current cap table; "Live mode" records changes as movements in the Ledger.
- Org Chart (/org-chart): visual ownership tree.
- Ledger (/ledger): share movements (transfers, issuances, redemptions) with a wizard and approval/void flow.
- UBO Registry (/ubo): ultimate beneficial owners computed by walking ownership chains and multiplying percentages. Individuals above the threshold (usually 25%) are flagged.
- Bank Accounts (/bank-accounts) and Signatory Register (/signatory-register): banking details, signatories and signing matrix rules.
- Reports (/reports): exports and compliance packs.
- Settings (/settings): workspace, members, alert rules.
- User Manual (/manual): slide-based guide.
Roles: admin can create and edit everything; viewer is read-only.
`;

const SYSTEM_PROMPT = `You are CorpSync Copilot, the in-app assistant for the CorpSync entity-management platform.

You do three things:
1. Teach users how to use CorpSync, based on the product guide below. Give short, concrete steps and mention the exact page paths.
2. Answer questions about the user's own workspace data by calling the read tools. Never invent data — call a tool.
3. Generate content (summaries, compliance checklists, board memos, briefing notes) from real workspace data, and create records when explicitly asked.

Rules:
- Always call tools to answer data questions; never guess numbers, names or dates.
- Privacy: personal and account data is replaced by opaque placeholders such as [PERSON_K3XQ9AB], [COMPANY_2M4TZQD] or [EMAIL_9PWB3RC]. Treat each placeholder as the identity of that record: reuse it verbatim, exactly as given, in your answers and in tool arguments. Never shorten, reformat, translate or invent a placeholder, and never claim you cannot see a name — the user sees the real value.
- Before creating or updating anything, restate exactly what you will create and ask the user to confirm, unless they already gave an explicit instruction with all required details.
- Only admins can create or update records. If a write tool returns a permission error, explain the user needs admin rights.
- Answer in concise markdown. Use tables for lists of records. Percentages to 2 decimals.
- Today's date is ${new Date().toISOString().slice(0, 10)}.

PRODUCT GUIDE:
${PRODUCT_GUIDE}`;


function docStatus(expiry: string | null) {
  if (!expiry) return "no_expiry";
  const days = Math.floor((new Date(expiry).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return "expired";
  if (days <= 30) return "expiring_soon";
  return "valid";
}

Deno.serve(async (req) => {
  const corsHeaders = corsFor(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "AI is not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
    );

    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, threadId }: { messages: UIMessage[]; threadId: string } = await req.json();

    const { data: thread, error: threadError } = await supabase
      .from("ai_threads")
      .select("id, workspace_id, user_id, title")
      .eq("id", threadId)
      .maybeSingle();

    if (threadError || !thread || thread.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Conversation not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const workspaceId = thread.workspace_id as string;

    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    const isAdmin = roleRow?.role === "admin";

    // PII tokenizer: real values never reach the model or the prompt log.
    const { data: nameRows } = await supabase
      .from("entities")
      .select("name")
      .eq("workspace_id", workspaceId)
      .limit(5000);
    const tokenizer = await createTokenizer(
      Deno.env.get("ENCRYPTION_MASTER_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!,
      workspaceId,
      { names: (nameRows ?? []).map((r) => r.name as string) },
    );



    // Persist the incoming user message.
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === "user") {
      const { error: insertError } = await supabase.from("ai_messages").insert({
        thread_id: threadId,
        workspace_id: workspaceId,
        user_id: user.id,
        role: "user",
        parts: lastMessage.parts,
      });
      if (insertError) console.error("Failed to save user message:", insertError.message);

      const firstText = (lastMessage.parts ?? [])
        .map((p: { type: string; text?: string }) => (p.type === "text" ? p.text ?? "" : ""))
        .join(" ")
        .trim();
      if (thread.title === "New chat" && firstText) {
        await supabase
          .from("ai_threads")
          .update({ title: firstText.slice(0, 60), updated_at: new Date().toISOString() })
          .eq("id", threadId);
      } else {
        await supabase.from("ai_threads").update({ updated_at: new Date().toISOString() }).eq("id", threadId);
      }
    }

    const adminGuard = () =>
      isAdmin ? null : { error: "Permission denied: only workspace admins can create or change records." };

    const tools = {
      list_entities: tool({
        description: "List or search entities (companies and individuals) in the workspace.",
        inputSchema: z.object({
          search: z.string().nullable().describe("Name fragment to search for, or null for all."),
          type: z.enum(["company", "individual"]).nullable().describe("Filter by entity type, or null."),
          limit: z.number().int().nullable().describe("Max rows, default 25."),
        }),
        execute: async ({ search, type, limit }) => {
          let q = supabase
            .from("entities")
            .select("id, name, type, company_type, entity_status, nationality_or_jurisdiction, registration_number, date_of_birth_or_incorporation, email")
            .eq("workspace_id", workspaceId)
            .order("name")
            .limit(Math.min(limit ?? 25, 100));
          if (search) q = q.ilike("name", `%${search}%`);
          if (type) q = q.eq("type", type);
          const { data, error } = await q;
          if (error) return { error: error.message };
          return { count: data?.length ?? 0, entities: data };
        },
      }),

      get_entity: tool({
        description: "Get full detail for one entity including its documents, owners and holdings.",
        inputSchema: z.object({ entity_id: z.string().describe("The entity UUID.") }),
        execute: async ({ entity_id }) => {
          const { data: entity, error } = await supabase
            .from("entities")
            .select("*")
            .eq("workspace_id", workspaceId)
            .eq("id", entity_id)
            .maybeSingle();
          if (error) return { error: error.message };
          if (!entity) return { error: "Entity not found" };
          const { data: documents } = await supabase
            .from("documents")
            .select("id, document_type, document_number, issue_date, expiry_date, country_of_issue")
            .eq("workspace_id", workspaceId)
            .eq("entity_id", entity_id);
          const { data: ownedBy } = await supabase
            .from("equity_links")
            .select("percentage, shares_owned, effective_date, end_date, owner:owner_entity_id (id, name, type)")
            .eq("workspace_id", workspaceId)
            .eq("owned_entity_id", entity_id);
          const { data: owns } = await supabase
            .from("equity_links")
            .select("percentage, shares_owned, effective_date, end_date, owned:owned_entity_id (id, name, type)")
            .eq("workspace_id", workspaceId)
            .eq("owner_entity_id", entity_id);
          return {
            entity,
            documents: (documents ?? []).map((d) => ({ ...d, status: docStatus(d.expiry_date) })),
            owned_by: ownedBy ?? [],
            owns: owns ?? [],
          };
        },
      }),

      list_documents: tool({
        description: "List documents in the workspace, optionally filtered by status or entity.",
        inputSchema: z.object({
          status: z.enum(["expired", "expiring_soon", "valid", "any"]).describe("Document status filter."),
          entity_id: z.string().nullable().describe("Restrict to one entity, or null."),
          days_ahead: z.number().int().nullable().describe("For expiring_soon, horizon in days (default 30)."),
        }),
        execute: async ({ status, entity_id, days_ahead }) => {
          let q = supabase
            .from("documents")
            .select("id, document_type, document_number, issue_date, expiry_date, country_of_issue, entity:entity_id (id, name, type)")
            .eq("workspace_id", workspaceId)
            .order("expiry_date", { nullsFirst: false })
            .limit(200);
          if (entity_id) q = q.eq("entity_id", entity_id);
          const { data, error } = await q;
          if (error) return { error: error.message };
          const horizon = days_ahead ?? 30;
          const rows = (data ?? []).map((d) => {
            const days = d.expiry_date
              ? Math.floor((new Date(d.expiry_date).getTime() - Date.now()) / 86_400_000)
              : null;
            return { ...d, days_to_expiry: days, status: docStatus(d.expiry_date) };
          });
          const filtered =
            status === "any"
              ? rows
              : status === "expiring_soon"
                ? rows.filter((r) => r.days_to_expiry !== null && r.days_to_expiry >= 0 && r.days_to_expiry <= horizon)
                : rows.filter((r) => r.status === status);
          return { count: filtered.length, documents: filtered.slice(0, 100) };
        },
      }),

      list_ownership: tool({
        description: "List ownership (equity) links, optionally for a specific company.",
        inputSchema: z.object({
          company_entity_id: z.string().nullable().describe("Owned company UUID, or null for all links."),
          active_only: z.boolean().describe("Only links without an end date."),
        }),
        execute: async ({ company_entity_id, active_only }) => {
          let q = supabase
            .from("equity_links")
            .select("id, percentage, shares_owned, effective_date, end_date, owner:owner_entity_id (id, name, type), owned:owned_entity_id (id, name, type)")
            .eq("workspace_id", workspaceId)
            .limit(200);
          if (company_entity_id) q = q.eq("owned_entity_id", company_entity_id);
          if (active_only) q = q.is("end_date", null);
          const { data, error } = await q;
          if (error) return { error: error.message };
          return { count: data?.length ?? 0, links: data };
        },
      }),

      list_ubos: tool({
        description: "List calculated ultimate beneficial owners from the UBO registry.",
        inputSchema: z.object({
          company_entity_id: z.string().nullable().describe("Company UUID, or null for all companies."),
          above_threshold_only: z.boolean().describe("Only UBOs above the reporting threshold."),
        }),
        execute: async ({ company_entity_id, above_threshold_only }) => {
          let q = supabase
            .from("ubo_snapshots")
            .select("effective_economic_pct, effective_voting_pct, is_above_threshold, circular_detected, unresolved_chain, calculated_at, company:company_entity_id (id, name), person:person_entity_id (id, name)")
            .eq("workspace_id", workspaceId)
            .order("effective_economic_pct", { ascending: false })
            .limit(200);
          if (company_entity_id) q = q.eq("company_entity_id", company_entity_id);
          if (above_threshold_only) q = q.eq("is_above_threshold", true);
          const { data, error } = await q;
          if (error) return { error: error.message };
          return { count: data?.length ?? 0, ubos: data };
        },
      }),

      workspace_overview: tool({
        description: "High-level counts for the workspace: entities, documents by status, ownership links, bank accounts.",
        inputSchema: z.object({}),
        execute: async () => {
          const [entities, documents, links, accounts] = await Promise.all([
            supabase.from("entities").select("type, entity_status").eq("workspace_id", workspaceId),
            supabase.from("documents").select("expiry_date").eq("workspace_id", workspaceId),
            supabase.from("equity_links").select("id").eq("workspace_id", workspaceId),
            supabase.from("bank_accounts").select("id").eq("workspace_id", workspaceId),
          ]);
          const docs = documents.data ?? [];
          return {
            entities_total: entities.data?.length ?? 0,
            companies: entities.data?.filter((e) => e.type === "company").length ?? 0,
            individuals: entities.data?.filter((e) => e.type === "individual").length ?? 0,
            documents_total: docs.length,
            documents_expired: docs.filter((d) => docStatus(d.expiry_date) === "expired").length,
            documents_expiring_soon: docs.filter((d) => docStatus(d.expiry_date) === "expiring_soon").length,
            ownership_links: links.data?.length ?? 0,
            bank_accounts: accounts.data?.length ?? 0,
          };
        },
      }),

      create_entity: tool({
        description: "Create a new entity (company or individual). Admins only. Confirm details with the user first.",
        inputSchema: z.object({
          name: z.string().describe("Entity legal name or person name."),
          type: z.enum(["company", "individual"]).describe("Entity type."),
          jurisdiction: z.string().nullable().describe("Nationality or jurisdiction, or null."),
          registration_number: z.string().nullable().describe("Registration/passport number, or null."),
          notes: z.string().nullable().describe("Free-text notes, or null."),
        }),
        execute: async ({ name, type, jurisdiction, registration_number, notes }) => {
          const denied = adminGuard();
          if (denied) return denied;
          const { data, error } = await supabase
            .from("entities")
            .insert({
              workspace_id: workspaceId,
              name,
              type,
              nationality_or_jurisdiction: jurisdiction,
              registration_number,
              notes,
            })
            .select("id, name, type")
            .maybeSingle();
          if (error) return { error: error.message };
          return { created: data };
        },
      }),

      create_document: tool({
        description: "Add a document record to an entity. Admins only. Confirm details with the user first.",
        inputSchema: z.object({
          entity_id: z.string().describe("Entity UUID the document belongs to."),
          document_type: z.string().describe("Document type, e.g. Trade Licence, Passport, MOA."),
          document_number: z.string().nullable().describe("Document number, or null."),
          issue_date: z.string().nullable().describe("ISO date YYYY-MM-DD, or null."),
          expiry_date: z.string().nullable().describe("ISO date YYYY-MM-DD, or null."),
          country_of_issue: z.string().nullable().describe("Country of issue, or null."),
        }),
        execute: async (input) => {
          const denied = adminGuard();
          if (denied) return denied;
          const { data, error } = await supabase
            .from("documents")
            .insert({ workspace_id: workspaceId, ...input })
            .select("id, document_type, expiry_date")
            .maybeSingle();
          if (error) return { error: error.message };
          return { created: data };
        },
      }),

      create_ownership_link: tool({
        description: "Create an ownership (equity) link between two entities. Admins only. Confirm details first.",
        inputSchema: z.object({
          owner_entity_id: z.string().describe("Owner entity UUID."),
          owned_entity_id: z.string().describe("Owned company UUID."),
          percentage: z.number().describe("Ownership percentage, 0-100."),
          effective_date: z.string().nullable().describe("ISO date YYYY-MM-DD, or null for today."),
          notes: z.string().nullable().describe("Notes, or null."),
        }),
        execute: async ({ owner_entity_id, owned_entity_id, percentage, effective_date, notes }) => {
          const denied = adminGuard();
          if (denied) return denied;
          const { data, error } = await supabase
            .from("equity_links")
            .insert({
              workspace_id: workspaceId,
              owner_entity_id,
              owned_entity_id,
              percentage,
              effective_date: effective_date ?? new Date().toISOString().slice(0, 10),
              notes,
            })
            .select("id, percentage")
            .maybeSingle();
          if (error) return { error: error.message };
          return { created: data };
        },
      }),
    };

    // Every tool: detokenize the model's arguments (deep) before the query runs,
    // tokenize the result (column-driven, deep) before it goes back to the model.
    const tokenizedTools = Object.fromEntries(
      Object.entries(tools).map(([name, definition]) => {
        const original = definition as unknown as {
          execute: (input: unknown, options: unknown) => Promise<unknown>;
        };
        return [
          name,
          {
            ...(definition as object),
            execute: async (input: unknown, options: unknown) => {
              const realInput = tokenizer.detokenizeValue(input);
              const output = await original.execute(realInput, options);
              return await tokenizer.tokenizeValue(output);
            },
          },
        ];
      }),
    ) as typeof tools;


    const initialRunId = getLovableAiGatewayRunId(req);
    const runIdFetch = createLovableAiGatewayRunIdFetch(initialRunId);
    const lovable = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
      fetch: runIdFetch.fetch,
    });

    const MODEL_ID = "openai/gpt-5.6-sol";
    const providerOptions = {
      openai: {
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    } as const;

    const modelMessages = await tokenizer.tokenizeAllText(await convertToModelMessages(messages));

    // Service-role client used only for the prompt audit log (table is insert-restricted).
    const logClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    let promptLogId: string | null = null;
    const startedAt = Date.now();
    try {
      const { data: logRow, error: logError } = await logClient
        .from("ai_prompt_logs")
        .insert({
          workspace_id: workspaceId,
          thread_id: threadId,
          user_id: user.id,
          user_email: redactEmail(user.email),
          model: MODEL_ID,
          run_id: initialRunId ?? null,
          system_prompt: SYSTEM_PROMPT,
          sent_messages: redactValue(modelMessages),
          provider_options: providerOptions,
          available_tools: Object.keys(tools),
          status: "pending",
        })
        .select("id")
        .maybeSingle();
      if (logError) console.error("Failed to write prompt log:", logError.message);
      promptLogId = logRow?.id ?? null;
    } catch (e) {
      console.error("Prompt log insert failed:", e);
    }

    const finalizeLog = async (patch: Record<string, unknown>) => {
      if (!promptLogId) return;
      const { error } = await logClient
        .from("ai_prompt_logs")
        .update({ duration_ms: Date.now() - startedAt, ...patch })
        .eq("id", promptLogId);
      if (error) console.error("Failed to update prompt log:", error.message);
    };

    const result = streamText({
      model: lovable.responses(MODEL_ID),
      system: SYSTEM_PROMPT,
      messages: modelMessages,
      tools: tokenizedTools,
      stopWhen: stepCountIs(50),
      providerOptions,
      onError: async ({ error }) => {
        console.error("streamText error:", error);
        await finalizeLog({
          status: "error",
          error_message: redactText(error instanceof Error ? error.message : String(error)),
        });
      },
      onFinish: async ({ text, finishReason, usage, steps }) => {
        const toolCalls = (steps ?? []).flatMap((step) =>
          (step.toolCalls ?? []).map((call, i) => ({
            tool: call.toolName,
            input: redactValue(call.input),
            output: redactValue(step.toolResults?.[i]?.output ?? null),
          })),
        );
        await finalizeLog({
          status: "success",
          response_text: text ? redactText(text) : null,
          finish_reason: finishReason ?? null,
          tool_calls: toolCalls,
          input_tokens: usage?.inputTokens ?? null,
          output_tokens: usage?.outputTokens ?? null,
          total_tokens: usage?.totalTokens ?? null,
          run_id: runIdFetch.getRunId() ?? initialRunId ?? null,
        });
      },
    });

    return result.toUIMessageStreamResponse({
      sendReasoning: true,
      originalMessages: messages,
      headers: corsHeaders,
      onFinish: async ({ responseMessage }) => {
        const { error } = await supabase.from("ai_messages").insert({
          thread_id: threadId,
          workspace_id: workspaceId,
          user_id: user.id,
          role: "assistant",
          parts: responseMessage.parts,
        });
        if (error) console.error("Failed to save assistant message:", error.message);
      },
    });
  } catch (e) {
    console.error("ai-assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
