import { fu } from "../constants.mjs";
import { MHLError } from "./errorHelpers.mjs";
import { prependIndefiniteArticle, capitalize } from "./stringHelpers.mjs";

//root: root folder of the structure to update
//exemplar: document to copy ownership structure of
export async function applyOwnshipToFolderStructure(root, exemplar) {
  const ids = getIDsFromFolder(root); // handles type checking of root
  const updates = ids.map((id) => fu.flattenObject({ _id: id, ownership: exemplar.ownership }));
  const dc = CONFIG[root.type].documentClass;
  console.warn({dc, root})
  await dc.updateDocuments(updates);
}

// flat list of all document IDs under a given folder structure
export function getIDsFromFolder(root) {
  if (!(root instanceof Folder)) {
    if (typeof root === 'string') root = game.folders.get(root);
    if (!root) throw MHLError('MHL.Error.Type.Folder', { var: 'root' }, { func: 'getIDsFromFolder' });
  }
  return root.contents.concat(root.getSubfolders(true).flatMap(f => f.contents)).map(c => c.id);
}
export function isOwnedBy(doc, user) {
  //partially lifted from warpgate
  const corrected = doc instanceof TokenDocument ? doc.actor : doc instanceof Token ? doc.document.actor : doc;
  const userID = user.id ?? user;
  if (corrected.ownership[userID] === 3) return true;
  return false;
}

export async function pickAThingDialog({ things = null, title = null, thingType = "Item", dialogOptions = {} } = {}) {
  const PREFIX = "MHL.PickAThing";
  if (!Array.isArray(things)) {
    throw MHLError(`${PREFIX}.Error.ThingsFormat`);
  }
  const buttons = things.reduce((acc, curr) => {
    let buttonLabel = ``;
    if (!("label" in curr && "value" in curr)) {
      throw MHLError(`${PREFIX}.Error.MalformedThing`, null, { log: { badthing: curr } });
    }
    if (curr?.img) {
      buttonLabel += `<img src="${curr.img}" alt="${curr.label}" data-tooltip="${curr?.indentifier ?? curr.label}" />`;
    }
    buttonLabel += `<span class="item-name">${curr.label}</span>`;
    if (curr?.identifier) {
      buttonLabel += `<span class="dupe-id">(${curr.identifier})</span>`;
    }
    acc[curr.value] = { label: buttonLabel };
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
    title: title ?? `Pick ${prependIndefiniteArticle(capitalize(thingType) ?? "Thing")}`,
    // content: dialogStyle,
    buttons,
    close: () => false,
  };
  return await Dialog.wait(dialogData, dialogOptions);
}

