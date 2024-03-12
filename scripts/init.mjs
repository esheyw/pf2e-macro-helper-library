import * as helpers from "./helpers/index.mjs";
import * as macros from "./macros/index.mjs";
import * as classes from "./classes/index.mjs";
import { setting, registerSettings, updateSettingsCache } from "./settings.mjs";
import { MODULE_ID } from "./constants.mjs";
export const MODULE = () => game.modules.get(MODULE_ID);
Hooks.on("init", () => {
  if (game.modules.get("macro-helper-library")?.active) return;
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

Hooks.once("ready", () => {
  if (game.user !== game.users.activeGM) return;
  if (game.modules.get("macro-helper-library")?.active) {
    ui.notifications.error(
      "PF2e Macro & Helper Library | You have this module's successor active, disabling self, please uninstall at your convenience.",
      { permanent: true }
    );
  } else if (!setting("acknowledged-deprecation")) {
    ui.notifications.error("This module has been superceded by Macro & Helper Library, see chat for details.", {
      permanent: true,
    });
    const messageData = {
      whisper: [game.user.id],
      content: `<h3>PF2e Macro & Helper Library is Retired</h3><p>
    This module has been superceded by <a href="https://github.com/esheyw/macro-helper-library">Macro & Helper Library</a>, which is system agnostic, and where all future development will be done. <br>
    PF2e-MHL should remain functional as-is, but will not be maintained to work with future foundry or system versions, and you are advised to transition to the new module at your earliest convenience.<br>
    Any existing macros utilizing helpers retrieved via <code>game.pf2emhl</code> will not work out of the box, but can be made functional again by enabling new-MHL's <code>Legacy Access</code> setting.<br>
    If you have any transition issues I haven't foreseen, please make an issue on either module's repo, I'll still be checking both.<br>
    @UUID[Compendium.pf2e-macro-helper-library.helper-library-macros.Macro.RCmDAw1JsdIyWm2U]{Acknowledge Deprecation}
    </p>`,
      flags: {
        "pf2e-macro-helper-library": {
          closingRelease: true,
        },
      },
    };
    const existing = game.messages.find((m) => m?.flags?.["pf2e-macro-helper-library"]?.closingRelease);
    if (existing) {
      if (existing.id !== game.messages.contents.at(-1)?.id) {
        existing.delete();
        ChatMessage.create(messageData);
      }
    } else {
      ChatMessage.create(messageData);
    }
  }
});
