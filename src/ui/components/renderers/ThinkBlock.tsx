import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@ui/components/ui/collapsible";
import {
    BrainIcon,
    ChevronDown as ChevronDownIcon,
    Loader2,
} from "lucide-react";
import { useEffect, useRef,useState } from "react";

export const ThinkBlock = ({
    content,
    isComplete,
}: {
    content: string;
    isComplete: boolean;
}) => {
    const [isOpen, setIsOpen] = useState(!isComplete);
    const prevIsCompleteRef = useRef<boolean | undefined>(undefined);

    // When the block transitions from incomplete to complete, close it
    useEffect(() => {
        if (
            prevIsCompleteRef.current === false &&
            isComplete === true &&
            isOpen
        ) {
            setIsOpen(false);
        }
        prevIsCompleteRef.current = isComplete;
    }, [isComplete, isOpen]);

    // Don't render anything if children is empty
    if (!content || (typeof content === "string" && content.trim() === "")) {
        return null;
    }

    return (
        <Collapsible
            open={isOpen}
            onOpenChange={setIsOpen}
            className="my-4 rounded-md text-muted-foreground text-sm py-1.5 px-1.5 border w-fit max-w-full"
            onClick={(e: React.MouseEvent<HTMLDivElement>) => {
                e.stopPropagation(); // prevent message from selecting
            }}
        >
            <CollapsibleTrigger className="group font-geist-mono font-[350] text-left flex items-center justify-left hover:text-foreground">
                <div className="flex items-center">
                    {!isComplete ? (
                        <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                    ) : (
                        <div className="mr-2">
                            <BrainIcon className="w-3 h-3" />
                        </div>
                    )}
                    Thoughts
                </div>
                <div className="ml-auto flex items-center">
                    <ChevronDownIcon className="w-3 h-3 ml-4 inline-block transition-transform group-data-[state=open]:rotate-180" />
                </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="">
                <div className="">
                    <div className="px-2 py-4 text-sm text-muted-foreground whitespace-pre-wrap">
                        {content.trim()}
                    </div>
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
};
