// druid: look, weapon/offhand art, projectile/area/effect visuals and skill icons (render/registry).
// The druid wields the existing staves (with druidic ornaments drawn by its decor) and carves totems (offhand):
//   look.ts  — CLASS_LOOK, the druid decor (hair, beard, antler headdress, pelts, kilt, belt totem, staff head),
//              per-skill pose remap and cast flourishes, OFFHAND_ART.totem (+ inventory icon)
//   vfx.ts   — PROJ_ART / AREA_ART / EFFECT_ART / FX_EVENT / BUFF_ART for every visual the sim emits
//   icons.ts — SKILL_ICON for all six skills
import './look';
import './vfx';
import './icons';
