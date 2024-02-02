import * as helpers from "./helpers/index.mjs";
import * as macros from "./macros/index.mjs";
import * as classes from "./classes/index.mjs";
import { registerSettings, updateSettingsCache } from "./settings.mjs";
import { MODULE_ID } from "./constants.mjs";
export const MODULE = ()=> game.modules.get(MODULE_ID)
Hooks.on("init", () => {
  game.pf2emhl = {
    macros,
    classes,
  };
  //helpers go in the root of the api object
  for (const [key, helper] of Object.entries(helpers)) {
    game.pf2emhl[key] = helper;
  }
  //shorthand when working at home
  if (game.modules.get("esheyw-transfer")?.active) {
    globalThis.mh = game.pf2emhl;
  }
  game.pf2emhl.settings = {};
  registerSettings();

  Handlebars.registerHelper("mhlocalize", (value, options) => {
    if (value instanceof Handlebars.SafeString) value = value.toString();
    const data = options.hash;
    return helpers.localize(value, data);
  });
});

Hooks.once("setup", () => {
  updateSettingsCache();
});
