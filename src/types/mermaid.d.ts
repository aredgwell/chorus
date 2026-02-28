// Type declarations for mermaid v8.14.0 (callback-based API)
declare module "mermaid" {
    interface MermaidAPI {
        initialize: (config: Record<string, unknown>) => void;
        /**
         * Renders a mermaid diagram. In v8, render is synchronous and
         * returns the SVG string. An optional callback receives (svgCode, bindFunctions).
         */
        render: (
            id: string,
            text: string,
            cb?: (svgCode: string, bindFunctions?: (element: Element) => void) => void,
            container?: Element,
        ) => string;
        contentLoaded: () => void;
    }
    const mermaid: MermaidAPI;
    export default mermaid;
}
