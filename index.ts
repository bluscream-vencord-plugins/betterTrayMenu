/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { isPluginEnabled, plugins, pluginRequiresRestart, startPlugin, stopPlugin } from "@api/PluginManager";
import { definePluginSettings, Settings } from "@api/Settings";
import { Logger } from "@utils/Logger";
import { sleep } from "@utils/misc";
import definePlugin, { OptionType } from "@utils/types";
import { ChannelActions, ChannelStore, MediaEngineStore, NavigationRouter, SelectedChannelStore, showToast, UserStore, VoiceActions } from "@webpack/common";

const logger = new Logger("BetterTrayMenu");

const PATTERNS = {
    /** Plugin providing the tray API; looked up at runtime, never imported. */
    nativeUtils: "NativeUtils",
    owner: "BetterTrayMenu",
    ids: {
        mute: "mute",
        deafen: "deafen",
        channel: "voice-channel",
        disconnect: "disconnect",
        account: "account",
        reload: "reload",
        pluginPrefix: "plugin:"
    },
    /** NativeUtils tray positions: the very top, and directly before Equibop's Restart item. */
    positions: { top: "top", beforeRestart: "beforeRestart" },
    dmGuild: "@me",
    listSeparator: ",",
    maxLabelLength: 100,
    maxPluginToggles: 10,
    /** Wait before checking again when NativeUtils is unavailable or a call failed. */
    retryDelayMs: 5000
};

const settings = definePluginSettings({
    account: { type: OptionType.BOOLEAN, description: "Show which account you're logged in as at the top of the tray menu.", default: true, onChange: () => updateTray() },
    reload: { type: OptionType.BOOLEAN, description: "Show Reload right before Restart in the tray menu. It reloads the Discord window.", default: true, onChange: () => updateTray() },
    mute: { type: OptionType.BOOLEAN, description: "Show a Mute toggle in the tray menu.", default: true, onChange: () => updateTray() },
    deafen: { type: OptionType.BOOLEAN, description: "Show a Deafen toggle in the tray menu.", default: true, onChange: () => updateTray() },
    voiceChannel: { type: OptionType.BOOLEAN, description: "Show your current voice channel in the tray menu. Clicking it opens the channel.", default: true, onChange: () => updateTray() },
    disconnect: { type: OptionType.BOOLEAN, description: "Show Disconnect in the tray menu while you're in voice.", default: true, onChange: () => updateTray() },
    plugins: { type: OptionType.STRING, description: "Comma separated plugin names to toggle from the tray menu.", default: "", onChange: () => updateTray() }
});

interface TrayItem {
    id: string;
    label: string;
    type: "normal" | "checkbox" | "separator";
    checked?: boolean;
    enabled?: boolean;
    position?: string;
}

let running = false;
let lastItems = "";

function nativeUtils() {
    if (IS_WEB || !isPluginEnabled(PATTERNS.nativeUtils)) return undefined;
    const helpers = VencordNative.pluginHelpers[PATTERNS.nativeUtils];
    return helpers?.setTrayItems && helpers.waitTrayClick ? helpers : undefined;
}

function voiceChannel() {
    const id = SelectedChannelStore.getVoiceChannelId();
    return id ? ChannelStore.getChannel(id) : undefined;
}

function pluginNames() {
    return settings.store.plugins.split(PATTERNS.listSeparator).map(name => name.trim()).filter(name => name in plugins);
}

