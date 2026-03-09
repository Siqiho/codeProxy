import { useCallback, useEffect, useState } from "react";
import { Modal } from "@/modules/ui/Modal";
import { usageApi } from "@/lib/http/apis";
import { Loader2, FileInput, FileOutput } from "lucide-react";

interface LogContentModalProps {
    open: boolean;
    logId: number | null;
    /** Which tab to show initially: "input" or "output" */
    initialTab?: "input" | "output";
    onClose: () => void;
}

/* -------------------------------------------------------------------------- */
/*  MessageBlock                                                              */
/* -------------------------------------------------------------------------- */

function MessageBlock({ role, content }: { role: string; content: string }) {
    const roleConfig: Record<string, { label: string; icon: string; color: string; bg: string }> = {
        system: {
            label: "系统提示词",
            icon: "⚙️",
            color: "text-purple-700 dark:text-purple-300",
            bg: "bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800/50",
        },
        developer: {
            label: "开发者指令",
            icon: "⚙️",
            color: "text-purple-700 dark:text-purple-300",
            bg: "bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800/50",
        },
        user: {
            label: "用户消息",
            icon: "👤",
            color: "text-sky-700 dark:text-sky-300",
            bg: "bg-sky-50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-800/50",
        },
        assistant: {
            label: "模型回复",
            icon: "🤖",
            color: "text-emerald-700 dark:text-emerald-300",
            bg: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/50",
        },
        tool: {
            label: "工具结果",
            icon: "🔧",
            color: "text-amber-700 dark:text-amber-300",
            bg: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/50",
        },
        instructions: {
            label: "指令 (Instructions)",
            icon: "📋",
            color: "text-indigo-700 dark:text-indigo-300",
            bg: "bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800/50",
        },
        function_call: {
            label: "函数调用",
            icon: "⚡",
            color: "text-orange-700 dark:text-orange-300",
            bg: "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800/50",
        },
        function_call_output: {
            label: "函数返回",
            icon: "📤",
            color: "text-teal-700 dark:text-teal-300",
            bg: "bg-teal-50 dark:bg-teal-950/30 border-teal-200 dark:border-teal-800/50",
        },
    };

    const config = roleConfig[role] || {
        label: role,
        icon: "💬",
        color: "text-slate-700 dark:text-slate-300",
        bg: "bg-slate-50 dark:bg-slate-950/30 border-slate-200 dark:border-slate-800/50",
    };

    return (
        <div className={`rounded-xl border p-4 ${config.bg}`}>
            <div className={`mb-2 flex items-center gap-2 text-sm font-semibold ${config.color}`}>
                <span>{config.icon}</span>
                <span>{config.label}</span>
            </div>
            <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800 dark:text-slate-200">
                {content}
            </div>
        </div>
    );
}

/* -------------------------------------------------------------------------- */
/*  Content extraction helpers                                                */
/* -------------------------------------------------------------------------- */

type Msg = { role: string; content: string };

/** Extract text from content field: string | array<{type,text}> | object */
function extractText(content: unknown): string {
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
        return content
            .map((p: Record<string, unknown>) => {
                if (typeof p.text === "string") return p.text;
                if (typeof p.content === "string") return p.content;
                return "";
            })
            .filter(Boolean)
            .join("\n");
    }
    if (content && typeof content === "object") return JSON.stringify(content, null, 2);
    return String(content ?? "");
}

/* -------------------------------------------------------------------------- */
/*  Input parsers                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Parse OpenAI Chat Completions format: { messages: [{role, content}] }
 */
function parseOpenAIMessages(data: Record<string, unknown>): Msg[] | null {
    const msgs = data.messages;
    if (!Array.isArray(msgs)) return null;
    const result = msgs
        .filter((m: Record<string, unknown>) => m.role && m.content !== undefined)
        .map((m: Record<string, unknown>) => ({
            role: String(m.role),
            content: extractText(m.content),
        }));
    return result.length > 0 ? result : null;
}

