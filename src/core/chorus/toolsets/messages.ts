import { homeDir } from "@tauri-apps/api/path";
import { exists } from "@tauri-apps/plugin-fs";
import { Command } from "@tauri-apps/plugin-shell";

import { StdioServerParameters } from "../MCPStdioTauri";
import { MCPServer, Toolset } from "../Toolsets";
export class MCPMessages extends MCPServer {
    protected getExecutionParameters(
        _config: Record<string, string>,
    ): StdioServerParameters {
        return {
            type: "sidecar",
            sidecarBinary: "binaries/mcp-exa",
        };
    }
}

export class ToolsetMessages extends Toolset {
    constructor() {
        super("messages", "Messages", {}, "Lists unread messages", "");

        this.addCustomTool(
            "get_unread_messages",
            {
                type: "object",
                properties: {
                    limit: {
                        type: "number",
                        description:
                            "Limit the number of messages to fetch (default: 10)",
                    },
                },
                additionalProperties: false,
            },
            async (args) => {
                const messages = await getUnreadMessages(args.limit as number);
                console.log(messages);
                return JSON.stringify(messages);
            },
            "Fetch unread messages",
        );

        this.addCustomTool(
            "get_contact_name",
            {
                type: "object",
                properties: {
                    phoneNumber: { type: "string" },
                },
                required: ["phoneNumber"],
                additionalProperties: false,
            },
            async (args) => {
                const contactName = await getContactName(
                    args.phoneNumber as string,
                );
                return JSON.stringify(contactName);
            },
            "Fetch contact name",
        );
        const messagesServer = new MCPMessages();

        this.addServer(messagesServer, { mode: "all" });
    }
}

interface Message {
    content: string;
    date: string;
    sender: string;
    sender_name?: string;
    is_from_me: boolean;
    attachments?: string[];
    url?: string;
}

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

async function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function retryOperation<T>(
    operation: () => Promise<T>,
    retries = MAX_RETRIES,
    delay = RETRY_DELAY,
): Promise<T> {
    try {
        return await operation();
    } catch (error) {
        if (retries > 0) {
            console.error(
                `Operation failed, retrying... (${retries} attempts remaining)`,
            );
            await sleep(delay);
            return retryOperation(operation, retries - 1, delay);
        }
        throw error;
    }
}

function normalizePhoneNumber(phone: string): string[] {
    // Remove all non-numeric characters except +
    const cleaned = phone.replace(/[^0-9+]/g, "");

    // If it's already in the correct format (+1XXXXXXXXXX), return just that
    if (/^\+1\d{10}$/.test(cleaned)) {
        return [cleaned];
    }

    // If it starts with 1 and has 11 digits total
    if (/^1\d{10}$/.test(cleaned)) {
        return [`+${cleaned}`];
    }

    // If it's 10 digits
    if (/^\d{10}$/.test(cleaned)) {
        return [`+1${cleaned}`];
    }

    // If none of the above match, try multiple formats
    const formats = new Set<string>();

    if (cleaned.startsWith("+1")) {
        formats.add(cleaned);
    } else if (cleaned.startsWith("1")) {
        formats.add(`+${cleaned}`);
    } else {
        formats.add(`+1${cleaned}`);
    }

    return Array.from(formats);
}

async function checkMessagesDBAccess(): Promise<boolean> {
    try {
        const dbPath = `${await homeDir()}/Library/Messages/chat.db`;

        // Check if the file exists using Tauri's file system plugin
        const fileExists = await exists(dbPath);
        if (!fileExists) {
            throw new Error(`File not found: ${dbPath}`);
        }

        // Additional check - try to query the database using Tauri's shell plugin
        const command = Command.create("sqlite3", [dbPath, "SELECT 1;"]);
        const output = await command.execute();

        if (output.code !== 0) {
            throw new Error(`Database query failed: ${output.stderr}`);
        }

        return true;
    } catch (error) {
        console.error(`
Error: Cannot access Messages database.
To fix this, please grant Full Disk Access to Terminal/iTerm2:
1. Open System Preferences
2. Go to Security & Privacy > Privacy
3. Select "Full Disk Access" from the left sidebar
4. Click the lock icon to make changes
5. Add Chorus.app to the list
6. Restart your terminal and try again

Error details: ${error instanceof Error ? error.message : String(error)}
`);
        return false;
    }
}

