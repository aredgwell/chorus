import {
    index,
    integer,
    primaryKey,
    real,
    sqliteTable,
    text,
} from "drizzle-orm/sqlite-core";

// ── app_metadata ──────────────────────────────────────────────────────────────

export const appMetadata = sqliteTable("app_metadata", {
    key: text("key").primaryKey(),
    value: text("value").notNull(),
    createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
});

// ── attachments ───────────────────────────────────────────────────────────────

export const attachments = sqliteTable("attachments", {
    id: text("id").primaryKey(),
    createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
    type: text("type").notNull(),
    isLoading: integer("is_loading", { mode: "boolean" }).notNull().default(false),
    originalName: text("original_name"),
    path: text("path").notNull(),
    ephemeral: integer("ephemeral", { mode: "boolean" }).notNull().default(false),
});

// ── chats ─────────────────────────────────────────────────────────────────────

export const chats = sqliteTable(
    "chats",
    {
        id: text("id").primaryKey().notNull(),
        title: text("title"),
        createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
        updatedAt: text("updated_at"),
        pinned: integer("pinned", { mode: "boolean" }).notNull().default(false),
        quickChat: integer("quick_chat", { mode: "boolean" })
            .notNull()
            .default(false),
        projectId: text("project_id").notNull().default("default"),
        summary: text("summary"),
        isNewChat: integer("is_new_chat", { mode: "boolean" })
            .notNull()
            .default(false),
        parentChatId: text("parent_chat_id"),
        projectContextSummary: text("project_context_summary"),
        projectContextSummaryIsStale: integer(
            "project_context_summary_is_stale",
            { mode: "boolean" },
        )
            .notNull()
            .default(true),
        replyToId: text("reply_to_id"),
        gcPrototypeChat: integer("gc_prototype_chat", { mode: "boolean" })
            .notNull()
            .default(false),
        totalCostUsd: real("total_cost_usd").default(0.0),
    },
    (table) => [
        index("idx_chats_is_new_chat").on(table.isNewChat),
        index("idx_chats_pinned").on(table.pinned),
    ],
);

// ── custom_toolsets ───────────────────────────────────────────────────────────

export const customToolsets = sqliteTable("custom_toolsets", {
    name: text("name").primaryKey(),
    command: text("command"),
    args: text("args"),
    env: text("env"), // JSON stored as text
    updatedAt: text("updated_at").default("CURRENT_TIMESTAMP"),
    defaultPermission: text("default_permission").notNull().default("ask"),
});

// ── draft_attachments ─────────────────────────────────────────────────────────

export const draftAttachments = sqliteTable(
    "draft_attachments",
    {
        chatId: text("chat_id").notNull(),
        attachmentId: text("attachment_id").notNull(),
    },
    (table) => [primaryKey({ columns: [table.chatId, table.attachmentId] })],
);

// ── gc_prototype_conductors ───────────────────────────────────────────────────

export const gcPrototypeConductors = sqliteTable(
    "gc_prototype_conductors",
    {
        chatId: text("chat_id").notNull(),
        scopeId: text("scope_id").notNull(),
        conductorModelId: text("conductor_model_id").notNull(),
        turnCount: integer("turn_count").default(0),
        isActive: integer("is_active", { mode: "boolean" }).default(true),
        createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
    },
    (table) => [
        primaryKey({ columns: [table.chatId, table.scopeId] }),
        index("idx_gc_prototype_conductors_active").on(
            table.chatId,
            table.isActive,
        ),
    ],
);

// ── gc_prototype_messages ─────────────────────────────────────────────────────

export const gcPrototypeMessages = sqliteTable(
    "gc_prototype_messages",
    {
        chatId: text("chat_id").notNull(),
        id: text("id").notNull(),
        text: text("text").notNull(),
        modelConfigId: text("model_config_id").notNull(),
        createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
        updatedAt: text("updated_at").default("CURRENT_TIMESTAMP"),
        isDeleted: integer("is_deleted", { mode: "boolean" })
            .notNull()
            .default(false),
        threadRootMessageId: text("thread_root_message_id"),
        promotedFromMessageId: text("promoted_from_message_id"),
    },
    (table) => [
        primaryKey({ columns: [table.chatId, table.id] }),
        index("idx_gc_prototype_messages_chat_created").on(
            table.chatId,
            table.createdAt,
        ),
        index("idx_gc_prototype_messages_promoted_from").on(
            table.promotedFromMessageId,
        ),
        index("idx_gc_prototype_messages_thread_root").on(
            table.threadRootMessageId,
        ),
    ],
);

// ── message_attachments ───────────────────────────────────────────────────────

export const messageAttachments = sqliteTable(
    "message_attachments",
    {
        messageId: text("message_id").notNull(),
        attachmentId: text("attachment_id").notNull(),
    },
    (table) => [primaryKey({ columns: [table.messageId, table.attachmentId] })],
);

// ── message_drafts ────────────────────────────────────────────────────────────

export const messageDrafts = sqliteTable("message_drafts", {
    chatId: text("chat_id").primaryKey(),
    content: text("content").notNull(),
});

// ── message_parts ─────────────────────────────────────────────────────────────

export const messageParts = sqliteTable(
    "message_parts",
    {
        chatId: text("chat_id").notNull(),
        messageId: text("message_id").notNull(),
        level: integer("level").notNull(),
        content: text("content").notNull(),
        toolCalls: text("tool_calls"),
        toolResults: text("tool_results"),
    },
    (table) => [primaryKey({ columns: [table.messageId, table.level] })],
);

