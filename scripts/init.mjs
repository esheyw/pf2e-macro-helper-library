import * as helpers from "./helpers/index.mjs";
import * as macros from "./macros/index.mjs";
import * as classes from "./classes/index.mjs";
import { SETTINGS, setting } from "./settings.mjs";
import { MODULE_ID, VERIFIED_SYSTEM_VERSIONS, fu } from "./constants.mjs";
import { registerHandlebarsHelpers } from "./handlebars.mjs";
export const MODULE = () => game.modules.get(MODULE_ID);
Hooks.on("init", () => {
  const mod = MODULE();
  mod.api = {
    macros,
    classes,
  };
  //helpers go in the root of the api object
  for (const [key, helper] of Object.entries(helpers)) {
    // only fill out system specific helpers if we're in that system
    if (key.startsWith("systemhelpers_")) {
      const system = key.substring(14);
      if (game.system.id !== system) continue;
      for (const [pkey, phelper] of Object.entries(helper)) {
        mod.api[pkey] = phelper;
      }
    }
    mod.api[key] = helper;
  }

  registerHandlebarsHelpers();

  const settingManagerOptions = {
    prefix: "MHL.Setting",
    disabledResetClass: "disabled-transparent",
    // resetButtons: false,
  };
  mod.settingsManager = new classes.MHLSettingsManager(MODULE_ID, settingManagerOptions);
  //special exposure
  mod.api.mhlSetting = setting;
  mod.api.sm = mod.settingsManager;
  helpers.mhlog('test', {func: 'init'})
});
Hooks.once("i18nInit", () => {
  helpers.mhlog('test', {func: 'i18nInit'})
  const mod = MODULE();
  mod.settingsManager.registerSettings(SETTINGS);

});
Hooks.once("setup", () => {
  helpers.mhlog('test', {func: 'setup'})
  const mod = MODULE();
  if (setting("legacy-access")) game.pf2emhl = mod.api;
  if (setting("global-access")) globalThis.mhl = mod.api;
});

Hooks.once("ready", () => {
  const verifiedFor = VERIFIED_SYSTEM_VERSIONS[game.system.id] ?? false;
  if (verifiedFor && !fu.isNewerVersion(game.system.version, verifiedFor))
    helpers.MHLBanner(
      `MHL.Warning.SystemBelowVerified`,
      { version: game.system.version, verified: verifiedFor },
      { type: "warn", permanent: true }
    );
});
