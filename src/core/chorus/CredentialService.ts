import {
    getPassword,
    setPassword,
    deletePassword,
} from "tauri-plugin-keyring-api";

const SERVICE = "sh.chorus.app";

export async function getCredential(
    key: string,
): Promise<string | undefined> {
    try {
        const value = await getPassword(SERVICE, key);
        return value ?? undefined;
    } catch {
        return undefined;
    }
}

export async function setCredential(
    key: string,
    value: string,
): Promise<void> {
    await setPassword(SERVICE, key, value);
}

export async function deleteCredential(key: string): Promise<void> {
    try {
        await deletePassword(SERVICE, key);
    } catch {
        // Ignore errors when deleting (key may not exist)
    }
}
