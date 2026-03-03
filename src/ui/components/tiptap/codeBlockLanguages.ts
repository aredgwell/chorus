import { common, createLowlight } from "lowlight";

export const lowlight = createLowlight(common);
export const codeBlockLanguages = [
    ...lowlight.listLanguages(),
    "mermaid",
    "latex",
].sort();
