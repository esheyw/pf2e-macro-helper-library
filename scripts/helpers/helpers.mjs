import { NOTIFY } from "../constants.mjs";
const PREFIX = 'MHL';
export function localize(str, data = {}, { defaultEmpty = true } = {}) {
  return game.i18n
    .localize(str)
    .replace(/(?<!\\)({[^}]+})/g, (match) => { //negative lookbehind to ignore {} if preceded by \
      return data[match.slice(1, -1)] ?? (defaultEmpty ? "" : undefined);
    })
    .replace(/\\{/, "{"); //strip \ before { from final string
}
export function localizedError(str, data = {}, { notify = null, prefix = "",log={}} = {}) {
  notify ??= NOTIFY;
  let errorstr = "" + prefix;
  if (typeof log === 'object' && Object.keys(log).length) console.error(log);
  errorstr += typeof str === "string" ? localize(str, data) : localize(`${PREFIX}.Error.BadErrorString`);
  if (notify) ui.notifications.error(errorstr, { console: false });
  return Error(errorstr);
}
export function MHLError(str, data = {}, { notify = null, prefix = "MacroHelperLibrary: ", log={}, func=null} = {}) {
  if (func && typeof func==='string') prefix += func;
  return localizedError(str, data, { notify, prefix });
}
export function prependArticle (word) {
  const vowels = "aeiou";
  const article = vowels.indexOf(word[0].toLowerCase()) > -1 ? "an " : "a ";
  return article + word;
};