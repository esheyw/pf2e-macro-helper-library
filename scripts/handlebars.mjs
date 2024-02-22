import { mhlog } from "./helpers/errorHelpers.mjs";
import { localize } from "./helpers/stringHelpers.mjs";
export function registerHandlebarsHelpers() {
  Handlebars.registerHelper("mhlocalize", (value, options) => {
    if (value instanceof Handlebars.SafeString) value = value.toString();
    const data = options.hash;
    return localize(value, data);
  });
  Handlebars.registerHelper("isColor", (value)=>{
    if (value instanceof Handlebars.SafeString) value = value.toString();
    return /^#[a-f0-9]{6}$/i.test(value);
  });
}