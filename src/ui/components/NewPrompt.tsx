import * as ModelsAPI from "@core/chorus/api/ModelsAPI";
import { useShortcut } from "@ui/hooks/useShortcut";
import { posthog } from "posthog-js";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";

import { Button } from "./ui/button";
import { DraggableTopBar } from "./ui/draggable-top-bar";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "./ui/select";
import { Textarea } from "./ui/textarea";

// providers that support system prompts
const CUSTOM_PROMPT_PROVIDERS = ["anthropic", "openai", "google", "perplexity"];

interface NewModelFormData {
    name: string;
    baseModel: string;
    systemPrompt: string;
}

export default function NewPrompt() {
    return <NewPromptInner />;
}

export function NewPromptInner() {
    const navigate = useNavigate();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState<NewModelFormData>({
        name: "",
        baseModel: "",
        systemPrompt: "",
    });

    const models = ModelsAPI.useModels();
    const createModelConfig = ModelsAPI.useCreateModelConfig();

    const baseModelOptions = (models.data ?? [])
        .filter((model) => !model.isInternal && model.isEnabled)
        .filter((model) => {
            const provider = model.id.split("::")[0];
            return CUSTOM_PROMPT_PROVIDERS.includes(provider);
        })
        .sort((a, b) => a.displayName.localeCompare(b.displayName));

    // Cmd+Enter to submit
    useShortcut(["meta", "enter"], () => {
        void handleSubmit();
    });

    const handleSubmit = async (e?: React.FormEvent) => {
        posthog?.capture("new_prompt_created");
        e?.preventDefault();
        if (!formData.name || !formData.baseModel) {
            toast.error("Error", {
                description: "Please fill in all required fields",
            });
            return;
        }

        setIsSubmitting(true);
        // custom_<uuid> instead of custom::<uuid>, because it's not an model id. we don't want to confuse 'custom' as a model provider.
        const configId = `custom__${uuidv4()}`;

        await createModelConfig.mutateAsync({
            configId,
            baseModel: formData.baseModel,
            displayName: formData.name,
            systemPrompt: formData.systemPrompt,
        });

        toast.success("Success", {
            description: "Custom system prompt created",
        });
        navigate("/prompts");
    };

    return (
        <div className="container mx-14 my-14 mt-24">
            <DraggableTopBar />
            <div className="space-y-4 w-full">
                <h2 className="text-xl font-medium text-foreground">
                    New Prompt
                </h2>

                <form
                    onSubmit={(e) => void handleSubmit(e)}
                    className="space-y-6 max-w-4xl"
                >
                    <div className="space-y-2">
                        <Label htmlFor="baseModel">LLM</Label>
                        <Select
                            value={formData.baseModel}
                            onValueChange={(value) =>
                                setFormData((prev) => ({
                                    ...prev,
                                    baseModel: value,
                                }))
                            }
                        >
                            <SelectTrigger className="h-8">
                                <SelectValue placeholder="Select a model" />
                            </SelectTrigger>
                            <SelectContent>
                                {baseModelOptions.map((model) => (
                                    <SelectItem key={model.id} value={model.id}>
                                        {model.displayName}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="name">Name</Label>
                        <Input
                            id="name"
                            placeholder="My Custom GPT-4"
                            value={formData.name}
                            onChange={(e) =>
                                setFormData((prev) => ({
                                    ...prev,
                                    name: e.target.value,
                                }))
                            }
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="systemPrompt">System Prompt</Label>
                        <Textarea
                            id="systemPrompt"
                            placeholder="You are a helpful AI assistant..."
                            value={formData.systemPrompt}
                            onChange={(e) =>
                                setFormData((prev) => ({
                                    ...prev,
                                    systemPrompt: e.target.value,
                                }))
                            }
                            className="min-h-[100px] w-full"
                        />
                    </div>

                    <div className="flex justify-end space-x-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => navigate(-1)}
                        >
                            Cancel <span className="text-sm">⌘[</span>
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? "Creating..." : "Save Prompt"}
                            <span className="text-sm">⌘↵</span>
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
