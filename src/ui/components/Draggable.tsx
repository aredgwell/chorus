import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

interface DraggableProps {
    id: string;
    children: React.ReactNode;
}

export default function Draggable({ id, children }: DraggableProps) {
    const { attributes, listeners, setNodeRef, transform, isDragging } =
        useDraggable({
            id,
        });

    const style = {
        transform: CSS.Translate.toString(transform),
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className={
                isDragging
                    ? "bg-sidebar/95 backdrop-blur-xs rounded opacity-50"
                    : ""
            }
        >
            {children}
        </div>
    );
}
