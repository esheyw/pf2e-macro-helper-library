import { fu } from "../constants.mjs"
import { localize } from "../helpers/stringHelpers.mjs";
export class MHLDialog extends Dialog {  
  constructor(data, options={}) {
    super(data, options);
    this.contentData = data.contentData ?? {};
  }
  getData() {
    return fu.mergeObject(super.getData(), {
      appId: this.appId,
      ...this.contentData
    });
  }
  static get defaultOptions() {
    return fu.mergeObject(super.defaultOptions, {
      jQuery: false,
      classes: ["mhldialog"]
    })
  }
  async _renderInner(data) {
    const originalContent = fu.deepClone(data.content);
    // console.warn({originalContent, data})
    if (data.content.endsWith('.hbs')) {
      data.content = await renderTemplate(originalContent, data)
    } else if (data.content.startsWith('<')) {
      data.content = (Handlebars.compile(originalContent)(data)) 
    }
    data.content ||= localize('MHL.Dialog.Error.TemplateFailure')
    return super._renderInner(data);
  }
}