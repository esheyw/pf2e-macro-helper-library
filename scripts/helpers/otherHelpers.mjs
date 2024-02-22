import { fu } from "../constants.mjs";
import { MHLError, mhlog } from "./errorHelpers.mjs";
import { localize, prependIndefiniteArticle } from "./stringHelpers.mjs";
import { MHLDialog } from "../classes/MHLDialog.mjs";

//root: root folder of the structure to update
//exemplar: document to copy ownership structure of
export async function applyOwnshipToFolderStructure(root, exemplar) {
  const ids = getIDsFromFolder(root); // handles type checking of root
  const updates = ids.map((id) => fu.flattenObject({ _id: id, ownership: exemplar.ownership }));
  const dc = CONFIG[root.type].documentClass;
  console.warn({ dc, root });
  await dc.updateDocuments(updates);
}

// flat list of all document IDs under a given folder structure
export function getIDsFromFolder(root) {
  if (!(root instanceof Folder)) {
    if (typeof root === "string") root = game.folders.get(root);
    if (!root) throw MHLError("MHL.Error.Type.Folder", { var: "root" }, { func: "getIDsFromFolder" });
  }
  return root.contents.concat(root.getSubfolders(true).flatMap((f) => f.contents)).map((c) => c.id);
}
export function isOwnedBy(doc, user) {
  //partially lifted from warpgate
  const corrected = doc instanceof TokenDocument ? doc.actor : doc instanceof Token ? doc.document.actor : doc;
  const userID = user.id ?? user;
  if (corrected.ownership[userID] === 3) return true;
  return false;
}

export function doc(input, type, parent=null) {
  let doc; 
  parent ??= game;
  if (typeof type === 'string') type = getDocumentClass(type);
  if (typeof type !== 'function') return undefined;
  if (input instanceof type) return input;
  if (typeof input === "string") {
    if (input.startsWith('Compendium')) {
      doc = fromUuidSync(input);
      if (doc instanceof type) return doc;
      return undefined;
    }
    if (/^[A-Z][a-z]+(\.[-a-zA-Z0-9])+/.test(input)) {
      doc = fromUuidSync(input);
      if (doc instanceof type) return doc;
    }
    const collection = parent[type.collectionName] 
    if (/^[a-z0-9]{16}$/i.test(input)) {
      doc = collection.get(input);
      if (doc instanceof type) return doc;
    }
    doc = collection.getName(input);
    if (doc instanceof type) return doc;
  }
  return undefined;
}

export function isRealGM(user) {
  user = doc(user, User);
  if (!user) return false;
  return user.role === CONST.USER_ROLES.GAMEMASTER;
}

export function activeRealGM() {
  const activeRealGMs = game.users.filter(u=> u.active && isRealGM(u));
  activeRealGMs.sort((a, b) => a.id > b.id ? 1 : -1);
  return activeRealGMs[0] || null
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
  dialogOptions.classes ??= [];
  dialogOptions.classes.push("pick-a-thing");
  const dialogData = {
    title: title ?? `Pick ${prependIndefiniteArticle(thingType.capitalize() ?? "Thing")}`,
    buttons,
    close: () => false,
  };
  return await MHLDialog.wait(dialogData, dialogOptions);
}
