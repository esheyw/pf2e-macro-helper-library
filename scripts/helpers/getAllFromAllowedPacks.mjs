import { MHLError } from "./helpers.mjs";
const PREFIX = "MHL.GetAllFromAllowedPacks";
// types: [all, action, bestiary, campaignFeature, equipment, feat, hazard, spell] (compendium browser divisions + 'all')
//        if you need to find effects like this, too bad I guess
// fields: document fields required to index for provided filter
// filter: a function that takes one argument, returns bool, for .filter()
// strictSourcing: if true, will suppress documents with missing source information, if false they're let through
// fetch: if true, return full documents instead of the filtered index

export async function getAllFromAllowedPacks({
  type = "equipment",
  fields = [],
  filter = null,
  strictSourcing = true,
  fetch = false,
} = {}) {
  const func = "getAllFromAllowedPacks";
  const browser = game.pf2e.compendiumBrowser;
  const validTypes = Object.keys(browser.settings);
  validTypes.push("all");
  const aliases = {
    actor: "bestiary",
    npc: "bestiary",
    ability: "action",
  };

  const originalType = type;
  if (!validTypes.includes(type) && !validTypes.includes((type = aliases[type] ?? ""))) {
    throw MHLError(`MHL.Error.InvalidType`, { type: originalType }, { func });
  }
  if (!Array.isArray(fields) || (fields.length && fields.some((f) => typeof f !== "string"))) {
    throw MHLError(`${PREFIX}.Error.FieldsFormat`, null, { func, log: { fields } });
  }
  if (filter && typeof filter !== "function") {
    throw MHLError(`${PREFIX}.Error.Type.Function`, { var: "filter" }, { func, log: { filter } });
  }

  //initialize the sources list if it hasn't been set
  if (!Object.keys(browser.packLoader.sourcesSettings.sources).length) {
    await browser.packLoader.updateSources(browser.loadedPacksAll());
  }
  const packList =
    type === "all"
      ? Object.values(browser.settings).flatMap((t) => Object.entries(t))
      : Object.entries(browser.settings[type]);

  const loadablePacks = packList.filter(([_, p]) => p.load).map(([pack]) => pack);
  const unloadablePacks = packList.filter(([_, p]) => !p.load).map(([pack]) => pack);
  const sources = browser.packLoader.sourcesSettings.sources;
  const loadableSources = Object.values(sources)
    .filter((s) => s.load)
    .map((s) =>
      s.name.slugify({
        strict: true,
      })
    );
  fields.push("system.details.publication", "system.publication", "system.source", "system.details.source");

  let out = [];
  const sourceFilter = (d) => {
    const slug = (
      d?.system?.details?.publication?.title ??
      d?.system?.publication?.title ??
      d?.system?.details?.source?.value ??
      d?.system?.source?.value ??
      ""
    ).slugify({
      strict: true,
    });
    if (!slug) return strictSourcing ? false : true;
    return loadableSources.includes(slug);
  };

  for (const packName of loadablePacks) {
    const pack = game.packs.get(packName);
    const initialDocs = await pack.getIndex({
      fields,
    });
    const sourcedDocs = initialDocs.filter(sourceFilter);
    let filteredDocs = [];
    try {
      filteredDocs = filter ? sourcedDocs.filter(filter) : sourcedDocs;
    } catch (error) {
      ui.notifications.error(`Error in provided filter: ${error.toString()}`);
      return null;
    }

    if (fetch) {
      out.push(
        ...(await pack.getDocuments({
          _id__in: filteredDocs.map((d) => d._id),
        }))
      );
    } else {
      out.push(...filteredDocs);
    }
  }
  return out;
}
// TEST EXAMPLES:
/* 
const testFilter = (d) => d.system.traits.value.includes("exploration")

const symonFilter = (t) => t.type === "weapon"
 && t.system.level.value <= actor.level
 && t.system.range === null
 && !t.system.traits.value.includes("magical")
 && !t.system.traits.value.includes("bomb")
 && !t.system.traits.value.includes("vehicular")
 && t.system.potencyRune.value === null


const options = {
  type: "ability",
  fields: [
    "system.details.level",
    "system.traits",
    "system.level",
    "system.traits",
    "system.potencyRune",
    "system.range"
  ],
  filter: testFilter,
  strictSourcing: false,
  // fetch: true
}

let finalout = (await getAllFromAllowedPacks(options))
finalout = finalout ? finalout.map(d => {return{name: d.name, source: d?.system?.details?.publication?.title
       ?? d?.system?.publication?.title
       ?? d?.system?.details?.source?.value
       ?? d?.system?.source?.value
       ?? ""}}) : 'there was an error'
  console.warn('final out:', finalout); */
