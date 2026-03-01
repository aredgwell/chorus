import {
    deleteCredential,
    getCredential,
    setCredential,
} from "./CredentialService";

// Built-in toolset secrets: "toolset:{toolsetName}:{parameterId}"
function toolsetKey(toolsetName: string, parameterId: string): string {
    return `toolset:${toolsetName}:${parameterId}`;
}

export async function getToolsetCredential(
    toolsetName: string,
    parameterId: string,
): Promise<string | undefined> {
    return getCredential(toolsetKey(toolsetName, parameterId));
}

export async function setToolsetCredential(
    toolsetName: string,
    parameterId: string,
    value: string,
): Promise<void> {
    await setCredential(toolsetKey(toolsetName, parameterId), value);
}

export async function deleteToolsetCredential(
    toolsetName: string,
    parameterId: string,
): Promise<void> {
    await deleteCredential(toolsetKey(toolsetName, parameterId));
}

// Custom toolset env: "customtoolset:{name}:env"
function customToolsetEnvKey(name: string): string {
    return `customtoolset:${name}:env`;
}

export async function getCustomToolsetEnv(
    name: string,
): Promise<string | undefined> {
    return getCredential(customToolsetEnvKey(name));
}

export async function setCustomToolsetEnv(
    name: string,
    envJson: string,
): Promise<void> {
    await setCredential(customToolsetEnvKey(name), envJson);
}

export async function deleteCustomToolsetEnv(name: string): Promise<void> {
    await deleteCredential(customToolsetEnvKey(name));
}
