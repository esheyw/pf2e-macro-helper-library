export function isOwnedBy(doc, user) {
  //partially lifted from warpgate
  const corrected = doc instanceof TokenDocument ? doc.actor : doc instanceof Token ? doc.document.actor : doc;
  const userID = user.id ?? user;
  if (corrected.ownership[userID] === 3) return true;
  return false;
}