function decodeAttributedBody(hexString: string): {
    text: string;
    url?: string;
} {
    try {
        // Convert hex to buffer
        const buffer = Buffer.from(hexString, "hex");
        const content = buffer.toString();

        // Common patterns in attributedBody
        const patterns = [
            /NSString">(.*?)</, // Basic NSString pattern
            /NSString">([^<]+)/, // NSString without closing tag
            /NSNumber">\d+<.*?NSString">(.*?)</, // NSNumber followed by NSString
            /NSArray">.*?NSString">(.*?)</, // NSString within NSArray
            /"string":\s*"([^"]+)"/, // JSON-style string
            /text[^>]*>(.*?)</, // Generic XML-style text
            /message>(.*?)</, // Generic message content
        ];

        // Try each pattern
        let text = "";
        for (const pattern of patterns) {
            const match = content.match(pattern);
            if (match?.[1]) {
                text = match[1];
                if (text.length > 5) {
                    // Only use if we got something substantial
                    break;
                }
            }
        }

        // Look for URLs
        const urlPatterns = [
            /(https?:\/\/[^\s<"]+)/, // Standard URLs
            /NSString">(https?:\/\/[^\s<"]+)/, // URLs in NSString
            /"url":\s*"(https?:\/\/[^"]+)"/, // URLs in JSON format
            /link[^>]*>(https?:\/\/[^<]+)/, // URLs in XML-style tags
        ];

        let url: string | undefined;
        for (const pattern of urlPatterns) {
            const match = content.match(pattern);
            if (match?.[1]) {
                url = match[1];
                break;
            }
        }

        if (!text && !url) {
            // Try to extract any readable text content
            const readableText = content
                .replace(/streamtyped.*?NSString/g, "") // Remove streamtyped header
                .replace(/NSAttributedString.*?NSString/g, "") // Remove attributed string metadata
                .replace(/NSDictionary.*?$/g, "") // Remove dictionary metadata
                .replace(/\+[A-Za-z]+\s/g, "") // Remove +[identifier] patterns
                .replace(/NSNumber.*?NSValue.*?\*/g, "") // Remove number/value metadata
                .replace(/[^\x20-\x7E]/g, " ") // Replace non-printable chars with space
                .replace(/\s+/g, " ") // Normalize whitespace
                .trim();

            if (readableText.length > 5) {
                // Only use if we got something substantial
                text = readableText;
            } else {
                return { text: "[Message content not readable]" };
            }
        }

        // Clean up the found text
        if (text) {
            text = text
                .replace(/^[+\s]+/, "") // Remove leading + and spaces
                .replace(/\s*iI\s*[A-Z]\s*$/, "") // Remove iI K pattern at end
                .replace(/\s+/g, " ") // Normalize whitespace
                .trim();
        }

        return { text: text || url || "", url };
    } catch (error) {
        console.error("Error decoding attributedBody:", error);
        return { text: "[Message content not readable]" };
    }
}

async function getAttachmentPaths(messageId: number): Promise<string[]> {
    try {
        const query = `
            SELECT filename
            FROM attachment
            INNER JOIN message_attachment_join 
            ON attachment.ROWID = message_attachment_join.attachment_id
            WHERE message_attachment_join.message_id = ${messageId}
        `;

        const command = Command.create("sqlite3", [
            "-json",
            `${process.env.HOME}/Library/Messages/chat.db`,
            query,
        ]);
        const output = await command.execute();

        if (!output.stdout.trim()) {
            return [];
        }

        const attachments = JSON.parse(output.stdout) as { filename: string }[];
        return attachments.map((a) => a.filename).filter(Boolean);
    } catch (error) {
        console.error("Error getting attachments:", error);
        return [];
    }
}

// Cache for contact names to avoid repeated lookups
const contactNameCache: Record<string, string | null> = {};

