// v6/src/lib/hoo-trading/v6-engine.ts
import { createHash, createHmac as createHmac2 } from "node:crypto";

// v6/src/lib/hoo-trading/v6-random.ts
import { createCipheriv, createHmac } from "node:crypto";
var Random = class {
  key;
  buffer = Buffer.alloc(0);
  cursor = 0;
  words;
  spare;
  constructor(secret, domain, state = { words: 0, spare: null }) {
    this.key = createHmac("sha256", secret).update("hoo-v6-1:" + domain).digest();
    this.words = state.words;
    this.spare = state.spare;
  }
  u() {
    if (this.cursor >= this.buffer.length) {
      const offset = this.words * 4, iv = Buffer.alloc(16);
      iv.writeBigUInt64BE(BigInt(Math.floor(offset / 16)), 8);
      this.buffer = createCipheriv("aes-256-ctr", this.key, iv).update(Buffer.alloc(32768));
      this.cursor = offset % 16;
    }
    const v = (this.buffer.readUInt32LE(this.cursor) + 0.5) / 4294967296;
    this.cursor += 4;
    this.words++;
    return v;
  }
  n() {
    if (this.spare !== null) {
      const s = this.spare;
      this.spare = null;
      return s;
    }
    const r = Math.sqrt(-2 * Math.log(this.u())), a = 2 * Math.PI * this.u();
    this.spare = r * Math.sin(a);
    return r * Math.cos(a);
  }
  snapshot() {
    return { words: this.words, spare: this.spare };
  }
};
function weighted(r, values, weights) {
  let k = r.u() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < values.length; i++) {
    k -= weights[i];
    if (k <= 0) return values[i];
  }
  return values.at(-1);
}
function duration(r, scale) {
  return Math.max(2, Math.round(scale * Math.exp(0.65 * r.n() - 0.21)));
}

