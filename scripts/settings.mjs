import { MODULE } from "./constants.mjs";
import { localize } from "./helpers/stringHelpers.mjs";
export function registerSettings() {
  game.settings.register(MODULE, "notify-on-error", {
    config: true,
    default: true,
    hint: localize("MHL.Settings.NotifyOnError.Hint"),
    name: localize("MHL.Settings.NotifyOnError.Name"),
    scope: "client",
    type: Boolean,
  });
}
export const NOTIFY = () => game.settings.get(MODULE, 'notify-on-error');