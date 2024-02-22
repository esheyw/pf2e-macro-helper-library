import { MODULE_ID, fu } from "../constants.mjs";
import { setting } from "../settings.mjs";
import { MHLError, mhlog } from "./index.mjs";
export function prependIndefiniteArticle(string) {
  const vowels = "aeiou";
  const article =
    vowels.indexOf(string[0].toLowerCase()) > -1
      ? localize(`MHL.Grammar.Articles.An`)
      : localize(`MHL.Grammar.Articles.A`);
  return `${article} ${string}`;
}

export function localize(str, data = {}, { defaultEmpty = true } = {}) {
  if (fu.isEmpty(game.i18n?.translations)) {
    return `Localization attempted before i18n initialization, pasteable command: 
    game.modules.get('${MODULE_ID}').api.localize('${str}', ${JSON.stringify(data)})`;
  }
  return game.i18n
    .localize(str)
    .replace(/(?<!\\)({[^}]+})/g, (match) => {
      // match all {} not preceded by \
      return data[match.slice(1, -1)] ?? (defaultEmpty ? "" : undefined);
    })
    .replace(/\\{/, "{"); //strip \ before { from final string
}
//almost entirely lifted from pf2e system code, but now that we're system agnostic, can't rely on the system function being around
export function sluggify(text, { camel = null } = {}) {
  const wordCharacter = String.raw`[\p{Alphabetic}\p{Mark}\p{Decimal_Number}\p{Join_Control}]`;
  const nonWordCharacter = String.raw`[^\p{Alphabetic}\p{Mark}\p{Decimal_Number}\p{Join_Control}]`;
  const nonWordCharacterRE = new RegExp(nonWordCharacter, "gu");

  const wordBoundary = String.raw`(?:${wordCharacter})(?=${nonWordCharacter})|(?:${nonWordCharacter})(?=${wordCharacter})`;
  const nonWordBoundary = String.raw`(?:${wordCharacter})(?=${wordCharacter})`;
  const lowerCaseLetter = String.raw`\p{Lowercase_Letter}`;
  const upperCaseLetter = String.raw`\p{Uppercase_Letter}`;
  const lowerCaseThenUpperCaseRE = new RegExp(`(${lowerCaseLetter})(${upperCaseLetter}${nonWordBoundary})`, "gu");

  const nonWordCharacterHyphenOrSpaceRE =
    /[^-\p{White_Space}\p{Alphabetic}\p{Mark}\p{Decimal_Number}\p{Join_Control}]/gu;
  const upperOrWordBoundariedLowerRE = new RegExp(`${upperCaseLetter}|(?:${wordBoundary})${lowerCaseLetter}`, "gu");
  if (typeof text !== "string") return null; //i'm okay being a bit more agressive than the system here, it should break something
  if (text === "-") return text; //would otherwise be reduced to ""
  switch (camel) {
    case null:
      return text
        .replace(lowerCaseThenUpperCaseRE, "$1-$2")
        .toLowerCase()
        .replace(/['’]/g, "")
        .replace(nonWordCharacterRE, " ")
        .trim()
        .replace(/[-\s]+/g, "-");
    case "bactrian": {
      const dromedary = sluggify(text, { camel: "dromedary" });
      return dromedary.capitalize();
    }
    case "dromedary":
      return text
        .replace(nonWordCharacterHyphenOrSpaceRE, "")
        .replace(/[-_]+/g, " ")
        .replace(upperOrWordBoundariedLowerRE, (part, index) => (index === 0 ? part.toLowerCase() : part.toUpperCase()))
        .replace(/\s+/g, "");
    default:
      throw MHLError(`MHL.Error.InvalidCamel`, { camel }, { log: { camel }, func: "sluggify" });
  }
}

export function getIconString(string, { classesOnly = false } = {}) {
  const func = "getIconString";
  if (typeof string !== "string") {
    mhlog(`MHL.Warning.Fallback.Type`, {
      localize: true,
      data: { var: "string", expected: "string", type: typeof string },
      func,
    });
    string = String(string);
  }
  const pre = `<i class="`;
  const post = `"></i>`;
  const containsHTML = /<[^>]+>/.test(string);
  const matches = new RegExp(`(${pre})([-a-z0-9\s]+)(${post})`).exec(string);
  if (containsHTML && !matches) {
    mhlog(`MHL.Error.Validation.FontAwesomeIcon`, { localize: true, data: { string }, func });
    return "";
  }
  const classes = matches ? getIconClasses(matches[2]) : getIconClasses(string);
  if (!classes) return "";
  return classesOnly ? classes : pre + classes + post;
}

export function getIconClasses(string) {
  const func = "getIconClasses";
  if (typeof string !== "string") {
    mhlog(`MHL.Warning.Fallback.Type`, {
      localize: true,
      data: { var: "string", expected: "string", type: typeof string },
      func,
    });
    string = String(string);
  }
  const partsSeen = {
    sharp: null,
    type: null,
    slug: null,
  };
  const parts = string.split(/\s+/).map((p) => p.toLowerCase());
  if (parts.length > 3) {
    return false;
  }
  for (let part of parts) {
    if (part === "fa-sharp") {
      if (partsSeen.sharp) return false;
      partsSeen.sharp = part;
    } else if (/^fa-(regular|thin|solid|light|duotone)$/.test(part)) {
      if (partsSeen.type) return false;
      partsSeen.type = part;
    } else if (/^(fa[-a-z0-9]+)$/.test(part)) {
      if (partsSeen.slug) return false;
      partsSeen.slug = part;
    } else {
      return false;
    }
  }
  if (!partsSeen.slug) {
    mhlog(`MHL.Error.Validation.FontAwesomeClasses`, { localize: true, data: { string }, func });
    return false;
  }
  return [partsSeen.sharp ?? "", partsSeen.type ?? "fa-regular", partsSeen.slug].join(" ").trim();
}
