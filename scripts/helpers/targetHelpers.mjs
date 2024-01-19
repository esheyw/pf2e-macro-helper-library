import { MHLError, localizedBanner } from "./errorHelpers.mjs";
const PREFIX = `MHL.Target`;
export function oneTargetOnly(useFirst = false, user = game.user) {
  const targets = anyTargets(user);
  if (targets.size > 1) {
    // if it was 0 it got caught by anyTargets
    if (useFirst) {
      localizedBanner(`${PREFIX}.Info.Fallback`, { name: targets.first().name });
      return targets.first();
    }
    throw MHLError(`${PREFIX}.Error.NotOneTargetted`);
  }
  return targets.first();
}
export function anyTargets(user = game.user) {
  if (typeof user === 'string') user = game.users.get(user) ?? game.users.getName(user);
  if (!(user instanceof User)) {
    throw MHLError(`MHL.Error.Type.User`, {var:'user'}, { log: { user } });
  }
  if (user.targets.size === 0) {
    throw MHLError(`${PREFIX}.Error.NotAnyTargetted`);
  }
  return user.targets;
}
