# Claude's Onboarding Doc

## What is Chorus?

Chorus is a native Mac AI chat app that lets you chat with all the AIs.

It lets you send one prompt and see responses from Claude, o3-pro, Gemini, etc. all at once.

It's built with Tauri, React, TypeScript, TanStack Query, and a local sqlite database.

Key features:

-   MCP support
-   Ambient chats (start a chat from anywhere)
-   Projects
-   Bring your own API keys

Most of the functionality lives in this repo. There's also a backend that handles accounts, billing, and proxying the models' requests; that lives at app.chorus.sh and is written in Elixir.

## Your role

Your role is to write code. You do NOT have access to the running app, so you cannot test the code. You MUST rely on me, the user, to test the code.

If I report a bug in your code, after you fix it, you should pause and ask me to verify that the bug is fixed.

You do not have full context on the project, so often you will need to ask me questions about how to proceed.

Don't be shy to ask questions -- I'm here to help you!

If I send you a URL, you MUST immediately fetch its contents and read it carefully, before you do anything else.

## Workflow

We use GitHub issues to track work we need to do, and PRs to review code. Whenever you create an issue or a PR, tag it with "by-claude". Use the `gh` bash command to interact with GitHub.

To start working on a feature, you should:

1. Setup

-   Identify the relevant GitHub issue (or create one if needed)
-   Checkout main and pull the latest changes
-   Create a new branch like `claude/feature-name`. NEVER commit to main. NEVER push to origin/main.

2. Development

-   Commit often as you write code, so that we can revert if needed.
-   When you have a draft of what you're working on, ask me to test it in the app to confirm that it works as you expect. Do this early and often.

3. Review

-   When the work is done, verify that the diff looks good with `git diff main`
-   While you should attempt to write code that adheres to our coding style, don't worry about manually linting or formatting your changes. There are Husky pre-commit Git hooks that will do this for you.
-   Push the branch to GitHub
-   Open a PR.
    -   The PR title should not include the issue number
    -   The PR description should start with the issue number and a brief description of the changes.
    -   Next, you should write a test plan. I (not you) will execute the test plan before merging the PR. If I can't check off any of the items, I will let you know. Make sure the test plan covers both new functionality and any EXISTING functionality that might be impacted by your changes

4. Fixing issues

-   To reconcile different branches, always rebase or cherry-pick. Do not merge.

Sometimes, after you've been working on one feature, I will ask you to start work on an unrelated feature. If I do, you should probably repeat this process from the beginning (checkout main, pull changes, create a new branch). When in doubt, just ask.

We use pnpm to manage dependencies.

Don't combine git commands -- e.g., instead of `git add -A && git commit`, run `git add -A` and `git commit` separately. This will save me time because I won't have to grant you permission to run the combined command.

## Project Structure

-   **UI:** React components in `src/ui/components/`
-   **Core:** Business logic in `src/core/chorus/`
-   **Tauri:** Rust backend in `src-tauri/src/`

The app uses a three-pane layout with canonical names:

-   **Sidebar** (left pane) — Navigation, collections, tags. Component: `AppSidebar.tsx`
-   **List** (middle pane) — Item listing for the selected collection/tag filter. Component: `ListPane.tsx`
-   **Editor** (right pane) — Content editing/viewing (notes, chats, settings). Component: `EditorPane.tsx`

Important files and directories to be aware of:

-   `src/core/chorus/api/` - TanStack Query queries, mutations, and raw SQL queries, split by entity type (e.g. `MessageAPI.ts`, `ChatAPI.ts`, `ProjectAPI.ts`, `SearchAPI.ts`, `CostAPI.ts`)
-   `src/core/chorus/DB.ts` - Database connection singleton (queries live in `api/` files, not here)
-   `src/ui/components/MultiChat.tsx` - Main chat interface (rendered in the Editor pane)
-   `src/ui/components/ChatInput.tsx` - The input box where the user types chat messages
-   `src/ui/components/AppSidebar.tsx` - The Sidebar pane
-   `src/ui/components/ListPane.tsx` - The List pane (item listing)
-   `src/ui/components/EditorPane.tsx` - The Editor pane (routes to notes, chats, etc.)
-   `src/ui/App.tsx` - The root component

Other features:

-   Model picker, which lets the user select which models are available in the chat -- implemented in `ManageModelsBox.tsx`
-   Quick chats (aka Ambient Chats), a lightweight chat window -- implemented, alongside regular chats, in `MultiChat.tsx`
-   Projects, which are folders of related chats -- start with `AppSidebar.tsx`
-   Tools and "connections" (aka toolsets) -- start with `Toolsets.ts`, individual toolsets in `src/core/chorus/toolsets/` (e.g. `github.ts`, `slack.ts`)
-   Full-text search (FTS5) -- already implemented via `SearchAPI.ts` and `CommandMenu.tsx` (migration #50)
-   react-router-dom for navigation -- see `App.tsx`
-   Streaming: `UpdateQueue` in `MessageAPI.ts` batches DB writes during streaming; cache updates use Immer's `produce` via TanStack Query's `setQueryData`
-   Settings and API keys stored via `@tauri-apps/plugin-store` in `src/core/infra/Store.ts`

## Screenshots

I've put some screenshots of the app in the `screenshots` directory. If you're working on the UI at all, take a look at them. Keep in mind, though, that they may not be up to date with the latest code changes.

## Adding a new model

Adding a new model requires only a database migration. **No TypeScript provider code changes are needed.**

1. **Create a migration** in `src-tauri/src/migrations.rs` — see the "HOW TO ADD A NEW MODEL" comment block there for the exact columns and a template (use migration 142 as an example).
2. **Add to UI tier list** (optional) in `src/ui/lib/models.ts` if it should appear in the model picker tiers.
3. **Test** by running the app and verifying the model appears and generates responses correctly.

The `models` table stores all per-model configuration: API name aliases (`api_model_name`), output token limits (`max_output_tokens`), reasoning model flag (`is_reasoning_model`), tool support flag (`supports_tool_use`), and provider-specific overrides (`model_flags` JSON). Providers read this configuration at runtime instead of maintaining hardcoded allowlists.

## Data model changes

Changes to the data model will typically require most of the following steps:

-   Making a new migration in `src-tauri/src/migrations.rs` (if changes to the sqlite database scheme are needed). New migrations must use the next sequential version number. NEVER modify a previous migration.
-   Modifying fetch and read functions in the relevant `src/core/chorus/api/*.ts` file (e.g. `MessageAPI.ts`, `ChatAPI.ts`)
-   Modifying data types (stored in a variety of places)
-   Adding or modifying TanStack Query queries in the relevant `src/core/chorus/api/*.ts` file

## Coding style

-   **TypeScript:** Strict typing enabled, ES2020 target. Use `as` only in exceptional
    circumstances, and then only with an explanatory comment. Prefer type hints.
-   **Paths:** `@ui/*`, `@core/*`, `@/*` aliases. Use these instead of relative imports.
-   **Components:** PascalCase for React components
-   **Interfaces:** Prefixed with "I" (e.g., `IProvider`)
-   **Hooks:** camelCase with "use" prefix
-   **Formatting:** 4-space indentation, Prettier formatting
-   **Promise handling:** All promises must be handled (ESLint enforced)
-   **Nulls:** Prefer undefined to null. Convert `null` values from the database into undefined, e.g. `parentChatId: row.parent_chat_id ?? undefined`
-   **Dates:** If you ever need to render a date, format it using `displayDate` in `src/ui/lib/utils.ts`. If the date was read
    from our SQLite DB, you will need to convert it to a fully qualified UTC date using `convertDate` first.
-   Do not use foreign keys or other constraints, they're too hard to remove and tend to put us in tricky situations down the line

IMPORTANT: If you want to use any of these features, you must alert me and explicitly ask for my permission first: `setTimeout`, `useImperativeHandle`, `useRef`, or type assertions with `as`. These are escape hatches from React's declarative model and TypeScript's type system — they introduce hidden state, imperative control flow, or type safety bypasses that can cause bugs only visible at runtime (which you cannot test). For high-frequency updates, prefer `useDeferredValue` or `startTransition` over `setTimeout`.

## Troubleshooting

Whenever I report that code you wrote doesn't work, or report a bug, you should:

1. Read any relevant code or documentation, looking for hypotheses about the root cause
2. For each hypothesis, check whether it's consistent with the observations I've already reported
3. For any remaining hypotheses, think about a test I could run that would tell me if that hypothesis is incorrect
4. Propose a troubleshooting plan. The plan could involve: me running a test, you writing code, you adding logging statements, me reporting the output of the log statements back to you, or any other steps you think would be helpful.

Then we'll go through the plan together. At each step, keep in mind your list of hypotheses, and remember to re-evaluate each hypothesis against the evidence we've collected.

When we run into issues with the requests we're sending to model providers (e.g., the way we format system prompts, attachments, tool calls, or other parts of the conversation history) one helpful troubleshooting step is to add the line `console.log(`createParams: ${JSON.stringify(createParams, null, 2)}`);` to ProviderAnthropic.ts.

## Updating this onboarding doc

Whenever you discover something that you wish you'd known earlier -- and seems likely to be helpful to future developers as well -- you can add it to the scratchpad section below. Feel free to edit the scratchpad section, but don't change the rest of this doc.

## Build and Dev Commands

-   `pnpm build` - TypeScript check + Vite production build
-   `pnpm vite:dev` - Vite dev server (called automatically by `tauri dev`)
-   `pnpm tsc --noEmit` - TypeScript type check only
-   `cargo tauri dev` - Full Tauri dev mode (starts both Vite and Rust backend)

## Stack Versions

-   React 19.2
-   TypeScript 5.9
-   Vite 6
-   Tauri 2
-   TanStack Query 5
-   React Compiler via `babel-plugin-react-compiler` (React 19 has the compiler runtime built in)

### Scratchpad
