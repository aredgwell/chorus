import { AppMetadataContext } from "@ui/context/AppMetadataContext";
import { useContext } from "react";

export function useWaitForAppMetadata() {
    const context = useContext(AppMetadataContext);
    if (!context) {
        throw new Error(
            "useWaitForAppMetadata must be used within a AppMetadataProvider",
        );
    }
    return context;
}
