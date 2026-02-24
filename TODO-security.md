# Security Improvements (TODO)

## Migrate Secrets to OS Keychain

### Problem

All secrets are stored in plain text:

| Secret type | Storage location | Format |
|---|---|---|
| Model API keys (Anthropic, OpenAI, Google, etc.) | `~/.config/sh.melty.app/settings.json` (Tauri Store) | Plain text JSON |
| Toolset credentials (GitHub PAT, Linear API key, Slack token) | SQLite `toolsets_config` table | Plain text columns |
| Chorus backend token | Tauri Store (`api_token` key) | Plain text |

### ~~Remove Stronghold~~

Done — the unused `tauri-plugin-stronghold` dependency and its `todo!()` placeholder have been removed from `Cargo.toml` and `lib.rs`. This eliminates the `iota_stronghold` dependency tree.

### Plugin research

Two third-party Tauri v2 keyring plugins exist:

| Plugin | Crate | JS API | Notes |
|---|---|---|---|
| [tauri-plugin-keyring](https://github.com/HuakunShen/tauri-plugin-keyring) | `tauri-plugin-keyring` | `getPassword(service, user)`, `setPassword(service, user, password)`, `deletePassword(service, user)` | Wraps Rust `keyring` crate. Created Dec 2024. Also available on JSR as `@hk/tauri-plugin-keyring-api`. |
| [tauri-plugin-keychain](https://github.com/lindongchen/tauri-plugin-keychain) | `tauri-plugin-keychain` v2.0.2 | Unknown | Compatible with Tauri ^2.0.6. Focused on iOS Keychain. |

**Recommendation**: `tauri-plugin-keyring` (HuakunShen) has a cleaner API and broader platform support (macOS Keychain, Windows Credential Manager, Linux Secret Service). Both are relatively new — test thoroughly before shipping.

### Implementation steps

#### 1. Add keyring plugin
- `cargo add tauri-plugin-keyring` in `src-tauri/Cargo.toml`
- `pnpm add tauri-plugin-keyring-api` (or from JSR: `@hk/tauri-plugin-keyring-api`)
- Register in `src-tauri/src/lib.rs`: `.plugin(tauri_plugin_keyring::init())`

#### 2. Create a credential service
Create `src/core/chorus/CredentialService.ts`:
```typescript
import { getPassword, setPassword, deletePassword } from "tauri-plugin-keyring-api";

const SERVICE_NAME = "sh.chorus.app";

export async function getCredential(key: string): Promise<string | undefined> {
    try {
        return await getPassword(SERVICE_NAME, key) ?? undefined;
    } catch {
        return undefined;
    }
}

export async function setCredential(key: string, value: string): Promise<void> {
    await setPassword(SERVICE_NAME, key, value);
}

export async function deleteCredential(key: string): Promise<void> {
    await deletePassword(SERVICE_NAME, key);
}
```

#### 3. Migrate model API keys
- Update `Settings.ts` to read/write API keys via `CredentialService` instead of Tauri Store
- Update `AppMetadataAPI.ts` `getApiKeys()` to read from keyring
- Key naming: `apiKey.anthropic`, `apiKey.openai`, `apiKey.google`, etc.

#### 4. Migrate toolset credentials
- Update `ToolsetsAPI.ts` to read/write sensitive config values via keyring
- Keep non-sensitive config (e.g., `enabled` flag) in SQLite `toolsets_config`
- Identify which `parameter_id` values are secrets vs. config: `personalAccessToken`, `apiKey`, `apiToken` are secrets; `enabled`, `teamId` are not
- Key naming: `toolset.github.personalAccessToken`, `toolset.linear.apiKey`, etc.

#### 5. Migration for existing users
On first launch after upgrade:
1. Check if old-style credentials exist (in Tauri Store JSON / SQLite)
2. Copy each credential to keyring
3. Delete the plain text version from the old location
4. Set a flag in `app_metadata` to avoid re-running migration

### Files involved

| File | Change |
|---|---|
| `src-tauri/Cargo.toml` | Add `tauri-plugin-keyring` |
| `src-tauri/src/lib.rs` | Register keyring plugin |
| `src/core/chorus/CredentialService.ts` | New — keyring read/write abstraction |
| `src/core/utilities/Settings.ts` | Read API keys from keyring instead of store |
| `src/core/chorus/api/AppMetadataAPI.ts` | Update `getApiKeys()` |
| `src/core/chorus/api/ToolsetsAPI.ts` | Use keyring for sensitive toolset config |
| Migration logic | One-time migration from plain text to keyring |

### Risks

- **Plugin maturity**: Both keyring plugins are relatively new (2024). Test thoroughly on macOS before shipping.
- **Keychain access prompts**: macOS may show "Chorus wants to access keychain" on first use. This is expected and one-time.
- **Migration failures**: If migration fails partway, credentials could be in an inconsistent state. Use a flag to track migration status per credential.
- **Development workflow**: Developers need the keyring available in their environment. Consider a fallback to in-memory storage for `tauri dev` if keyring is unavailable.
