import { anyTokens } from "../helpers/tokenHelpers.mjs";
import { setInitiativeStatistic } from "../helpers/pf2eHelpers.mjs";
import { MHLDialog } from "../classes/MHLDialog.mjs";
import { MODULE } from "../constants.mjs";

export async function updateInitiativeSkillsDialog() {
  const tokens = anyTokens().filter(t=>(!t.actor.traits.has('minion') && ['character', 'npc'].includes(t.actor.type)));
  async function submitCallback(html) {
    const { all, ...data } = new FormDataExtended(html[0].querySelector("form")).object;
    if (all) {
      for (const id of Object.keys(data)) {
        let actor = fromUuidSync(id)?.actor;
        await setInitiativeStatistic(actor, skill);
      }
    } else {
      for (const [id, skill] of Object.entries(data)) {
        let actor = fromUuidSync(id)?.actor;
        await setInitiativeStatistic(actor, skill);
      }
    }
  }
  const contentData = {
    uskills: Object.entries(CONFIG.PF2E.skillList),
    tokens: tokens.map((t) => ({
      name: t.name,
      id: t.document.uuid,
      skills: t.actor.skills,
    })),
  };
  contentData.uskills.unshift(["perception", "PF2E.PerceptionLabel"]);
  contentData.uskills.pop(); // remove the generic lore entry
  contentData.uskills = contentData.uskills.map((e) => ({
    slug: e[0],
    label: e[1],
  }));

  const dialogData = {
    contentData,
    title: `Set Initiative Skills`,
    content: `/modules/${MODULE}/templates/updateInitiativeSkills.hbs`,
    buttons: {
      yes: {
        icon: "<i class='fas fa-check'></i>",
        label: `Apply Changes`,
        callback: submitCallback,
      },
      no: {
        icon: "<i class='fas fa-times'></i>",
        label: `Cancel Changes`,
      },
    },
    default: "yes",
  };
  // console.warn(templateData,dialogData)
  new MHLDialog(dialogData).render(true);
}
