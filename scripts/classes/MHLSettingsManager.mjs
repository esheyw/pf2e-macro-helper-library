import { MODULE_ID, fu } from "../constants.mjs";
import { htmlClosest, htmlQuery, htmlQueryAll } from "../helpers/DOMHelpers.mjs";
import { MHLError, isEmpty, mhlog, modLog } from "../helpers/errorHelpers.mjs";
import { isRealGM } from "../helpers/otherHelpers.mjs";
import { localize, getIconString, sluggify } from "../helpers/stringHelpers.mjs";
import { MHLDialog } from "./MHLDialog.mjs";
const PREFIX = `MHL.SettingsManager`;
const funcPrefix = `MHLSettingsManager`;
export class MHLSettingsManager {
  #groups = new Collection([["ungrouped", []]]);
  #groupOrder = new Set(["ungrouped"]);
  #initialized = false;
  #module;
  #potentialSettings = new Set();
  #resetAllListener = { listener: null, active: false };
  #resetGroupListeners = new Collection();
  #resetListeners = new Collection();
  #settings = new Collection();
  #visibilityControlElements = new Set();
  #visibilityListeners = new Map();

  constructor(mod, options = {}) {
    const func = `${funcPrefix}#constructor`;
    this.#module = mod instanceof Module ? mod : game.modules.get(mod);
    if (!this.#module) throw MHLError(`${PREFIX}.Error.BadModuleID`, { log: { mod }, func: funcPrefix });
    this.options = fu.mergeObject(this.defaultOptions, options);
    if (this.options.groups && Array.isArray(this.options.groups)) {
      for (const group of this.options.groups) {
        if (typeof group !== "string") {
          modLog(
            { group },
            { mod: this.options.modPrefix, type: "error", func, localize: true, prefix: `${PREFIX}.Error.InvalidGroup` }
          );
          continue;
        }
        this.#groupOrder.add(group);
      }
    }

    if (this.options.sort && !(this.options.sort === "a" || typeof this.options.sort === "function")) {
      modLog(
        { sort: options.sort },
        { mod: this.options.modPrefix, type: "error", func, localize: true, prefix: `${PREFIX}.Error.InvalidSort` }
      );
      this.options.sort = null;
    }
    if (options?.settings) this.registerSettings(settings);
    Hooks.on("renderSettingsConfig", this.#onRenderSettings.bind(this));
    this.#initialized = true;
  }

  get initialized() {
    return this.#initialized;
  }

  get defaultOptions() {
    const prefix = sluggify(this.#module.title, { camel: "bactrian" });
    return {
      buttons: true, // process settings with button data into clickable buttons instead of their regular type
      colorPickers: true, // add color picker elements to settings whose default value is a hex color code
      resetButtons: true, // add  reset-to-default buttons on each setting and for the whole module in its header
      visibility: true, // process settings with visibility data, only showing them in the settings window conditionally on the value of another setting
      groups: true, // handle setting grouping. if true, uses insertion order, use an array to specify an order.
      sort: null, // handle sorting of settings. "a" for alphabetical on name, or a custom compare function.
      settingPrefix: prefix + ".Setting", //String to start inferred localization keys with
      infix: "Choice", // localization key section placed between setting name and choice value when inferring choice localization
      disabledResetClass: "disabled-transparent", // css class toggled on reset buttons when the setting in question is already its default value
      modPrefix: prefix.replace(/[a-z]/g, ""), // prefix for logged errors/warnings
    };
  }

  #onRenderSettings(app, html, data) {
    const func = `${funcPrefix}#onRenderSettings`;
    html = html instanceof jQuery ? html[0] : html;
    const clientSettings = this.#settings.filter((setting) => setting?.scope !== "world");
    //if there's nothign to display anyway, bail
    if (!clientSettings.length && !isRealGM(game.user)) return;
    const section = htmlQuery(html, `section[data-category="${this.#module.id}"]`);
    section.classList.add("mhl-settings-manager");
    if (this.options.resetButtons) {
      this.#addResetAllButton(section);
    }
    const settingDivs = htmlQueryAll(section, `[data-setting-id]`);
    for (const div of settingDivs) {
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
      if (this.options.visibility && "visibility" in settingData) {
        this.#addVisibilityListeners(div, settingData.visibility);
      }
    }
    // handle groups, sorting, and sorting of groups
    this.#sortHTML(section);

    if (this.options.groups && this.options.resetButtons) {
      this.#addResetGroupButtons(section);
    }
    //initial visibility checks
    for (const el of this.#visibilityControlElements) {
      el.dispatchEvent(new Event("change"));
    }
  }

  get(key) {
    const func = `${funcPrefix}#get`;
    if (game?.user) {
      if (game.settings.settings.get(`${this.#module.id}.${key}`) === undefined) {
        mhlog(`${PREFIX}.Error.NotRegistered`, {
          type: "error",
          context: { setting: key, module: this.#module.title },
          localize: true,
          func,
        });
        return undefined;
      } else {
        const value = game.settings.get(this.#module.id, key);
        return value;
      }
    }
    return undefined;
  }

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
        ? [...data.entries()]
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
        context: { module: this.#module.id },
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
            context: { setting, module: this.#module.id },
          }
        );
      }
    }

    if (game?.user) {
      // 'are settings available' hack
      this.#updateHooks();
    } else {
      Hooks.once("setup", this.#updateHooks.bind(this));
    }
  }

  registerSetting(setting, data, { initial = false } = {}) {
    const func = `${funcPrefix}#registerSetting`;
    if (!this.#potentialSettings.has(setting)) this.#potentialSettings.add(setting);
    if (game.settings.settings.get(`${this.#module.id}.${setting}`)) {
      mhlog(`${PREFIX}.Error.DuplicateSetting`, {
        type: "error",
        localize: true,
        context: { setting, module: this.#module.id },
        func,
      });
      return false;
    }

    data = this.#processSettingData(setting, data);
    if (!data) return false;

    //actually register the setting finally
    this.#register(setting, data);
    // only update hooks if we're not inside a registerSettings call
    if (!initial) this.#updateHooks(setting);
    this.#potentialSettings.delete(setting);
    return true;
  }

  #processSettingData(setting, data) {
    const func = `${funcPrefix}#processSettingData`;
    //add the key to the data because Collection's helpers only operate on vaalues
    data.key = setting;
    //handle registering settings menus
    if ("type" in data && "label" in data && data.type.prototype instanceof FormApplication) {
      if ("icon" in data) {
        data.icon = getIconString(data.icon, { classesOnly: true });
      }
      data.menu = true;
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
      if (!data.visibility) delete data.visibility;
    }

    //update hooks every time a setting is changed
    const originalOnChange = "onChange" in data ? data.onChange : null;
    data.onChange = function (value) {
      this.#updateHooks(setting);
      if (originalOnChange) originalOnChange(value);
    }.bind(this);

    //handle setting-conditional hooks, has to happen after registration or the error handling in setHooks gets gross
    if ("hooks" in data) {
      data.hooks = this.#processHooksData(setting, data.hooks);
      if (!data.hooks) delete data.hooks;
    }
    if ("group" in data && typeof data.group === "string" && data?.config) {
      if (!this.#groups.has(data.group)) this.#groups.set(data.group, []);
      this.#groups.get(data.group).push(setting);
      if (!this.#groupOrder.has(data.group)) this.#groupOrder.add(data.group);
    } else {
      this.#groups.get("ungrouped").push(setting);
    }
    return data;
  }

  #register(setting, data) {
    if (data.menu) {
      game.settings.registerMenu(this.#module.id, setting, data);
    } else {
      game.settings.register(this.#module.id, setting, data);
      this.#settings.set(setting, data);
    }
  }

  #processNullLabels(setting, data) {
    if ("name" in data && data.name === null) {
      data.name = [this.options.settingPrefix, sluggify(setting, { camel: "bactrian" }), "Name"].join(".");
    }
    if ("hint" in data && data.hint === null) {
      data.hint = [this.options.settingPrefix, sluggify(setting, { camel: "bactrian" }), "Hint"].join(".");
    }
    if ("choices" in data) {
      for (const [choiceValue, choiceLabel] of Object.entries(data.choices)) {
        if (choiceLabel === null) {
          data.choices[choiceValue] = [
            this.options.settingPrefix,
            sluggify(setting, { camel: "bactrian" }),
            this.options.infix,
            sluggify(choiceValue, { camel: "bactrian" }),
          ].join(".");
        }
      }
    }
    if ("label" in data && data.label === null) {
      data.label = [this.options.settingPrefix, sluggify(setting, { camel: "bactrian" }), "Label"].join(".");
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
      buttonData.label = [this.options.settingPrefix, sluggify(setting, { camel: "bactrian" }), "Label"].join(".");
    }
    buttonData.label = String(buttonData.label);

    if ("icon" in buttonData) {
      buttonData.icon = getIconString(buttonData.icon);
    }
    return buttonData;
  }

  #processVisibilityString(setting, dependsOn) {
    const func = `${funcPrefix}#processVisibilityString`;
    const data = { setting, dependsOn, module: this.#module.title };
    const invert = dependsOn.at(0) === "!";
    dependsOn = invert ? dependsOn.slice(1) : dependsOn;
    if (!this.#settings.has(dependsOn) && !this.#potentialSettings.has(dependsOn)) {
      modLog(data, {
        type: "error",
        func,
        localize: true,
        mod: this.options.modPrefix,
        prefix: `${PREFIX}.Error.Visibility.UnknownDependency`,
        context: data,
      });
      return false;
    }
    return { [dependsOn]: !invert };
  }

  #processVisibilityData(setting, visibilityData) {
    const func = `${funcPrefix}#processVisibilityData`;
    const data = { setting, visibilityData, module: this.#module.title };
    let test;
    const dependsOn = {};
    if (typeof visibilityData === "string") {
      const processed = this.#processVisibilityString(setting, visibilityData);
      if (!processed) return false;
      fu.mergeObject(dependsOn, processed);
    } else if (Array.isArray(visibilityData)) {
      for (const dependency of visibilityData) {
        const processed = this.#processVisibilityString(setting, dependency);
        if (!processed) continue;
        fu.mergeObject(dependsOn, processed);
      }
      if (isEmpty(dependsOn)) return false;
    } else if (typeof visibilityData === "object") {
      const dependsOnError = () =>
        modLog(data, {
          type: "error",
          mod: this.options.modPrefix,
          func,
          context: data,
          localize: true,
          prefix: `${PREFIX}.Error.Visibility.RequireDependsOn`,
        });

      if (!("test" in visibilityData) || typeof visibilityData.test !== "function") {
        modLog(data, {
          type: "error",
          mod: this.options.modPrefix,
          func,
          context: data,
          localize: true,
          prefix: `${PREFIX}.Error.Visibility.RequireTest`,
        });
        return false;
      }
      test = visibilityData.test;
      if (!("dependsOn" in visibilityData)) {
        dependsOnError();
        return false;
      }
      if (!Array.isArray(visibilityData.dependsOn)) visibilityData.dependsOn = [visibilityData.dependsOn];
      if (!visibilityData.dependsOn.every((e) => typeof e === "string")) {
        dependsOnError();
        return false;
      }
      for (const dependency of visibilityData.dependsOn) {
        const processed = this.#processVisibilityString(setting, dependency);
        if (!processed) continue;
        fu.mergeObject(dependsOn, processed);
      }
      if (isEmpty(dependsOn)) return false;
    }
    return { dependsOn, test };
  }

  #processHooksData(setting, hooksData) {
    const func = `${funcPrefix}#processHooksData`;
    const goodHooks = [];
    if (!Array.isArray(hooksData)) hooksData = [hooksData];
    for (const hookData of hooksData) {
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
            context: { setting, hook: hookData?.hook, module: this.#module.id },
            func,
          }
        );
        continue;
      }
      //default test if none provided
      hookData.test ??= (value) => !!value;
      goodHooks.push(hookData);
    }
    return goodHooks.length ? goodHooks : false;
  }

  setHooks(setting, hooks) {
    const func = `${funcPrefix}#setHooks`;
    if (!this.#requireSetting(setting, func)) return undefined;
    const hooksData = this.#processHooksData(hooks);
    if (!hooksData) return false;
    const data = this.#settings.get(setting);
    data.hooks ??= [];
    data.hooks.push(...hooksData);
    this.#settings.set(setting, data);
    this.#updateHooks();
    return hooksData.length;
  }

  setButton(setting, buttonData) {
    const func = `${funcPrefix}#setButton`;
    if (!this.#requireSetting(setting, func)) return undefined;
    const fullKey = `${this.#module.id}.${setting}`;
    const savedData = game.settings.settings.get(fullKey);
    const processed = this.#processButtonData(setting, buttonData);
    if (processed) {
      savedData.button = processed;
      this.#settings.set(setting, savedData);
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
      this.#settings.set(setting, savedData);
      game.settings.settings.set(fullKey, savedData);
      return true;
    }
    return false;
  }

  #updateHooks(key = null) {
    for (const [setting, data] of this.#settings.entries()) {
      if ((key && key !== setting) || !("hooks" in data)) continue;
      const value = this.get(setting);
      for (let i = 0; i < data.hooks.length; i++) {
        const active = data.hooks[i].test(value);
        const existingHookID = data.hooks[i].id ?? null;
        if (active) {
          if (existingHookID) continue;
          data.hooks[i].id = Hooks.on(data.hooks[i].hook, data.hooks[i].action);
        } else if (existingHookID) {
          Hooks.off(data.hooks[i].hook, existingHookID);
          delete data.hooks[i].id;
        }
      }
      this.#settings.set(setting, data);
    }
  }

  #addColorPicker(div) {
    const pattern = "^#[A-Fa-f0-9]{6}";
    const regex = new RegExp(pattern);
    const settingName = div.dataset.settingId.split(".")[1];
    const defaultValue = game.settings.settings.get(div.dataset.settingId).default;
    const textInput = htmlQuery(div, 'input[type="text"]');
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
    const input = htmlQuery(div, ".form-fields").children[0];
    div.classList.add("submenu");
    const button = document.createElement("button");
    button.innerHTML = `${data.icon} <label>${localize(data.label)}</label>`;
    button.type = "button";
    button.classList.add("mhl-setting-button");
    button.addEventListener("click", data.action ?? (() => true));
    input.replaceWith(button);
  }

  #updateVisibility(setting, event) {
    const func = `${funcPrefix}#updateVisibility`;
    const section = htmlClosest(event.target, "section.mhl-settings-manager");
    const div = htmlQuery(section, `div[data-setting-id$="${setting}"]`);
    const visible = div.style.display !== "none";
    const formValues = this.#getFormValues(section, { visibleOnly: false });
    const visibilityData = this.#settings.get(setting).visibility;
    let show = true;
    if (!visibilityData.test) {
      for (const [dependency, test] of Object.entries(visibilityData.dependsOn)) {
        const match = !!formValues[dependency] == test;
        if (match) continue;
        show = false;
      }
    } else {
      const dependencies = Object.keys(visibilityData.dependsOn);
      let relevantFormValues, relevantSavedValues;
      if (dependencies.length === 1) {
        relevantFormValues = formValues[dependencies[0]];
        relevantSavedValues = this.get(dependencies[0]);
      } else {
        relevantFormValues = Object.entries(formValues).reduce((acc, [setting, value]) => {
          if (!dependencies.includes(setting)) return acc;
          acc[setting] = value;
          return acc;
        }, {});
        relevantSavedValues = dependencies.reduce((acc, setting) => {
          acc[setting] = this.get(setting);
          return acc;
        }, {});
      }
      show = visibilityData.test(relevantFormValues, relevantSavedValues, visible) ?? true;
    }
    div.style.display = show ? "flex" : "none";
  }

  #addVisibilityListeners(div, data) {
    const func = `${funcPrefix}#addVisibilityListeners`;
    const section = htmlClosest(div, "section.mhl-settings-manager");
    const setting = div.dataset.settingId.split(".")[1];
    const dependencies = Object.keys(data.dependsOn);
    const existingListeners = this.#visibilityListeners.get(setting) ?? {};
    for (const dependency of dependencies) {
      const controlElement = htmlQuery(section, `div[data-setting-id$="${dependency}"] :is(input,select)`);
      this.#visibilityControlElements.add(controlElement);
      const listener =
        existingListeners[dependency] ??
        function (event) {
          this.#updateVisibility(setting, event);
        }.bind(this);
      controlElement.addEventListener("change", listener);
      existingListeners[dependency] = listener;
    }
    this.#visibilityListeners.set(setting, existingListeners);
  }