function buildItems(): TrayItem[] {
    const { mute, deafen, voiceChannel: showChannel, disconnect, account, reload } = settings.store;
    const items: TrayItem[] = [];
    const user = UserStore.getCurrentUser();
    if (account && user) items.push({ id: PATTERNS.ids.account, label: `User: @${user.username}`.slice(0, PATTERNS.maxLabelLength), type: "normal", enabled: false, position: PATTERNS.positions.top });
    if (reload) items.push({ id: PATTERNS.ids.reload, label: "Reload", type: "normal", position: PATTERNS.positions.beforeRestart });
    if (mute) items.push({ id: PATTERNS.ids.mute, label: "Mute", type: "checkbox", checked: MediaEngineStore.isSelfMute() });
    if (deafen) items.push({ id: PATTERNS.ids.deafen, label: "Deafen", type: "checkbox", checked: MediaEngineStore.isSelfDeaf() });

    const channel = voiceChannel();
    if (channel && showChannel) items.push({ id: PATTERNS.ids.channel, label: `In voice: ${channel.name || "Call"}`.slice(0, PATTERNS.maxLabelLength), type: "normal" });
    if (channel && disconnect) items.push({ id: PATTERNS.ids.disconnect, label: "Disconnect", type: "normal" });

    const names = pluginNames().slice(0, PATTERNS.maxPluginToggles);
    if (names.length && items.some(item => !item.position)) items.push({ id: "", label: "", type: "separator" });
    for (const name of names) {
        const restart = pluginRequiresRestart(plugins[name]) ? " (restart)" : "";
        items.push({ id: PATTERNS.ids.pluginPrefix + name, label: `${name}${restart}`.slice(0, PATTERNS.maxLabelLength), type: "checkbox", checked: isPluginEnabled(name) });
    }
    return items;
}

function updateTray() {
    const native = nativeUtils();
    if (!running || !native) return;
    const items = buildItems();
    const key = JSON.stringify(items);
    if (key === lastItems) return;
    lastItems = key;
    native.setTrayItems(PATTERNS.owner, items).catch(e => {
        lastItems = "";
        logger.warn("Updating the tray failed", e);
    });
}

function togglePlugin(name: string) {
    const plugin = plugins[name];
    const enabled = !isPluginEnabled(name);
    Settings.plugins[name].enabled = enabled;
    if (pluginRequiresRestart(plugin)) {
        showToast({ text: `${name} ${enabled ? "enabled" : "disabled"}. Restart Discord to apply.` });
        return;
    }
    const ok = enabled ? startPlugin(plugin) : stopPlugin(plugin);
    if (!ok) showToast({ text: `Couldn't ${enabled ? "start" : "stop"} ${name}.`, variant: "critical" });
}

function onClick(id: string) {
    switch (id) {
        case PATTERNS.ids.mute: return VoiceActions.toggleSelfMute();
        case PATTERNS.ids.deafen: return VoiceActions.toggleSelfDeaf();
        case PATTERNS.ids.disconnect: return ChannelActions.disconnect();
        case PATTERNS.ids.reload: return location.reload();
        case PATTERNS.ids.channel: {
            const channel = voiceChannel();
            if (!channel) return;
            VesktopNative?.win?.focus?.();
            return NavigationRouter.transitionTo(`/channels/${channel.guild_id ?? PATTERNS.dmGuild}/${channel.id}`);
        }
    }
    if (id.startsWith(PATTERNS.ids.pluginPrefix)) togglePlugin(id.slice(PATTERNS.ids.pluginPrefix.length));
}

async function clickLoop() {
    while (running) {
        const native = nativeUtils();
        if (!native) {
            lastItems = "";
            await sleep(PATTERNS.retryDelayMs);
            continue;
        }
        updateTray();
        try {
            const id = await native.waitTrayClick(PATTERNS.owner);
            if (running && typeof id === "string") onClick(id);
        } catch (e) {
            logger.warn("Waiting for tray clicks failed", e);
            lastItems = "";
            await sleep(PATTERNS.retryDelayMs);
        }
    }
}

export default definePlugin({
    name: "BetterTrayMenu",
    description: "Adds your account, Mute, Deafen, your voice channel, Disconnect, Reload and plugin toggles to Equibop's tray menu. Needs the NativeUtils plugin; without it this does nothing.",
    authors: [
        { name: "Bluscream", id: 467777925790564352n },
        { name: "Claude Opus 5.5", id: 0n }
    ],
    settings,

    flux: {
        AUDIO_TOGGLE_SELF_MUTE: updateTray,
        AUDIO_TOGGLE_SELF_DEAF: updateTray,
        VOICE_CHANNEL_SELECT: updateTray,
        RTC_CONNECTION_STATE: updateTray,
        CONNECTION_OPEN: updateTray,
        CURRENT_USER_UPDATE: updateTray
    },

    start() {
        running = true;
        lastItems = "";
        clickLoop();
    },

    stop() {
        running = false;
        lastItems = "";
        nativeUtils()?.setTrayItems(PATTERNS.owner, []).catch(e => logger.warn("Clearing the tray failed", e));
    }
});
