// paladin: look, weapon/offhand art, projectile/area/effect visuals and skill icons (render/registry).
// The paladin wields existing maces/swords and shields (no new item categories); the rest lives in:
//   look.ts    — CLASS_LOOK, the knight decor (tabard, cape, helms, arms, pauldrons), heraldic shield art
//   weapons.ts — WEAPON_ART 'pl_mace': the order's maces by base tier (club, flanged mace, morning star, war hammer)
//   vfx.ts     — PROJ_ART / AREA_ART / EFFECT_ART / FX_EVENT / BUFF_ART for every visual the sim emits
//   icons.ts   — SKILL_ICON for all six skills
import './look';
import './weapons';
import './vfx';
import './icons';
