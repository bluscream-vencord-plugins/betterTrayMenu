# BetterTrayMenu

Equicord user plugin: adds voice controls and plugin toggles to Equibop's tray menu, above Restart and Quit.

**Needs the [NativeUtils](https://github.com/bluscream-vencord-plugins/nativeUtils) plugin**, installed and enabled. Without it this plugin does nothing.

| Item | What it does |
| --- | --- |
| Mute / Deafen | Checkboxes that show and toggle your mute and deafen state. |
| In voice: *channel* | Your current voice channel. Clicking it focuses Discord and opens the channel. |
| Disconnect | Leaves voice. Only shown while you're in voice. |
| Plugin toggles | One checkbox per plugin listed in the *plugins* setting (comma separated names, up to 10). Plugins that patch Discord's code need a restart; their label says so. |

Each item can be turned off in the settings.

## Install

```sh
cd src/userplugins
git clone https://github.com/bluscream-vencord-plugins/nativeUtils
git clone https://github.com/bluscream-vencord-plugins/betterTrayMenu
```

Rebuild Equicord, enable NativeUtils and BetterTrayMenu, and restart Discord fully.
