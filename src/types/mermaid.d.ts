declare module "mermaid" {
    interface MermaidAPI {
        initialize: (config: Record<string, unknown>) => void;
        render: (
            id: string,
            text: string,
        ) => Promise<{ svg: string }>;
        contentLoaded: () => void;
    }
    const mermaid: MermaidAPI;
    export default mermaid;
}