// v6/src/lib/hoo-trading/v6-shocks.ts
var COINS = ["HOO", "EGG", "COAL"];
var SHOCK_KINDS = ["news", "flow", "liquidity", "cascade"];
var SIGMA = { HOO: 9e-4, EGG: 15e-4, COAL: 27e-4 };
function initialShockState(r, prices) {
  return { events: [], serial: 0, excitation: 0, depth: { HOO: 1, EGG: 1, COAL: 1 }, cohorts: Object.fromEntries(COINS.map((s) => [s, { longTrigger: Math.log(prices[s]) - 0.025, shortTrigger: Math.log(prices[s]) + 0.025, longMass: 1, shortMass: 1 }])), rng: r.snapshot(), dropped: 0 };
}
function spawn(state, r, t, kind, scope, market, forcedDirection) {
  if (kind === "cascade" && state.events.some((e2) => e2.kind === "cascade" && e2.scope === scope)) return null;
  if (state.events.length >= 12) {
    state.dropped++;
    return null;
  }
  const valence = r.u() < 0.15 ? 0 : r.u() < 0.5 ? -1 : 1, direction = forcedDirection ?? (r.u() < 0.5 ? -1 : 1), severity = Math.exp(0.8 * r.n() - 0.32) * (r.u() < 0.12 ? 3.5 : 0.7);
  const exposure = {};
  for (const s of COINS) {
    if (scope === "common") exposure[s] = { HOO: 0.8, EGG: 1, COAL: 1.25 }[s] * (0.65 + 0.7 * r.u()) * (r.u() < 0.1 ? -1 : 1);
    else exposure[s] = s === scope ? 1 : r.u() < { HOO: 0.55, EGG: 0.4, COAL: 0.25 }[scope] ? (0.1 + 0.5 * r.u()) * (r.u() < 0.2 ? -1 : 1) : 0;
  }
  const e = { id: ++state.serial, kind, scope, born: t, phase: "delay", remaining: duration(r, kind === "cascade" ? 2 : 12), age: 0, phaseAge: 0, direction, valence, severity, confidence: 0.25 + 0.7 * r.u(), uncertainty: r.u(), outcome: null, generation: 0, exposure };
  state.events.push(e);
  return e;
}
function stepShocks(state, r, t, m, emit) {
  state.excitation *= 0.994;
  const avgVol = COINS.reduce((a, s) => a + m[s].vol, 0) / 3, avgDepth = COINS.reduce((a, s) => a + state.depth[s], 0) / 3;
  const context = (s) => ({ compression: 0.55, range: 0.7, volatile: 1.5, panic: 1.9 }[m[s].regime] ?? 1) * (1 + 0.2 * Math.log1p(m[s].regimeAge / 1e3)) * (0.65 + 0.35 * m[s].vol) / Math.sqrt(state.depth[s]);
  const births = [];
  if (r.u() < 15e-5 * (0.7 + 0.3 * avgVol) * (1 + state.excitation) / Math.sqrt(avgDepth)) births.push({ kind: weighted(r, SHOCK_KINDS, [3, 2, 2, 1]), scope: "common" });
  for (const s of COINS) {
    if (r.u() < { HOO: 11e-5, EGG: 18e-5, COAL: 28e-5 }[s] * context(s) * (1 + state.excitation * 0.7)) births.push({ kind: weighted(r, SHOCK_KINDS, [3, 3, 2, 1]), scope: s });
    const c = state.cohorts[s];
    c.longMass += 2e-3 * (1 - c.longMass);
    c.shortMass += 2e-3 * (1 - c.shortMass);
    const down = m[s].x < c.longTrigger, up = m[s].x > c.shortTrigger;
    if (down || up) {
      const mass = down ? c.longMass : c.shortMass;
      if (r.u() < Math.min(0.25, 0.035 * mass / Math.sqrt(state.depth[s]))) births.push({ kind: "cascade", scope: s, direction: down ? -1 : 1 });
      c.longTrigger = m[s].x - (0.012 + 0.04 * r.u());
      c.shortTrigger = m[s].x + (0.012 + 0.04 * r.u());
      if (down) c.longMass *= 0.2;
      else c.shortMass *= 0.2;
    }
  }
  for (const b of births) {
    const e = spawn(state, r, t, b.kind, b.scope, m, b.direction);
    if (e) {
      state.excitation += 0.06;
      emit?.({ type: "shock_birth", second: t, id: e.id, kind: e.kind, scope: e.scope, severity: e.severity, valence: e.valence });
    }
  }
  const output = Object.fromEntries(COINS.map((s) => [s, { pressure: 0, volMultiplier: 1, depth: state.depth[s], activity: 1, stress: 0 }]));
  for (const e of state.events) {
    e.age++;
    e.phaseAge++;
    if (--e.remaining <= 0) {
      const previous = e.phase;
      if (e.phase === "delay") {
        e.phase = "onset";
        e.remaining = duration(r, 12 + 18 * e.severity);
        if (e.kind === "news") {
          const sameTrend = e.scope === "common" ? 0 : Math.sign(m[e.scope].ret) * e.valence;
          const alignedProb = 0.55 + 0.18 * e.confidence - 0.13 * e.uncertainty - 0.08 * sameTrend;
          e.direction = e.valence ? r.u() < alignedProb ? e.valence : -e.valence : r.u() < 0.5 ? -1 : 1;
        }
      } else if (e.phase === "onset") {
        if (r.u() < 0.12) {
          e.outcome = "early_dissipation";
          e.phase = "aftermath";
          e.remaining = duration(r, 10);
        } else {
          e.phase = "spread";
          e.remaining = duration(r, 60 + 35 * e.severity);
          if (r.u() < 0.16) e.direction *= -1;
        }
      } else if (e.phase === "spread") {
        e.phase = "aftermath";
        e.outcome = weighted(r, ["v_recovery", "slow_recovery", "range", "failed_recovery", "aftershock", "trend_reversal", "volatile_only"], [1.2 * avgDepth, 1.4, 1.1, 1.2 / avgDepth, 1 + state.excitation, 1, 1.1 * avgVol]);
        e.remaining = duration(r, e.outcome === "v_recovery" ? 20 : e.outcome === "slow_recovery" ? 220 : 90);
      } else {
        emit?.({ type: "shock_end", second: t, id: e.id, kind: e.kind, scope: e.scope, outcome: e.outcome, duration: e.age, generation: e.generation });
        e.remaining = -1;
        continue;
      }
      e.phaseAge = 0;
      emit?.({ type: "shock_phase", second: t, id: e.id, kind: e.kind, scope: e.scope, from: previous, phase: e.phase, outcome: e.outcome, direction: e.direction, valence: e.valence, severity: e.severity, exposure: e.exposure });
    }
    if (e.phase === "delay") continue;
    let flow = e.direction, pressureScale = e.phase === "onset" ? 0.12 : e.phase === "spread" ? 0.055 : 0.04, stress = e.severity * Math.exp(-e.phaseAge / (40 + 20 * Math.sqrt(e.severity)));
    if (e.phase === "aftermath") {
      if (e.outcome === "v_recovery") {
        flow *= -1;
        pressureScale = 0.14;
      } else if (e.outcome === "slow_recovery") {
        flow *= -1;
        pressureScale = 0.025;
      } else if (e.outcome === "trend_reversal") flow *= -1;
      else if (e.outcome === "failed_recovery") flow *= e.phaseAge < 10 ? -1 : 1;
      else if (e.outcome === "aftershock") {
        pressureScale = 0.09;
        stress *= 1.3;
      } else {
        flow = 0;
        stress *= e.outcome === "volatile_only" ? 0.9 : 0.25;
      }
      stress *= Math.exp(-e.phaseAge / 160);
    }
    if (e.kind === "cascade" && e.phase === "spread" && e.generation < 4) {
      const s = e.scope === "common" ? "HOO" : e.scope;
      if (e.direction * m[s].ret > SIGMA[s] && r.u() < 0.025 / Math.sqrt(state.depth[s])) {
        e.generation++;
        e.severity *= 0.9 + 0.45 * r.u();
        e.remaining += duration(r, 8);
        emit?.({ type: "cascade_secondary", second: t, id: e.id, scope: e.scope, generation: e.generation });
      } else if (r.u() < 3e-3) {
        e.remaining = 1;
        if (r.u() < 0.4) e.direction *= -1;
      }
    }
    for (const s of COINS) {
      let exposure = e.exposure[s];
      if (e.scope !== s && e.scope !== "common" && e.phase === "onset" && e.phaseAge < 5) exposure = 0;
      if (!exposure) continue;
      const o = output[s], impact = stress * Math.abs(exposure);
      o.stress += impact;
      o.activity += impact * (e.kind === "flow" ? 1.4 : 1);
      const liquidityLoss = e.kind === "liquidity" ? 0.22 : e.kind === "cascade" ? 0.08 : 0.025;
      o.depth *= Math.exp(-liquidityLoss * impact / 12);
      o.pressure += flow * exposure * SIGMA[s] * stress * pressureScale / Math.sqrt(Math.max(0.08, state.depth[s]));
    }
  }
  state.events = state.events.filter((e) => e.remaining >= 0);
  for (const s of COINS) {
    const o = output[s];
    state.depth[s] = Math.max(0.08, Math.min(3, o.depth + 0.03 * (1 - o.depth)));
    o.depth = state.depth[s];
    o.volMultiplier = Math.sqrt(1 + o.stress * 0.35) / Math.sqrt(Math.max(0.25, o.depth));
    o.activity = Math.max(0.1, o.activity);
  }
  state.rng = r.snapshot();
  return output;
}

