import { MODULE_ID } from "./constants.mjs";
import { mhlog } from "./helpers/index.mjs";
import { MODULE } from "./init.mjs";
export const SETTINGS = {
  "log-level": {
    config: true,
    type: String,
    name: null,
    hint: null,
    choices: {
      debug: null,
      info: null,
      warn: null,
      error: null,
    },
    default: "warn",
    scope: "world",
  },
  "test-setting": {
    config: true,
    default: true,
    name: "test setting 1",
    hint: "just need something valid",
    type: Boolean,
    scope: "world",
    hooks: {
      hook: "preCreateMacro",
      action: () => console.warn("PRECREATE!"),
    },
  },
  "test-replacer": {
    config: true,
    scope: "world",
    name: null,
    hint: null,
    button: {
      label: null,
      icon: "fa-house",
      action: () => ui.notifications.info(`You're Home!`),
    },
  },
  "test-range": {
    config: true,
    default: 5,
    type: Number,
    scope: "world",
    name: null,
    hint: null,
    range: {
      min: 1,
      max: 10,
      step: 0.5,
    },
  },
  "test-choices": {
    config: true,
    default: "abbot",
    type: String,
    scope: "world",
    name: null,
    hint: null,
    choices: {
      abbot: null,
      bernie: null,
      costello: null,
    },
    hooks: [
      {
        hook: "hoverToken",
        action: (token) => console.warn(`hovered ${token.name}`),
        test: (value) => value === "costello",
      },
    ],
    visibility: {
      dependsOn: "test-range",
      test: (n) => n > 5,
    },
  },
  "test-color": {
    config: true,
    default: "#9f3f6f",
    type: String,
    name: null,
    hint: null,
    scope: "world",
  },
  "global-access": {
    config: true,
    default: true,
    type: Boolean,
    hint: null,
    name: null,
    scope: "world",
    onChange: (value) => {
      if (value) globalThis.mhl = MODULE().api;
      else delete globalThis.mhl;
    },
  },
  "legacy-access": {
    config: true,
    default: false,
    type: Boolean,
    hint: null,
    name: null,
    scope: "world",
    onChange: (value) => {
      if (value) game.pf2emhl = MODULE().api;
      else delete game.pf2emhl;
    },
  },
  "no-default": {
    config: true,
    type: String,
    name: null,
  },
  "test-client": {
    config: true,
    type: Boolean,
    name: null,
    default: true,
  },
};

export function setting(key) {
  const SM = MODULE()?.settingsManager;
  if (SM?.initialized && game?.user) {
    return SM.get(key);
  }
  return undefined;
}
