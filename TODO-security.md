# Security Improvements (TODO)

## ~~Migrate Secrets to OS Keychain~~

Done — all secrets are now stored in the OS keychain via `tauri-plugin-keyring`.

### What was migrated

| Secret type | Old location | New location | Key format |
|---|---|---|---|
| Model API keys (Anthropic, OpenAI, etc.) | Tauri Store JSON | OS keychain | `apikey:{provider}` |
| Chorus backend token | Tauri Store | OS keychain | `chorus_token` |
| Built-in toolset credentials (GitHub PAT, Slack token, Linear API key) | `toolsets_config` table | OS keychain | `toolset:{name}:{paramId}` |
| Custom toolset env vars (API keys, AWS creds, etc.) | `custom_toolsets.env` column | OS keychain | `customtoolset:{name}:env` |

### How it works

- **`CredentialService.ts`** — low-level keychain read/write/delete using `tauri-plugin-keyring-api`
- **`Settings.ts`** — `migrateApiKeysToKeychain()` migrates model API keys and chorus token on startup
- **`ToolsetCredentials.ts`** — keychain helpers for toolset secrets and custom env
- **`ToolsetsAPI.ts`** — `migrateToolsetCredentialsToKeychain()` migrates toolset secrets on startup
- **`Toolsets.ts`** — `MCPParameter.isSecret` flag marks which params are credentials; `ensureStart()` hydrates secrets from keychain before starting MCP servers

### Non-secret config stays in SQLite

| Config type | Storage |
|---|---|
| Toolset enabled/disabled flag | `toolsets_config` table |
| Slack team ID | `toolsets_config` table |
| Custom toolset command, args | `custom_toolsets` table |
| Custom toolset default permission | `custom_toolsets` table |

### ~~Remove Stronghold~~

Done — the unused `tauri-plugin-stronghold` dependency was removed previously.