// v6/src/lib/hoo-trading/v6-patterns.ts
var OUTCOMES = ["breakout", "failed_breakout", "fakeout", "opposite_breakout", "invalidation", "range", "reversal", "extension"];
function outcomeProbabilities(c) {
  const i = c.familyIndex, base = [1.4 + 0.12 * (i % 4), 1 + 0.09 * ((i + 2) % 5), 0.8 + 0.1 * (i % 3), 0.7 + 0.08 * ((i + 1) % 4), 0.3, 0.7 + 0.1 * (i % 2), 0.65 + 0.1 * ((i + 1) % 3), 0.9 + 0.11 * ((i + 3) % 5)];
  const align = Math.tanh(c.alignment), risk = Math.log1p(c.stress) + Math.max(0, c.vol - 1), quality = Math.max(0.05, Math.min(1, c.quality)), formed = Math.log1p(c.duration / 120), size = Math.min(2, c.amplitude / 0.03);
  base[0] *= Math.exp(0.45 * align + 0.35 * quality - 0.18 * risk + 0.05 * formed);
  base[1] *= Math.exp(-0.2 * align + 0.28 * risk + 0.22 * (c.recentFailure ? 1 : 0));
  base[2] *= 1 + 0.3 / (c.depth + 0.2) + 0.12 * size;
  base[3] *= Math.exp(-0.4 * align + 0.16 * risk);
  base[4] *= 1 + 0.3 * risk + (1 - quality);
  base[5] *= Math.exp(-0.15 * risk + 0.1 * formed);
  base[6] *= 1 + 0.15 * risk + 0.2 * (1 - quality);
  base[7] *= Math.exp(0.5 * align + 0.2 * quality - 0.08 * risk + 0.08 * size);
  const sum = base.reduce((a, b) => a + Math.max(0.05, b), 0);
  return base.map((x) => Math.max(0.05, x) / sum);
}
function resolvePattern(r, c, early) {
  const probabilities = outcomeProbabilities(c);
  return { result: early ? "invalidation" : weighted(r, OUTCOMES, probabilities), probabilities };
}

// SR extension, generated from lib/hoo-trading/v6-support-resistance.ts
/** V6.1 support/resistance microstructure extension. SERVER ONLY.
 * Models uncertain reactions to CONFIRMED pivots and volume-concentrated price bands.
 * No future bars, user PnL/orders, synthetic oracle lines, or account input.
 * No forced bounce, exact cap, or deterministic post-break target.
 * When price crosses an established level, its market-facing role flips naturally.
 * SR pressure is a bounded fraction of normal one-minute volatility.
 */



