import { MHLError } from "./helpers.mjs";
import { fu } from "../constants.mjs";
const PREFIX = "MHL.PickAThing";
export async function pickAThingDialog({ things = null, title = null, thingType = "Item", dialogOptions = {} } = {}) {
  if (!Array.isArray(things)) {
    throw MHLError(`${PREFIX}.Error.ThingsFormat`);
  }
  const buttons = things.reduce((acc, curr) => {
    let label = ``;
    if (!("name" in curr && "value" in curr)) {
      throw MHLError(`${PREFIX}.Error.MalformedThing`, null, { log:{badthing: curr }});
    }
    if (curr?.img) {
      label += `<img src="${curr.img}" alt="${curr.name}" data-tooltip="${curr?.indentifier ?? curr.name}" />`;
    }
    label += `<span class="item-name">${curr.name}</span>`;
    if (curr?.identifier) {
      label += `<span class="dupe-id">(${curr.identifier})</span>`;
    }
    acc[curr.value] = { label };
    return acc;
  }, {});
  dialogOptions = fu.mergeObject(
    {
      jQuery: false,
      classes: ["pick-a-thing"],
    },
    dialogOptions
  );
  const dialogData = {
    title: title ?? `Pick a ${thingType ?? "Thing"}`,
    // content: dialogStyle,
    buttons,
    close: () => false,
  };
  return await Dialog.wait(dialogData, dialogOptions);
}
