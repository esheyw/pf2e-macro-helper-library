export const MODULE = 'pf2e-macro-helper-library';
export const NOTIFY = () => game.settings.get(MODULE,'notify-on-error');
export const PHYSICAL_ITEM_TYPES = ["armor", "backpack", "book", "consumable", "equipment", "shield", "treasure", "weapon"];
export const fu = foundry.utils;