function supportResistancePressure(q          )       {
 if(!(q.sigma>0)||!Number.isFinite(q.x))return 0;
 const width=Math.max(q.sigma*3.5,0.0015);
 const shockDamping=1/(1+Math.max(0,q.stress)*0.35);
 const regimeFactor=q.regime==='panic'?0.32:q.regime==='breakout'?0.55:q.regime==='volatile'?0.75:1;
 const nodeMax=Math.max(1,...q.nodes.map(n=>Math.max(0,n.v)));
 // Bounded outward pressure: above a level -> support; below -> resistance.
 // At a precise crossing pressure approaches zero, allowing breakouts and fakeouts.
 const response=(level       ,weight       )=>{
  const signed=(q.x-level)/width;
  if(Math.abs(signed)>4)return 0;
  const envelope=Math.exp(-0.5*signed*signed)*Math.tanh(2*Math.abs(signed));
  return Math.sign(signed)*envelope*weight;
 };
 let force=0;
 for(const p of q.pivots.slice(-10)){
  // A pivot is known only after its confirmation, preventing lookahead.
  if(p.confirmed>=q.t)continue;
  const age=Math.max(0,q.t-p.confirmed);
  const nearby=q.nodes.reduce((best,n)=>Math.max(best,Math.exp(-0.5*((p.x-n.x)/(width*1.7))**2)*Math.sqrt(Math.max(0,n.v)/nodeMax)),0);
  const strength=(0.7+0.3*nearby)*Math.exp(-age/4800);
  force+=response(p.x,strength);
 }
 // A weaker contribution from traded volume concentrations can create
 // natural levels even before a fully confirmed pivot exists.
 for(const n of q.nodes){
  const volumeWeight=Math.sqrt(Math.max(0,n.v)/nodeMax);
  force+=response(n.x,0.15*volumeWeight);
 }
 const bounded=Math.max(-0.17,Math.min(0.17,force*0.15));
 return q.sigma*bounded*shockDamping*regimeFactor;
}

