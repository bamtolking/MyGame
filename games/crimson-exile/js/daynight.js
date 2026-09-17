'use strict';
// ===================== 낮밤 주기 (다크에덴) =====================
const Clock = {
  t: 0.14,            // 0..1  (0.0 새벽 시작)
  bloodMoon: false,
  rolledNight: -1,
  forced: null,       // 'day' | 'night' | 'bloodmoon' (맵 모드)
  cycles: 0,
  update(dt) {
    const prev = this.t;
    this.t += dt / CFG.DAY_LENGTH;
    if (this.t >= 1) { this.t -= 1; this.cycles++; }
    // 밤 시작 시 블러드문 판정
    const ph = this.phase();
    if (ph === 'night' && this.rolledNight !== this.cycles) {
      this.rolledNight = this.cycles;
      this.bloodMoon = this.forced === 'bloodmoon' ? true : chance(0.35);
      if (this.bloodMoon && typeof Game !== 'undefined' && Game.state === 'play') Game.announce('🌑 블러드문이 떠오른다! 몬스터가 미쳐 날뛴다', '#ff3355');
    }
    if (ph !== 'night' && this.bloodMoon && this.forced !== 'bloodmoon') this.bloodMoon = false;
  },
  rawPhase() {
    const t = this.t;
    if (t < 0.08) return 'dawn';
    if (t < 0.46) return 'day';
    if (t < 0.56) return 'dusk';
    return 'night';
  },
  phase() {
    if (this.forced === 'day') return 'day';
    if (this.forced === 'night' || this.forced === 'bloodmoon') return 'night';
    return this.rawPhase();
  },
  isNight() { return this.phase() === 'night'; },
  isDay() { return this.phase() === 'day'; },
  isTwilight() { const p = this.phase(); return p === 'dawn' || p === 'dusk'; },
  darkness() {
    if (this.forced === 'day') return 0.05;
    if (this.forced === 'night' || this.forced === 'bloodmoon') return 0.66;
    const t = this.t;
    // 새벽: 어둠 감소, 낮: 0, 황혼: 증가, 밤: 최대
    if (t < 0.08) return lerp(0.66, 0.05, t / 0.08);
    if (t < 0.46) return 0.05;
    if (t < 0.56) return lerp(0.05, 0.66, (t - 0.46) / 0.10);
    return 0.66;
  },
  label() {
    const p = this.phase();
    return { dawn: '새벽', day: '낮', dusk: '황혼', night: this.bloodMoon ? '블러드문' : '밤' }[p];
  },
  icon() {
    const p = this.phase();
    return { dawn: '🌅', day: '☀️', dusk: '🌇', night: this.bloodMoon ? '🩸' : '🌙' }[p];
  },
  // 종족별 시간 보너스
  classBonus(cls, extra) {
    const p = this.phase();
    const tm = CLASSES[cls].time;
    let b = 0;
    if (p === 'day') b = tm.day + (extra.inc_day || 0);
    else if (p === 'night') b = tm.night + (extra.inc_night || 0);
    else b = tm.twilight + (extra.inc_twilight || 0);
    if (this.bloodMoon && p === 'night') b += 0.10;
    return b;
  },
};
