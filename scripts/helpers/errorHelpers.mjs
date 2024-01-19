import { BANNER_TYPES, CONSOLE_TYPES } from "../constants.mjs";
import { NOTIFY } from "../settings.mjs";
import { localize } from "./stringHelpers.mjs";

export function localizedError(str, data = {}, { notify = null, prefix = "", log = {} } = {}) {
  notify ??= NOTIFY();
  let errorstr = "" + prefix;
  if (typeof log === "object" && Object.keys(log).length) mhlog(log, "error");
  if (typeof str !== "string") {
    throw MHLError(`MHL.Error.Type.String`, { var: "str" }, { func: "localizedError", log: { str } });
  }
  errorstr += localize(str, data);
  if (notify) ui.notifications.error(errorstr, { console: false });
  return Error(errorstr);
}

export function localizedBanner(str, data = {}, { notify = null, prefix = "", log = {}, type = "info", console=true} = {}) {
  const func = "localizedBanner";
  notify ??= NOTIFY();
  if (!notify) return false;
  if (!BANNER_TYPES.includes(type)) throw MHLError(`MHL.Error.BannerType`, null, { func, log: { type } });
  let bannerstr = "" + prefix;
  if (typeof log === "object" && Object.keys(log).length) mhlog(log,type);
  if (typeof str !== "string") {
    throw MHLError(`MHL.Error.Type.String`, { var: "str" }, { func, log: { str } });
  }
  bannerstr += localize(str, data);
  return ui.notifications[type](bannerstr, {console});
}

export function MHLError(
  str,
  data = {},
  { notify = null, prefix = "MHL | ", log = {}, func = null } = {}
) {
  if (func && typeof func === "string") prefix += func;
  return localizedError(str, data, { notify, prefix, log });
}

// taken from https://stackoverflow.com/a/32728075, slightly modernized
/**
 * Checks if value is empty. Deep-checks arrays and objects
 * Note: isEmpty([]) == true, isEmpty({}) == true, isEmpty([{0:false},"",0]) == true, isEmpty({0:1}) == false
 * @param value
 * @returns {boolean}
 */
export function isEmpty(value) {
  const isEmptyObject = (a) => {
    if (!Array.isArray(a)) {
      // it's an Object, not an Array
      const hasNonempty = Object.keys(a).some((e) => !isEmpty(a[e]));
      return hasNonempty ? false : isEmptyObject(Object.keys(a));
    }
    return !a.some((e) => !isEmpty(e));
  };
  return (
    value == false ||
    typeof value === "undefined" ||
    value == null ||
    (typeof value === "object" && isEmptyObject(value))
  );
}

export function log(loggable, type = null, prefix = null) {
  type ??= "debug";
  if (!CONSOLE_TYPES.includes(type)) {
    throw MHLError(`MHL.Error.LogTypes`, { types: BANNER_TYPES.join(", ") }, { func: "log: ", log: { type } });
  }
  prefix ??= "";
  return console[type](prefix, loggable);
}

export function mhlog(loggable, type = null) {
  return log(loggable, type, "MacroHelperLibrary |");
}
