// Bundled by build-web.mjs into www/js/capacitor-plugins.js (app only).
// Exposes the native plugins to multi-timer/js/native.js without a bundler in the web code.
import { Capacitor, SystemBars } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Filesystem } from "@capacitor/filesystem";
import { Haptics } from "@capacitor/haptics";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Preferences } from "@capacitor/preferences";
import { Share } from "@capacitor/share";
import { KeepAwake } from "@capacitor-community/keep-awake";

window.CapPlugins = { Capacitor, SystemBars, App, Filesystem, Haptics, LocalNotifications, Preferences, Share, KeepAwake };
