export function levelBasedDC(level) {
  let DCbyLevel = [
    14, 15, 16, 18, 19, 20, 22, 23, 24, 26, 27, 28, 30, 31, 32, 34, 35, 36, 38, 39, 40, 42, 44, 46, 48, 50,
  ];
  let DC = 0;
  if (level >= DCbyLevel.length || level < -1) {
    console.warn(`levelBasedDC | Given level ${level} out of bounds! Defaulting to level 25.`);
    level = 26;
  }
  if (level === -1) {
    DC = 13;
  } else {
    DC = DCbyLevel[level];
  }
  return DC;
}

export async function setInitSkill(actor, skillname = "perception") {
  return await actor.update({
    "system.attributes.initiative.statistic": skillname,
  });
}