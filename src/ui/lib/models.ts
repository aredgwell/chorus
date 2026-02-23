/**
 * UI tier configuration for the model picker and quick chat.
 *
 * When adding a new model:
 * 1. Add it to the database via a migration in src-tauri/src/migrations.rs
 *    (this is the primary step — see the "HOW TO ADD A NEW MODEL" comment there)
 * 2. Add it to the appropriate tier below (basic/frontier/plus) for UI display ordering
 * 3. If it should appear in quick chat, it's automatically included via the tier list
 *
 * If a model ID listed here doesn't exist in the database, it will simply not appear.
 * No provider TypeScript code changes are needed — model capabilities are stored in the DB.
 */

import { ProviderName } from "@core/chorus/Models";

// The ordering of these keys is the same as the ordering of the models in the UI
export const MODEL_IDS = {
    basic: {
        GPT_5_NANO: "openai::gpt-5-nano",
        GPT_5_MINI: "openai::gpt-5-mini",
        GEMINI_FLASH: "google::gemini-2.5-flash",
        GROK_3_MINI: "grok::grok-3-mini-beta",
    },
    frontier: {
        CLAUDE_OPUS_4_6: "anthropic::claude-opus-4-6",
        O3_PRO: "openai::o3-pro",
        O3_DEEP_RESEARCH: "openai::o3-deep-research",
        GPT_5_2: "openai::gpt-5.2",
        GROK_3_FAST: "grok::grok-3-fast-beta",
        SONAR_DEEP_RESEARCH: "5dfdba07-3bad-456d-8267-4aa448d7ae1c",
    },
    plus: {
        CLAUDE_SONNET_4_6: "anthropic::claude-sonnet-4-6",
        GPT_5_1: "openai::gpt-5.1",
        GPT_5: "openai::gpt-5",
        GEMINI_3_1_PRO: "google::gemini-3.1-pro-preview",
        GEMINI_2_5_PRO: "google::gemini-2.5-pro-latest",
        O3: "openai::o3",
        O4_MINI: "openai::o4-mini",
        DEEPSEEK_R1_0528: "openrouter::deepseek/deepseek-r1-0528",
        GROK_3: "grok::grok-3-beta",
        GROK_4: "openrouter::x-ai/grok-4",
    },
} as const;

// Hard coded list of default openrouter models that will receive special tier exemptions and logo handling
export const OPENROUTER_CUSTOM_PROVIDER_LOGOS: Record<string, ProviderName> = {
    "openrouter::x-ai/grok-4": "grok",
};

// Flatten the MODEL_IDS object into a single array of allowed IDs
export const ALLOWED_MODEL_IDS_FOR_QUICK_CHAT: string[] = [
    ...Object.values(MODEL_IDS).flatMap((tier) => Object.values(tier)),
    // Add our custom models for quick chat
    "24711c64-725c-4bdd-b5eb-65fe1dbfcde8", // Ambient Claude
    "google::ambient-gemini-2.5-pro-preview-03-25", // Ambient Gemini
    "openrouter::qwen/qwen3-32b", // Qwen 32B
];
