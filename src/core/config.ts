// Environment detection
const isDev = import.meta.env.DEV;

const DB_URL = "sqlite:chats.db";

// Note: meltyProxyUrl is kept for backwards compatibility with feedback submission
// It can be removed once feedback is handled differently
const MELTY_PROXY_URL = "https://app.chorus.sh";

export const config = {
    analyticsEnabled: false,
    updaterEnabled: false,
    dbUrl: DB_URL,
    meltyProxyUrl: MELTY_PROXY_URL,
} as const;