  #addResetAllButton(section) {
    const func = `${funcPrefix}#addResetAllButton`;
    const h2 = htmlQuery(section, "h2");
    const span = document.createElement("span");
    span.classList.add("mhl-reset-all");
    span.innerHTML = `<a data-reset-all="${this.#module.id}"><i class="fa-regular fa-reply-all"></i></a>`;
    const anchor = htmlQuery(span, "a");
    anchor.addEventListener("click", this.#onResetMultipleClick.bind(this));
    h2.appendChild(span);
  }

  #addResetGroupButtons(section) {
    const func = `${funcPrefix}#addResetGroupButtons`;
    const h3s = htmlQueryAll(section, 'h3[data-group]')
  }

  #addResetButton(div) {
    const func = `${funcPrefix}#addResetButton`;
    const setting = div.dataset.settingId.split(".")[1];
    const label = htmlQuery(div, "label");
    const firstInput = htmlQuery(div, "input, select");
    if (!firstInput) return undefined; // something's gone wrong or its a settings menu
    // only time there should be more than one input per div is colorpickers, and they'll update the text field anyway.
    const anchor = document.createElement("a");
    anchor.dataset.resetFor = setting;
    anchor.innerHTML = '<i class="fa-regular fa-arrow-rotate-left"></i>';
    anchor.dataset.tooltipDirection = "UP";
    label.append(anchor);
    firstInput.addEventListener(
      "change",
      function (event) {
        this.#updateResetButton(event);
        this.#updateResetAllButton(event);
      }.bind(this)
    );
    //initial check if setting === default
    firstInput.dispatchEvent(new Event("change"));
  }

  #updateResetAllButton(event) {
    const func = `${funcPrefix}#updateResetAllButton`;
    const section = htmlClosest(event.target, "section.mhl-settings-manager");
    const anchor = htmlQuery(section, `a[data-reset-all="${this.#module.id}"]`);
    const formValues = this.#getFormValues(section);
    const isGM = isRealGM(game.user);
    this.#resetAllListener.listener ??= this.#onResetMultipleClick.bind(this);
    // I know ?? undefined is redundant, but it'll help me remember. === false because no default returns undefined.
    // also check for GM status for world settings
    const resettables = this.#settings.filter(
      (s) => (s?.scope === "world" ? isGM : true) && this.#isDefault(s.key, formValues[s.key] ?? undefined) === false
    );
    if (!resettables.length) {
      anchor.classList.add(this.options.disabledResetClass);
      anchor.dataset.tooltip = localize(`${PREFIX}.ResetAll.AllDefault`);
      if (this.#resetAllListener.active) {
        anchor.removeEventListener("click", this.#resetAllListener.listener);
      }
      this.#resetAllListener.active = false;
    } else {
      anchor.classList.remove(this.options.disabledResetClass);
      anchor.dataset.tooltip = localize(`${PREFIX}.ResetAll.Tooltip`);
      if (!this.#resetAllListener.active) {
        anchor.addEventListener("click", this.#resetAllListener);
        this.#resetAllListener.active = true;
      }
    }
  }
  #updateResetButton(event) {
    const div = htmlClosest(event.target, "div[data-setting-id]");
    const anchor = htmlQuery(div, "a[data-reset-for]");
    const setting = anchor.dataset.resetFor;
    const settingData = this.#settings.get(setting);
    const firstInput = htmlQuery(div, "input, select");
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

  #setInputValues(div, value) {
    const func = `${funcPrefix}#setInputValues`;
    const inputs = htmlQueryAll(div, "input, select");
    for (const input of inputs) {
      //grr checkboxen
      if (input.nodeName === "INPUT" && input.type === "checkbox") {
        input.checked = value;
      }
      if (input.type === "range") {
        const span = htmlQuery(div, "span.range-value");
        span.innerText = value;
      }
      input.value = value;
      input.dispatchEvent(new Event("change")); //to force visibility updates
    }
  }

  #isDefault(setting, value = undefined) {
    const func = `${funcPrefix}#isDefault`;
    const data = this.#settings.get(setting);
    const defaultValue = "default" in data ? data.default : undefined;
    if (defaultValue === undefined) return undefined;
    // this is to support checking if the form value = default
    value = value === undefined ? this.get(setting) : value;
    const currentValue = "type" in data ? data.type(value) : value;
    return typeof currentValue === "object"
      ? isEmpty(fu.diffObject(defaultValue, currentValue))
      : defaultValue === currentValue;
  }

  #getFormValues(section, { visibleOnly = true } = {}) {
    const divs = htmlQueryAll(section, "div[data-setting-id]");
    return divs.reduce((acc, curr) => {
      const firstInput = htmlQuery(curr, "input, select");
      if (!firstInput || (visibleOnly && curr.style.display === "none")) return acc;
      const setting = curr.dataset.settingId.split(".")[1];
      const data = this.#settings.get(setting);
      const inputValue = this.#_value(firstInput);
      acc[setting] = "type" in data ? data.type(inputValue) : inputValue;
      return acc;
    }, {});
  }
  async #onResetMultipleClick(event) {
    const func = `${funcPrefix}#onResetMultipleClick`;
    const section = htmlClosest(event.target, "section.mhl-settings-manager");
    const formValues = this.#getFormValues(section);
    let defaultlessCount = 0;
    const defaultlessList = [];
    let areDefault = 0;
    const areDefaultList = [];
    const changed = {};
    const isGM = isRealGM(game.user);
    let settings, division;
    const anchor = htmlClosest(event.target, 'a')
    if (anchor.dataset?.resetAll) {
      division = this.#module.title;
      settings = this.#settings.entries();
    } else if (anchor.dataset?.resetGroup) {
      division = anchor.dataset.resetGroup;
      settings = this.#groups.get(division).map(s=>[s,this.#settings.get(s)]);
    }
    for (const [setting, data] of settings) {
      if ("button" in data) continue;
      if (data?.scope === "world" && !isGM) continue;
      if (!("default" in data)) {
        defaultlessList.push(setting);
        defaultlessCount++;
        continue;
      }
      const storedValue = this.get(setting);
      const visible = setting in formValues;
      const currentValue = visible ? formValues[setting] : storedValue;
      if (this.#isDefault(setting, currentValue)) {
        areDefaultList.push(setting);
        areDefault++;
        continue;
      }
      //make the object settings presentable by stringifying
      changed[setting] = {
        config: "config" in data && data.config,
        currentValue: typeof currentValue === "object" ? JSON.stringify(currentValue, null, 2) : currentValue,
        visible,
        defaultValue: typeof data.default === "object" ? JSON.stringify(data.default, null, 2) : data.default,
      };
    }

    const dialogData = {
      title: localize(`${PREFIX}.Reset.Title`),
      content: `modules/${MODULE_ID}/templates/MHLSettingsManager-ResetMultiple.hbs`,
      contentData: {
        isGM: isRealGM(game.user),
        division,
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
    // mhlog(dialogData);
    const doReset = await MHLDialog.confirm(dialogData, dialogOptions);
    if (!doReset) return;
    for (const [setting, data] of Object.entries(changed)) {
      const div = htmlQuery(section, `div[data-setting-id$="${setting}"]`);
      if (data.visible) this.#setInputValues(div, data.defaultValue);
      this.reset(setting);
    }
    this.#updateResetAllButton(event);
  }

  #sortHTML(section) {
    const existingNodes = Array.from(section.children);
    const sortOrder = [existingNodes.shift()]; // add the h2 in first
    if (this.options.groups) {
      if (this.options.groups === "a") {
        this.#groupOrder = new Set([
          "ungrouped",
          ...[...this.#groupOrder]
            .filter((g) => g !== "ungrouped")
            .toSorted((a, b) => localize(a).localeCompare(localize(b))),
        ]);
      }
      for (const group of this.#groupOrder) {
        if (group !== "ungrouped") {
          const groupHeader = document.createElement("h3");
          groupHeader.innerText = localize(group);
          groupHeader.dataset.group = group;
          sortOrder.push(groupHeader);
        }
        const settings = this.#groups
          .get(group)
          .filter((s) => this.#settings.get(s)?.config)
          .map((s) => {
            const node = existingNodes.find((n) => n.dataset?.settingId?.includes(s));
            const name = htmlQuery(node, "label").innerText;
            return { id: s, node, name };
          });
        if (this.options.sort) {
          if (this.options.sort === "a") {
            settings.sort((a, b) => a.name.localeCompare(b.name));
          } else {
            settings.sort(this.options.sort);
          }
        }
        for (const setting of settings) {
          sortOrder.push(setting.node);
        }
      }
    } else if (this.options.sort) {
      const settings = this.#settings
        .filter((s) => s?.config)
        .map((s) => {
          const node = existingNodes.find((n) => n.dataset?.settingId?.includes(s.key));
          mhlog({ node, setting: s });
          const name = htmlQuery(node, "label").innerText;
          return { id: s, node, name };
        });

      if (this.options.sort === "a") {
        settings.sort((a, b) => a.name.localeCompare(b.name));
      } else {
        settings.sort(this.options.sort);
      }
      for (const setting of settings) {
        sortOrder.push(setting.node);
      }
    } else {
      //no sorting to be done
      return;
    }
    //do the reorg
    for (const node of sortOrder) {
      section.appendChild(node);
    }
  }
  async #onResetClick(event) {
    const skipDialog = event.detail?.skipDialog ?? false;
    const div = htmlClosest(event.target, "div[data-setting-id]");
    const label = htmlQuery(div, "label");
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
    this.#setInputValues(div, defaultValue);
    this.reset(setting);
    this.#updateResetButton(event);
  }

  #requireSetting(setting, func = null) {
    if (!this.#settings.has(setting)) {
      mhlog(`${PREFIX}.Error.NotRegistered`, {
        type: "error",
        localize: true,
        context: { setting, module: this.#module.id },
        func,
      });
      return false;
    }
    return true;
  }
}
