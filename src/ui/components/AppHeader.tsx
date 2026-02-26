import { SearchIcon } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SidebarTrigger } from "@ui/components/ui/sidebar";
import { useSidebar } from "@ui/hooks/useSidebar";
import { useAppMode } from "@ui/hooks/useAppMode";
import { AppMode } from "@ui/context/AppModeContext";

const MODE_TABS: { value: AppMode; label: string }[] = [
    { value: "chats", label: "Chats" },
    { value: "editor", label: "Editor" },
    { value: "graph", label: "Graph" },
    { value: "synthesis", label: "Synthesis" },
];

export function AppHeader() {
    const { open: isSidebarOpen } = useSidebar();
    const { mode, setMode } = useAppMode();
    const navigate = useNavigate();
    const [searchValue, setSearchValue] = useState("");

    const handleSearchSubmit = () => {
        if (searchValue.trim()) {
            setMode("chats");
            navigate(`/search?q=${encodeURIComponent(searchValue.trim())}`);
            setSearchValue("");
        }
    };

    return (
        <div
            data-tauri-drag-region
            className="h-[44px] flex items-center justify-between px-3 border-b shrink-0 bg-background"
        >
            {/* Left: sidebar trigger when collapsed */}
            <div className="flex items-center w-[120px]">
                {!isSidebarOpen && (
                    <SidebarTrigger className="size-4!" />
                )}
            </div>

            {/* Center: mode tabs */}
            <div className="flex items-center gap-0.5 bg-muted rounded-lg p-1">
                {MODE_TABS.map(({ value, label }) => (
                    <button
                        key={value}
                        onClick={() => setMode(value)}
                        className={`px-3 py-1 text-sm rounded-md transition-colors ${
                            mode === value
                                ? "bg-background text-foreground shadow-xs"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {/* Right: search input */}
            <div className="flex items-center w-[120px] justify-end">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/50 border border-border/50">
                    <SearchIcon className="size-3.5 text-muted-foreground shrink-0" />
                    <input
                        type="text"
                        value={searchValue}
                        onChange={(e) => setSearchValue(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") handleSearchSubmit();
                        }}
                        placeholder="Search..."
                        className="bg-transparent border-0 text-sm w-24 focus:outline-hidden placeholder:text-muted-foreground/60"
                    />
                </div>
            </div>
        </div>
    );
}
