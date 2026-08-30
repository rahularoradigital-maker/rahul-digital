// Gemini adapter: thin wrapper over the existing, proven calls in lib/gemini.ts (unchanged).
// Text uses the LITE model; JSON/vision uses the multimodal model. Model arg is accepted for a
// uniform adapter shape but Gemini's concrete model selection stays inside lib/gemini.ts.

import { callGemini, callGeminiText } from "../../gemini.ts";
import type { InlineImage } from "../tasks.ts";

export const gemini = {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  text: (_model: string, prompt: string): Promise<string | null> => callGeminiText(prompt),
  json: (
    _model: string,
    prompt: string,
    schema: Record<string, unknown>,
    inline: InlineImage | null,
  ): Promise<Record<string, unknown> | null> => callGemini(prompt, schema, inline),
};