// v6/src/lib/hoo-trading/v6-engine.ts
var ENGINE_VERSION = "hoo-v6-sr-candidate-1";
var SYMBOLS = ["HOO", "EGG", "COAL"];
var REGIMES = ["up", "down", "range", "compression", "breakout", "volatile", "panic", "recovery"];
var PATTERNS = ["ascending_triangle", "bull_flag", "bull_pennant", "double_bottom", "falling_wedge", "inverse_head_shoulders", "descending_triangle", "bear_flag", "bear_pennant", "rising_wedge_continuation", "rising_wedge_reversal", "double_top", "head_shoulders"];
var FIB = [0.382, 0.5, 0.618, 0.786];
var CONFIG = { HOO: { sigma: 9e-4, life: 6500, volume: 1700, jump: 5e-4, rho: 0.55 }, EGG: { sigma: 15e-4, life: 2900, volume: 850, jump: 1e-3, rho: 0.4 }, COAL: { sigma: 27e-4, life: 1600, volume: 240, jump: 22e-4, rho: 0.23 } };
var SPAN = [120, 720, 5760];
var CONFIG_HASH = createHash("sha256").update(JSON.stringify({ version: ENGINE_VERSION, CONFIG, SPAN, FIB })).digest("hex");
var sign = (x) => x < 0 ? -1 : 1;
function choose(rng, values, weights) {
  let k = rng.u() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < values.length; i++) {
    k -= weights[i];
    if (k <= 0) return values[i];
  }
  return values.at(-1);
}
function regime(r, previous, life) {
  const weights = REGIMES.map((n) => n === "up" || n === "down" ? 2 : n === "range" ? 1.4 : n === "panic" ? 0.25 : 1);
  if (previous === "panic") weights[7] *= 4;
  if (previous === "compression") weights[4] *= 3;
  if (previous === "up") weights[0] *= 1.8;
  if (previous === "down") weights[1] *= 1.8;
  const name = choose(r, [...REGIMES], weights), factor = name === "up" || name === "down" ? 1 : name === "range" ? 0.55 : name === "panic" ? 0.06 : 0.2;
  return { name, remaining: Math.max(20, Math.floor(life * factor * Math.exp(0.7 * r.n() - 0.245))), direction: name === "up" ? 1 : name === "down" ? -1 : r.u() > 0.5 ? 1 : -1, age: 0 };
}
function envelope(family, u) {
  switch (family) {
    case "ascending_triangle":
      return [1, -1 + 1.45 * u];
    case "descending_triangle":
      return [1 - 1.45 * u, -1];
    case "bull_pennant":
    case "bear_pennant":
      return [1 - 0.72 * u, -1 + 0.72 * u];
    case "falling_wedge":
      return [1 - 2 * u, -1 - 0.55 * u];
    case "rising_wedge_continuation":
    case "rising_wedge_reversal":
      return [1 + 0.55 * u, -1 + 2 * u];
    case "bull_flag":
    case "bear_flag":
      return [1 - 0.9 * u, -1 - 0.9 * u];
    default:
      return [1, -1];
  }
}
function makeEpisode(r, t, x, sigma, span, rg, fib) {
  const weights = PATTERNS.map((p, i) => {
    const bullish = i < 6;
    let w = rg.direction === (bullish ? 1 : -1) ? 1.4 : 0.8;
    if (fib && fib.direction === (bullish ? 1 : -1)) w *= 1.5;
    return w;
  });
  const family = choose(r, [...PATTERNS], weights), duration2 = Math.max(24, Math.round(span * Math.exp(0.5 * r.n() - 0.125))), amplitude = sigma * Math.sqrt(duration2) * (1.2 + r.u()), points = [];
  let ys;
  if (family === "double_bottom") ys = [0.4, -1, 0.65, -0.9, 0.55];
  else if (family === "double_top") ys = [-0.4, 1, -0.65, 0.9, -0.55];
  else if (family === "inverse_head_shoulders") ys = [0.3, -0.4, 0.6, -1.3, 0.5, -0.45, 0.6];
  else if (family === "head_shoulders") ys = [-0.3, 0.4, -0.6, 1.3, -0.5, 0.45, -0.6];
  else {
    const count = 5 + 2 * Math.floor(r.u() * 3);
    ys = Array.from({ length: count }, (_, i) => {
      const u = i / (count - 1), [h, l] = envelope(family, u);
      return i % 2 ? h : l;
    });
  }
  const intervals = ys.map((_, i) => i === 0 ? 0 : 0.65 + 0.7 * r.u()), total = intervals.reduce((a, b) => a + b, 0);
  let at = 0;
  for (let i = 0; i < ys.length; i++) {
    at += intervals[i];
    points.push([at / total, ys[i] + (r.u() - 0.5) * 0.15]);
  }
  const startY = points[0][1];
  for (const p of points) p[1] -= startY;
  const direction = PATTERNS.indexOf(family) < 6 ? 1 : -1;
  return { family, start: t, duration: duration2, amplitude, points, lastShape: 0, resolutionShape: 0, resolvedAt: 0, resolutionDuration: 0, anchor: x, stage: "forming", result: null, direction, invalid: false };
}
function shape(e, u) {
  const pts = e.points;
  let j = 1;
  while (j < pts.length - 1 && pts[j][0] < u) j++;
  const a = pts[j - 1], b = pts[j], f = Math.max(0, Math.min(1, (u - a[0]) / (b[0] - a[0])));
  return a[1] + (b[1] - a[1]) * (f * f * (3 - 2 * f));
}
function finitePrice(x) {
  const p = Math.exp(x);
  if (!(p > 0) || !Number.isFinite(p)) throw new Error("V6_NUMERIC_RANGE");
  return p;
}
function validateCheckpoint(c) {
  const walk = (v) => {
    if (typeof v === "number" && !Number.isFinite(v)) throw Error("V6_INVALID_CHECKPOINT_NUMBER");
    if (v && typeof v === "object") for (const child of Object.values(v)) walk(child);
  };
  walk(c);
  if (!Number.isSafeInteger(c.second) || !c.shock || !Array.isArray(c.shock.events) || c.shock.events.length > 12 || !c.entropy || !c.common || !c.coins) throw Error("V6_INVALID_CHECKPOINT");
  for (const s of SYMBOLS) {
    const a = c.coins[s];
    if (!a || !(a.price > 0) || Math.abs(Math.log(a.price) - a.x) > 1e-10 || !a.entropy || !a.regime || a.episodes.length !== 3 || !a.swing || a.nodes.length > 16 || !(c.shock.depth[s] > 0)) throw Error("V6_INVALID_CHECKPOINT");
  }
}
var V6Engine = class {
  poisoned = false;
  shockRng;
  secret;
  commonRng;
  rng;
  s;
  constructor(options) {
    if (!/^[a-f0-9]{64}$/.test(options.buildDigest)) throw new Error("V6_VERIFIED_BUILD_REQUIRED");
    if (options.secret.length < 24) throw new Error("V6_PRIVATE_SECRET_REQUIRED");
    if (!Number.isSafeInteger(options.startSecond)) throw new Error("V6_INVALID_START");
    this.secret = options.secret;
    const namespace = createHmac2("sha256", options.secret).update(options.buildDigest + ":" + CONFIG_HASH + ":" + options.startSecond + ":" + JSON.stringify(SYMBOLS.map((s) => options.prices[s]))).digest("hex");
    if (options.checkpoint) {
      const c = structuredClone(options.checkpoint);
      validateCheckpoint(c);
      if (c.buildDigest !== options.buildDigest || c.version !== ENGINE_VERSION || c.configHash !== CONFIG_HASH || c.namespace !== namespace || c.second < options.startSecond) throw new Error("V6_CHECKPOINT_MISMATCH");
      this.s = c;
    } else {
      for (const symbol of SYMBOLS) if (!(options.prices[symbol] > 0) || !Number.isFinite(options.prices[symbol])) throw new Error("V6_INVALID_ANCHOR");
      const commonRng = new Random(options.secret, "common");
      const coins = {};
      for (const symbol of SYMBOLS) {
        const r = new Random(options.secret, symbol), x = Math.log(options.prices[symbol]), rg = regime(r, void 0, CONFIG[symbol].life);
        coins[symbol] = { price: options.prices[symbol], x, previousReturn: 0, trendEMA: 0, logVol: 0, lastShock: 0, regime: rg, episodes: SPAN.map((span) => makeEpisode(r, options.startSecond, x, CONFIG[symbol].sigma, span, rg, null)), swing: { direction: 0, extreme: x, at: options.startSecond, pivots: [] }, nodes: [], fib: null, fibCooldown: 0, lastBreak: 0, entropy: r.snapshot() };
      }
      const sr = new Random(options.secret, "shock");
      this.s = { buildDigest: options.buildDigest, shock: initialShockState(sr, options.prices), version: ENGINE_VERSION, configHash: CONFIG_HASH, namespace, second: options.startSecond, common: regime(commonRng, void 0, 11e3), entropy: commonRng.snapshot(), coins };
    }
    this.shockRng = new Random(this.secret, "shock", this.s.shock.rng);
    this.commonRng = new Random(this.secret, "common", this.s.entropy);
    this.rng = Object.fromEntries(SYMBOLS.map((s) => [s, new Random(this.secret, s, this.s.coins[s].entropy)]));
  }
  get second() {
    return this.s.second;
  }
  get namespace() {
    return this.s.namespace;
  }
  checkpoint() {
    if (this.poisoned) throw new Error("V6_ENGINE_POISONED_RELOAD_COMMIT");
    this.s.entropy = this.commonRng.snapshot();
    for (const s of SYMBOLS) this.s.coins[s].entropy = this.rng[s].snapshot();
    return structuredClone(this.s);
  }
  next(onEvent) {
    if (this.poisoned) throw new Error("V6_ENGINE_POISONED_RELOAD_COMMIT");
    try {
      return this.advance(onEvent);
    } catch (e) {
      this.poisoned = true;
      throw e;
    }
  }
  advance(onEvent) {
    const t = this.s.second + 1, out = {};
    if (!Number.isSafeInteger(t)) throw new Error("V6_TIME_RANGE");
    const market = Object.fromEntries(SYMBOLS.map((symbol) => {
      const c = this.s.coins[symbol];
      return [symbol, { x: c.x, ret: c.previousReturn, vol: Math.exp(c.logVol), regime: c.regime.name, regimeAge: c.regime.age }];
    }));
    const impacts = stepShocks(this.s.shock, this.shockRng, t, market, (e) => onEvent?.(e));
    if (--this.s.common.remaining <= 0) this.s.common = regime(this.commonRng, this.s.common.name, 11e3);
    this.s.common.age++;
    const commonNormal = this.commonRng.n(), commonJump = this.commonRng.u() < 12e-5 ? this.commonRng.n() * 9e-3 : 0;
    const commonMicro = Array.from({ length: 20 }, () => this.commonRng.n());
    for (const symbol of SYMBOLS) {
      const c = this.s.coins[symbol], r = this.rng[symbol], cfg = CONFIG[symbol];
      const emit = (event) => onEvent?.({ symbol, second: t, ...event });
      if (--c.regime.remaining <= 0 || r.u() < Math.min(3e-3, 15e-5 * impacts[symbol].stress)) {
        const previous = c.regime.name;
        c.regime = regime(r, previous, cfg.life);
        emit({ type: "regime", previous, name: c.regime.name, duration: c.regime.remaining });
      }
      c.regime.age++;
      const rg = c.regime, volatile = rg.name === "volatile" || rg.name === "panic", targetVol = rg.name === "compression" ? -0.6 : rg.name === "panic" ? 0.65 : rg.name === "volatile" ? 0.4 : 0;
      c.logVol = 0.975 * c.logVol + 0.025 * targetVol + 0.035 * r.n() + 0.018 * (Math.abs(c.lastShock) - 0.8);
      const sigma = cfg.sigma * Math.exp(c.logVol);
      const impact = impacts[symbol];
      const trendDirection = rg.name === "up" ? 1 : rg.name === "down" ? -1 : rg.name === "range" || rg.name === "compression" ? 0 : rg.direction;
      const macroDirection = this.s.common.name === "up" ? 1 : this.s.common.name === "down" ? -1 : 0;
      const trend = cfg.sigma * (0.014 * trendDirection + 8e-3 * macroDirection);
      let structural = 0;
      for (let k = 0; k < c.episodes.length; k++) {
        let e = c.episodes[k];
        const age = t - e.start, u = age / e.duration;
        if (e.stage === "forming" && (u >= 1 || Math.abs(c.x - e.anchor) > 8 * e.amplitude || r.u() < 7e-5 * (volatile ? 3 : 1) * (1 + 0.3 * impact.stress))) {
          e.stage = "resolved";
          e.resolutionShape = e.lastShape;
          e.resolvedAt = t;
          e.resolutionDuration = duration(r, Math.max(12, e.duration * (0.12 + 0.3 * r.u())));
          e.invalid = u < 1;
          const quality = Math.exp(-Math.abs(c.x - e.anchor - e.lastShape * e.amplitude) / Math.max(sigma * Math.sqrt(Math.max(1, age)), 1e-4));
          const context = { familyIndex: PATTERNS.indexOf(e.family), alignment: e.direction * (trendDirection + Math.tanh(c.trendEMA / sigma) * 2), duration: age, amplitude: e.amplitude, vol: Math.exp(c.logVol), stress: impact.stress, depth: impact.depth, quality, recentFailure: c.lastBreak < 0 };
          const resolved = resolvePattern(r, context, e.invalid);
          e.result = resolved.result;
          c.lastBreak = e.result === "breakout" || e.result === "extension" ? 1 : -1;
          emit({ type: "pattern", family: e.family, result: e.result, start: e.start, duration: age, plannedDuration: e.duration, amplitude: e.amplitude, layer: k, probabilities: resolved.probabilities, context });
        }
        if (e.stage === "forming") {
          const y = shape(e, Math.min(1, u));
          structural += (y - e.lastShape) * e.amplitude * (k === 0 ? 0.65 : k === 1 ? 0.32 : 0.15);
          e.lastShape = y;
        } else {
          const f = Math.min(1, Math.max(0, (t - e.resolvedAt) / Math.max(2, e.resolutionDuration))), smooth = f * f * (3 - 2 * f), d = e.direction;
          const response = e.result === "breakout" ? d * 0.65 : e.result === "failed_breakout" ? -d * 0.45 : e.result === "opposite_breakout" ? -d * 0.9 : e.result === "extension" ? d * 1.1 : e.result === "reversal" ? d * Math.cos(Math.PI * f) * 1.2 : e.result === "fakeout" ? d * Math.cos(Math.PI * f) * 0.9 : 0;
          const y = f >= 1 ? 0 : e.resolutionShape * (1 - smooth) + response * Math.sin(Math.PI * f);
          structural += (y - e.lastShape) * e.amplitude * (k === 0 ? 0.65 : k === 1 ? 0.32 : 0.15);
          e.lastShape = y;
          if (f >= 1) c.episodes[k] = makeEpisode(r, t, c.x, sigma, SPAN[k], rg, c.fib);
        }
      }
      let levelPressure = 0;
      const sw = c.swing, piv = sw.pivots;
      const nodes = c.nodes;
      let nearest = nodes.length ? nodes.reduce((a, b) => Math.abs(a.x - c.x) < Math.abs(b.x - c.x) ? a : b) : null;
      const confluence = nearest ? Math.exp(-Math.abs(nearest.x - c.x) / (sigma * 8)) : 0;
      if (c.fibCooldown > 0) c.fibCooldown--;
      if (!c.fib && c.fibCooldown === 0 && piv.length >= 2) {
        const a = piv[piv.length - 2], b = piv[piv.length - 1], span = b.x - a.x, d = sign(span), ratio = (b.x - c.x) / span;
        const j = FIB.findIndex((f) => Math.abs(ratio - f) < Math.min(0.045, sigma * 1.5 / Math.max(Math.abs(span), sigma)));
        if (j >= 0 && Math.abs(span) > sigma * 5) {
          const alignment = trendDirection * d, volfactor = Math.exp(c.logVol), weights = [1.3 + 0.25 * alignment + 0.4 * confluence, 1.1 / (1 + volfactor * 0.2), 0.8 + 0.2 * volfactor, 1.1 - 0.2 * alignment + 0.15 * volfactor, 0.8, 0.7 + 0.4 * Math.abs(trendDirection)];
          const kinds = ["bounce", "pause", "sweep", "fail", "next", "ignore"];
          const kind = choose(r, kinds, weights.map((w) => Math.max(0.15, w)));
          c.fib = { level: FIB[j], kind, direction: d, remaining: 8 + Math.floor(r.u() * 35), amplitude: sigma * (0.05 + 0.1 * r.u()), elapsed: 0, at: t, reference: c.x };
          c.fibCooldown = 60;
          emit({ type: "fib", level: FIB[j], kind, probabilities: weights.map((w) => Math.max(0.15, w) / weights.reduce((a2, b2) => a2 + Math.max(0.15, b2), 0)), regime: rg.name, confirmedPivots: [a.confirmed, b.confirmed], swing: [a.x, b.x], x: c.x });
        }
      }
      if (c.fib) {
        const f = c.fib;
        f.elapsed++;
        if (f.kind === "bounce") levelPressure += f.direction * f.amplitude;
        else if (f.kind === "sweep") levelPressure += f.direction * f.amplitude * (f.elapsed < 5 ? -1 : 1);
        else if (f.kind === "fail" || f.kind === "next") levelPressure -= f.direction * f.amplitude;
        if (--f.remaining <= 0) c.fib = null;
      }
      if (nearest && rg.name === "range") levelPressure += Math.tanh((nearest.x - c.x) / (sigma * 8)) * sigma * 0.018;
      levelPressure += supportResistancePressure({x:c.x,sigma,t,pivots:piv,nodes,stress:impact.stress,regime:rg.name});
      const rho = volatile ? Math.min(0.78, cfg.rho + 0.2) : cfg.rho;
      const local = r.n(), normal = rho * commonNormal + Math.sqrt(1 - rho * rho) * local;
      c.lastShock = normal;
      const jump = (r.u() < cfg.jump * (rg.name === "panic" ? 4 : 1) ? r.n() * sigma * (3 + 4 * r.u()) : 0) + commonJump * (0.5 + rho);
      const open = c.price, path = [open];
      const effectiveSigma = (c.fib?.kind === "pause" ? sigma * 0.65 : sigma) * impact.volMultiplier;
      const impulse = trend + structural + levelPressure + jump + impact.pressure;
      for (let j = 0; j < 20; j++) {
        const n = rho * commonMicro[j] + Math.sqrt(1 - rho * rho) * r.n();
        c.x += impulse / 20 + effectiveSigma * (0.35 * normal / 20 + Math.sqrt(1 - 0.35 * 0.35) * n / Math.sqrt(20));
        path.push(finitePrice(c.x));
      }
      const oldX=Math.log(open);
      for(let j=piv.length-1;j>=0;j--){const p=piv[j];
        if(p.confirmed>=t||Math.max(Math.abs(oldX-p.x),Math.abs(c.x-p.x))>sigma*9)continue;
        if((oldX-p.x)*(c.x-p.x)<0){emit({type:'sr_break',level:Math.exp(p.x),roleBefore:oldX>p.x?'support':'resistance',roleAfter:c.x>p.x?'support':'resistance',confirmed:p.confirmed});break;}
      }
      const close = path[20], ret = Math.log(close / open);
      const volume = Math.max(1, Math.round(cfg.volume * (0.45 + r.u()) * (0.7 + Math.abs(ret) / cfg.sigma + Math.abs(jump) / cfg.sigma) * (volatile ? 1.4 : 1) * impact.activity));
      c.previousReturn = ret;
      c.trendEMA = 0.98 * c.trendEMA + 0.02 * ret;
      c.price = close;
      out[symbol] = { t, open, close, high: Math.max(...path), low: Math.min(...path), volume, path };
      const threshold = Math.max(cfg.sigma * 5, sigma * 4);
      if (sw.direction === 0) {
        if (Math.abs(c.x - sw.extreme) > threshold) {
          sw.direction = sign(c.x - sw.extreme);
          sw.extreme = c.x;
          sw.at = t;
        }
      } else if (sw.direction * (c.x - sw.extreme) > 0) {
        sw.extreme = c.x;
        sw.at = t;
      } else if (sw.direction * (sw.extreme - c.x) > threshold) {
        piv.push({ x: sw.extreme, at: sw.at, confirmed: t, kind: sw.direction > 0 ? "high" : "low" });
        if (piv.length > 12) piv.shift();
        sw.direction *= -1;
        sw.extreme = c.x;
        sw.at = t;
      }
      for (const node of nodes) node.v *= 0.998;
      nearest = nodes.length ? nodes.reduce((a, b) => Math.abs(a.x - c.x) < Math.abs(b.x - c.x) ? a : b) : null;
      if (nearest && Math.abs(nearest.x - c.x) < cfg.sigma * 8) {
        nearest.x = (nearest.x * nearest.v + c.x * volume) / (nearest.v + volume);
        nearest.v += volume;
      } else {
        nodes.push({ x: c.x, v: volume });
        if (nodes.length > 16) {
          let k = 0;
          for (let j = 1; j < nodes.length; j++) if (nodes[j].v < nodes[k].v) k = j;
          nodes.splice(k, 1);
        }
      }
    }
    this.s.second = t;
    return out;
  }
};
function aggregate(bars, span, epoch) {
  if (![1, 5, 15, 60, 240, 1440].includes(span) || !Number.isSafeInteger(epoch)) throw new Error("V6_INVALID_AGGREGATION");
  const out = [];
  let prev;
  for (const b of bars) {
    if (prev !== void 0 && b.t !== prev + 1) throw new Error("V6_MISSING_MINUTE");
    prev = b.t;
    const start = epoch + Math.floor((b.t - epoch - 1) / span) * span, last = out.at(-1);
    if (last && last.t === start) {
      last.high = Math.max(last.high, b.high);
      last.low = Math.min(last.low, b.low);
      last.close = b.close;
      last.volume += b.volume;
    } else out.push({ t: start, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume });
  }
  return out;
}
export {
  CONFIG_HASH,
  ENGINE_VERSION,
  PATTERNS,
  REGIMES,
  SYMBOLS,
  V6Engine,
  aggregate
};
