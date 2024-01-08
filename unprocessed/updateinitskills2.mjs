/* Update Initiative Skills 2.0 - esheyw */

//Check for one or more selected tokens:
const tokens = canvas.tokens.controlled;
if (!tokens.length) {
    const charToken = game.user.character?.getActiveTokens()[0];
    if (!charToken) {
        ui.notifications.warn("Please select at least one token or assign yourself a character.");
        return;
    } else {
        tokens.push(charToken);
    }
}

async function submitCallback(html, event) {
  const data = new FormDataExtended(html[0].querySelector("form")).object;
  if (data['all']) {
      const allskill = data['all'];
      delete data['all'];
      for (const id of Object.keys(data)) {
          let actor = fromUuidSync(id)?.actor;
          await actor.update({
            'system.attributes.initiative.statistic': allskill
          });   
      }
  } else {
      delete data['all'];
      for (const [id,skill] of Object.entries(data)) {
          let actor = fromUuidSync(id)?.actor;
          await actor.update({
            'system.attributes.initiative.statistic': skill
          });   
      }
  }
}
let templatedata = {};
templatedata.uskills = Object.entries(CONFIG.PF2E.skillList)
templatedata.uskills.unshift(['perception', 'PF2E.PerceptionLabel'])
templatedata.uskills.pop(); // remove the generic lore entry
templatedata.uskills = templatedata.uskills.map(e=>{return {slug: e[0], label: e[1]}})
templatedata.tokens = tokens.map(t=>{
    let tout = {};
    tout.name = t.name;
    tout.id = t.document.uuid;
    tout.skills = t.actor.skills;
    return tout;
});
let template = `
<form>
    <div class="form-group">
        <label for="all">All</label>
        <select id="all" name="all">
            {{selectOptions uskills nameAttr="slug" labelAttr="label" sort=true blank="-" localize="true"}}
        </select>
    </div>
    <hr />
    {{#each tokens as |token|}}
        <div class="form-group">
            <label for="{{token.id}}">{{token.name}}</label>
            <select id="{{token.id}}" name="{{token.id}}">
                <option value="perception" selected>Perception</option>
                {{selectOptions token.skills nameAttr="slug" labelAttr="label" sort="true"}}
            </select>
        </div>
    {{/each}}
</form>`;
let compiled = Handlebars.compile(template)(templatedata);
const dData = {
  title: `Set Initiative Skills`,
  content: compiled,
  buttons: {
    yes: {
      icon: "<i class='fas fa-check'></i>",
      label: `Apply Changes`,
      callback:  submitCallback,
    },
    no: {
      icon: "<i class='fas fa-times'></i>",
      label: `Cancel Changes`
    },
  },
  default: "yes", 
}
new Dialog(dData).render(true);