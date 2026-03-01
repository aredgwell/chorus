import Database from "@tauri-apps/plugin-sql";
import { DatabaseContext } from "@ui/context/DatabaseContext";
import { ReactNode } from "react";

// ----------------------------------
// Database provider
// ----------------------------------

export function DatabaseProvider({
    db,
    children,
}: {
    db: Database;
    children: ReactNode;
}) {
    return (
        <DatabaseContext.Provider
            value={{
                db,
            }}
        >
            {children}
        </DatabaseContext.Provider>
    );
}
