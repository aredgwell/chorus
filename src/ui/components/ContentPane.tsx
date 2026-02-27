import { Route, Routes } from "react-router-dom";
import Home from "./Home";
import MultiChat from "./MultiChat";
import NoteEditor from "./NoteEditor";
import ProjectView from "./ProjectView";
import SearchView from "./SearchView";
import NewPrompt from "./NewPrompt";
import ListPrompts from "./ListPrompts";

export function ContentPane() {
    return (
        <div className="flex flex-col h-full">
            <div className="flex-1 min-h-0">
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/new-prompt" element={<NewPrompt />} />
                    <Route path="/prompts" element={<ListPrompts />} />
                    <Route path="/search" element={<SearchView />} />
                    <Route
                        path="/chat/:chatId"
                        element={<MultiChat />}
                    />
                    <Route
                        path="/note/:noteId"
                        element={<NoteEditor />}
                    />
                    <Route
                        path="/projects/:projectId"
                        element={<ProjectView />}
                    />
                </Routes>
            </div>
        </div>
    );
}
