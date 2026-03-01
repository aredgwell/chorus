import { FileIcon } from "lucide-react";
import {
    siCss,
    siHtml5,
    siJavascript,
    siJson,
    siMarkdown,
    SimpleIcon,
    siTypescript,
} from "simple-icons";

export function getFileIcon(filePath: string, className?: string) {
    const extension = filePath.split(".").pop();
    // Create SVG element using icon data
    const renderIcon = (icon: SimpleIcon) => (
        <svg viewBox="0 0 24 24" className={`mr-2 ${className}`}>
            <path d={icon.path} fill="currentColor" />
        </svg>
    );

    switch (extension) {
        case "ts":
            return renderIcon(siTypescript);
        case "js":
            return renderIcon(siJavascript);
        case "css":
            return renderIcon(siCss);
        case "html":
            return renderIcon(siHtml5);
        case "json":
            return renderIcon(siJson);
        case "md":
            return renderIcon(siMarkdown);
        default:
            return <FileIcon className={className} />;
    }
}
