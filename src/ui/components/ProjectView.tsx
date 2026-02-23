import { useState, useRef, useEffect, forwardRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
    PROJECT_TEMPLATE_COACH,
    PROJECT_TEMPLATE_PAIR_PROGRAMMER,
    PROJECT_TEMPLATE_HAMEL_WRITING_GUIDE,
    PROJECT_TEMPLATE_DECISION_ADVISOR,
} from "@core/chorus/prompts/prompts";
import {
    ArrowLeftIcon,
    ArrowRightIcon,
    AtSignIcon,
    FolderOpenIcon,
    SquarePlusIcon,
    TrashIcon,
} from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { toast } from "sonner";
import RetroSpinner from "./ui/retro-spinner";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "./ui/dialog";
import { AttachmentDropArea } from "./AttachmentsViews";
import _ from "lodash";
import AutoExpandingTextarea from "./AutoExpandingTextarea";
import {
    useFileSelect,
    useFileDrop,
    useAttachUrl,
    useFilePaste,
} from "@ui/hooks/useAttachments";
import {
    handleInputPasteWithAttachments,
    projectDisplayName,
} from "@ui/lib/utils";
import { EditableTitle } from "./EditableTitle";
import { useQuery } from "@tanstack/react-query";
import { useSidebar } from "@ui/hooks/useSidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { Switch } from "./ui/switch";
import { dialogActions, useDialogStore } from "@core/infra/DialogStore";
import { useSettings } from "./hooks/useSettings";
import { Link } from "react-router-dom";
import { SidebarTrigger } from "./ui/sidebar";
import * as ProjectAPI from "@core/chorus/api/ProjectAPI";
import * as ChatAPI from "@core/chorus/api/ChatAPI";

const deleteProjectDialogId = (projectId: string) =>
    `delete-project-dialog-${projectId}`;