async function getContactName(phoneNumber: string): Promise<string | null> {
    try {
        // Check cache first
        if (contactNameCache[phoneNumber] !== undefined) {
            return contactNameCache[phoneNumber];
        }

        // Generate optimized set of variants
        const variants = generateOptimizedVariants(phoneNumber);

        // Build variant string for AppleScript
        const variantsStr = variants
            .map((v) => `"${v.replace(/"/g, '\\"')}"`)
            .join(", ");

        // More thorough but optimized contact lookup
        const ascript = `
            tell application "Contacts"
                set phoneVariants to {${variantsStr}}
                set contactName to ""
                
                -- First try direct contains match (fastest)
                repeat with phoneVar in phoneVariants
                    if contactName is "" then
                        try
                            set matchingPeople to (every person whose phones's value contains phoneVar)
                            if length of matchingPeople > 0 then
                                set contactName to name of item 1 of matchingPeople
                            end if
                        end try
                    end if
                end repeat
                
                -- If still no match, try ends with on just the first few people
                -- (this is a performance compromise)
                if contactName is "" then
                    try
                        set allPeople to every person
                        -- Limit to first 50 people for performance
                        set personCount to (count of allPeople)
                        if personCount > 50 then set personCount to 50
                        
                        repeat with i from 1 to personCount
                            set p to item i of allPeople
                            set personPhones to value of phones of p
                            repeat with phoneVar in phoneVariants
                                repeat with ph in personPhones
                                    if ph ends with phoneVar then
                                        set contactName to name of p
                                        exit repeat
                                    end if
                                end repeat
                                if contactName is not "" then exit repeat
                            end repeat
                            if contactName is not "" then exit repeat
                        end repeat
                    end try
                end if
                
                return contactName
            end tell
        `;

        const command = Command.create("osascript", ["-e", ascript]);
        const output = await command.execute();

        let result = null;
        if (output.code === 0 && output.stdout.trim()) {
            result = output.stdout.trim();
        }

        // Cache the result
        contactNameCache[phoneNumber] = result;
        return result;
    } catch (error) {
        console.error("Error getting contact name:", error);
        contactNameCache[phoneNumber] = null;
        return null;
    }
}

function generateOptimizedVariants(phoneNumber: string): string[] {
    // Clean the phone number
    const cleanNumber = phoneNumber.replace(/[^\d+]/g, "");
    if (cleanNumber.length < 7) return [phoneNumber];

    const variants: string[] = [];

    // Start with the cleaned number
    variants.push(cleanNumber);

    // For US/Canada numbers with +1
    if (cleanNumber.startsWith("+1") && cleanNumber.length >= 12) {
        // Version without +1
        variants.push(cleanNumber.substring(2));

        // Last 10 digits (most important for matching)
        variants.push(cleanNumber.substring(cleanNumber.length - 10));
    }
    // For 10-digit US/Canada numbers without +1
    else if (cleanNumber.length === 10 && /^\d+$/.test(cleanNumber)) {
        variants.push(`+1${cleanNumber}`);
    }

    // If the original had formatting, add it as a variant
    if (phoneNumber !== cleanNumber) {
        variants.push(phoneNumber);
    }

    // Add one common format variant for good measure
    if (
        cleanNumber.length === 10 ||
        (cleanNumber.startsWith("+1") && cleanNumber.length === 12)
    ) {
        const base =
            cleanNumber.length === 10 ? cleanNumber : cleanNumber.substring(2);
        const area = base.substring(0, 3);
        const prefix = base.substring(3, 6);
        const line = base.substring(6);
        variants.push(`(${area}) ${prefix}-${line}`);
    }

    return variants;
}

