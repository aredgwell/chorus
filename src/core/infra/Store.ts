import { load, Store } from "@tauri-apps/plugin-store";

/**
 * Loads a store from the app's data directory, which is in
 * ~/Library/Application\ Support/sh.melty.app
 */
export async function getStore(storeName: string): Promise<Store> {
    return await load(storeName, { autoSave: true, defaults: {} });
}
