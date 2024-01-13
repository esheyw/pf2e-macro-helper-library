import { fu } from "../constants.mjs";
import { MHLError } from "../helpers/errorHelpers.mjs";
import { localize } from "../helpers/stringHelpers.mjs";
const PREFIX = "MHL.Dialog";
export class MHLDialog extends Dialog {
  constructor(data, options = {}) {
    if ("submitValidator" in data) {
      const { submitValidator } = data;
      if (typeof submitValidator !== "function")
        throw MHLError(
          `MHL.Error.Type.Function`,
          { var: "submitValidator" },
          { func: "MHLDialog: ", log: { submitValidator } }
        );
    }
    super(data, options);
  }

  getData() {
    return fu.mergeObject(super.getData(), {
      idPrefix: `mhdialog-${this.appId}-`,
      ...(this.data.contentData ?? {}),
    });
  }

  static get defaultOptions() {
    return fu.mergeObject(super.defaultOptions, {
      jQuery: false,
      classes: ["mhldialog"],
    });
  }

  submit(button, event) {
    if (this.data?.submitValidator && !this.data.submitValidator(this.element[0])) return false;
    super.submit(button, event);
  }

  async _renderInner(data) {
    const originalContent = fu.deepClone(data.content);
    if (/\.(hbs|html)$/.test(data.content)) {
      data.content = await renderTemplate(originalContent, data);
    } else {
      data.content = Handlebars.compile(originalContent)(data);
    }
    data.content ||= localize(`${PREFIX}.Error.TemplateFailure`);
    return super._renderInner(data);
  }

  static getFormData(html) {
    return Object.values(this.getFormsData(html))[0];
  }

  static getFormsData(html) {
    html = html instanceof jQuery ? html[0] : html;
    const out = {};
    const forms = Array.from(html.querySelectorAll("form"));
    for (const form of forms) {
      if (forms.length > 1 && !form?.name) {
        throw MHLError(`${PREFIX}.Error.FormRequiresName`, null, { func: "defaultFormCallback: ", log: { forms } });
      }
      out[form?.name ?? "form"] = new FormDataExtended(curr).object; //if there's only one and it doesnt have a name, give it a default
    }
    return out;
  }
}
