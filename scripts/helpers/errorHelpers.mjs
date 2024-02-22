import { BANNER_TYPES, CONSOLE_TYPES } from "../constants.mjs";
import { setting } from "../settings.mjs";
import { localize } from "./stringHelpers.mjs";

export function log(loggable, options = {}) {
  const func = "log";
  const defaultType = "debug";
  let { type, prefix } = options;
  type = String(type ?? defaultType);
  prefix = String(prefix ?? "");
  if (!CONSOLE_TYPES.includes(type)) {
    mhlog(`MHL.Warning.Fallback.LogType`, {
      type: "warn",
      func,
      localize: true,
      data: { type, defaultType },
    });
    type = defaultType;
  }
  if (typeof loggable === "string") {
    loggable = prefix + loggable;
    console[type](loggable);
    return loggable;
  } else {
    console[type](prefix, loggable);
    return loggable;
  }
}

export function modLog(loggable, options = {}) {
  let { type, prefix, data, func, modPrefix } = options;
  options.localize ??= false; // don't destructure so as to not conflict with the function; probably a tidier way to do this
  // silent: true to avoid yelling about cache misses when called before setting init
  type ??= setting("log-level", { silent: true }) ?? "debug";
  prefix = String(prefix ?? "");
  if (options.localize) {
    if (typeof loggable === "string") {
      loggable = localize(loggable, data);
    } else {
      prefix = localize(prefix, data);
    }
  }
  if (!prefix.startsWith(modPrefix)) {
    prefix = modPrefix + (func ? `${func} | ` : "") + prefix;
  }
  return log(loggable, { type, prefix });
}

export function mhlog(loggable, options = {}) {
  options.modPrefix = "MHL | ";
  return modLog(loggable, options);
}

export function localizedBanner(str, data = {}, options = {}) {
  const func = "localizedBanner";
  const defaultType = "info";

  let { prefix, type, console, permanent, log } = options;
  prefix = String(prefix ?? "");
  type = String(type ?? "");
  console ??= false;
  permanent ??= false;
  if (!BANNER_TYPES.includes(type)) {
    mhlog(`MHL.Warning.Fallback.BannerType`, { func, localize: true, data: { type, defaultType } });
    type = defaultType;
  }
  if (typeof str !== "string") {
    mhlog(`MHL.Warning.Fallback.Type`, {
      func,
      localize: true,
      data: { var: "str", type: typeof str, expected: "string" },
    });
    str = String(str);
  }
  let bannerstr = prefix + localize(str, data);
  if (!game.ready) {
    globalThis.console.error(localize(`MHL.Error.TooEarlyForBanner`, { type, bannerstr }));
  } else {
    ui.notifications[type](bannerstr, { console, permanent });
  }
  if (typeof log === "object" && Object.keys(log).length) log(log, { type, prefix });
  return bannerstr;
}

export function MHLBanner(str, data = {}, options = {}) {
  const mhlPrefix = "MHL | ";
  let { prefix, type, console, permanent, log, func } = options;
  type ??= setting("log-level", { silent: true }) ?? "info";
  prefix = String(prefix ?? "");
  if (!prefix.startsWith(mhlPrefix)) {
    prefix = mhlPrefix + (func ? `${func} | ` : "") + prefix;
  }
  const out = localizedBanner(str, data, { prefix, type, console, permanent });
  if (typeof log === "object" && Object.keys(log).length) mhlog(log, { type });
  return out;
}

export function localizedError(str, data = {}, options = {}) {
  const func = "localizedError";
  let { banner, prefix, permanent, log } = options;
  banner ??= false;
  prefix = String(prefix ?? "");
  permanent ??= false;
  if (typeof str !== "string") {
    mhlog(`MHL.Warning.Fallback.Type`, {
      func,
      localize: true,
      data: { var: "str", type: typeof str, expected: "string" },
    });
    str = String(str);
  }
  const errorstr = prefix + localize(str, data);
  if (banner) localizedBanner(errorstr, null, { type: "error", console: false, permanent });
  if (typeof log === "object" && Object.keys(log).length) log(log, { type: "error", prefix });
  return Error(errorstr);
}

export function MHLError(str, data = {}, options = {}) {
  const mhlPrefix = "MHL | ";
  let { banner, prefix, log, func, permanent } = options;
  banner ??= true;
  prefix = String(prefix ?? "");
  if (!prefix.startsWith(mhlPrefix)) {
    prefix = mhlPrefix + (func ? `${func} | ` : "") + prefix;
  }
  if (typeof log === "object" && Object.keys(log).length) mhlog(log, { type: "error" });
  if (banner && game.ready) MHLBanner(str, data, { prefix, type: "error", permanent, console: false });
  return localizedError(str, data, { prefix, type: "error", banner: false });
}

export function isPF2e() {
  return game.system.id === "pf2e";
}

export function requireSystem(system, prefix = null) {
  if (game.system.id !== system) throw localizedError(`MHL.Error.RequiresSystem`, { system }, { prefix });
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
