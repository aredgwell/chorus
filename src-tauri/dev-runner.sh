#!/usr/bin/env bash
# Signs the dev binary with a stable identity before launching,
# so macOS keychain "Always Allow" persists across rebuilds.
#
# Used as the Cargo runner in dev mode via .cargo/config.toml.
# Requires APPLE_SIGNING_IDENTITY to be set in the environment.

BINARY="$1"
shift

if [ -n "$APPLE_SIGNING_IDENTITY" ]; then
    codesign --force --sign "$APPLE_SIGNING_IDENTITY" "$BINARY" 2>/dev/null
fi

exec "$BINARY" "$@"