/**
 * Parse Codex / OpenAI Responses API format:
 * { instructions?: string, input: [{ type:"message", role, content:[{text}] }, ...] }
 */
function parseCodexInput(data: Record<string, unknown>): Msg[] | null {
    const input = data.input;
    if (!Array.isArray(input)) return null;

    const result: Msg[] = [];

    // Instructions first
    if (typeof data.instructions === "string" && data.instructions.trim()) {
        result.push({ role: "instructions", content: data.instructions.trim() });
    }

    for (const item of input as Record<string, unknown>[]) {
        const itemType = String(item.type || "");
        if (itemType === "message") {
            const role = String(item.role || "user");
            const text = extractText(item.content);
            if (text) result.push({ role, content: text });
        } else if (itemType === "function_call") {
            const name = String(item.name || "");
            const args = typeof item.arguments === "string" ? item.arguments : JSON.stringify(item.arguments ?? "");
            result.push({ role: "function_call", content: `${name}(${args})` });
        } else if (itemType === "function_call_output") {
            const output = typeof item.output === "string" ? item.output : JSON.stringify(item.output ?? "");
            result.push({ role: "function_call_output", content: output });
        } else {
            // Generic item — try to get content/text
            const text = extractText(item.content ?? item.text ?? "");
            if (text) result.push({ role: String(item.role || itemType || "unknown"), content: text });
        }
    }

    return result.length > 0 ? result : null;
}

/** Parse input content into structured messages */
function parseInputMessages(raw: string): Msg[] | null {
    // First try: valid JSON
    try {
        const data = JSON.parse(raw);
        const codex = parseCodexInput(data);
        if (codex) return codex;
        const openai = parseOpenAIMessages(data);
        if (openai) return openai;
        return null;
    } catch {
        // JSON is likely truncated (100KB limit). Try recovery.
    }

    // Recovery for truncated Codex/Responses format:
    // Extract "instructions" field value via regex
    const result: Msg[] = [];

    const instrMatch = raw.match(/"instructions"\s*:\s*"((?:[^"\\]|\\.)*)"/s);
    if (instrMatch) {
        const decoded = instrMatch[1]
            .replace(/\\n/g, "\n")
            .replace(/\\t/g, "\t")
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, "\\");
        result.push({ role: "instructions", content: decoded });
    }

    // Try to extract messages from "input" array - look for {type,role,content} patterns
    const inputMatch = raw.match(/"input"\s*:\s*\[(.+)/s);
    if (inputMatch) {
        const inputStr = inputMatch[1];
        // Extract individual input_text items
        const textRegex = /"type"\s*:\s*"input_text"\s*,\s*"text"\s*:\s*"((?:[^"\\]|\\.)*)"/gs;
        let match;
        const texts: string[] = [];
        while ((match = textRegex.exec(inputStr)) !== null) {
            const decoded = match[1]
                .replace(/\\n/g, "\n")
                .replace(/\\t/g, "\t")
                .replace(/\\"/g, '"')
                .replace(/\\\\/g, "\\");
            texts.push(decoded);
        }
        if (texts.length > 0) {
            result.push({ role: "user", content: texts.join("\n\n") });
        }
    }

    // Recovery for truncated OpenAI Chat Completions format:
    if (result.length === 0) {
        const messagesMatch = raw.match(/"messages"\s*:\s*\[(.+)/s);
        if (messagesMatch) {
            // Try to extract role+content pairs
            const roleContentRegex = /"role"\s*:\s*"(\w+)"\s*,\s*"content"\s*:\s*"((?:[^"\\]|\\.)*)"/gs;
            let match;
            while ((match = roleContentRegex.exec(messagesMatch[1])) !== null) {
                const decoded = match[2]
                    .replace(/\\n/g, "\n")
                    .replace(/\\t/g, "\t")
                    .replace(/\\"/g, '"')
                    .replace(/\\\\/g, "\\");
                result.push({ role: match[1], content: decoded });
            }
        }
    }

    if (result.length > 0) {
        result.push({
            role: "system",
            content: "⚠️ 注意：原始内容因超过大小限制被截断，部分消息可能不完整。",
        });
        return result;
    }

    return null;
}

