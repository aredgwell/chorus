import { dialogActions } from "@core/infra/DialogStore";
import { openPath } from "@tauri-apps/plugin-opener";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogTitle,
} from "@ui/components/ui/dialog";

import { Button } from "../ui/button";
interface ImagePreviewProps {
    src: string;
    alt?: string;
}

const imagePreviewDialogId = (src: string) => `image-preview-dialog-${src}`;

export function ImagePreview({ src, alt }: ImagePreviewProps) {
    return (
        <>
            <img
                src={src}
                alt={alt}
                className="cursor-zoom-in hover:opacity-90 transition-opacity"
                onClick={() =>
                    dialogActions.openDialog(imagePreviewDialogId(src))
                }
            />
            <Dialog id={imagePreviewDialogId(src)}>
                <DialogContent aria-describedby={undefined}>
                    <DialogTitle className="sr-only">Image Preview</DialogTitle>
                    <div className="flex items-center justify-center">
                        <img
                            src={src}
                            alt={alt}
                            className="max-h-[90vh] object-contain rounded-lg"
                        />
                    </div>
                    <DialogFooter>
                        {src.startsWith("asset://localhost/") && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    const path = src.replace(
                                        "asset://localhost",
                                        "",
                                    );
                                    // decode the path
                                    const decodedPath =
                                        decodeURIComponent(path);
                                    console.log("openPath", decodedPath);
                                    void openPath(decodedPath);
                                }}
                            >
                                Open in Preview
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
