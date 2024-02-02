import { BANNER_TYPES, CONSOLE_TYPES } from "../constants.mjs";
import { setting } from "../settings.mjs";
import { localize } from "./stringHelpers.mjs";

export function localizedError(str, data = {}, { notify = null, prefix = "", log = {} } = {}) {
  notify ??= setting('notify-on-error');
  let errorstr = "" + prefix;
  if (typeof log === "object" && Object.keys(log).length) mhlog(log, "error");
  if (typeof str !== "string") {
    throw MHLError(`MHL.Error.Type.String`, { var: "str" }, { func: "localizedError", log: { str } });
  }
  errorstr += localize(str, data);
  if (notify) ui.notifications.error(errorstr, { console: false });
  return Error(errorstr);
}

export function localizedBanner(
  str,
  data = {},
  { notify = null, prefix = "", log = {}, type = "info", console = true } = {}
) {
  const func = "localizedBanner";
  notify ??= setting('notify-on-error');
  if (!notify) return false;
  if (!BANNER_TYPES.includes(type)) throw MHLError(`MHL.Error.BannerType`, null, { func, log: { type } });
  let bannerstr = "" + prefix;
  if (typeof log === "object" && Object.keys(log).length) mhlog(log, type);
  if (typeof str !== "string") {
    throw MHLError(`MHL.Error.Type.String`, { var: "str" }, { func, log: { str } });
  }
  bannerstr += localize(str, data);
  return ui.notifications[type](bannerstr, { console });
}

export function MHLError(str, data = {}, { notify = null, prefix = "MHL | ", log = {}, func = null } = {}) {
  if (func && typeof func === "string") prefix += `${func} | `;
  return localizedError(str, data, { notify, prefix, log });
}

export function log(loggable, type = null, prefix = null) {
  type ??= "debug";
  if (!CONSOLE_TYPES.includes(type)) {
    throw MHLError(`MHL.Error.LogTypes`, { types: BANNER_TYPES.join(", ") }, { func: "log", log: { type } });
  }
  prefix ??= "";
  return console[type](prefix, loggable);
}

export function mhlog(loggable, type = null, prefix = "MHL | ") {
  return log(loggable, type, prefix);
}
