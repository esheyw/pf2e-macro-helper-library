import { COLOURS, LABELABLE_TAGS, fu } from "../constants.mjs";
import { MHLError, localizedBanner } from "../helpers/errorHelpers.mjs";
import { localize } from "../helpers/stringHelpers.mjs";
const PREFIX = "MHL.Dialog";
export class MHLDialog extends Dialog {
  constructor(data, options = {}) {
    //validate the validator. TODO: add facility for list of non-empty inputs instead of function
    if ("validator" in data) {
      let validator = data.validator;
      switch (typeof validator) {
        case "function":
          break;
        case "string":
          validator = [validator];
        case "object":
          if (Array.isArray(validator) && validator.every((f) => typeof f === "string")) {
            const fields = fu.deepClone(validator);
            data.validator = (html) => {
              const formValues = MHLDialog.getFormData(html);
              const emptyFields = fields.filter((f) => fu.isEmpty(formValues[f]));
              if (emptyFields.length) {
                const fieldsError = fields
                  .map((f) =>
                    emptyFields.includes(f)
                      ? `<span style="text-decoration: underline wavy ${COLOURS["error"]}">${f}</span>`
                      : f
                  )
                  .join(", ");
                localizedBanner(
                  `${PREFIX}.Warning.RequiredFields`,
                  { fields: fieldsError },
                  { type: "warn", log: { formValues }, console: false }
                );
                return false;
              }
              return true;
            };
            break;
          }
        default:
          throw MHLError(`${PREFIX}.Error.BadValidator`, null, { func: "MHLDialog: ", log: { validator } });
      }
    }
    //make sure contentData doesnt have reserved keys (just buttons and content afaict)
    if ("contentData" in data) {
      const contentData = data.contentData;
      const disallowedKeys = ["buttons", "content"];
      if (!Object.keys(contentData).every((k) => !disallowedKeys.includes(k))) {
        throw MHLError(
          `${PREFIX}.Error.ReservedKeys`,
          { keys: disallowedKeys.join(", ") },
          { func: "MHLDialog: ", log: { contentData } }
        );
      }
    }

    // gotta work around Application nuking the classes array with mergeObject
    let tempClasses;
    if ("classes" in options && Array.isArray(options.classes)) {
      tempClasses = fu.deepClone(options.classes);
      delete options.classes;
    }
    super(data, options);
    if (tempClasses) this.options.classes = [...new Set(this.options.classes.concat(tempClasses))];
  }

  #_validate() {
    if (!("validator" in this.data)) return true;
    return this.data.validator(this.options.jQuery ? this.element : this.element[0]);
  }

  getData() {
    return fu.mergeObject(super.getData(), {
      idPrefix: `mhldialog-${this.appId}-`,
      ...(this.data.contentData ?? {}),
    });
  }

  static get defaultOptions() {
    return fu.mergeObject(super.defaultOptions, {
      jQuery: false,
      classes: ["mhldialog", ...super.defaultOptions.classes],
    });
  }

  submit(button, event) {
    if (!this.#_validate()) return false;
    super.submit(button, event);
  }

  async _renderInner(data) {
    if (data?.content) {
      const originalContent = fu.deepClone(data.content);
      if (/\.(hbs|html)$/.test(data.content)) {
        data.content = await renderTemplate(originalContent, data);
      } else {
        data.content = Handlebars.compile(originalContent)(data);
      }
      data.content ||= localize(`${PREFIX}.Error.TemplateFailure`);
    }
    return super._renderInner(data);
  }

  static getFormData(html) {
    return Object.values(MHLDialog.getFormsData(html))[0];
  }

  static getFormsData(html) {
    html = html instanceof jQuery ? html[0] : html;
    const out = {};
    const forms = Array.from(html.querySelectorAll("form"));
    for (const form of forms) {
      if (forms.length > 1 && !form?.name) {
        throw MHLError(`${PREFIX}.Error.FormRequiresName`, null, { func: "defaultFormCallback: ", log: { forms } });
      }
      //if there's only one and it doesnt have a name, give it a default
      out[form?.name ?? "form"] = new FormDataExtended(form).object;
    }
    return out;
  }

  static getLabelMap(html) {
    html = html instanceof jQuery ? html[0] : html;
    const named = html.querySelectorAll("[name][id]");
    if (!named.length) return {};
    const namedIDs = Array.from(named).map((e) => e.getAttribute("id"));
    const allLabels = Array.from(html.querySelectorAll("label"));
    if (!allLabels.length) return {};
    return allLabels.reduce((acc, curr) => {
      const forAttr = curr.getAttribute("for");
      if (forAttr) {
        if (!namedIDs.includes(forAttr)) return acc;
        acc[curr.getAttribute("name")] = curr.innerText;
      } else {
        const labelableChild = curr.querySelector(LABELABLE_TAGS.map((t) => `${t}[name]`).join(", "));
        if (!labelableChild) return acc;
        acc[labelableChild.getAttribute("name")] = curr.innerText;
      }
      return acc;
    }, {});
  }
}