async function readMessages(
    phoneNumber: string,
    limit = 10,
): Promise<Message[]> {
    try {
        // Check database access with retries
        const hasAccess = await retryOperation(checkMessagesDBAccess);
        if (!hasAccess) {
            return [];
        }

        // Get all possible formats of the phone number
        const phoneFormats = normalizePhoneNumber(phoneNumber);
        console.error("Trying phone formats:", phoneFormats);

        // Create SQL IN clause with all phone number formats
        const phoneList = phoneFormats
            .map((p) => `'${p.replace(/'/g, "''")}'`)
            .join(",");

        const query = `
            SELECT 
                m.ROWID as message_id,
                CASE 
                    WHEN m.text IS NOT NULL AND m.text != '' THEN m.text
                    WHEN m.attributedBody IS NOT NULL THEN hex(m.attributedBody)
                    ELSE NULL
                END as content,
                datetime(m.date/1000000000 + strftime('%s', '2001-01-01'), 'unixepoch', 'localtime') as date,
                h.id as sender,
                m.is_from_me,
                m.is_audio_message,
                m.cache_has_attachments,
                m.subject,
                CASE 
                    WHEN m.text IS NOT NULL AND m.text != '' THEN 0
                    WHEN m.attributedBody IS NOT NULL THEN 1
                    ELSE 2
                END as content_type
            FROM message m 
            INNER JOIN handle h ON h.ROWID = m.handle_id 
            WHERE h.id IN (${phoneList})
                AND (m.text IS NOT NULL OR m.attributedBody IS NOT NULL OR m.cache_has_attachments = 1)
                AND m.is_from_me IS NOT NULL  -- Ensure it's a real message
                AND m.item_type = 0  -- Regular messages only
                AND m.is_audio_message = 0  -- Skip audio messages
            ORDER BY m.date DESC 
            LIMIT ${limit}
        `;

        // Execute query with retries
        const { stdout } = await retryOperation(async () => {
            const command = Command.create("sqlite3", [
                "-json",
                `${await homeDir()}/Library/Messages/chat.db`,
                query,
            ]);
            const output = await command.execute();
            return { stdout: output.stdout };
        });

        if (!stdout.trim()) {
            console.error(
                "No messages found in database for the given phone number",
            );
            return [];
        }

        const messages = JSON.parse(stdout) as (Message & {
            message_id: number;
            is_audio_message: number;
            cache_has_attachments: number;
            subject: string | null;
            content_type: number;
        })[];

        // Process messages with potential parallel attachment fetching
        const processedMessages = await Promise.all(
            messages
                .filter(
                    (msg) =>
                        msg.content !== null || msg.cache_has_attachments === 1,
                )
                .map(async (msg) => {
                    let content = msg.content || "";
                    let url: string | undefined;

                    // If it's an attributedBody (content_type = 1), decode it
                    if (msg.content_type === 1) {
                        const decoded = decodeAttributedBody(content);
                        content = decoded.text;
                        url = decoded.url;
                    } else {
                        // Check for URLs in regular text messages
                        const urlMatch = content.match(/(https?:\/\/[^\s]+)/);
                        if (urlMatch) {
                            url = urlMatch[1];
                        }
                    }

                    // Get attachments if any
                    let attachments: string[] = [];
                    if (msg.cache_has_attachments) {
                        attachments = await getAttachmentPaths(msg.message_id);
                    }

                    // Add subject if present
                    if (msg.subject) {
                        content = `Subject: ${msg.subject}\n${content}`;
                    }

                    // Get contact name for the sender
                    const contactName = await getContactName(msg.sender);

                    // Format the message object
                    const formattedMsg: Message = {
                        content: content || "[No text content]",
                        date: new Date(msg.date).toISOString(),
                        sender: msg.sender,
                        is_from_me: Boolean(msg.is_from_me),
                    };

                    // Add contact name if found
                    if (contactName) {
                        formattedMsg.sender_name = contactName;
                    }

                    // Add attachments if any
                    if (attachments.length > 0) {
                        formattedMsg.attachments = attachments;
                        formattedMsg.content += `\n[Attachments: ${attachments.length}]`;
                    }

                    // Add URL if present
                    if (url) {
                        formattedMsg.url = url;
                        formattedMsg.content += `\n[URL: ${url}]`;
                    }

                    return formattedMsg;
                }),
        );

        return processedMessages;
    } catch (error) {
        console.error("Error reading messages:", error);
        if (error instanceof Error) {
            console.error("Error details:", error.message);
            console.error("Stack trace:", error.stack);
        }
        return [];
    }
}

