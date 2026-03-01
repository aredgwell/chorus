import * as ModelsAPI from "@core/chorus/api/ModelsAPI";
import type { ModelConfig } from "@core/chorus/Models";
import { dialogActions } from "@core/infra/DialogStore";
import {
    MixIcon,
    Pencil2Icon,
    PlusIcon,
    TrashIcon,
} from "@radix-ui/react-icons";
import { Button } from "@ui/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@ui/components/ui/dialog";
import { DraggableTopBar } from "@ui/components/ui/draggable-top-bar";
import { Input } from "@ui/components/ui/input";
import { Label } from "@ui/components/ui/label";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@ui/components/ui/table";
import { Textarea } from "@ui/components/ui/textarea";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const editPromptDialogId = (promptId: string) =>
    `edit-prompt-dialog-${promptId}`;

interface PromptDetailProps {
    promptId: string;
    displayName: string;
    systemPrompt: string;
}

export function PromptDetail({
    promptId,
    displayName: initialDisplayName,
    systemPrompt: initialSystemPrompt,
}: PromptDetailProps) {
    const [displayName, setDisplayName] = useState(initialDisplayName);
    const [systemPrompt, setSystemPrompt] = useState(initialSystemPrompt);
    const updateModelConfig = ModelsAPI.useUpdateModelConfig();

    const handleSave = async () => {
        try {
            await updateModelConfig.mutateAsync({
                modelConfigId: promptId,
                displayName,
                systemPrompt,
            });
            dialogActions.closeDialog();
            toast.success("Success", {
                description: "Prompt updated",
            });
        } catch (error) {
            console.error("Error updating model config:", error);
            toast.error("Error", {
                description: "Failed to update prompt",
            });
        }
    };

    const handleCancel = () => {
        // Reset to initial values
        setDisplayName(initialDisplayName);
        setSystemPrompt(initialSystemPrompt);
        dialogActions.closeDialog();
    };

    return (
        <Dialog id={editPromptDialogId(promptId)}>
            <DialogContent className="p-4" aria-describedby={undefined}>
                <DialogHeader>
                    <DialogTitle>Edit Prompt</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor={`name-${promptId}`}>Name</Label>
                        <Input
                            id={`name-${promptId}`}
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor={`systemPrompt-${promptId}`}>
                            System Prompt
                        </Label>
                        <Textarea
                            id={`systemPrompt-${promptId}`}
                            value={systemPrompt}
                            onChange={(e) => setSystemPrompt(e.target.value)}
                            className="min-h-[100px] w-full"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={handleCancel}>
                        Cancel
                    </Button>
                    <Button onClick={() => void handleSave()}>
                        Save Changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

const PromptRow = React.memo(({ config }: { config: ModelConfig }) => {
    const deleteModelConfig = ModelsAPI.useDeleteModelConfig();

    const handleDelete = async () => {
        try {
            await deleteModelConfig.mutateAsync({
                modelConfigId: config.id,
            });
            toast.success("Success", {
                description: "Prompt deleted",
            });
        } catch (error) {
            console.error("Error deleting model config:", error);
            toast.error("Error", {
                description: "Failed to delete prompt",
            });
        }
    };

    return (
        <>
            <TableRow>
                <TableCell>{config.displayName}</TableCell>
                <TableCell>{config.modelId.split("::")[1]}</TableCell>
                <TableCell className="max-w-md truncate">
                    {config.systemPrompt || "No system prompt"}
                </TableCell>
                <TableCell>
                    <div className="flex gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                                dialogActions.openDialog(
                                    editPromptDialogId(config.id),
                                )
                            }
                        >
                            <Pencil2Icon className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => void handleDelete()}
                        >
                            <TrashIcon className="h-4 w-4" />
                        </Button>
                    </div>
                </TableCell>
            </TableRow>
            <PromptDetail
                promptId={config.id}
                displayName={config.displayName}
                systemPrompt={config.systemPrompt || ""}
            />
        </>
    );
});

export default function ListPrompts() {
    const navigate = useNavigate();
    const modelConfigs = ModelsAPI.useModelConfigs();

    // Filter to only show user-created configs
    const userConfigs =
        modelConfigs.data?.filter((config) => config.author === "user") ?? [];

    return (
        <div className="container mx-14 my-14 mt-24">
            <DraggableTopBar />
            <div className="space-y-4 w-full">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-medium text-foreground">
                        Custom Prompts
                    </h2>
                    <Button onClick={() => navigate("/new-prompt")}>
                        <PlusIcon className="mr-2 h-4 w-4" /> New
                    </Button>
                </div>

                <Table>
                    {userConfigs.length > 0 && (
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Base Model</TableHead>
                                <TableHead>System Prompt</TableHead>
                                <TableHead className="w-[100px]">
                                    Actions
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                    )}
                    <TableBody>
                        {userConfigs.map((config) => (
                            <PromptRow key={config.id} config={config} />
                        ))}
                        {userConfigs.length === 0 && (
                            <TableRow>
                                <TableCell
                                    colSpan={4}
                                    className="h-[400px] text-center"
                                >
                                    <div className="flex flex-col items-center justify-center space-y-4">
                                        <div className="rounded-full bg-muted p-6">
                                            <MixIcon className="h-8 w-8 text-muted-foreground" />
                                        </div>
                                        <div className="text-lg font-medium">
                                            No custom prompts
                                        </div>
                                        <div className="text-sm text-muted-foreground max-w-sm">
                                            Create custom prompts to personalize
                                            how your AI models behave. Click the
                                            "New" button above to get started.
                                        </div>
                                        <Button
                                            onClick={() =>
                                                navigate("/new-prompt")
                                            }
                                        >
                                            <PlusIcon className="mr-2 h-4 w-4" />{" "}
                                            Create your first prompt
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
