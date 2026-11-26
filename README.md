# BetterTrayMenu

Equicord user plugin: adds your account, voice controls, a reload item and plugin toggles to Equibop's tray menu.

**Needs the [NativeUtils](https://github.com/bluscream-vencord-plugins/nativeUtils) plugin**, installed and enabled. Without it this plugin does nothing.

| Item | What it does |
| --- | --- |
| User: @*name* | At the very top: the account you're logged in as. Not clickable; updates when you switch accounts. |
| Mute / Deafen | Checkboxes that show and toggle your mute and deafen state. |
| In voice: *channel* | Your current voice channel. Clicking it focuses Discord and opens the channel. |
| Disconnect | Leaves voice. Only shown while you're in voice. |
| Plugin toggles | One checkbox per plugin listed in the *plugins* setting (comma separated names, up to 10). Plugins that patch Discord's code need a restart; their label says so. |

| Reload | Directly before Equibop's Restart: reloads the Discord window, without restarting the app. |

Each item can be turned off in the settings. The voice items and plugin toggles go in a block above Restart and Quit. To move, rename or hide any tray item, including Equibop's own, use the [MenuCustomisation](https://github.com/bluscream-vencord-plugins/menuCustomisation) plugin's tray menu editor.

## Install

```sh
cd src/userplugins
git clone https://github.com/bluscream-vencord-plugins/nativeUtils
git clone https://github.com/bluscream-vencord-plugins/betterTrayMenu
```

Rebuild Equicord, enable NativeUtils and BetterTrayMenu, and restart Discord fully.
