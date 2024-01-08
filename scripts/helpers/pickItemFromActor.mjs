import { pickAThingDialog } from "./pickAThingDialog.mjs";
import { MHLError, prependArticle } from "./helpers.mjs";
import { PHYSICAL_ITEM_TYPES } from "../constants.mjs";
const PREFIX = "MHL.PickItemFromActor";
export async function pickItemFromActor(
  actor,
  { itemType = null, otherFilter = null, held = false, title = null, dialogOptions = {}, errorIfEmpty = true } = {}
) {
  let filteredItems = [];

  if (!itemType || itemType === "physical") {
    itemType ??= "physical (default)"; // for error display purposes
    filteredItems = actor.items.filter((i) => PHYSICAL_ITEM_TYPES.includes(i.type)) ?? [];
  } else {
    filteredItems = actor.items.filter((i) => i.type === itemType) ?? [];
  }
  if (!filteredItems.length) {
    if (errorIfEmpty) throw MHLError(`${PREFIX}.Error.NoItemsOfType`, { itemType });
    return null;
  }

  if (otherFilter && typeof otherFilter === "function") {
    filteredItems = filteredItems.filter(otherFilter);
    if (!filteredItems.length) {
      if (errorIfEmpty) throw MHLError(`${PREFIX}.Error.FilterUnmatched`, null, { log: { filter: otherFilter } });
      return null;
    }
  }

  if (held) {
    filteredItems = filteredItems.filter((i) => i.system.equipped.carryType === "held") ?? [];
    if (!filteredItems.length) {
      if (errorIfEmpty) throw MHLError(`${PREFIX}.Error.NoMatchingHeld`);
      return null;
    }
  }

  if (filteredItems.length === 1) return filteredItems[0];

  const names = {};
  for (const item of filteredItems) {
    names[item.name] ??= 0;
    names[item.name]++;
  }
  const things = filteredItems.map((i) => {
    return {
      name: i.name,
      value: i.id,
      img: i.img,
      identifier: names[i.name] > 1 ? i.id : null,
    };
  });
  title ??= `Select ${prependArticle(itemType)}`.titleCase();

  const response = await pickAThingDialog({ things, title });
  return actor.items.get(response);
}
