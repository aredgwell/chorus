import * as AppMetadataAPI from "@core/chorus/api/AppMetadataAPI";
import RetroSpinner from "@ui/components/ui/retro-spinner";
import { AppMetadataContext } from "@ui/context/AppMetadataContext";
import { ReactNode } from "react";

// ----------------------------------
// *ensures* app metadata is loaded
// ----------------------------------

export function AppMetadataProvider({ children }: { children: ReactNode }) {
    const appMetadata = AppMetadataAPI.useAppMetadata();

    if (!appMetadata.isSuccess) {
        return <RetroSpinner />;
    }

    return (
        <AppMetadataContext.Provider value={appMetadata.data}>
            {children}
        </AppMetadataContext.Provider>
    );
}
