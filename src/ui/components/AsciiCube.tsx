import { cn } from "@ui/lib/utils";
import { useEffect, useState } from "react";

const AsciiCube = ({ className }: { className?: string }) => {
    const [text, setText] = useState("");
    const fullText = `⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠿⠿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿
⣿⣿⣿⣿⣿⣿⣿⡿⠿⠛⢋⣁⣀⣤⣤⣀⣈⡙⠛⠿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿
⣿⣿⠿⠛⠋⢁⣤⣴⣶⣿⣿⣿⣿⣿⣿⠿⠿⠿⠿⣶⣤⣄⡉⠛⠻⢿⣿⣿⣿⣿
⣿⡿⠀⠀⠀⠻⢿⣿⣿⣿⣿⣿⣿⠏⠀⠀⠀⠀⠀⠀⠈⠉⢻⣷⣦⠀⠈⠉⢻⣿
⣿⡇⠀⣿⣿⣶⣤⣀⡉⠛⠿⣿⣿⣆⡀⠀⠀⢀⣀⣠⣤⡶⠿⠛⠉⠀⠀⠀⢸⣿
⣿⡇⠀⣿⣿⣿⣿⣿⣿⣷⣦⣄⡈⠙⠛⠛⠛⠛⠋⣉⣠⣤⣴⣶⣿⣿⣿⡀⢸⣿
⣿⡇⢸⣿⣿⣿⣿⣿⣿⡟⠉⢻⣿⣷⡀⠀⠀⣴⡿⠛⠛⠛⣿⡏⠀⠙⣿⡇⢸⣿
⣿⡇⢸⣿⣿⣿⣿⣿⣿⠃⠀⠀⠹⣿⣷⠀⢸⣿⠀⠀⠀⠀⣿⡇⠀⠀⣿⡇⢸⣿
⣿⡇⢸⣿⠟⠋⠉⠉⠀⠀⠀⠀⠀⢻⣿⠀⢸⣿⣦⣀⣠⣾⡟⠀⠀⠀⣿⠁⢸⣿
⣿⡇⢸⡏⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⣿⠀⣾⣿⣿⡿⠿⠋⠀⠀⠀⠀⣿⠀⢸⣿
⣿⡇⠘⣿⣄⠀⠀⠀⠀⠀⠀⠀⠀⢸⣿⠀⣿⡟⠁⠀⠀⠀⠀⠀⠀⣼⡿⠀⣸⣿
⣿⣧⣀⠈⠻⢷⣦⣄⣀⠀⠀⠀⠀⣸⡏⠀⣿⣇⠀⠀⠀⠀⠀⣠⣾⡿⠃⠀⣿⣿
⣿⣿⣿⣿⣶⣤⣈⡉⠛⠿⢶⣦⣶⣿⠇⠀⣿⣿⣷⣶⣶⡾⠿⠛⠋⢀⣀⣤⣿⣿
⣿⣿⣿⣿⣿⣿⣿⣿⣷⣶⣤⣀⡉⠁⠀⠀⠙⠉⢉⣉⣤⣴⣶⣿⣿⣿⣿⣿⣿⣿
⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⣶⣶⣾⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿`;

    useEffect(() => {
        let index = 0;
        const timer = setInterval(() => {
            setText((prev) => {
                if (index < fullText.length) {
                    index++;
                    return fullText.slice(0, index);
                }
                clearInterval(timer);
                return prev;
            });
        }, 0.025); // Adjust this value to control the speed

        return () => clearInterval(timer);
    }, [fullText]);

    return (
        <pre
            className={cn(
                "font-mono",
                "whitespace-pre",
                "block",
                "p-2",
                "rounded-md",
                "line-height-1",
                className,
            )}
        >
            {text || "\u00A0"}
        </pre>
    );
};

export default AsciiCube;
