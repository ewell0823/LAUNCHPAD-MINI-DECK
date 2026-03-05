#!/bin/bash
# Uninstalls the Launchpad companion server LaunchAgent

PLIST_NAME="com.launchpad-editor.companion"
PLIST_PATH="$HOME/Library/LaunchAgents/$PLIST_NAME.plist"

if [ -f "$PLIST_PATH" ]; then
    launchctl unload "$PLIST_PATH" 2>/dev/null || true
    rm "$PLIST_PATH"
    echo "Uninstalled LaunchAgent: $PLIST_NAME"
else
    echo "LaunchAgent not found: $PLIST_PATH"
fi
