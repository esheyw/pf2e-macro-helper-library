import { MHLError, localize } from "./helpers.mjs";
import { NOTIFY } from "../constants.mjs"; // usually localizedError handles this, but infos aren't errors
const PREFIX = `MHL.Target`;
export function oneTargetOnly(user = game.user, useFirst = false) {
  const targets = anyTargets(user);
  if (targets.size > 1) {
    // if it was 0 it got caught by anyTargets
    if (useFirst) {
      if (NOTIFY) ui.notifications.info(localize(`${PREFIX}.Info.Fallback`, { name: targets.first().name }));
      return targets.first();
    }
    throw MHLError(`${PREFIX}.Error.NotOneTargetted`);
  }
  return targets.first();
}
export function anyTargets(user = game.user) {
  if (!(user instanceof User)) {
    throw MHLError(`MHL.User.Error.NotAUser`, null, { log: { user } });
  }
  if (user.targets.size === 0) {
    throw MHLError(`${PREFIX}.Error.NotAnyTargetted`);
  }
  return user.targets;
}
