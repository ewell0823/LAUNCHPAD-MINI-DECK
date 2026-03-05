#!/bin/bash
# Installs the Launchpad companion server as a macOS LaunchAgent (auto-start on login)

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$SCRIPT_DIR/LaunchpadCompanion.app"
APP_EXEC="$APP_DIR/Contents/MacOS/run"
RESOURCES_DIR="$APP_DIR/Contents/Resources"
PLIST_NAME="com.launchpad-editor.companion"
PLIST_PATH="$HOME/Library/LaunchAgents/$PLIST_NAME.plist"
LOG_DIR="$HOME/Library/Logs/launchpad-companion"

# Copy latest server.mjs into .app bundle
mkdir -p "$RESOURCES_DIR"
cp "$SCRIPT_DIR/server.mjs" "$RESOURCES_DIR/server.mjs"

mkdir -p "$HOME/Library/LaunchAgents"
mkdir -p "$LOG_DIR"

cat > "$PLIST_PATH" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$PLIST_NAME</string>
    <key>ProgramArguments</key>
    <array>
        <string>$APP_EXEC</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$LOG_DIR/stdout.log</string>
    <key>StandardErrorPath</key>
    <string>$LOG_DIR/stderr.log</string>
</dict>
</plist>
EOF

# Load the agent
launchctl unload "$PLIST_PATH" 2>/dev/null || true
launchctl load "$PLIST_PATH"

echo "Installed and started LaunchAgent: $PLIST_NAME"
echo "  App:  $APP_DIR"
echo "  Logs: $LOG_DIR/"
echo ""
echo "The companion server will now auto-start on login."
echo ""
echo "IMPORTANT: Add 'LaunchpadCompanion' to:"
echo "  System Settings > Privacy & Security > Accessibility"
echo "To uninstall: bash $SCRIPT_DIR/uninstall-launchagent.sh"
