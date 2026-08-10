import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Bot, MessageSquarePlus, Trash2, Building2, FileWarning, Shield, Sparkle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Tool, ToolHeader, ToolContent, ToolInput, ToolOutput } from "@/components/ai-elements/tool";

type ThreadRow = { id: string; title: string; updated_at: string };

const SUGGESTIONS = [
  { icon: Building2, label: "How do I add a company and its shareholders?" },
  { icon: FileWarning, label: "Which documents expire in the next 60 days?" },
  { icon: Shield, label: "Summarise the UBOs above 25% across my workspace" },
  { icon: Sparkle, label: "Draft a compliance briefing note for my largest company" },
];

export default function Assistant() {
  const { threadId } = useParams<{ threadId: string }>();
  const navigate = useNavigate();
  const { user, workspaceId } = useAuth();
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [initialMessages, setInitialMessages] = useState<UIMessage[] | null>(null);
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const creatingRef = useRef(false);

  const loadThreads = useCallback(async () => {
    const { data } = await supabase
      .from("ai_threads")
      .select("id, title, updated_at")
      .order("updated_at", { ascending: false });
    setThreads((data as ThreadRow[]) ?? []);
  }, []);

  const createThread = useCallback(async () => {
    if (!user || !workspaceId || creatingRef.current) return;
    creatingRef.current = true;
    const { data, error } = await supabase
      .from("ai_threads")
      .insert({ user_id: user.id, workspace_id: workspaceId, title: "New chat" })
      .select("id, title, updated_at")
      .single();
    creatingRef.current = false;
    if (error || !data) {
      toast.error("Could not start a new conversation");
      return;
    }
    setThreads((prev) => [data as ThreadRow, ...prev]);
    navigate(`/assistant/${data.id}`);
  }, [navigate, user, workspaceId]);

  useEffect(() => {
    void loadThreads();
  }, [loadThreads]);

  // No thread in the URL: open the most recent one, or create the first.
  useEffect(() => {
    if (threadId || !user || !workspaceId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("ai_threads")
        .select("id")
        .order("updated_at", { ascending: false })
        .limit(1);
      if (cancelled) return;
      if (data && data.length > 0) navigate(`/assistant/${data[0].id}`, { replace: true });
      else void createThread();
    })();
    return () => {
      cancelled = true;
    };
  }, [threadId, user, workspaceId, navigate, createThread]);

  // Load persisted messages for the active thread.
  useEffect(() => {
    if (!threadId) return;
    let cancelled = false;
    setInitialMessages(null);
    (async () => {
      const { data, error } = await supabase
        .from("ai_messages")
        .select("id, role, parts")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      if (error) {
        toast.error("Could not load this conversation");
        setInitialMessages([]);
        return;
      }
      setInitialMessages(
        (data ?? []).map((m) => ({
          id: m.id as string,
          role: m.role as UIMessage["role"],
          parts: (m.parts ?? []) as UIMessage["parts"],
        })),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [threadId]);

  const deleteThread = async (id: string) => {
    await supabase.from("ai_threads").delete().eq("id", id);
    const remaining = threads.filter((t) => t.id !== id);
    setThreads(remaining);
    if (id === threadId) {
      if (remaining.length > 0) navigate(`/assistant/${remaining[0].id}`, { replace: true });
      else void createThread();
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-4">
      <aside className="hidden w-64 shrink-0 flex-col rounded-xl border bg-card md:flex">
        <div className="p-3">
          <Button className="w-full justify-start gap-2" onClick={() => void createThread()}>
            <MessageSquarePlus className="h-4 w-4" />
            New chat
          </Button>
        </div>
        <ScrollArea className="flex-1 px-2 pb-3">
          <div className="space-y-1">
            {threads.map((t) => (
              <div
                key={t.id}
                className={cn(
                  "group flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted",
                  t.id === threadId && "bg-muted font-medium",
                )}
              >
                <button
                  type="button"
                  onClick={() => navigate(`/assistant/${t.id}`)}
                  className="flex-1 truncate text-left"
                  title={t.title}
                >
                  {t.title}
                </button>
                <button
                  type="button"
                  aria-label="Delete conversation"
                  onClick={() => void deleteThread(t.id)}
                  className="opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col rounded-xl border bg-card">
        {threadId && initialMessages !== null ? (
          <ChatWindow
            key={threadId}
            threadId={threadId}
            initialMessages={initialMessages}
            input={input}
            setInput={setInput}
            textareaRef={textareaRef}
            onTitleMayChange={loadThreads}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">Loading…</div>
        )}
      </div>
    </div>
  );
}

function ChatWindow({
  threadId,
  initialMessages,
  input,
  setInput,
  textareaRef,
  onTitleMayChange,
}: {
  threadId: string;
  initialMessages: UIMessage[];
  input: string;
  setInput: (v: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  onTitleMayChange: () => void;
}) {
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`,
        headers: async () => {
          const { data } = await supabase.auth.getSession();
          return {
            Authorization: `Bearer ${data.session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          };
        },
        body: { threadId },
      }),
    [threadId],
  );

  const { messages, sendMessage, status, error } = useChat({
    id: threadId,
    messages: initialMessages,
    transport,
    onFinish: () => {
      onTitleMayChange();
      textareaRef.current?.focus();
    },
    onError: (e) => toast.error(e.message || "The assistant could not respond"),
  });

  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    textareaRef.current?.focus();
  }, [threadId, textareaRef]);

  const submit = (text: string) => {
    const value = text.trim();
    if (!value || busy) return;
    void sendMessage({ text: value });
    setInput("");
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  return (
    <>
      <Conversation className="flex-1">
        <ConversationContent className="mx-auto w-full max-w-3xl">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center gap-6 py-12">
              <ConversationEmptyState
                icon={
                  <div className="rounded-2xl bg-primary/10 p-3">
                    <img src="/logo-icon.png" alt="" className="h-8 w-8" />
                  </div>
                }
                title="CorpSync Copilot"
                description="Ask how to use CorpSync, query your entities, documents and UBOs, or generate briefing notes."
              />
              <div className="grid w-full max-w-xl gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => submit(s.label)}
                    className="flex items-start gap-2 rounded-lg border p-3 text-left text-sm transition-colors hover:bg-muted"
                  >
                    <s.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{s.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <Message from={message.role} key={message.id}>
                <MessageContent>
                  {message.parts.map((part, i) => {
                    if (part.type === "text") {
                      return <MessageResponse key={i}>{part.text}</MessageResponse>;
                    }
                    if (part.type === "reasoning" && part.text) {
                      return (
                        <p key={i} className="text-xs italic text-muted-foreground">
                          {part.text}
                        </p>
                      );
                    }
                    if (part.type.startsWith("tool-")) {
                      const tp = part as unknown as {
                        type: string;
                        state: string;
                        input?: unknown;
                        output?: unknown;
                        errorText?: string;
                      };
                      return (
                        <Tool defaultOpen={false} key={i}>
                          <ToolHeader type={tp.type as `tool-${string}`} state={tp.state as never} />
                          <ToolContent>
                            <ToolInput input={tp.input} />
                            <ToolOutput output={tp.output} errorText={tp.errorText} />
                          </ToolContent>
                        </Tool>
                      );
                    }
                    return null;
                  })}
                  {message.role === "assistant" && <MessageSources message={message} />}
                </MessageContent>
              </Message>

            ))
          )}
          {status === "submitted" && (
            <div className="flex items-center gap-2 px-1 py-2">
              <Bot className="h-4 w-4 text-primary" />
              <Shimmer>Thinking…</Shimmer>
            </div>
          )}
          {error && (
            <p className="px-1 py-2 text-sm text-destructive">
              {error.message || "Something went wrong. Please try again."}
            </p>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="border-t p-3">
        <div className="mx-auto w-full max-w-3xl">
          <PromptInput
            onSubmit={(_, event) => {
              event.preventDefault();
              submit(input);
            }}
          >
            <PromptInputTextarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your entities, documents, UBOs — or how to use CorpSync…"
            />
            <PromptInputFooter className="justify-end">
              <PromptInputSubmit status={status} disabled={!input.trim() && !busy} />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
    </>
  );
}