async function getUnreadMessages(limit = 100): Promise<Message[]> {
    try {
        // Check database access with retries
        const hasAccess = await retryOperation(checkMessagesDBAccess);
        if (!hasAccess) {
            return [];
        }

        const query = `
            SELECT 
                m.ROWID as message_id,
                CASE 
                    WHEN m.text IS NOT NULL AND m.text != '' THEN m.text
                    WHEN m.attributedBody IS NOT NULL THEN hex(m.attributedBody)
                    ELSE NULL
                END as content,
                datetime(m.date/1000000000 + strftime('%s', '2001-01-01'), 'unixepoch', 'localtime') as date,
                h.id as sender,
                m.is_from_me,
                m.is_audio_message,
                m.cache_has_attachments,
                m.subject,
                CASE 
                    WHEN m.text IS NOT NULL AND m.text != '' THEN 0
                    WHEN m.attributedBody IS NOT NULL THEN 1
                    ELSE 2
                END as content_type
            FROM message m 
            INNER JOIN handle h ON h.ROWID = m.handle_id 
            WHERE m.is_from_me = 0  -- Only messages from others
                AND m.is_read = 0   -- Only unread messages
                AND (m.text IS NOT NULL OR m.attributedBody IS NOT NULL OR m.cache_has_attachments = 1)
                AND m.is_audio_message = 0  -- Skip audio messages
                AND m.item_type = 0  -- Regular messages only
            ORDER BY m.date DESC 
            LIMIT ${limit}
        `;

        // Execute query with retries
        const { stdout } = await retryOperation(async () => {
            const command = Command.create("sqlite3", [
                "-json",
                `${await homeDir()}/Library/Messages/chat.db`,
                query,
            ]);
            const output = await command.execute();
            return { stdout: output.stdout };
        });

        console.log(stdout, "stdout");

        if (!stdout.trim()) {
            console.error("No unread messages found");
            return [];
        }

        const messages = JSON.parse(stdout) as (Message & {
            message_id: number;
            is_audio_message: number;
            cache_has_attachments: number;
            subject: string | null;
            content_type: number;
        })[];

        // Process messages with potential parallel attachment fetching
        const processedMessages = await Promise.all(
            messages
                .filter(
                    (msg) =>
                        msg.content !== null || msg.cache_has_attachments === 1,
                )
                .map(async (msg) => {
                    let content = msg.content || "";
                    let url: string | undefined;

                    // If it's an attributedBody (content_type = 1), decode it
                    if (msg.content_type === 1) {
                        const decoded = decodeAttributedBody(content);
                        content = decoded.text;
                        url = decoded.url;
                    } else {
                        // Check for URLs in regular text messages
                        const urlMatch = content.match(/(https?:\/\/[^\s]+)/);
                        if (urlMatch) {
                            url = urlMatch[1];
                        }
                    }

                    // Get attachments if any
                    let attachments: string[] = [];
                    if (msg.cache_has_attachments) {
                        attachments = await getAttachmentPaths(msg.message_id);
                    }

                    // Add subject if present
                    if (msg.subject) {
                        content = `Subject: ${msg.subject}\n${content}`;
                    }

                    // Get contact name for the sender
                    const contactName = await getContactName(msg.sender);

                    // Format the message object
                    const formattedMsg: Message = {
                        content: content || "[No text content]",
                        date: new Date(msg.date).toISOString(),
                        sender: msg.sender,
                        is_from_me: Boolean(msg.is_from_me),
                    };

                    // Add contact name if found
                    if (contactName) {
                        formattedMsg.sender_name = contactName;
                    }

                    // Add attachments if any
                    if (attachments.length > 0) {
                        formattedMsg.attachments = attachments;
                        formattedMsg.content += `\n[Attachments: ${attachments.length}]`;
                    }

                    // Add URL if present
                    if (url) {
                        formattedMsg.url = url;
                        formattedMsg.content += `\n[URL: ${url}]`;
                    }

                    return formattedMsg;
                }),
        );

        return processedMessages;
    } catch (error) {
        console.error("Error reading unread messages:", error);
        if (error instanceof Error) {
            console.error("Error details:", error.message);
            console.error("Stack trace:", error.stack);
        }
        return [];
    }
}

export default {
    readMessages,
    getUnreadMessages,
};
