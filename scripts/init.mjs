import * as helpers from "./helpers/index.mjs";
import * as macros from "./macros/index.mjs";
import { MODULE } from "./constants.mjs";
import { registerSettings } from "./settings.mjs";
const { MHLError, localize } = helpers;
Hooks.on("init", () => {
  game.pf2emhl = {
    macros: {},
  };
  //helpers go in the root of the api object
  for (const [key, helper] of Object.entries(helpers)) {
    game.pf2emhl[key] = helper;
  }
  //macros get their own subobject
  for (const [key, macro] of Object.entries(macros)) {
    game.pf2emhl.macros[key] = macro;
  }
  //shorthand when working at home
  if (game.modules.get("esheyw-transfer")?.active) {
    globalThis.mh = game.pf2emhl;
  }

  registerSettings();
});
