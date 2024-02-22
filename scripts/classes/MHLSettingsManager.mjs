import { MODULE_ID, fu } from "../constants.mjs";
import { htmlClosest, htmlQuery, htmlQueryAll } from "../helpers/DOMHelpers.mjs";
import { MHLError, mhlog } from "../helpers/errorHelpers.mjs";
import { isRealGM } from "../helpers/otherHelpers.mjs";
import { localize, getIconString, sluggify } from "../helpers/stringHelpers.mjs";
import { MHLDialog } from "./MHLDialog.mjs";
const PREFIX = `MHL.SettingsManager`;
const funcPrefix = `MHLSettingsManager`;
export class MHLSettingsManager {
  #module;
  #cache = {};
  #potentialSettings = new Set();
  #settings = new Collection();
  #visibilityControlElements = new Set();
  #nonDefaults = new Set();
  #resetListeners = new Map();
  #hooks = {};
  #initialized = false;

  constructor(mod, options = {}) {
    this.#module = mod instanceof Module ? mod : game.modules.get(mod);
    if (!this.#module) throw MHLError(`${PREFIX}.Error.BadModuleID`, null, { log: { moduleID }, func: funcPrefix });
    this.options = fu.mergeObject(this.defaultOptions, options);
    if (options?.settings) this.registerSettings(settings);
    Hooks.on("renderSettingsConfig", this.#onRenderSettings.bind(this));
    this.#initialized = true;
  }

  get initialized() {
    return this.#initialized;
  }

  get defaultOptions() {
    return {
      buttons: true, // process settings with button data into clickable buttons instead of their regular type
      colorPickers: true, // add color picker elements to settings whose default value is a hex color code
      resetButtons: true, // add  reset-to-default buttons on each setting and for the whole module in its header
      visbility: true, // process settings with visibility data, only showing them in the settings window conditionally on the value of another setting
      prefix: sluggify(this.#module.title, { camel: "bactrian" }) + ".Setting", //String to start inferred localization keys with
      infix: "Choice", // localization key section placed between setting name and choice value when inferring choice localization
      disabledResetClass: "disabled-transparent", // css class toggled on reset buttons when the setting in question is already its default value
    };
  }

  #onRenderSettings(app, html, data) {
    html = html instanceof jQuery ? html[0] : html; // futureproofing
    const clientSettings = this.#settings.filter((setting) => setting?.scope !== "world");
    if (!clientSettings.length && !isRealGM(game.user)) return;
    const moduleSection = htmlQuery(html, `section[data-category="${this.#module.id}"]`);
    moduleSection.classList.add("mhl-settings-manager");

    if (this.options.resetButtons) {
      this.#addResetAllButton(moduleSection);
    }

    const settingDivs = htmlQueryAll(moduleSection, `[data-setting-id]`);
    for (const div of settingDivs) {
      //TODO: make setVisibility and setHook update data?
      const settingData = game.settings.settings.get(div.dataset.settingId);
      if (this.options.buttons && "button" in settingData) {
        this.#replaceWithButton(div, settingData.button);
      }
      if (this.options.colorPickers) {
        this.#addColorPicker(div);
      }
      if (
        this.options.resetButtons &&
        !("button" in settingData) &&
        "default" in settingData &&
        (settingData?.scope !== "world" || isRealGM(game.user))
      ) {
        this.#addResetButton(div);
      }
      if (this.options.visbility && "visibility" in settingData) {
        this.#addVisibilityListener(div, settingData.visibility);
      }
    }
    //initial visibility checks
    for (const el of this.#visibilityControlElements) {
      el.dispatchEvent(new Event("change"));
    }
  }

  get(key, { silent = false } = {}) {
    const func = `${funcPrefix}#get`;
    const settingPath = key.replace("_", ".");
    const cached = fu.getProperty(this.#cache, settingPath);
    //in case this somehow gets called before settings are registered; log types must be explicit to avoid infinite loop
    if (cached === undefined && game?.user) {
      if (!silent) {
        mhlog(`${PREFIX}.Warning.CacheMiss`, {
          type: 'warn',
          data: { key, module: this.#module.id },
          localize: true,
          func,
        });
      }
      if (game.settings.settings.get(`${this.#module.id}.${key}`) === undefined) {
        if (!silent) {
          mhlog(`${PREFIX}.Error.NotRegistered`, {
            type: "error",
            data: { key, module: this.#module.id },
            localize: true,
            func,
          });
        }
        return undefined;
      } else {
        const value = game.settings.get(this.#module.id, key);
        this.#updateCache(key);
        mhlog({value}, {type: 'warn', prefix:'value retrieved'})
        return value;
      }
    }
    return cached;
  }
  // mostly here for completeness sake, the onChange already handles cache updates
  async set(setting, value) {
    const func = `${funcPrefix}#set`;
    if (!this.#requireSetting(setting, func)) return undefined;
    return game.settings.set(this.#module.id, setting, value);
  }

  async reset(setting) {
    const func = `${funcPrefix}#resetSetting`;
    if (!this.#requireSetting(setting, func)) return undefined;
    const data = this.#settings.get(setting);
    if (!("default" in data)) return undefined;
    return this.set(setting, data.default);
  }

  registerSettings(data) {
    const func = `${funcPrefix}#registerSettings`;
    const settings =
      data instanceof Map
        ? data.entries()
        : Array.isArray(data)
        ? data.reduce((acc, setting) => {
            if ("id" in setting && typeof setting.id === "string") {
              const { id, ...rest } = setting;
              acc.push([id, rest]);
            }
            return acc;
          }, [])
        : typeof data === "object"
        ? Object.entries(data)
        : null;

    if (!settings) {
      mhlog(`${PREFIX}.Error.NoValidSettings`, {
        type: "error",
        data: { module: this.#module.id },
        localize: true,
        func,
      });
      return false;
    }
    //have all potential keys available to predicate visibility upon
    this.#potentialSettings = new Set([...settings.map(([key, _]) => key)]);
    for (const [setting, data] of settings) {
      const success = this.registerSetting(setting, data, { initial: true });
      if (!success) {
        mhlog(
          { setting, data, module: this.#module.id },
          {
            localize: true,
            prefix: `${PREFIX}.Error.InvalidSettingData`,
            func,
            data: { setting, module: this.#module.id },
          }
        );
      }
    }
    if (game?.user) {
      this.#updateCache();
      this.#updateHooks();
    } else {
      Hooks.once(
        "setup",
        function () {
          this.#updateCache();
          this.#updateHooks();
        }.bind(this)
      );
    }
  }

  registerSetting(setting, data, { initial = false } = {}) {
    let menu = false;
    const func = `${funcPrefix}#registerSetting`;
    if (!this.#potentialSettings.has(setting)) this.#potentialSettings.add(setting);
    if (game.settings.settings.get(`${this.#module.id}.${setting}`)) {
      mhlog(`${PREFIX}.Error.DuplicateSetting`, {
        type: "error",
        localize: true,
        data: { setting, module: this.#module.id },
        func,
      });
      return false;
    }
    //add the key to the data because Collection's helpers only operate on vaalues
    data.key = setting;
    //handle registering settings menus
    if ("type" in data && "label" in data && data.type.prototype instanceof FormApplication) {
      if ("icon" in data) {
        data.icon = getIconString(data.icon, { classesOnly: true });
      }
      menu = true;
    }

    // if name, hint, or a choice or menu label is passed as null, infer the desired translation key
    data = this.#processNullLabels(setting, data);

    //validate button settings
    if ("button" in data) {
      data.button = this.#processButtonData(setting, data.button);
      // since buttons replace whole settings, if validation fails, don't create a useless text input
      if (!data.button) return false;
    }
    //handle setting visibility dependencies
    if ("visibility" in data) {
      data.visibility = this.#processVisibilityData(setting, data.visibility);
      // if validation failed, don't make broken listeners
      if (!data.visbility) delete data.visbility;
    }

    //update the cache every time a setting is changed
    const originalOnChange = "onChange" in data ? data.onChange : null;
    data.onChange = function (value) {
      this.#updateCache(setting);
      this.#updateHooks(setting);
      if (originalOnChange) originalOnChange(value);
    }.bind(this);

    //actually register the setting finally
    if (menu) {
      game.settings.registerMenu(this.#module.id, setting, data);
    } else {
      game.settings.register(this.#module.id, setting, data);
      this.#settings.set(setting, data);
    }

    //handle setting-conditional hooks, has to happen after registration or the error handling in setHooks gets gross
    if ("hooks" in data) {
      this.setHooks(setting, data.hooks, { initial });
    }
    // only update hooks and cache if we're not inside a registerSettings call
    if (!initial) {
      this.#updateHooks(setting);
      this.#updateCache(setting);
    }
    this.#potentialSettings.delete(setting);
    return true;
  }

  #processNullLabels(setting, data) {
    if ("name" in data && data.name === null) {
      data.name = [this.options.prefix, sluggify(setting, { camel: "bactrian" }), "Name"].join(".");
    }
    if ("hint" in data && data.hint === null) {
      data.hint = [this.options.prefix, sluggify(setting, { camel: "bactrian" }), "Hint"].join(".");
    }
    if ("choices" in data) {
      for (const [choiceValue, choiceLabel] of Object.entries(data.choices)) {
        if (choiceLabel === null) {
          data.choices[choiceValue] = [
            this.options.prefix,
            sluggify(setting, { camel: "bactrian" }),
            this.options.infix,
            sluggify(choiceValue, { camel: "bactrian" }),
          ].join(".");
        }
      }
    }
    if ("label" in data && data.label === null) {
      data.label = [this.options.prefix, sluggify(setting, { camel: "bactrian" }), "Label"].join(".");
    }
    return data;
  }

  //mostly type and format checking, also icon processing
  #processButtonData(setting, buttonData) {
    const func = `${funcPrefix}#processButtonData`;
    if (typeof buttonData !== "object" || !("action" in buttonData) || typeof buttonData.action !== "function") {
      mhlog(
        { setting, buttonData, module: this.#module.id },
        { localize: true, prefix: `${PREFIX}.Error.Button.BadFormat`, func }
      );
      return false;
    }

    if (!("label" in buttonData) || buttonData.label === null) {
      buttonData.label = [this.options.prefix, sluggify(setting, { camel: "bactrian" }), "Label"].join(".");
    }
    buttonData.label = String(buttonData.label);

    if ("icon" in buttonData) {
      buttonData.icon = getIconString(buttonData.icon);
    }
    return buttonData;
  }

  #processVisibilityData(setting, visibilityData) {
    const func = `${funcPrefix}#processVisibilityData`;
    const data = { setting, visibilityData, module: this.#module.id };
    let invalid = false;
    let errorstr = "";
    let dependsOn, invert, test;
    switch (typeof visibilityData) {
      case "object":
        if (!("dependsOn" in visibilityData) || typeof visibilityData.dependsOn !== "string") {
          errorstr = `${PREFIX}.Error.Visibility.BadObject`;
          invalid = true;
          break;
        }
        ({ dependsOn, test } = visibilityData);
        if (test && typeof test !== "function") {
          errorstr = `${PREFIX}.Error.Visibility.TestFunction`;
          invalid = true;
          break;
        }
      case "string": //deliberate passthrough
        dependsOn ??= visibilityData; //if not set by the object
        invert = dependsOn.at(0) === "!";
        dependsOn = invert ? dependsOn.slice(1) : dependsOn;
        test ??= invert ? (value) => !value : (value) => !!value;
        break;
      default:
        errorstr = `${PREFIX}.Error.Visibility.BadFormat`;
        invalid = true;
    }
    if (invalid) {
      mhlog(data, { type: "error", localize: true, prefix: errorstr, data, func });
      return false;
    }
    if (!this.#settings.has(dependsOn) && !this.#potentialSettings.has(dependsOn)) {
      mhlog(data, {
        type: "error",
        localize: true,
        prefix: `${PREFIX}.Error.Visibility.UnknownDependency`,
        data: { dependsOn, setting, module: this.#module.id },
        func,
      });
      return false;
    }
    return {
      dependsOn,
      test,
    };
  }
  #processHookData(setting, hookData) {
    const func = `${funcPrefix}#validateHookData`;
    let invalid = false;
    let errorstr = "";
    if (typeof hookData !== "object" || ("hook" in hookData && typeof hookData.hook !== "string")) {
      errorstr = `${PREFIX}.Error.Hooks.BadHook`;
      invalid = true;
    }
    if (!invalid && "action" in hookData && typeof hookData.action !== "function") {
      errorstr = `${PREFIX}.Error.Hooks.RequiresAction`;
      invalid = true;
    }
    if (!invalid && "test" in hookData && typeof hookData.test !== "function") {
      errorstr = `${PREFIX}.Error.Hooks.TestFunction`;
      invalid = true;
    }
    if (invalid) {
      mhlog(
        { setting, hookData, module: this.#module.id },
        {
          type: "error",
          localize: true,
          prefix: errorstr,
          data: { setting, hook: hookData?.hook, module: this.#module.id },
          func,
        }
      );
      return false;
    }
  }
  setHooks(setting, hooks, { initial = false } = {}) {
    //accept single hook object instead of array if provided
    const outcomes = [];
    if (!Array.isArray(hooks)) hooks = [hooks];
    for (const hook of hooks) this.setHook(setting, hook, { deferUpdate: true });
    //don't update hooks if we're in the middle of registering settings
    if (!initial) this.#updateHooks();
  }

  setHook(setting, hookData, { deferUpdate = false } = {}) {
    const func = `${funcPrefix}#setHook`;
    if (!this.#requireSetting(setting, func)) return undefined;
    let invalid = false;
    let errorstr = "";
    if (typeof hookData !== "object" || ("hook" in hookData && typeof hookData.hook !== "string")) {
      errorstr = `${PREFIX}.Error.Hooks.BadHook`;
      invalid = true;
    }
    if (!invalid && "action" in hookData && typeof hookData.action !== "function") {
      errorstr = `${PREFIX}.Error.Hooks.RequiresAction`;
      invalid = true;
    }
    if (!invalid && "test" in hookData && typeof hookData.test !== "function") {
      errorstr = `${PREFIX}.Error.Hooks.TestFunction`;
      invalid = true;
    }
    if (invalid) {
      mhlog(
        { setting, hookData, module: this.#module.id },
        {
          type: "error",
          localize: true,
          prefix: errorstr,
          data: { setting, hook: hookData.hook, module: this.#module.id },
          func,
        }
      );
      return false;
    }
    //default test if none provided
    hookData.test ??= (value) => !!value;
    this.#hooks[setting] ??= [];
    this.#hooks[setting].push(hookData);
    if (!deferUpdate) this.#updateHooks(setting);
    return true;
  }

  setButton(setting, buttonData) {
    const func = `${funcPrefix}#setButton`;
    if (!this.#requireSetting(setting, func)) return undefined;
    const fullKey = `${this.#module.id}.${setting}`;
    const savedData = game.settings.settings.get(fullKey);
    const processed = this.#processButtonData(setting, buttonData);
    if (processed) {
      savedData.button = processed;
      game.settings.settings.set(fullKey, savedData);
      return true;
    }
    return false;
  }

  setVisibility(setting, visibilityData) {
    const func = `${funcPrefix}#setButton`;
    if (!this.#requireSetting(setting, func)) return undefined;
    const fullKey = `${this.#module.id}.${setting}`;
    const savedData = game.settings.settings.get(fullKey);
    const processed = this.#processVisibilityData(setting, visibilityData);
    if (processed) {
      savedData.visibility = processed;
      game.settings.settings.set(fullKey, savedData);
      return true;
    }
    return false;
  }

  #updateHooks(key = null) {
    for (const [setting, hooks] of Object.entries(this.#hooks)) {
      if (key && key !== setting) continue;
      const value = this.get(setting);
      for (let i = 0; i < hooks.length; i++) {
        const active = hooks[i].test(value);
        const existingHookID = hooks[i].id ?? null;
        if (active) {
          if (existingHookID) continue;
          hooks[i].id = Hooks.on(hooks[i].hook, hooks[i].action);
        } else if (existingHookID) {
          Hooks.off(hooks[i].hook, existingHookID);
          delete hooks[i].id;
        }
      }
    }
  }

  #updateCache(key = null) {
    for (const setting of this.#settings.keys()) {
      if (key && key !== setting) continue;
      const settingPath = setting.replace("_", ".");
      const currentValue = game.settings.get(this.#module.id, setting);
      if (game?.user) { // after setup hack
        if (this.#isDefault(setting) === false) {
          this.#nonDefaults.add(setting);
        } else {
          this.#nonDefaults.delete(setting);
        }
      }
      fu.setProperty(this.#cache, settingPath, currentValue);
    }
  }

  #addColorPicker(div) {
    const pattern = "^#[A-Fa-f0-9]{6}";
    const regex = new RegExp(pattern);
    const settingName = div.dataset.settingId.split(".")[1];
    const defaultValue = game.settings.settings.get(div.dataset.settingId).default;
    const textInput = div.querySelector('input[type="text"]');
    if (!textInput || !regex.test(defaultValue)) return undefined;
    const colorPicker = document.createElement("input");
    colorPicker.type = "color";
    colorPicker.dataset.edit = div.dataset.settingId;
    colorPicker.value = this.get(settingName);
    colorPicker.addEventListener(
      "input",
      function (event) {
        //force a reset anchor refresh; foundry's code for updating the text field runs too slowly?
        textInput.value = event.target.value;
        if (this.options.resetButtons) this.#updateResetButton(event);
      }.bind(this)
    );
    textInput.parentElement.append(colorPicker);
    textInput.pattern = pattern;
    textInput.addEventListener("input", (event) => {
      //would love to support more than a string 6-character hex code, but input[type=color] yells about condensed and/or rgba on chrome
      if (event.target.value.length > 7) {
        event.target.value = event.target.value.substring(0, 7);
      }
      if (!regex.test(event.target.value)) {
        textInput.dataset.tooltipDirection = "UP";
        textInput.dataset.tooltip = localize(`${PREFIX}.ColorPicker.ValidHexCode`);
      } else {
        textInput.dataset.tooltip = "";
        colorPicker.value = event.target.value;
      }
    });
  }
  #replaceWithButton(div, data) {
    const input = div.querySelector(".form-fields").children[0];
    div.classList.add("submenu");
    const button = document.createElement("button");
    button.innerHTML = `${data.icon} <label>${localize(data.label)}</label>`;
    button.type = "button";
    button.classList.add("mhl-setting-button");
    button.addEventListener("click", data.action ?? (() => true));
    input.replaceWith(button);
  }

  #addVisibilityListener(div, data) {
    const controlDiv = div.parentElement.querySelector(`[data-setting-id$="${data.dependsOn}"]`);
    const controlElement = controlDiv.querySelector("input, select");
    this.#visibilityControlElements.add(controlElement);
    controlElement.addEventListener("change", (event) => {
      div.style.display = data.test(this.#_value(event.target)) ? "flex" : "none";
    });
  }

  #addResetAllButton(section) {
    const h2 = section.querySelector("h2");
    const title = h2.innerText;
    const span = document.createElement("span");
    span.classList.add("mhl-reset-all");
    span.innerHTML = `<a data-reset-all="true"><i class="fa-regular fa-reply-all"></i></a>`;
    const anchor = span.querySelector("a");
    anchor.addEventListener(
      "click",
      // async (event) => {
      //   const section = event.target.closest("section");
      //   const resetButtons = Array.from(section.querySelectorAll("a[data-reset-for]"));
      //   const doReset = await Dialog.confirm({
      //     defaultYes: false,
      //     title: localize(`${PREFIX}.ResetAll.Title`),
      //     content: localize(`${PREFIX}.ResetAll.Body`, {
      //       module: title,
      //       count: resetButtons.filter((b) => !b.classList.value.includes("disabled")).length,
      //     }),
      //   });
      //   if (!doReset) return undefined;
      //   for (const button of resetButtons) {
      //     button.dispatchEvent(new CustomEvent("click", { detail: { skipDialog: true } }));
      //   }
      // }
      this.#onResetAllClick.bind(this)
    );
    h2.appendChild(span);
  }

  #addResetButton(div) {
    const setting = div.dataset.settingId.split(".")[1];
    const label = div.querySelector("label");
    const firstInput = div.querySelector("input, select");
    if (!firstInput) return undefined; // something's gone wrong or its a settings menu
    // only time there should be more than one input per div is colorpickers, and they'll update the text field anyway.
    const anchor = document.createElement("a");
    anchor.dataset.resetFor = setting;
    anchor.innerHTML = '<i class="fa-regular fa-arrow-rotate-left"></i>';
    anchor.dataset.tooltipDirection = "UP";
    label.append(anchor);
    firstInput.addEventListener("change", this.#updateResetButton.bind(this));
    //initial check if setting === default
    firstInput.dispatchEvent(new Event("change"));
  }

  #updateResetButton(event) {
    const div = event.target.closest("div[data-setting-id]");
    const anchor = div.querySelector("a[data-reset-for]");
    const setting = anchor.dataset.resetFor;
    const settingData = this.#settings.get(setting);
    const firstInput = div.querySelector("input, select");
    const existingListener = this.#resetListeners.get(setting);
    const listener = existingListener ?? this.#onResetClick.bind(this);
    if (!existingListener) this.#resetListeners.set(setting, listener);
    //if possible cast value by setting type; shouldn't blow up since reset anchors wont be on button settings/menus
    const inputValue = this.#_value(firstInput);
    const currentValue = "type" in settingData ? settingData.type(inputValue) : inputValue;
    if (this.#isDefault(setting, currentValue)) {
      anchor.classList.add(this.options.disabledResetClass);
      anchor.dataset.tooltip = localize(`${PREFIX}.Reset.IsDefault`);
      anchor.removeEventListener("click", listener);
    } else {
      anchor.classList.remove(this.options.disabledResetClass);
      anchor.dataset.tooltip = localize(`${PREFIX}.Reset.Tooltip`);
      anchor.addEventListener("click", listener);
    }
  }

  #_value(input) {
    //grr checkboxen
    return input?.type === "checkbox" ? input.checked : input.value;
  }

  #isDefault(setting, value = undefined) {
    const data = this.#settings.get(setting);
    const defaultValue = "default" in data ? data.default : undefined;
    if (defaultValue === undefined) return undefined;
    // this is to support checking if the form value = default
    const currentValue = value === undefined ? this.get(setting) : value;
    return typeof currentValue === "object"
      ? isEmpty(fu.diffObject(defaultValue, currentValue))
      : defaultValue === currentValue;
  }

  async #onResetAllClick(event) {
    const section = htmlClosest(event.target, "section.mhl-settings-manager");
    const divs = htmlQueryAll(section, "div[data-setting-id]");
    const formValues = divs.reduce((acc, curr) => {
      const firstInput = htmlQuery(curr, "input, select");
      if (!firstInput || curr.style.display === "none") return acc;
      const setting = curr.dataset.settingId.split(".")[1];
      acc[setting] = this.#_value(firstInput);
      return acc;
    }, {});
    let defaultlessCount = 0;
    const defaultlessList = [];
    let areDefault = 0;
    const areDefaultList = [];
    const changed = {};
    for (const [setting, data] of this.#settings.entries()) {
      if ("button" in data) continue;
      if (!("default" in data)) {
        defaultlessList.push(setting);
        defaultlessCount++;
        continue;
      }
      const storedValue = this.get(setting);
      const visible = setting in formValues;
      const currentValue = visible
        ? formValues[setting]
        : typeof storedValue === "object"
        ? JSON.stringify(storedValue)
        : storedValue;
      if (this.#isDefault(setting, currentValue)) {
        areDefaultList.push(setting);
        areDefault++;
        continue;
      }
      const defaultValue =
        data.default === undefined
          ? undefined
          : typeof data.default === "object"
          ? JSON.stringify(data.default)
          : data.default;
      changed[setting] = {
        config: "config" in data && data.config,
        currentValue,
        visible,
        defaultValue,
      };
    }

    const dialogData = {
      title: localize(`${PREFIX}.ResetAll.Title`),
      content: `modules/${MODULE_ID}/templates/MHLSettingsManager-ResetAll.hbs`,
      contentData: {
        module: this.#module.title,
        defaultlessCount,
        defaultlessTooltip: defaultlessList.join(", "),
        areDefault,
        areDefaultTooltip: areDefaultList.join(", "),
        changed,
      },
    };
    const dialogOptions = {
      classes: ["mhl-reset-all"],
      width: 700,
    };
    mhlog(dialogData);
    mhlog(await MHLDialog.confirm(dialogData, dialogOptions));
  }

  async #onResetClick(event) {
    const skipDialog = event.detail?.skipDialog ?? false;
    const div = event.target.closest("div[data-setting-id]");
    // multiple inputs should only be for colorPickers
    const inputs = Array.from(div.querySelectorAll("input, select"));
    const label = div.querySelector("label");
    const setting = div.dataset.settingId.split(".")[1];
    const data = this.#settings.get(setting);
    const defaultValue = "default" in data ? data.default : undefined;
    const doReset = skipDialog
      ? true
      : await Dialog.confirm({
          defaultYes: false,
          title: localize(`${PREFIX}.Reset.Title`),
          content: localize(`${PREFIX}.Reset.Body`, { setting: label.innerText, value: defaultValue }),
        });
    if (!doReset) return;
    for (const input of inputs) {
      //grr checkboxen
      if (input.tagName === "INPUT" && input.type === "checkbox") {
        input.checked = defaultValue;
      }
      input.value = defaultValue;
      input.dispatchEvent(new Event("change")); //to force visibility updates
    }
    this.reset(setting);
    this.#updateResetButton(event);
  }

  #requireSetting(setting, func = null) {
    if (!this.#settings.has(setting)) {
      mhlog(`${PREFIX}.Error.NotRegistered`, {
        type: "error",
        localize: true,
        data: { setting, module: this.#module.id },
        func,
      });
      return false;
    }
    return true;
  }
}
