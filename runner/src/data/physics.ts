// Game-feel tunables. Every number the sim and the fairness validator share lives here.
// Coordinates: logical px, y grows DOWN, 1 m = 1 TILE = 40 px. Fixed step 1/60 s.

export const DT = 1 / 60;

// ---- View / grid ----
export const VIEW_W = 960;
export const VIEW_H = 540;
export const TILE = 40;
export const ROWS = 12;                 // chunk rows 0..11; row 11 is the ground row
export const GROUND_ROW = 11;
export const GROUND_Y = GROUND_ROW * TILE; // 440: top surface of the ground
export const PLAYER_SCREEN_X = 220;     // camera keeps the player here → 740 px look-ahead
export const PX_PER_M = TILE;

// ---- Player kinematics ----
export const GRAVITY = 3200;            // px/s²
export const JUMP_V = 1040;             // first jump → apex 169 px, 0.65 s airtime
export const DJUMP_V = 900;             // air jump → +127 px
export const FASTFALL_MUL = 2.2;        // holding slide in the air pulls you down faster
export const MAX_FALL_V = 1800;
export const COYOTE_T = 0.08;           // may still jump this long after running off an edge
export const JUMP_BUFFER_T = 0.12;      // a press this early before landing still jumps
export const MAX_JUMPS = 2;             // characters may raise this

// ---- Hurt/pick boxes (smaller than the drawn sprite ≈ 56×84 standing) ----
export const STAND_W = 36;
export const STAND_H = 70;
export const SLIDE_W = 52;
export const SLIDE_H = 32;
export const FOOT_W = 24;               // support check width (edges are forgiving)
export const PICK_PAD = 16;             // pickups are collected this far outside the hurtbox
export const GIANT_SCALE = 2.1;

// ---- Hazard geometry (relative to its grid cell; bottom-aligned unless noted) ----
export const SPIKE_W = 30, SPIKE_H = 36;      // '^' single jump
export const TALL_W = 34, TALL_H = 176;       // 'A' taller than a single-jump apex → needs the air jump
export const HANG_W = 40, HANG_BOTTOM_INSET = 6; // 'v' hangs from above; bottom = cell bottom − 6 (row 9 → y 394)
export const PLATFORM_THICK = 18;             // '-' one-way shelf, drawn thickness only

// ---- Speed tiers (px/s). Difficulty tier t runs at SPEED_TIERS[t]. ----
export const SPEED_TIERS = [420, 460, 500, 545, 590, 640] as const;
export const MAX_TIER = SPEED_TIERS.length - 1;
export const SPEED_EASE = 60;           // px/s² — how fast actual speed approaches the target

// ---- Fairness validator margins ----
export const VALIDATE_PAD = 5;          // hurtbox inflated by this on every side while validating
export const VALIDATE_INPUT_STEP = 4;   // decisions only every 4 frames (67 ms) — no frame-perfect paths
export const VALIDATE_SPEED_STEP = 20;  // chunks are proven at every 20 px/s within their tier range
