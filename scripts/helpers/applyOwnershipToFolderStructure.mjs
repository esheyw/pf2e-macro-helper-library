//root: root folder of the structure to update
//exemplar: document to copy ownership structure of
import { getIDsFromFolder } from "./getIDsFromFolder.mjs";
import { fu } from "../constants.mjs";
export async function applyOwnshipToFolderStructure(root, exemplar) {
  const ids = getIDsFromFolder(root); // handles type checking of root
  const updates = ids.map((id) => fu.flattenObject({ _id: id, ownership: exemplar.ownership }));
  const dc = CONFIG[root.type].documentClass;
  await dc.updateDocuments(updates);
}
