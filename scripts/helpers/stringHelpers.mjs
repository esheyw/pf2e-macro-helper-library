const PREFIX = 'MHL';
export function prependIndefiniteArticle(string) {
  const vowels = "aeiou";
  const article = vowels.indexOf(string[0].toLowerCase()) > -1 ? localize(`${PREFIX}.Grammar.Articles.An`) : localize(`${PREFIX}.Grammar.Articles.A`);
  return `${article} ${string}`;
}

export function capitalize(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

export function localize(str, data = {}, { defaultEmpty = true } = {}) {
  return game.i18n
    .localize(str)
    .replace(/(?<!\\)({[^}]+})/g, (match) => { // match all {} not preceded by \
      return data[match.slice(1, -1)] ?? (defaultEmpty ? "" : undefined);
    })
    .replace(/\\{/, "{"); //strip \ before { from final string
}

