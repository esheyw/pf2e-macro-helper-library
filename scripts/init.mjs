import * as helpers from "./helpers/index.mjs";
import * as macros from "./macros/index.mjs";
import * as classes from './classes/index.mjs';
import { registerSettings } from "./settings.mjs";
Hooks.on("init", () => {
  game.pf2emhl = {
    macros: {},
    classes: {},
  };
  //helpers go in the root of the api object
  for (const [key, helper] of Object.entries(helpers)) {
    game.pf2emhl[key] = helper;
  }
  //macros get their own subobject
  for (const [key, macro] of Object.entries(macros)) {
    game.pf2emhl.macros[key] = macro;
  }
  //classes also get subobjected
  for (const [key, classObj] of Object.entries(classes)) {
    game.pf2emhl.classes[key] = classObj;
  }
  //shorthand when working at home
  if (game.modules.get("esheyw-transfer")?.active) {
    globalThis.mh = game.pf2emhl;
  }
  registerSettings();
});
