import { NOTIFY } from "../constants.mjs";
import { localize } from "./stringHelpers.mjs";
export const PREFIX = "MHL";
export function localizedError(str, data = {}, { notify = null, prefix = "", log = {} } = {}) {
  notify ??= NOTIFY;
  let errorstr = "" + prefix;
  if (typeof log === "object" && Object.keys(log).length) console.error(log);
  errorstr += typeof str === "string" ? localize(str, data) : localize(`${PREFIX}.Error.Type.String`);
  if (notify) ui.notifications.error(errorstr, { console: false });
  return Error(errorstr);
}
export function localizedBanner(str, data = {}, { notify = null, prefix = "", log = {}, type="info" } = {}) {  
  const func = 'localizedBanner';
  notify ??= NOTIFY;
  if (!notify) return false;
  if (!['info','error','warn'].includes(type)) throw MHLError(`${PREFIX}.Error.BannerType`, null, {func, log:{type}})
  let bannerstr = "" + prefix;
  if (typeof log === "object" && Object.keys(log).length) console[type](log);
  if (typeof str !== "string") throw MHLError(`${PREFIX}.Error.Type.String`, {var:'str'}, {func,log:{str}});
  bannerstr += localize(str, data);
  return ui.notifications[type](bannerstr);
}
export function MHLError(
  str,
  data = {},
  { notify = null, prefix = "MacroHelperLibrary: ", log = {}, func = null } = {}
) {
  if (func && typeof func === "string") prefix += func;
  return localizedError(str, data, { notify, prefix });
}