/* -------------------------------------------------------------------------- */
/*  Output parsers                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Parse SSE stream lines to extract text deltas.
 * Supports:
 *  - OpenAI streaming: data: {"choices":[{"delta":{"content":"..."}}]}
 *  - Codex/Responses: data: {"type":"response.output_text.delta","delta":"..."}
 *                     or data: {"type":"content_block_delta","delta":{"text":"..."}}
 *  - Claude streaming: data: {"type":"content_block_delta","delta":{"text":"..."}}
 */
function parseSSEOutput(raw: string): string | null {
    const lines = raw.split("\n");
    const textParts: string[] = [];

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;

        const jsonStr = trimmed.slice(5).trim();
        if (jsonStr === "[DONE]") continue;

        try {
            const data = JSON.parse(jsonStr);

            // OpenAI Chat Completions streaming: choices[0].delta.content
            if (data.choices?.[0]?.delta?.content) {
                textParts.push(data.choices[0].delta.content);
                continue;
            }

            // Codex / Responses API text delta
            if (data.type === "response.output_text.delta" && typeof data.delta === "string") {
                textParts.push(data.delta);
                continue;
            }

            // Claude content_block_delta
            if (data.type === "content_block_delta" && data.delta?.text) {
                textParts.push(data.delta.text);
                continue;
            }

            // Codex response.completed — extract output text
            if (data.type === "response.completed" && data.response?.output) {
                const output = data.response.output;
                if (Array.isArray(output)) {
                    for (const item of output) {
                        if (item.type === "message" && Array.isArray(item.content)) {
                            for (const part of item.content) {
                                if (part.type === "output_text" && typeof part.text === "string") {
                                    // Only use this if we haven't accumulated deltas
                                    if (textParts.length === 0) {
                                        textParts.push(part.text);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        } catch {
            // Skip non-JSON lines
        }
    }

    return textParts.length > 0 ? textParts.join("") : null;
}

/** Parse non-stream output: single JSON response body */
function parseNonStreamOutput(raw: string): string | null {
    try {
        const data = JSON.parse(raw);
        // OpenAI format
        if (data.choices?.[0]?.message?.content) {
            return extractText(data.choices[0].message.content);
        }
        // Claude format
        if (Array.isArray(data.content)) {
            return extractText(data.content);
        }
        // Codex/Responses format: response.output[].content[].text
        if (data.response?.output || data.output) {
            const output = data.response?.output || data.output;
            if (Array.isArray(output)) {
                const texts: string[] = [];
                for (const item of output) {
                    if (item.type === "message" && Array.isArray(item.content)) {
                        for (const part of item.content) {
                            if (typeof part.text === "string") texts.push(part.text);
                        }
                    }
                }
                if (texts.length > 0) return texts.join("\n");
            }
        }
        // Gemini format
        const candidates = data.candidates || data.response?.candidates;
        if (Array.isArray(candidates) && candidates.length > 0) {
            const parts = candidates[0]?.content?.parts;
            if (Array.isArray(parts)) {
                return parts.map((p: Record<string, unknown>) => p.text || "").join("\n");
            }
        }
        return null;
    } catch {
        return null;
    }
}

/** Parse output content: try SSE stream first, then single JSON */
function parseOutputMessages(raw: string): string | null {
    // If it contains "data:" lines, treat as SSE
    if (raw.includes("data:")) {
        const sse = parseSSEOutput(raw);
        if (sse) return sse;
    }
    // Try single JSON response
    return parseNonStreamOutput(raw);
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

export function LogContentModal({
    open,
    logId,
    initialTab = "input",
    onClose,
}: LogContentModalProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [inputContent, setInputContent] = useState("");
    const [outputContent, setOutputContent] = useState("");
    const [model, setModel] = useState("");
    const [activeTab, setActiveTab] = useState<"input" | "output">(initialTab);

    useEffect(() => {
        setActiveTab(initialTab);
    }, [initialTab, logId]);

    const fetchContent = useCallback(async (id: number) => {
        setLoading(true);
        setError(null);
        try {
            const result = await usageApi.getLogContent(id);
            setInputContent(result.input_content || "");
            setOutputContent(result.output_content || "");
            setModel(result.model || "");
        } catch (err) {
            setError(err instanceof Error ? err.message : "加载失败");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (open && logId) {
            fetchContent(logId);
        }
    }, [open, logId, fetchContent]);

    const renderInput = () => {
        if (!inputContent) {
            return (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-white/30">
                    <FileInput size={40} className="mb-3 opacity-40" />
                    <p className="text-sm">暂无输入内容记录</p>
                </div>
            );
        }

        const messages = parseInputMessages(inputContent);
        if (messages && messages.length > 0) {
            return (
                <div className="space-y-3">
                    {messages.map((msg, idx) => (
                        <MessageBlock key={idx} role={msg.role} content={msg.content} />
                    ))}
                </div>
            );
        }

        // Fallback: try formatted JSON, then plain text
        try {
            const formatted = JSON.stringify(JSON.parse(inputContent), null, 2);
            return (
                <pre className="whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-800 dark:border-neutral-800 dark:bg-neutral-900 dark:text-slate-200">
                    {formatted}
                </pre>
            );
        } catch {
            return (
                <pre className="whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-800 dark:border-neutral-800 dark:bg-neutral-900 dark:text-slate-200">
                    {inputContent}
                </pre>
            );
        }
    };

    const renderOutput = () => {
        if (!outputContent) {
            return (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-white/30">
                    <FileOutput size={40} className="mb-3 opacity-40" />
                    <p className="text-sm">暂无输出内容记录</p>
                </div>
            );
        }

        const assistantText = parseOutputMessages(outputContent);
        if (assistantText) {
            return (
                <div className="space-y-3">
                    <MessageBlock role="assistant" content={assistantText} />
                </div>
            );
        }

        // Fallback
        try {
            const formatted = JSON.stringify(JSON.parse(outputContent), null, 2);
            return (
                <pre className="whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-800 dark:border-neutral-800 dark:bg-neutral-900 dark:text-slate-200">
                    {formatted}
                </pre>
            );
        } catch {
            return (
                <pre className="whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-800 dark:border-neutral-800 dark:bg-neutral-900 dark:text-slate-200">
                    {outputContent}
                </pre>
            );
        }
    };

    return (
        <Modal
            open={open}
            title={`消息内容${model ? ` · ${model}` : ""}`}
            description="请求/响应的消息详情"
            onClose={onClose}
        >
            {/* Tab switcher */}
            <div className="mb-4 flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-neutral-900">
                <button
                    type="button"
                    onClick={() => setActiveTab("input")}
                    className={[
                        "flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all",
                        activeTab === "input"
                            ? "bg-white text-slate-900 shadow-sm dark:bg-neutral-800 dark:text-white"
                            : "text-slate-500 hover:text-slate-700 dark:text-white/50 dark:hover:text-white/70",
                    ].join(" ")}
                >
                    <FileInput size={15} />
                    输入消息
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab("output")}
                    className={[
                        "flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all",
                        activeTab === "output"
                            ? "bg-white text-slate-900 shadow-sm dark:bg-neutral-800 dark:text-white"
                            : "text-slate-500 hover:text-slate-700 dark:text-white/50 dark:hover:text-white/70",
                    ].join(" ")}
                >
                    <FileOutput size={15} />
                    输出内容
                </button>
            </div>

            {/* Content area */}
            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 size={24} className="animate-spin text-slate-400 dark:text-white/40" />
                    <span className="ml-3 text-sm text-slate-500 dark:text-white/50">加载中…</span>
                </div>
            ) : error ? (
                <div className="flex flex-col items-center justify-center py-12">
                    <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
                </div>
            ) : (
                <div className="min-h-[200px]">
                    {activeTab === "input" ? renderInput() : renderOutput()}
                </div>
            )}
        </Modal>
    );
}
