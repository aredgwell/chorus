# Security Improvements (TODO)

## Migrate Secrets to OS Keychain

### Problem

All secrets are stored in plain text:

| Secret type | Storage location | Format |
|---|---|---|
| Model API keys (Anthropic, OpenAI, Google, etc.) | `~/.config/sh.melty.app/settings.json` (Tauri Store) | Plain text JSON |
| Toolset credentials (GitHub PAT, Linear API key, Slack token) | SQLite `toolsets_config` table | Plain text columns |
| Chorus backend token | Tauri Store (`api_token` key) | Plain text |

The `tauri-plugin-stronghold` dependency is included in `Cargo.toml` but never initialized — `src-tauri/src/lib.rs:134` has a `todo!()` placeholder that would panic if called.

### Proposed solution: `tauri-plugin-keyring`

Use OS-native credential storage via `tauri-plugin-keyring`, which wraps:
- **macOS**: Keychain Services
- **Windows**: Credential Manager
- **Linux**: Secret Service (via `libsecret`)

Advantages over Stronghold:
- Invisible to users — no extra password prompts (Stronghold requires a master password or auto-derived key)
- Credentials survive app reinstall (keychain is OS-managed)
- Standard security model users already trust

### Implementation steps

#### 1. Add keyring plugin
- `cargo add tauri-plugin-keyring` in `src-tauri/Cargo.toml`
- `pnpm add @tauri-apps/plugin-keyring`
- Register in `src-tauri/src/lib.rs`: `.plugin(tauri_plugin_keyring::init())`

#### 2. Remove Stronghold
- Remove `.plugin(tauri_plugin_stronghold::Builder::new(|_pass| todo!()).build())` from `src-tauri/src/lib.rs:134`
- Remove `tauri-plugin-stronghold = "2"` from `src-tauri/Cargo.toml:34`
- Run `cargo build` to verify the `iota_stronghold` dependency tree is gone (reduces binary size)

#### 3. Create a credential service
Create `src/core/chorus/CredentialService.ts`:
```typescript
import { getItem, setItem, deleteItem } from "@tauri-apps/plugin-keyring";

const SERVICE_NAME = "sh.chorus.app";

export async function getCredential(key: string): Promise<string | undefined> {
    return await getItem(SERVICE_NAME, key) ?? undefined;
}

export async function setCredential(key: string, value: string): Promise<void> {
    await setItem(SERVICE_NAME, key, value);
}

export async function deleteCredential(key: string): Promise<void> {
    await deleteItem(SERVICE_NAME, key);
}
```

#### 4. Migrate model API keys
- Update `Settings.ts` to read/write API keys via `CredentialService` instead of Tauri Store
- Update `AppMetadataAPI.ts` `getApiKeys()` to read from keyring
- Key naming: `apiKey.anthropic`, `apiKey.openai`, `apiKey.google`, etc.

#### 5. Migrate toolset credentials
- Update `ToolsetsAPI.ts` to read/write sensitive config values via keyring
- Keep non-sensitive config (e.g., `enabled` flag) in SQLite `toolsets_config`
- Identify which `parameter_id` values are secrets vs. config: `personalAccessToken`, `apiKey`, `apiToken` are secrets; `enabled`, `teamId` are not
- Key naming: `toolset.github.personalAccessToken`, `toolset.linear.apiKey`, etc.

#### 6. Migration for existing users
On first launch after upgrade:
1. Check if old-style credentials exist (in Tauri Store JSON / SQLite)
2. Copy each credential to keyring
3. Delete the plain text version from the old location
4. Set a flag in `app_metadata` to avoid re-running migration

### Files involved

| File | Change |
|---|---|
| `src-tauri/Cargo.toml` | Remove `tauri-plugin-stronghold`, add `tauri-plugin-keyring` |
| `src-tauri/src/lib.rs` | Swap Stronghold plugin for keyring plugin |
| `src/core/chorus/CredentialService.ts` | New — keyring read/write abstraction |
| `src/core/utilities/Settings.ts` | Read API keys from keyring instead of store |
| `src/core/chorus/api/AppMetadataAPI.ts` | Update `getApiKeys()` |
| `src/core/chorus/api/ToolsetsAPI.ts` | Use keyring for sensitive toolset config |
| Migration logic | One-time migration from plain text to keyring |

### Risks

- **keyring plugin maturity**: `tauri-plugin-keyring` is relatively new. Test thoroughly on macOS.
- **Keychain access prompts**: macOS may show "Chorus wants to access keychain" on first use. This is expected and one-time.
- **Migration failures**: If migration fails partway, credentials could be in an inconsistent state. Use a flag to track migration status per credential.
- **Development workflow**: Developers need the keyring available in their environment. Consider a fallback to in-memory storage for `tauri dev` if keyring is unavailable.
