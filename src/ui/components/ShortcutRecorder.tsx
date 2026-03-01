import React, { useEffect, useRef, useState } from "react";

import { Input } from "./ui/input";

interface ShortcutRecorderProps {
    value: string;
    onChange: (_shortcut: string) => void;
}

const CONTROL_KEY = "Control";
const SHIFT_KEY = "Shift";
const ALT_KEY = "Alt";
const META_KEY = "Meta";
const COMMAND_KEY = "Command";

export default function ShortcutRecorder({
    value,
    onChange,
}: ShortcutRecorderProps) {
    const [recording, setRecording] = useState<boolean>(false);
    const [display, setDisplay] = useState<string>(value);
    const keysRef = useRef<Set<string>>(new Set());
    const inputRef = useRef<HTMLInputElement>(null);

    // If value ever changes externally (e.g. reset button), reset the display
    useEffect(() => {
        setRecording(false);
        setDisplay(value);
    }, [value]);

    const formatShortcut = (keys: Set<string>): string => {
        return Array.from(keys)
            .map((key) => (key === META_KEY ? COMMAND_KEY : key))
            .join("+");
    };

    // Gets the key from the current event, handling special cases like spaces
    const getKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
        const isStringKey = e.code === "Space";

        // We use e.code for keys and digits to get their raw keyboard value
        // so modifier keys can't affect their values
        if (isStringKey) return "Space";
        else if (e.code.startsWith("Key")) return e.code.replace("Key", "");
        else if (e.code.startsWith("Digit")) return e.code.replace("Digit", "");
        else return e.key;
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        if (!recording) return;

        keysRef.current.add(getKey(e));

        // e.key returns nothing for modifier keys, so check those explicitly
        // we have to check this _after_ adding the key to the set
        // since these will be true if both the modifier and another key are pressed simultaneously
        if (e.ctrlKey) keysRef.current.add(CONTROL_KEY);
        if (e.metaKey) keysRef.current.add(META_KEY);
        if (e.shiftKey) keysRef.current.add(SHIFT_KEY);
        if (e.altKey) keysRef.current.add(ALT_KEY);

        const shortcut = formatShortcut(keysRef.current);
        setDisplay(shortcut);
    };

    // When the user releases their original key, we stop recording
    const handleKeyUp = (_e: React.KeyboardEvent<HTMLInputElement>) => {
        keysRef.current.clear();
        setRecording(false);
        onChange(display);
        if (inputRef.current) inputRef.current.blur();
    };

    // When the user focuses the input, we start recording
    const handleFocus = () => {
        setRecording(true);
        setDisplay("");
    };

    // We stop recording and restore the original value in case the user
    // manually blurs (e.g. clicks away) while still holding down the original record key
    const handleBlur = () => {
        keysRef.current.clear();
        setRecording(false);
        if (!display) setDisplay(value);
    };

    return (
        <Input
            ref={inputRef}
            type="text"
            value={display}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
            readOnly
            placeholder="Press shortcut keys"
            aria-label="Shortcut recorder"
        />
    );
}
