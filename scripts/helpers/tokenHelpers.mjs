import { MHLError } from "./errorHelpers.mjs";
import { localize } from "./stringHelpers.mjs";
const PREFIX = `MHL.Token`;
export function oneTokenOnly(fallback = true) {
  const tokens = anyTokens(fallback);
  if (tokens.length > 1) {
    //if it was 0 it got caught by anyTokens
    throw MHLError(`${PREFIX}.Error.NotOneSelected`, {
      fallback: fallback ? `${PREFIX}.Error.Fallback` : "",
    });
  }
  return tokens[0];
}
export function anyTokens(fallback = true) {
  let token;
  let fallbackStr = "";
  if (canvas.tokens.controlled.length === 0) {
    if (fallback) {
      if (game.user.character && (token = game.user.character.getActiveTokens()?.[0])) {
        return [token];
      }
      fallbackStr = localize(`${PREFIX}.Error.Fallback`);
    }
    throw MHLError(`${PREFIX}.Error.NotAnySelected`, { fallback: fallbackStr });
  }
  return canvas.tokens.controlled;
}