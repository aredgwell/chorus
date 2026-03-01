import { Route, Routes } from "react-router-dom";

import Home from "./Home";
import ListPrompts from "./ListPrompts";
import MultiChat from "./MultiChat";
import NewPrompt from "./NewPrompt";
import NoteEditor from "./NoteEditor";
import ProjectView from "./ProjectView";
import SearchView from "./SearchView";

export function ContentPane() {
    return (
        <div className="flex flex-col h-full">
            <div className="flex-1 min-h-0">
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/new-prompt" element={<NewPrompt />} />
                    <Route path="/prompts" element={<ListPrompts />} />
                    <Route path="/search" element={<SearchView />} />
                    <Route path="/chat/:chatId" element={<MultiChat />} />
                    <Route path="/note/:noteId" element={<NoteEditor />} />
                    <Route
                        path="/projects/:projectId"
                        element={<ProjectView />}
                    />
                </Routes>
            </div>
        </div>
    );
}