// ── message_sets ──────────────────────────────────────────────────────────────

export const messageSets = sqliteTable(
    "message_sets",
    {
        id: text("id").primaryKey(),
        chatId: text("chat_id").notNull(),
        deprecatedParentId: text("deprecated_parent_id"),
        type: text("type").notNull(),
        createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
        selectedBlockType: text("selected_block_type")
            .notNull()
            .default("chat"),
        level: integer("level"),
    },
    (table) => [
        index("idx_message_sets_chat_level").on(table.chatId, table.level),
    ],
);

// ── messages ──────────────────────────────────────────────────────────────────

export const messages = sqliteTable("messages", {
    id: text("id").primaryKey(),
    messageSetId: text("message_set_id").notNull(),
    chatId: text("chat_id").notNull(),
    text: text("text").notNull(),
    model: text("model").notNull(),
    selected: integer("selected", { mode: "boolean" }),
    createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
    streamingToken: text("streaming_token"),
    state: text("state").default("streaming"),
    errorMessage: text("error_message"),
    isReview: integer("is_review", { mode: "boolean" }).default(false),
    reviewState: text("review_state"),
    blockType: text("block_type"),
    level: integer("level"),
    depAttachmentsArchive: text("dep_attachments_archive"),
    replyChatId: text("reply_chat_id"),
    branchedFromId: text("branched_from_id"),
    promptTokens: integer("prompt_tokens"),
    completionTokens: integer("completion_tokens"),
    totalTokens: integer("total_tokens"),
    costUsd: real("cost_usd"),
});

// ── model_configs ─────────────────────────────────────────────────────────────

export const modelConfigs = sqliteTable("model_configs", {
    id: text("id").primaryKey(),
    modelId: text("model_id").notNull(),
    displayName: text("display_name").notNull(),
    author: text("author").notNull(),
    createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
    systemPrompt: text("system_prompt").notNull(),
    isDefault: integer("is_default", { mode: "boolean" }).default(false),
    budgetTokens: integer("budget_tokens"),
    reasoningEffort: text("reasoning_effort"),
    newUntil: text("new_until"),
});

// ── models ────────────────────────────────────────────────────────────────────

export const models = sqliteTable("models", {
    id: text("id").primaryKey(),
    displayName: text("display_name").notNull(),
    isEnabled: integer("is_enabled", { mode: "boolean" }).default(true),
    supportedAttachmentTypes: text("supported_attachment_types").notNull(),
    isInternal: integer("is_internal", { mode: "boolean" })
        .notNull()
        .default(false),
    isDeprecated: integer("is_deprecated", { mode: "boolean" })
        .notNull()
        .default(false),
    promptPricePerToken: real("prompt_price_per_token"),
    completionPricePerToken: real("completion_price_per_token"),
    apiModelName: text("api_model_name"),
    maxOutputTokens: integer("max_output_tokens"),
    isReasoningModel: integer("is_reasoning_model", { mode: "boolean" })
        .notNull()
        .default(false),
    supportsToolUse: integer("supports_tool_use", { mode: "boolean" })
        .notNull()
        .default(true),
    modelFlags: text("model_flags"),
});

// ── project_attachments ───────────────────────────────────────────────────────

export const projectAttachments = sqliteTable(
    "project_attachments",
    {
        projectId: text("project_id").notNull(),
        attachmentId: text("attachment_id").notNull(),
    },
    (table) => [primaryKey({ columns: [table.projectId, table.attachmentId] })],
);

// ── projects ──────────────────────────────────────────────────────────────────

export const projects = sqliteTable("projects", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
    updatedAt: text("updated_at").notNull().default("CURRENT_TIMESTAMP"),
    isCollapsed: integer("is_collapsed", { mode: "boolean" })
        .notNull()
        .default(false),
    contextText: text("context_text"),
    magicProjectsEnabled: integer("magic_projects_enabled", {
        mode: "boolean",
    })
        .notNull()
        .default(true),
    isImported: integer("is_imported", { mode: "boolean" })
        .notNull()
        .default(false),
    totalCostUsd: real("total_cost_usd").default(0.0),
});

// ── saved_model_configs_chats ─────────────────────────────────────────────────

export const savedModelConfigsChats = sqliteTable(
    "saved_model_configs_chats",
    {
        id: text("id").primaryKey().notNull(),
        chatId: text("chat_id"),
        modelIds: text("model_ids").notNull(),
        createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
        updatedAt: text("updated_at").default("CURRENT_TIMESTAMP"),
    },
    (table) => [
        index("idx_saved_model_configs_chats_chat_id").on(table.chatId),
    ],
);

// ── tool_permissions ──────────────────────────────────────────────────────────

export const toolPermissions = sqliteTable(
    "tool_permissions",
    {
        toolsetName: text("toolset_name").notNull(),
        toolName: text("tool_name").notNull(),
        permissionType: text("permission_type").notNull(),
        lastAskedAt: text("last_asked_at"),
        lastResponse: text("last_response"),
        createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
        updatedAt: text("updated_at").default("CURRENT_TIMESTAMP"),
    },
    (table) => [
        primaryKey({ columns: [table.toolsetName, table.toolName] }),
    ],
);

// ── toolsets_config ───────────────────────────────────────────────────────────

export const toolsetsConfig = sqliteTable(
    "toolsets_config",
    {
        toolsetName: text("toolset_name").notNull(),
        parameterId: text("parameter_id").notNull(),
        parameterValue: text("parameter_value"),
    },
    (table) => [
        primaryKey({ columns: [table.toolsetName, table.parameterId] }),
    ],
);