export default function ProjectView() {
    const { projectId } = useParams<{ projectId: string }>();
    const navigate = useNavigate();
    const [newName, setNewName] = useState("");
    const isDeleteProjectDialogOpen = useDialogStore((state) =>
        projectId
            ? state.activeDialogId === deleteProjectDialogId(projectId)
            : false,
    );
    const deleteConfirmButtonRef = useRef<HTMLButtonElement>(null);
    const contextEditorRef = useRef<ProjectContextEditorRef>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Mutations
    const renameProject = ProjectAPI.useRenameProject();
    const deleteProject = ProjectAPI.useDeleteProject();
    const getOrCreateNewChat = ChatAPI.useGetOrCreateNewChat();
    const setMagicProjectsEnabled = ProjectAPI.useSetMagicProjectsEnabled();

    // Queries
    const projectsQuery = useQuery(ProjectAPI.projectQueries.list());
    const project = projectsQuery.data?.find((p) => p.id === projectId);
    const chats = useQuery(ChatAPI.chatQueries.list());
    const chatsInProject =
        chats.data
            ?.filter((chat) => chat.projectId === projectId)
            .filter((chat) => !chat.isNewChat) ?? [];

    const { open } = useSidebar();

    // File attachment hook
    const fileSelect = useFileSelect({
        association: { type: "project", projectId: projectId || "" },
    });

    // Callbacks - must be defined before any conditional returns
    const handleForwardNavigation = useCallback(() => {
        navigate(1);
    }, [navigate]);

    const handleBackNavigation = useCallback(() => {
        navigate(-1);
    }, [navigate]);

    // effects
    useEffect(() => {
        if (project) {
            setNewName(project.name || "");
        }
    }, [project, projectId]);

    // Debounce effect
    useEffect(() => {
        const handler = setTimeout(() => {
            if (projectId && newName !== project?.name) {
                void renameProject.mutateAsync({
                    projectId,
                    newName,
                });
            }
        }, 250); // 250ms debounce delay

        return () => {
            clearTimeout(handler);
        };
    }, [projectId, newName, project?.name, renameProject]);

    if (!projectId) {
        return <div>Project ID not found</div>;
    }

    if (projectsQuery.isPending) {
        return <RetroSpinner />;
    }

    if (projectsQuery.isError) {
        return (
            <div>
                Error loading projects: {JSON.stringify(projectsQuery.error)}
            </div>
        );
    }

    if (!project) {
        return <div>Project not found</div>;
    }

    const handleOpenDeleteDialog = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dialogActions.openDialog(deleteProjectDialogId(projectId));
    };

    const handleConfirmDelete = async () => {
        await deleteProject.mutateAsync({
            projectId,
        });
        dialogActions.closeDialog();

        toast(`'${projectDisplayName(project.name)}' deleted`);

        navigate("/");
    };

    return (
        <div className="container py-28 px-16 mx-auto max-w-5xl relative">
            {/* header bar — todo: componentize because it's also used in multichat */}
            <div
                data-tauri-drag-region
                className={`fixed top-0 left-0 ${open ? "left-64" : "pl-20"} right-0 h-[52px] z-10
                     items-center justify-between px-3 -mt-[1px] flex bg-background
                hover:bg-background
                active:bg-background
                border-b
                active:border-b
                active:!border-border`}
            >
                <div className="flex items-center gap-1">
                    {!open && <SidebarTrigger className="!size-4 ml-2" />}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="link"
                                size="iconSm"
                                onClick={handleBackNavigation}
                            >
                                <ArrowLeftIcon
                                    strokeWidth={1.5}
                                    className="!size-3.5 ml-2"
                                />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                            Back{" "}
                            <kbd>
                                <span>⌘</span>[
                            </kbd>
                        </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="link"
                                size="iconSm"
                                onClick={handleForwardNavigation}
                                disabled={true}
                                className="text-helper"
                            >
                                <ArrowRightIcon
                                    strokeWidth={1.5}
                                    className="!size-3.5"
                                />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                            Forward{" "}
                            <kbd>
                                <span>⌘</span>]
                            </kbd>
                        </TooltipContent>
                    </Tooltip>

                    {/* Project name */}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground ml-4">
                        <FolderOpenIcon className="w-4 h-4" />
                        <EditableTitle
                            title={project?.name || ""}
                            onUpdate={async (newName) => {
                                await renameProject.mutateAsync({
                                    projectId,
                                    newName,
                                });
                            }}
                            className="font-normal"
                            editClassName="h-6 text-sm px-1 py-0 border-none"
                            placeholder="New Project"
                            showEditIcon={false}
                            disabled={false}
                        />
                    </div>
                </div>

                {/* Project actions */}
                <div className="flex items-center gap-2 mr-2">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="iconSm"
                                onClick={() => {
                                    if (projectId) {
                                        void getOrCreateNewChat.mutateAsync({
                                            projectId,
                                        });
                                    }
                                }}
                            >
                                <SquarePlusIcon
                                    strokeWidth={1.5}
                                    className="!w-4 !h-4"
                                />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                            New chat in project{" "}
                            <kbd>
                                <span>⌘</span>N
                            </kbd>
                        </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="iconSm"
                                onClick={handleOpenDeleteDialog}
                            >
                                <TrashIcon
                                    strokeWidth={1.5}
                                    className="!w-4 !h-4"
                                />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                            Delete project
                        </TooltipContent>
                    </Tooltip>
                </div>
            </div>

            {/*  header */}
            <div className="mb-8">
                <div className="flex-1 ml-2">
                    <Input
                        ref={inputRef}
                        autoFocus
                        value={newName}
                        onChange={(e) => {
                            setNewName(e.target.value);
                        }}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                contextEditorRef.current?.textareaRef.current?.focus();
                            }
                        }}
                        placeholder="New Project"
                        className="text-3xl font-medium ring-0 tracking-tight px-0 py-2 border-none rounded-none"
                    />
                </div>

                {/* Suggestion buttons and Add files */}
                <div className="flex gap-2 mt-8 ml-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                            e.preventDefault();
                            fileSelect.mutate();
                        }}
                        className="rounded-full text-foreground !border-input hover:bg-foreground/5 whitespace-nowrap h-7 text-sm"
                    >
                        <span className="text-base mr-1">+</span>
                        Add files
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            contextEditorRef.current?.handleTemplateSelect?.(
                                PROJECT_TEMPLATE_PAIR_PROGRAMMER,
                            );
                        }}
                        className="rounded-full text-foreground !border-input-border border-dashed hover:bg-foreground/5 whitespace-nowrap h-7 text-sm"
                    >
                        <AtSignIcon className="size-3" />
                        Pair Programmer
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            contextEditorRef.current?.handleTemplateSelect?.(
                                PROJECT_TEMPLATE_COACH,
                            );
                        }}
                        className="rounded-full text-foreground !border-input-border border-dashed hover:bg-foreground/5 whitespace-nowrap h-7 text-sm"
                    >
                        <AtSignIcon className="size-3" />
                        Coach
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            contextEditorRef.current?.handleTemplateSelect?.(
                                PROJECT_TEMPLATE_HAMEL_WRITING_GUIDE,
                            );
                        }}
                        className="rounded-full text-foreground !border-input-border border-dashed hover:bg-foreground/5 whitespace-nowrap h-7 text-sm"
                    >
                        <AtSignIcon className="size-3" />
                        Writing Assistant
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            contextEditorRef.current?.handleTemplateSelect?.(
                                PROJECT_TEMPLATE_DECISION_ADVISOR,
                            );
                        }}
                        className="rounded-full text-foreground !border-input-border border-dashed hover:bg-foreground/5 whitespace-nowrap h-7 text-sm"
                    >
                        <AtSignIcon className="size-3" />
                        Decision Advisor
                    </Button>
                </div>
            </div>

            <div className="md:grid grid-cols-12 gap-4 w-full mt-8">
                {/* User Context Section */}
                <div className="col-span-8">
                    <ProjectContextEditor
                        ref={contextEditorRef}
                        projectId={projectId}
                    />
                </div>

                {/* Magic Project Section */}
                <div className="p-1 border border-border rounded relative col-span-4 self-start">
                    <span className="absolute left-2 -top-2.5 bg-background px-2 text-xs font-geist-mono tracking-wider text-muted-foreground">
                        CHATS
                    </span>
                    <div className="flex justify-between gap-1 bg-muted px-3 py-2 rounded">
                        <div className="flex flex-col gap-1 w-64">
                            <h2 className="font-medium">
                                <span
                                    className={
                                        project.magicProjectsEnabled
                                            ? "shimmer"
                                            : ""
                                    }
                                >
                                    Project Memory
                                </span>
                            </h2>
                            <p className="text-sm text-muted-foreground font-[350] -mt-0.5">
                                Add automatic summaries of chats in this project
                                to context
                                {project.isImported && (
                                    <span className="block text-xs mt-1 text-muted-foreground/70">
                                        Disabled for imported projects
                                    </span>
                                )}
                            </p>
                        </div>
                        <Switch
                            checked={project.magicProjectsEnabled}
                            onCheckedChange={() => {
                                void setMagicProjectsEnabled.mutateAsync({
                                    projectId,
                                    enabled: !project.magicProjectsEnabled,
                                });
                            }}
                            disabled={project.isImported}
                        />
                    </div>
                    <div className="">
                        {/* Magic context details */}
                        <div className="space-y-2 mt-1 max-h-[400px] overflow-y-auto">
                            <div className="flex flex-col gap-2">
                                {chatsInProject.map((chat) => (
                                    <Link
                                        key={chat.id}
                                        to={`/chat/${chat.id}`}
                                        className="hover:bg-muted rounded px-3 py-2"
                                    >
                                        <div className="font-medium">
                                            {chat.title ?? "Untitled chat"}
                                        </div>
                                        <div className="text-sm text-muted-foreground font-[350]">
                                            {chat.projectContextSummary ?? (
                                                <span className="italic">
                                                    No summary yet
                                                </span>
                                            )}
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                        {chatsInProject.length === 0 && (
                            <div className="flex w-full">
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="group/new-chat w-full justify-between px-3"
                                    onClick={() => {
                                        if (projectId) {
                                            void getOrCreateNewChat.mutateAsync(
                                                {
                                                    projectId,
                                                },
                                            );
                                        }
                                    }}
                                >
                                    <span className="flex items-center gap-2 ">
                                        <SquarePlusIcon
                                            strokeWidth={1.5}
                                            className="size-3 text-muted-foreground"
                                        />{" "}
                                        New chat in project
                                    </span>
                                    <span className="text-xs hidden group-hover/new-chat:block text-muted-foreground">
                                        ⌘N
                                    </span>
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Delete confirmation dialog */}
            <Dialog
                id={deleteProjectDialogId(projectId)}
                open={isDeleteProjectDialogOpen}
            >
                <DialogContent className="sm:max-w-md p-5">
                    <DialogHeader>
                        <DialogTitle>
                            Delete &ldquo;
                            {projectDisplayName(project.name)}
                            &rdquo;
                        </DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this project and all
                            its chats? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => dialogActions.closeDialog()}
                            tabIndex={-1}
                        >
                            Cancel{" "}
                            <span className="ml-1 text-sm text-muted-foreground/70">
                                Esc
                            </span>
                        </Button>
                        <Button
                            type="button"
                            variant="default"
                            size="sm"
                            onClick={() => void handleConfirmDelete()}
                            ref={deleteConfirmButtonRef}
                            tabIndex={1}
                        >
                            Delete <span className="ml-1 text-sm">↵</span>
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

interface ProjectContextEditorRef {
    textareaRef: React.RefObject<HTMLTextAreaElement | null>;
    handleTemplateSelect?: (template: string) => void;
}

const replaceContextDialogId = (projectId: string) =>
    `replace-context-dialog-${projectId}`;

const ProjectContextEditor = forwardRef<
    ProjectContextEditorRef,
    { projectId: string }
>(function ProjectContextEditor({ projectId }, ref) {
    // Use the existing hook for context text
    const { draft: contextText, setDraft: setContextText } =
        ProjectAPI.useAutoSyncProjectContextText(projectId);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const settings = useSettings();
    const [pendingTemplate, setPendingTemplate] = useState<string | null>(null);
    const isReplaceContextDialogOpen = useDialogStore(
        (state) => state.activeDialogId === replaceContextDialogId(projectId),
    );

    const handleTemplateSelect = useCallback(
        (template: string) => {
            if (contextText && contextText.trim().length > 0) {
                setPendingTemplate(template);
                dialogActions.openDialog(replaceContextDialogId(projectId));
            } else {
                setContextText(template);
            }
        },
        [contextText, setContextText, projectId],
    );

    useEffect(() => {
        if (ref && "current" in ref) {
            ref.current = { textareaRef, handleTemplateSelect };
        }
    }, [ref, handleTemplateSelect]);

    const handleConfirmReplace = () => {
        if (pendingTemplate) {
            setContextText(pendingTemplate);
        }
        dialogActions.closeDialog();
        setPendingTemplate(null);
    };

    const handleCancelReplace = () => {
        dialogActions.closeDialog();
        setPendingTemplate(null);
    };

    const attachmentsQuery = useQuery(
        ProjectAPI.projectContextQueries.attachments(projectId),
    );
    const removeAttachment = ProjectAPI.useDeleteAttachmentFromProject();

    const fileDrop = useFileDrop({
        association: { type: "project", projectId },
    });

    const attachUrl = useAttachUrl({
        association: { type: "project", projectId },
    });

    const filePaste = useFilePaste({
        association: { type: "project", projectId },
    });

    const handlePaste = async (
        e: React.ClipboardEvent<HTMLTextAreaElement>,
    ) => {
        const { attachUrl: attachUrls, filePaste: files } =
            handleInputPasteWithAttachments(e, attachmentsQuery.data, settings);

        if (attachUrls) {
            for (const url of attachUrls) {
                await attachUrl.mutateAsync({ url });
            }
        }

        if (files) {
            await filePaste.mutateAsync(files);
        }
    };

    return (
        <div className="mb-8 relative">
            <span className="absolute left-2 -top-2.5 bg-background px-2 text-xs font-geist-mono tracking-wider text-muted-foreground z-10">
                CONTEXT
            </span>

            {/* Integrated context box with attachments and textarea */}
            <div className="border border-border rounded">
                <AttachmentDropArea
                    attachments={attachmentsQuery.data ?? []}
                    onFileDrop={fileDrop.mutate}
                    onRemove={(attachmentId) =>
                        removeAttachment.mutate({
                            attachmentId,
                            projectId,
                        })
                    }
                    inline={true}
                />

                <AutoExpandingTextarea
                    ref={textareaRef}
                    value={contextText}
                    onChange={(e) => setContextText(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            const textarea = e.currentTarget;
                            const start = textarea.selectionStart;
                            const end = textarea.selectionEnd;
                            const newValue =
                                contextText.substring(0, start) +
                                "\n" +
                                contextText.substring(end);
                            setContextText(newValue);
                            // Set cursor position after the newline
                            setTimeout(() => {
                                textarea.selectionStart =
                                    textarea.selectionEnd = start + 1;
                            }, 0);
                        }
                    }}
                    onPaste={(e) => void handlePaste(e)}
                    placeholder="What do you want all chats in this project to know?"
                    className="pl-3.5 pr-12 py-3 max-h-[400px] h-full overflow-y-auto ring-0 border-0 rounded placeholder:text-muted-foreground placeholder:font-[350] w-full"
                    rows={20}
                />
            </div>

            {/* Confirmation dialog */}
            <Dialog
                id={replaceContextDialogId(projectId)}
                open={isReplaceContextDialogOpen}
            >
                <DialogContent className="sm:max-w-md p-5">
                    <DialogHeader>
                        <DialogTitle>Replace existing context?</DialogTitle>
                        <DialogDescription>
                            You have existing text in the context field. Are you
                            sure you want to replace it with the template?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleCancelReplace}
                            tabIndex={-1}
                        >
                            Cancel{" "}
                            <span className="ml-1 text-sm text-muted-foreground/70">
                                Esc
                            </span>
                        </Button>
                        <Button
                            type="button"
                            variant="default"
                            size="sm"
                            onClick={handleConfirmReplace}
                            tabIndex={1}
                        >
                            Replace <span className="ml-1 text-sm">↵</span>
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
});
