import { invoke } from "@tauri-apps/api/core";

export async function captureWholeScreenCompressed() {
    // The Rust function optimizes the image size to be under 3.5MB
    // and handles all compression
    console.time("captureWholeScreen");

    try {
        const base64Image = await invoke<string>("capture_whole_screen");

        console.log("response from capture_whole_screen", base64Image);

        console.timeEnd("captureWholeScreen");

        const response = await fetch(`data:image/png;base64,${base64Image}`);
        const blob = await response.blob();

        const file = new File([blob], `screenshot.png`, {
            type: "image/png",
        });

        return file;
    } catch (error) {
        console.timeEnd("captureWholeScreen");
        console.error("Screenshot capture failed:", error);
        throw Object.assign(
            new Error(
                typeof error === "string"
                    ? error
                    : "Failed to capture screenshot",
            ),
            { cause: error },
        );
    }
}
