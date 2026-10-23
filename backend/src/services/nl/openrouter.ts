/**
 * OpenRouter chat completions client.
 * Model comes from OPENROUTER_MODEL — never hardcode a model id here.
 */

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export class NlConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NlConfigError";
  }
}

export class NlLlmError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NlLlmError";
  }
}

function requireEnv(name: string): string {
  const raw = process.env[name];
  const value = raw?.trim();
  if (!value) {
    throw new NlConfigError(`${name} is not set`);
  }
  return value;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function openRouterChat(
  messages: ChatMessage[],
): Promise<string> {
  const apiKey = requireEnv("OPENROUTER_API_KEY");
  const model = requireEnv("OPENROUTER_MODEL");

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.CLIENT_URL?.trim() || "http://localhost:3000",
      "X-Title": "SGX Stock Screener",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.1,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    let detail = `OpenRouter HTTP ${response.status}`;
    try {
      const body = (await response.json()) as {
        error?: { message?: string } | string;
      };
      if (typeof body.error === "string") detail = body.error;
      else if (body.error?.message) detail = body.error.message;
    } catch {
      // ignore
    }
    throw new NlLlmError(detail);
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string | null } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new NlLlmError("OpenRouter returned empty content");
  }
  return content;
}
