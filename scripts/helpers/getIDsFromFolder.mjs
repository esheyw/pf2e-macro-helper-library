// flat list of all document IDs under a given folder structure
import { MHLError } from "./helpers.mjs"
export function getIDsFromFolder(root) {
  if (!(root instanceof Folder)) {
    if (typeof root === 'string') root = game.folders.get(root);
    if (!root) throw MHLError('MHL.Error.Type.Folder', {var:'root'}, {func:'getIDsFromFolder'})
  }
  return root.contents.concat(root.getSubfolders(true).flatMap(f => f.contents)).map(c=>c.id)
}