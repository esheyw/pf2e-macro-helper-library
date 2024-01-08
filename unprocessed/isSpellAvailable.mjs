function isSpellAvailable(actor, spell, { readyToCast = true, spellRank = null, spellcastingEntry = null} = {}) {
  //if the actor isn't a spellcaster, what are we even doing
  if (!actor?.isSpellcaster) return false;

  let spellName = "";
  let isFocusSpell = false;
  //if passed a Spell object, use its name and rank, check if focus spell or cantrip
  if (typeof spell === 'string') {
      spellName = spell;
  } else if (['spell', 'focus'].includes(spell?.category?.value)) {
      spellName = spell.name;
      spellRank ??= spell.rank;
      isFocusSpell = spell.isFocusSpell;
  } else {
      return ui.notifications.error('isSpellAvailable: spell must be a string or a non-ritual spell object.');
  }
  
  if (spellRank !== null && (spellRank < 1 || spellRank > 11)) {
  return ui.notifications.error(`isSpellAvailable: spellRank must be between 1 and 11, provided ${spellRank}`)
}

  //limit to focus entries if passed focus spell, ignore ritual entries
  let entries = actor.spellcasting.contents.filter(e => !e.isRitual && (!isFocusSpell || e.isFocusPool)) ?? [];
  //if provided an entry name, find just that one
  // console.warn(entries)
  if (spellcastingEntry) {
      selectedEntry = entries.find(e => e.name === spellcastingEntry);
      if (!selectedEntry) {
          return ui.notifications.error(`isSpellAvailable: Spellcasting entry '${spellcastingEntry}' does not exist on actor ${actor?.name}`);
      }
      entries = [selectedEntry];
  }
  for (let entry of entries) {        
      // we want a spell matching the name, and that matches one of 
      // - is the rank specified
      // - is a cantrip
      // - is a signature spell
      // if there's more than one, take the one with the lowest rank
      const extantSpell = entry.spells.contents
                          .filter(sp => 
                              sp.name === spellName
                              && (sp.isCantrip
                              || (spellRank && sp.rank === spellRank)
                              || sp.system?.location?.signature
                              || !spellRank)) 
                          .reduce((prev,curr) => (prev?.rank < curr?.rank ? prev : curr), null);
      // if spell isn't found in this entry, it can't be available via it, try the next one
      // console.warn('extantSpell', extantSpell)
      if (!extantSpell) continue; 

      //if we just want to check if the spell is prepared/known, we can call it here
      if (!readyToCast) return true;
      
      const spellID = extantSpell._id;        
      const allSlots = Object.values(entry.system.slots);
      // cantrips can always be cast unless they're not prepared in a prepared entry
      if (extantSpell.isCantrip) {
          if (!entry.isPrepared || Object.values(allSlots[0].prepared).find(slot => slot.id === spellID)) return true;
          //spell is not prepared in this entry
          continue;
      }
      // remove cantrip slots from consideration from here on
      allSlots.shift(); 
      
      if (entry.isFocusPool) {
          // we know we have the spell, so just test if we have focus points
          return (actor.system.resources.focus.value >= 1);
      }
      // Innate spells store their uses per spell, no slots
      if (entry.isInnate) {
          if (extantSpell.system.location.uses.value > 0) return true;
      }
      
      // if spellRank set, limit to just those slots, accounting for lack of cantrip slots
      // otherwise limit to ranks of the spell's or higher
      // console.warn(allSlots)
      const relevantSlotRanks = spellRank
                            ? [allSlots[spellRank - 1]] 
                            : allSlots.filter(sr=>sr.max > 0).slice(extantSpell.rank - 1); 
      console.warn(relevantSlotRanks);
      if (entry.isSpontaneous) {
          // we have already narrowed ranks down to ones that can cast the spell, do any of them have unused slots?
          for (let slotRank of relevantSlotRanks) {
              if (slotRank.value > 0) return true;
          }
      }
      
      if (entry.isPrepared) {
          for (let slotRank of relevantSlotRanks) {
              if (entry.isFlexible) {
                  if (slotRank.value > 0) return true; // do we have any unused spell slots of sufficient rank
              }
              
              preparedSlotsThisRank = Object.values(slotRank.prepared);
              foundSpell = preparedSlotsThisRank.find(slot => slot.id === spellID && (!readyToCast || slot?.expended !== true));
              
              if (foundSpell) return true;
          }
      }
  }
  
  return false;
}

const options = {
  // spellRank: 1,
  // spellcastingEntry: 'Divine Flexible Spells',
  // readyToCast: false,
};
let mila = game.actors.getName('Mila');
let font = mila.spellcasting.contents[1] 
console.warn(isSpellAvailable(token.actor, 'Blur', options));