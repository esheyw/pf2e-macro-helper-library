export const MODULE_ID = "pf2e-macro-helper-library";
export const PHYSICAL_ITEM_TYPES = [
  "armor",
  "backpack",
  "book",
  "consumable",
  "equipment",
  "shield",
  "treasure",
  "weapon",
];
export const fu = foundry.utils;
export const CONSOLE_TYPES = ["debug", "info", "warn", "error"];
export const BANNER_TYPES = CONSOLE_TYPES.slice(1);
export const COLOURS = {
  error: "var(--color-level-error, red)",
};
export const LABELABLE_TAGS = ["button", "input", "meter", "output", "progress", "select", "textarea"];
export const SETTINGS = {
  "notify-on-error": {
    config: true,
    default: true,
    hint: "MHL.Settings.NotifyOnError.Hint",
    name: "MHL.Settings.NotifyOnError.Name",
    scope: "client",
    type: Boolean,
  },
  "acknowledged-deprecation": {
    config: true,
    default: false,
    type: Boolean,
    scope: "world",
    name: "MHL.Settings.Deprecation.Name",
    hint: "MHL.Settings.Deprecation.Hint",
  },
};
