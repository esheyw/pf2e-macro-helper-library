import { localize } from "../helpers/helpers.mjs";
const PREFIX='MHL.PickAThing';
export class PickAThingPrompt extends Application {
  constructor(data) {
    this.title = data.title ?? localize(`${PREFIX}.DefaultTitle`);
    this.prompt = data.prompt ?? localize(`${PREFIX}.DefaultPrompt`)
  }
}