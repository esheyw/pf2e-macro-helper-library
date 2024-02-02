import { MODULE_ID, SETTINGS, fu } from "./constants.mjs";

export function registerSettings() {
  for (const [setting, data] of Object.entries(SETTINGS)) {
    const settingPath = setting.replace("_", ".");
    fu.setProperty(game.pf2emhl.settings, settingPath, data?.default ?? null);
    const originalOnChange = data?.onChange ?? null;
    data.onChange = (value) => {
      fu.setProperty(game.pf2emhl.settings, settingPath, value);
      if (originalOnChange) originalOnChange(value);
    };
    game.settings.register(MODULE_ID, setting, data);
  }
}

export function updateSettingsCache() {
  for (const setting of Object.keys(SETTINGS)) {
    const settingPath = setting.replace("_", ".");
    fu.setProperty(game.pf2emhl.settings, settingPath, game.settings.get(MODULE_ID, setting));
  }
}

export function setting(key) {
  const settingPath = key.replace("_", ".");
  const cached = fu.getProperty(game.pf2mhl.settings, settingPath);
  return cached !== undefined ? cached : game.settings.get(MODULE_ID, key);
}
