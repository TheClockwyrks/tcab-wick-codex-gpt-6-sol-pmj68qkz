import type {
  Game,
  InitApi,
  UpdateApi,
  RenderApi,
} from "@clockwyrks/simple-2d";
import type { DeepReadonly } from "ts-essentials";
import * as C from "./constants";
import type {
  WickState,
  WickDebugApi,
  RunState,
  EnemyState,
  ProjectileState,
  ZoneState,
  WickRect,
  Screen,
  WeaponId,
  PassiveId,
  EnemyId,
  GemTier,
  OfferId,
  NextDrop,
} from "./state";
export * from "./state";
export const BACKGROUND = "#080d1c";
const images = new Map<string, ImageBitmap>();
const n = (v: number) => {
  if (!Number.isFinite(v)) throw Error("Expected a finite number");
  return v;
};
const check = (ok: boolean) => {
  if (!ok) throw Error("Invalid debug pose");
};
const unit = (x: number, y: number) => {
  const d = Math.hypot(x, y);
  return d ? { x: x / d, y: y / d } : { x: 1, y: 0 };
};
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);
const timer = (t: number) =>
  Math.max(0, t - C.TICK_DT) < C.TICK_DT / 2 ? 0 : Math.max(0, t - C.TICK_DT);
const random = <T>(list: readonly T[]) =>
  list[Math.floor(Math.random() * list.length)];
const idleRun = (): RunState => ({
  tick: 0,
  level: 1,
  xp: 0,
  kills: 0,
  player: { x: 0, y: 0, facing: "right", hp: C.BASE_MAX_HP },
  hurtFlash: 0,
  weapons: [],
  passives: [],
  enemies: [],
  projectiles: [],
  zones: [],
  gems: [],
  pickups: [],
  offers: [],
  nextOffers: null,
  pendingLevelUps: 0,
  chestResult: null,
  spawnTimer: 0,
  firedEvents: [],
  nextId: 0,
  nextSpawnAngle: null,
  nextSwarmAngle: null,
  nextSpawnType: null,
  nextPuddleOffset: null,
  nextStrikeTarget: null,
  nextChestItem: null,
  nextDrop: null,
  movedTicks: 0,
  lastMovedTick: -1,
  puffs: [],
});
const initial = (): WickState => ({
  screen: "title",
  menuIndex: 0,
  almanacTab: 0,
  almanacScroll: 0,
  run: idleRun(),
  accumulator: 0,
  simTime: 0,
  muted: false,
  spawning: true,
  events: true,
  despawning: true,
  enemyMotion: true,
  enemyContact: true,
  weaponFire: true,
  effectMotion: true,
  drops: true,
  progression: true,
  pointerDownAt: null,
});
const fresh = (s: WickState): WickState => ({
  ...s,
  screen: "playing",
  menuIndex: 0,
  run: { ...idleRun(), weapons: [{ id: "taper", level: 1, cooldown: 0 }] },
  accumulator: 0,
});
const lv = (r: RunState, id: PassiveId) =>
  r.passives.find((p) => p.id === id)?.level ?? 0;
const stats = (r: RunState) => ({
  damage: 1 + C.WICK_DAMAGE_PER_LEVEL * lv(r, "wick"),
  cooldown: 1 - C.OIL_COOLDOWN_PER_LEVEL * lv(r, "oil"),
  area: 1 + C.GLASS_AREA_PER_LEVEL * lv(r, "glass"),
  armor: C.BRASS_ARMOR_PER_LEVEL * lv(r, "brass"),
  amount: C.MIRROR_AMOUNT_PER_LEVEL * lv(r, "mirror"),
  speed: C.MOVE_SPEED * (1 + C.BELLOWS_SPEED_PER_LEVEL * lv(r, "bellows")),
  maxHp: C.BASE_MAX_HP + C.TALLOW_HP_PER_LEVEL * lv(r, "tallow"),
  recovery: C.BASE_RECOVERY + C.TINDER_RECOVERY_PER_LEVEL * lv(r, "tinder"),
  xp: 1 + C.SOOT_XP_PER_LEVEL * lv(r, "soot"),
  pickup: C.PICKUP_RADIUS * (1 + C.LURE_PICKUP_PER_LEVEL * lv(r, "lure")),
});
const xpNext = (r: RunState) => C.XP_BASE + C.XP_STEP * (r.level - 1);
const pool = (r: RunState): OfferId[] => [
  ...C.BASE_WEAPON_IDS.filter((id) => {
    const own = r.weapons.find((w) => w.id === id);
    return own
      ? own.level < C.MAX_WEAPON_LEVEL
      : r.weapons.length < C.WEAPON_SLOTS &&
          !Object.entries(C.EVOLUTIONS).some(
            ([e, v]) => v.from === id && r.weapons.some((w) => w.id === e),
          );
  }),
  ...C.PASSIVE_IDS.filter((id) => {
    const own = r.passives.find((p) => p.id === id);
    return own
      ? own.level < C.PASSIVES[id].maxLevel
      : r.passives.length < C.PASSIVE_SLOTS;
  }),
];
const offers = (r: RunState): RunState => {
  const p = pool(r);
  const forced = r.nextOffers;
  let a: OfferId[] = [];
  if (
    (forced && forced.every((id) => p.includes(id))) ||
    (p.length === 0 && forced?.length === 1 && forced[0] === C.LAMP_OIL_ID)
  )
    a = [...(forced ?? [])];
  else {
    const q = [...p];
    while (q.length && a.length < C.OFFER_COUNT) {
      const i = Math.floor(Math.random() * q.length);
      a.push(q.splice(i, 1)[0]);
    }
    if (!a.length) a = [C.LAMP_OIL_ID];
  }
  return { ...r, offers: a, nextOffers: null };
};
function choose(s: WickState, index: number): WickState {
  check(Number.isInteger(index) && index >= 0 && index < s.run.offers.length);
  const id = s.run.offers[index];
  let r: RunState = s.run;
  if (id === C.LAMP_OIL_ID)
    r = {
      ...r,
      player: {
        ...r.player,
        hp: Math.min(stats(r).maxHp, r.player.hp + C.LAMP_OIL_HEAL),
      },
    };
  else if ((C.BASE_WEAPON_IDS as readonly string[]).includes(id)) {
    const own = r.weapons.find((w) => w.id === id);
    r = {
      ...r,
      weapons: own
        ? r.weapons.map((w) => (w.id === id ? { ...w, level: w.level + 1 } : w))
        : [...r.weapons, { id: id as WeaponId, level: 1, cooldown: 0 }],
    };
  } else {
    const own = r.passives.find((p) => p.id === id);
    r = {
      ...r,
      passives: own
        ? r.passives.map((p) =>
            p.id === id ? { ...p, level: p.level + 1 } : p,
          )
        : [...r.passives, { id: id as PassiveId, level: 1 }],
    };
  }
  r = { ...r, pendingLevelUps: Math.max(0, r.pendingLevelUps - 1), offers: [] };
  return r.pendingLevelUps
    ? { ...s, run: offers(r), screen: "levelup", menuIndex: 0 }
    : { ...s, run: r, screen: "playing", menuIndex: 0 };
}
function spawn(r: RunState, type: EnemyId, x: number, y: number): RunState {
  const row = C.ENEMIES[type],
    hp =
      row.hp *
      (row.rank === "common"
        ? 1 + C.HP_SCALE_PER_MINUTE * Math.floor(r.tick / C.TICK_HZ / 60)
        : 1),
    heading = unit(r.player.x - x, r.player.y - y);
  return {
    ...r,
    enemies: [
      ...r.enemies,
      {
        id: r.nextId,
        type,
        x,
        y,
        hp,
        maxHp: hp,
        heading,
        age: 0,
        contactCooldown: 0,
      },
    ],
    nextId: r.nextId + 1,
  };
}
const angleSpawn = (r: RunState, type: EnemyId): RunState => {
  const a = ((r.nextSpawnAngle ?? Math.random() * 360) * Math.PI) / 180;
  return spawn(
    { ...r, nextSpawnAngle: null },
    type,
    r.player.x + Math.cos(a) * C.SPAWN_DISTANCE,
    r.player.y + Math.sin(a) * C.SPAWN_DISTANCE,
  );
};
const row = (id: WeaponId, level: number): C.WeaponLevelBase => {
  switch (id) {
    case "pyre":
      return C.PYRE_STATS;
    case "beacon":
      return C.BEACON_STATS;
    case "hail":
      return C.HAIL_STATS;
    case "chandelier":
      return { damage: C.CHANDELIER_STATS.damage, cooldown: 999 };
    case "corona":
      return C.CORONA_STATS;
    case "blaze":
      return C.BLAZE_STATS;
    default:
      return C.WEAPON_LEVELS[id][level - 1];
  }
};
function projectile(
  r: RunState,
  weapon: ProjectileState["weapon"],
  x: number,
  y: number,
  vx: number,
  vy: number,
  pierce: number,
): RunState {
  const held = r.weapons.find((w) => w.id === weapon),
    v = row(weapon, held?.level ?? 1) as C.BoltLevel | C.PersistentBoltLevel,
    st = stats(r),
    u = unit(vx, vy);
  return {
    ...r,
    nextId: r.nextId + 1,
    projectiles: [
      ...r.projectiles,
      {
        id: r.nextId,
        weapon,
        x,
        y,
        vx,
        vy,
        ax: weapon === "sconce" ? -C.SCONCE_DECEL * u.x : 0,
        ay: weapon === "sconce" ? -C.SCONCE_DECEL * u.y : 0,
        radius: v.radius * st.area,
        damage: v.damage * st.damage,
        ttl: v.duration,
        pierce,
        hits: [],
      },
    ],
  };
}
function zone(
  r: RunState,
  weapon: WeaponId,
  kind: ZoneState["kind"],
  x: number,
  y: number,
  radius: number,
  damage: number,
  ttl: number | null,
  width?: number,
  height?: number,
): RunState {
  return {
    ...r,
    nextId: r.nextId + 1,
    zones: [
      ...r.zones,
      {
        id: r.nextId,
        weapon,
        kind,
        x,
        y,
        radius,
        damage,
        ttl,
        hits: [],
        ...(kind === "lantern" ? { orbitAngle: 0 } : {}),
        ...(kind === "puddle" ? { lastPulseTick: null } : {}),
        ...(width === undefined ? {} : { width, height }),
      },
    ],
  };
}
function fire(r: RunState, id: WeaponId, level: number): RunState {
  const st = stats(r),
    v = row(id, level) as C.WeaponLevelBase & {
      amount?: number;
      radius?: number;
      speed?: number;
      duration?: number;
      pierce?: number;
      width?: number;
      height?: number;
      orbit?: number;
      area?: number;
    };
  const p = r.player,
    sign = p.facing === "right" ? 1 : -1,
    nearest = [...r.enemies].sort(
      (a, b) => dist(a, p) - dist(b, p) || a.id - b.id,
    )[0],
    aim = nearest ? unit(nearest.x - p.x, nearest.y - p.y) : { x: sign, y: 0 };
  const amount = (v.amount ?? 1) + st.amount;
  if (id === "taper" || id === "pyre") {
    for (let i = 0; i < Math.min(amount, C.TAPER_MAX_AMOUNT); i++)
      r = zone(
        r,
        id,
        "slash",
        p.x + (sign * (v.width ?? 120) * st.area) / 2,
        p.y + (i - (amount - 1) / 2) * 12,
        0,
        v.damage * st.damage,
        C.SLASH_FLASH,
        (v.width ?? 120) * st.area,
        (v.height ?? 40) * st.area,
      );
  } else if (
    ["ember", "beacon", "pin", "hail", "shard", "sconce"].includes(id)
  ) {
    if ((id === "ember" || id === "beacon" || id === "sconce") && !nearest)
      return r;
    for (let i = 0; i < amount; i++) {
      const d = id === "pin" || id === "hail" ? { x: sign, y: 0 } : aim;
      const spread =
          ((i - (amount - 1) / 2) *
            (id === "sconce"
              ? C.SCONCE_SPREAD
              : id === "shard"
                ? C.SHARD_SPREAD
                : C.PIN_SPREAD) *
            Math.PI) /
          180,
        cs = Math.cos(spread),
        sn = Math.sin(spread),
        vx = (d.x * cs - d.y * sn) * (v.speed ?? 400),
        vy = (d.x * sn + d.y * cs) * (v.speed ?? 400);
      r = projectile(
        r,
        id as ProjectileState["weapon"],
        p.x,
        p.y,
        vx,
        vy,
        id === "shard" || id === "sconce" ? C.INFINITE_PIERCE : (v.pierce ?? 0),
      );
    }
  } else if (id === "oil-splash" || id === "blaze") {
    for (let i = 0; i < amount; i++) {
      let off = r.nextPuddleOffset;
      if (i === 0 && off) r = { ...r, nextPuddleOffset: null };
      else {
        const a = Math.random() * Math.PI * 2,
          d = Math.sqrt(Math.random()) * C.OIL_SCATTER;
        off = { x: Math.cos(a) * d, y: Math.sin(a) * d };
      }
      r = zone(
        r,
        id,
        "puddle",
        p.x + off.x,
        p.y + off.y,
        (v.radius ?? 50) * st.area,
        v.damage * st.damage,
        v.duration ?? 3,
      );
    }
  } else if (id === "lantern") {
    for (let i = 0; i < amount; i++)
      r = zone(
        r,
        id,
        "lantern",
        p.x,
        p.y,
        (v.radius ?? 14) * st.area,
        v.damage * st.damage,
        v.duration ?? 3,
      );
  } else if (id === "spark") {
    const candidates = r.enemies.filter((e) => dist(e, p) <= C.SPARK_RANGE);
    const posed = r.nextStrikeTarget;
    r = { ...r, nextStrikeTarget: null };
    for (let i = 0; i < Math.min(amount, candidates.length); i++) {
      const target =
        i === 0 && posed !== null
          ? (candidates.find((e) => e.id === posed) ?? random(candidates))
          : random(candidates);
      r = zone(
        r,
        id,
        "strike",
        target.x,
        target.y,
        (v.area ?? 40) * st.area,
        v.damage * st.damage,
        C.SPARK_FLASH,
      );
    }
  } else if (id === "flare")
    r = zone(
      r,
      id,
      "burst",
      p.x,
      p.y,
      (v.radius ?? 640) * st.area,
      v.damage * st.damage,
      C.FLARE_FLASH,
    );
  return r;
}
function damage(r: RunState, enemyId: number, amount: number): RunState {
  return {
    ...r,
    enemies: r.enemies.map((e) =>
      e.id === enemyId ? { ...e, hp: e.hp - amount } : e,
    ),
  };
}
function tick(s: WickState, api: UpdateApi, dx: number, dy: number): WickState {
  let r: RunState = { ...s.run, tick: s.run.tick + 1 };
  r = {
    ...r,
    puffs: r.puffs
      .map((p) => ({ ...p, age: p.age + C.TICK_DT }))
      .filter((p) => p.age < C.PUFF_TIME),
  };
  const st = stats(r),
    d = unit(dx, dy),
    moving = dx !== 0 || dy !== 0;
  const p = {
    ...r.player,
    x: r.player.x + (moving ? d.x * st.speed * C.TICK_DT : 0),
    y: r.player.y + (moving ? d.y * st.speed * C.TICK_DT : 0),
    facing: (dx < 0 ? "left" : dx > 0 ? "right" : r.player.facing) as
      "left" | "right",
    hp: Math.min(st.maxHp, r.player.hp + st.recovery * C.TICK_DT),
  };
  r = {
    ...r,
    player: p,
    movedTicks: r.movedTicks + (moving ? 1 : 0),
    lastMovedTick: moving ? r.tick : r.lastMovedTick,
    hurtFlash: timer(r.hurtFlash),
  };
  r = {
    ...r,
    enemies: r.enemies.map((e) => {
      const age = e.age + C.TICK_DT;
      let heading = e.heading,
        x = e.x,
        y = e.y;
      if (s.enemyMotion) {
        if (C.ENEMIES[e.type].behavior !== "drift")
          heading = unit(p.x - x, p.y - y);
        x += heading.x * C.ENEMIES[e.type].speed * C.TICK_DT;
        y += heading.y * C.ENEMIES[e.type].speed * C.TICK_DT;
        if (C.ENEMIES[e.type].behavior === "weave") {
          const wob =
            C.WISP_AMPLITUDE *
            (Math.sin((2 * Math.PI * age) / C.WISP_PERIOD) -
              Math.sin((2 * Math.PI * e.age) / C.WISP_PERIOD));
          x -= heading.y * wob;
          y += heading.x * wob;
        }
      }
      return {
        ...e,
        x,
        y,
        heading,
        age,
        contactCooldown: timer(e.contactCooldown),
      };
    }),
  };
  const firedWeapons = new Set<WeaponId>();
  if (s.weaponFire) {
    const weapons = [];
    for (const w of r.weapons) {
      const v = row(w.id, w.level);
      let cd = timer(w.cooldown);
      if (cd === 0 && w.id !== "chandelier") {
        r = fire(r, w.id, w.level);
        firedWeapons.add(w.id);
        cd =
          Math.max(C.MIN_COOLDOWN, v.cooldown * st.cooldown) +
          (w.id === "lantern" ? (v as C.OrbitLevel).duration : 0);
      }
      weapons.push({ ...w, cooldown: cd });
    }
    r = { ...r, weapons };
  }
  const aura = r.weapons.find((w) => w.id === "halo" || w.id === "corona");
  r = {
    ...r,
    zones: r.zones.filter((z) => z.kind !== "aura" || z.weapon === aura?.id),
  };
  if (aura) {
    const v = row(aura.id, aura.level) as C.RadialLevel;
    const old = r.zones.find((z) => z.kind === "aura");
    if (old)
      r = {
        ...r,
        zones: r.zones.map((z) =>
          z.id === old.id
            ? {
                ...z,
                x: p.x,
                y: p.y,
                radius: v.radius * st.area,
                damage: v.damage * st.damage,
              }
            : z,
        ),
      };
    else
      r = zone(
        r,
        aura.id,
        "aura",
        p.x,
        p.y,
        v.radius * st.area,
        v.damage * st.damage,
        null,
      );
  }
  const chand = r.weapons.some((w) => w.id === "chandelier");
  if (
    chand &&
    r.zones.filter((z) => z.weapon === "chandelier").length !==
      C.CHANDELIER_STATS.amount + st.amount
  )
    r = { ...r, zones: r.zones.filter((z) => z.weapon !== "chandelier") };
  if (chand && !r.zones.some((z) => z.weapon === "chandelier"))
    for (let i = 0; i < C.CHANDELIER_STATS.amount + st.amount; i++)
      r = zone(
        r,
        "chandelier",
        "lantern",
        p.x,
        p.y,
        C.CHANDELIER_STATS.radius * st.area,
        C.CHANDELIER_STATS.damage * st.damage,
        null,
      );
  if (!chand)
    r = { ...r, zones: r.zones.filter((z) => z.weapon !== "chandelier") };
  const prevP = new Set(s.run.projectiles.map((x) => x.id)),
    prevZ = new Set(s.run.zones.map((x) => x.id));
  r = {
    ...r,
    projectiles: r.projectiles.flatMap((q) => {
      if (prevP.has(q.id) && timer(q.ttl) === 0) return [];
      let x = q.x,
        y = q.y,
        vx = q.vx,
        vy = q.vy;
      if (prevP.has(q.id) && s.effectMotion) {
        x += vx * C.TICK_DT;
        y += vy * C.TICK_DT;
        vx += q.ax * C.TICK_DT;
        vy += q.ay * C.TICK_DT;
        if (q.weapon === "shard") {
          if (Math.abs(x - p.x) > C.STAGE_CX) vx = -vx;
          if (Math.abs(y - p.y) > C.STAGE_CY) vy = -vy;
        }
      }
      return [
        {
          ...q,
          x,
          y,
          vx,
          vy,
          ttl: prevP.has(q.id) ? timer(q.ttl) : q.ttl,
          hits: q.hits
            .map((h) => ({ ...h, cooldown: timer(h.cooldown) }))
            .filter((h) => h.cooldown > 0),
        },
      ];
    }),
    zones: r.zones.flatMap((z) => {
      if (prevZ.has(z.id) && z.ttl !== null && timer(z.ttl) === 0) return [];
      let x = z.x,
        y = z.y,
        orbitAngle = z.orbitAngle;
      if (z.kind === "lantern") {
        const group = r.zones.filter(
            (a) => a.kind === "lantern" && a.weapon === z.weapon,
          ),
          i = group.findIndex((a) => a.id === z.id),
          v =
            z.weapon === "chandelier"
              ? C.CHANDELIER_STATS
              : (row(
                  z.weapon,
                  r.weapons.find((w) => w.id === z.weapon)?.level ?? 1,
                ) as C.OrbitLevel),
          initialAngle = (i * 2 * Math.PI) / group.length;
        orbitAngle = prevZ.has(z.id)
          ? (z.orbitAngle ?? initialAngle)
          : initialAngle;
        if (prevZ.has(z.id) && s.effectMotion)
          orbitAngle += ((C.LANTERN_ANGULAR_SPEED * Math.PI) / 180) * C.TICK_DT;
        x = p.x + Math.cos(orbitAngle) * v.orbit * st.area;
        y = p.y + Math.sin(orbitAngle) * v.orbit * st.area;
      }
      return [
        {
          ...z,
          x,
          y,
          ...(z.kind === "lantern" ? { orbitAngle } : {}),
          ...(z.weapon === "chandelier"
            ? {
                radius: C.CHANDELIER_STATS.radius * st.area,
                damage: C.CHANDELIER_STATS.damage * st.damage,
              }
            : {}),
          ttl: z.ttl === null ? null : prevZ.has(z.id) ? timer(z.ttl) : z.ttl,
          hits: z.hits
            .map((h) => ({ ...h, cooldown: timer(h.cooldown) }))
            .filter((h) => h.cooldown > 0),
        },
      ];
    }),
  };
  let hit = false,
    kill = false,
    gem = false,
    hurt = false,
    pickup = false,
    chest = false;
  const hitEnemy = (id: number, dmg: number) => {
    r = damage(r, id, dmg);
    hit = true;
  };
  for (const q of [...r.projectiles]) {
    let pierce = q.pierce;
    const hits = [...q.hits];
    for (const e of r.enemies) {
      if (
        hits.some((h) => h.enemy === e.id) ||
        dist(q, e) >= q.radius + C.ENEMIES[e.type].radius
      )
        continue;
      hitEnemy(e.id, q.damage);
      hits.push({
        enemy: e.id,
        cooldown:
          pierce === C.INFINITE_PIERCE
            ? q.weapon === "sconce"
              ? C.SCONCE_REHIT
              : C.SHARD_REHIT
            : q.ttl,
      });
      if (pierce !== C.INFINITE_PIERCE && pierce-- === 0) break;
    }
    r = {
      ...r,
      projectiles: r.projectiles.flatMap((a) =>
        a.id === q.id
          ? pierce < 0 && q.pierce !== C.INFINITE_PIERCE
            ? []
            : [{ ...a, pierce, hits }]
          : [a],
      ),
    };
  }
  for (const z of [...r.zones]) {
    const pulse =
      z.kind === "aura"
        ? firedWeapons.has(z.weapon)
        : z.kind === "puddle"
          ? z.lastPulseTick === null ||
            z.lastPulseTick === undefined ||
            r.tick - z.lastPulseTick >=
              Math.round(
                (z.weapon === "blaze" ? C.BLAZE_PULSE : C.OIL_PULSE) *
                  C.TICK_HZ,
              )
          : z.kind === "lantern" || !prevZ.has(z.id);
    if (!pulse) continue;
    const hits = [...z.hits];
    for (const e of r.enemies) {
      if (z.kind === "burst" && C.FLARE_IMMUNE.includes(e.type)) continue;
      if (hits.some((h) => h.enemy === e.id)) continue;
      const overlap =
        z.kind === "slash"
          ? Math.abs(e.x - z.x) <
              (z.width ?? 0) / 2 + C.ENEMIES[e.type].radius &&
            Math.abs(e.y - z.y) < (z.height ?? 0) / 2 + C.ENEMIES[e.type].radius
          : dist(z, e) < z.radius + C.ENEMIES[e.type].radius;
      if (overlap) {
        const beforeHp = r.enemies.find((a) => a.id === e.id)?.hp ?? e.hp;
        hitEnemy(e.id, z.damage);
        if (z.kind === "lantern")
          hits.push({ enemy: e.id, cooldown: C.LANTERN_REHIT });
        if (z.weapon === "pyre")
          r = {
            ...r,
            player: {
              ...r.player,
              hp: Math.min(st.maxHp, r.player.hp + C.PYRE_HEAL),
            },
          };
        if (z.weapon === "corona" && beforeHp > 0 && beforeHp <= z.damage)
          r = {
            ...r,
            player: {
              ...r.player,
              hp: Math.min(st.maxHp, r.player.hp + C.CORONA_HEAL),
            },
          };
      }
    }
    r = {
      ...r,
      zones: r.zones.map((a) =>
        a.id === z.id
          ? {
              ...a,
              hits,
              ...(z.kind === "puddle" ? { lastPulseTick: r.tick } : {}),
            }
          : a,
      ),
    };
  }
  const dead = r.enemies.filter((e) => e.hp <= 0);
  if (dead.length) {
    kill = true;
    r = {
      ...r,
      kills: r.kills + dead.length,
      enemies: r.enemies.filter((e) => e.hp > 0),
      puffs: [...r.puffs, ...dead.map((e) => ({ x: e.x, y: e.y, age: 0 }))],
    };
    if (s.drops)
      for (const e of dead) {
        const drop = C.ENEMIES[e.type].drop;
        if (drop === "chest")
          r = {
            ...r,
            pickups: [
              ...r.pickups,
              { id: r.nextId, kind: "chest", x: e.x, y: e.y },
            ],
            nextId: r.nextId + 1,
          };
        else if (drop) {
          r = {
            ...r,
            gems: [
              ...r.gems,
              { id: r.nextId, tier: drop, x: e.x, y: e.y, attracted: false },
            ],
            nextId: r.nextId + 1,
          };
          const d = r.nextDrop ?? rollDrop();
          r = { ...r, nextDrop: null };
          if (d !== "none")
            r = {
              ...r,
              pickups: [
                ...r.pickups,
                { id: r.nextId, kind: d, x: e.x, y: e.y },
              ],
              nextId: r.nextId + 1,
            };
        }
      }
  }
  if (s.enemyContact) {
    let hp = r.player.hp;
    const enemies = r.enemies.map((e) => {
      if (
        e.contactCooldown === 0 &&
        dist(e, p) < C.PLAYER_RADIUS + C.ENEMIES[e.type].radius
      ) {
        hurt = true;
        hp -= Math.max(C.MIN_DAMAGE_TAKEN, C.ENEMIES[e.type].damage - st.armor);
        return { ...e, contactCooldown: C.CONTACT_COOLDOWN };
      }
      return e;
    });
    r = {
      ...r,
      enemies,
      player: { ...r.player, hp },
      hurtFlash: hurt ? C.HURT_FLASH : r.hurtFlash,
    };
  }
  const picked = r.pickups.filter(
    (a) => dist(a, r.player) < C.PICKUP_ITEM_RADIUS + C.PLAYER_RADIUS,
  );
  r = { ...r, pickups: r.pickups.filter((a) => !picked.includes(a)) };
  for (const a of picked) {
    if (a.kind === "bread") {
      pickup = true;
      r = {
        ...r,
        player: {
          ...r.player,
          hp: Math.min(st.maxHp, r.player.hp + C.BREAD_HEAL),
        },
      };
    } else if (a.kind === "draft") {
      pickup = true;
      r = { ...r, gems: r.gems.map((g) => ({ ...g, attracted: true })) };
    } else {
      chest = true;
      r = openChest(r);
      if (r.chestResult?.kind === "evolve") api.audio.play(C.CUES.evolve);
    }
  }
  const oldGems = new Set(s.run.gems.map((g) => g.id));
  let gained = 0;
  r = {
    ...r,
    gems: r.gems.flatMap((g) => {
      const attracted = g.attracted || dist(g, r.player) <= st.pickup;
      let x = g.x,
        y = g.y;
      if (attracted && oldGems.has(g.id)) {
        const u = unit(r.player.x - x, r.player.y - y);
        x += u.x * Math.min(C.GEM_SPEED * C.TICK_DT, dist(g, r.player));
        y += u.y * Math.min(C.GEM_SPEED * C.TICK_DT, dist(g, r.player));
      }
      if (Math.hypot(x - r.player.x, y - r.player.y) <= C.COLLECT_RADIUS) {
        gained += C.GEM_VALUES[g.tier] * st.xp;
        gem = true;
        return [];
      }
      return [{ ...g, x, y, attracted }];
    }),
  };
  if (gained) {
    r = { ...r, xp: r.xp + gained };
    if (s.progression)
      while (r.xp >= xpNext(r)) {
        r = {
          ...r,
          xp: r.xp - xpNext(r),
          level: r.level + 1,
          pendingLevelUps: r.pendingLevelUps + 1,
        };
      }
  }
  if (s.despawning)
    r = {
      ...r,
      enemies: r.enemies.filter(
        (e) =>
          C.ENEMIES[e.type].rank !== "common" ||
          dist(e, r.player) <= C.DESPAWN_DISTANCE,
      ),
    };
  if (s.events)
    for (const ev of C.EVENTS)
      if (r.tick === ev.time * C.TICK_HZ && !r.firedEvents.includes(ev.time)) {
        r = { ...r, firedEvents: [...r.firedEvents, ev.time] };
        if (ev.kind === "spawn") r = angleSpawn(r, ev.type);
        else {
          const a = ((r.nextSwarmAngle ?? Math.random() * 360) * Math.PI) / 180,
            d = { x: Math.cos(a), y: Math.sin(a) };
          r = { ...r, nextSwarmAngle: null };
          for (let i = 0; i < C.SWARM_SIZE; i++) {
            const t = (i / (C.SWARM_SIZE - 1) - 0.5) * C.SWARM_LINE;
            r = spawn(
              r,
              ev.type,
              r.player.x + d.x * C.SPAWN_DISTANCE - d.y * t,
              r.player.y + d.y * C.SPAWN_DISTANCE + d.x * t,
            );
          }
        }
      }
  if (s.spawning) {
    const windowIndex = Math.min(
      19,
      Math.floor(r.tick / C.TICK_HZ / C.SPAWN_WINDOW),
    );
    const previousWindow = Math.min(
      19,
      Math.floor(s.run.tick / C.TICK_HZ / C.SPAWN_WINDOW),
    );
    const win = C.SPAWN_WINDOWS[windowIndex],
      cd = timer(windowIndex === previousWindow ? r.spawnTimer : 0),
      alive = r.enemies.filter(
        (e) => C.ENEMIES[e.type].rank === "common" && e.type !== "gnat",
      ).length;
    if (cd === 0 && alive < win.cap) {
      let type = r.nextSpawnType;
      if (!type || !win.types.includes(type)) type = random(win.types);
      r = { ...r, nextSpawnType: null, spawnTimer: win.interval };
      r = angleSpawn(r, type);
    } else r = { ...r, spawnTimer: cd };
  }
  if (hit) api.audio.play(C.CUES.hit);
  if (kill) api.audio.play(C.CUES.kill);
  if (hurt) api.audio.play(C.CUES.hurt);
  if (gem) api.audio.play(C.CUES.gem);
  if (pickup) api.audio.play(C.CUES.pickup);
  let screen: Screen = "playing";
  if (r.player.hp <= 0) {
    screen = "fallen";
    api.audio.play(C.CUES.fallen);
  } else if (r.tick >= C.DAWN_TIME * C.TICK_HZ) {
    screen = "dawn";
    api.audio.play(C.CUES.dawn);
  } else if (chest) {
    screen = "chest";
    api.audio.play(C.CUES.chest);
  } else if (r.pendingLevelUps > 0) {
    screen = "levelup";
    r = offers(r);
    api.audio.play(C.CUES.levelUp);
  }
  return { ...s, run: r, screen, menuIndex: 0 };
}
function rollDrop(): NextDrop {
  const v = Math.random();
  return v < C.BREAD_CHANCE
    ? "bread"
    : v < C.BREAD_CHANCE + C.DRAFT_CHANCE
      ? "draft"
      : "none";
}
function openChest(r: RunState): RunState {
  let result: RunState["chestResult"] = null;
  for (const id of C.EVOLUTION_IDS) {
    const recipe = C.EVOLUTIONS[id],
      i = r.weapons.findIndex((w) => w.id === recipe.from);
    if (
      i >= 0 &&
      r.weapons[i].level === C.MAX_WEAPON_LEVEL &&
      r.passives.some((p) => p.id === recipe.passive)
    ) {
      r = {
        ...r,
        weapons: r.weapons.map((w, j) =>
          j === i ? { id, level: 1, cooldown: 0 } : w,
        ),
      };
      result = { kind: "evolve", weapon: id };
      break;
    }
  }
  const possible = [
    ...r.weapons
      .filter(
        (w) =>
          (C.BASE_WEAPON_IDS as readonly string[]).includes(w.id) &&
          w.level < C.MAX_WEAPON_LEVEL,
      )
      .map((w) => w.id),
    ...r.passives
      .filter((p) => p.level < C.PASSIVES[p.id].maxLevel)
      .map((p) => p.id),
  ];
  const posed = r.nextChestItem;
  r = { ...r, nextChestItem: null };
  if (!result && possible.length) {
    const id = posed && possible.includes(posed) ? posed : random(possible);
    if ((C.BASE_WEAPON_IDS as readonly string[]).includes(id))
      r = {
        ...r,
        weapons: r.weapons.map((w) =>
          w.id === id ? { ...w, level: w.level + 1 } : w,
        ),
      };
    else
      r = {
        ...r,
        passives: r.passives.map((p) =>
          p.id === id ? { ...p, level: p.level + 1 } : p,
        ),
      };
    result = {
      kind: "level",
      item: id,
      level:
        r.weapons.find((w) => w.id === id)?.level ??
        r.passives.find((p) => p.id === id)?.level ??
        1,
    };
  }
  if (!result) {
    result = { kind: "heal" };
    r = {
      ...r,
      player: {
        ...r.player,
        hp: Math.min(stats(r).maxHp, r.player.hp + C.CHEST_HEAL),
      },
    };
  }
  return { ...r, chestResult: result };
}
const menuRects = (s: WickState): WickRect[] => {
  const count =
    s.screen === "title"
      ? C.TITLE_ITEMS.length
      : s.screen === "levelup"
        ? s.run.offers.length
        : s.screen === "paused"
          ? C.PAUSE_ITEMS.length
          : s.screen === "fallen" || s.screen === "dawn"
            ? C.END_ITEMS.length
            : s.screen === "almanac"
              ? Math.min(
                  C.ALMANAC_ROWS,
                  entries(s.almanacTab).length - s.almanacScroll,
                )
              : s.screen === "howto" || s.screen === "chest"
                ? 1
                : 0;
  const y =
    s.screen === "almanac"
      ? 180
      : s.screen === "levelup"
        ? 240
        : s.screen === "title"
          ? 425
          : s.screen === "howto" || s.screen === "chest"
            ? 590
            : 420;
  const h = s.screen === "almanac" ? 42 : s.screen === "levelup" ? 95 : 58;
  return Array.from({ length: count }, (_, i) => ({
    x: s.screen === "almanac" ? 125 : 390,
    y: y + i * h,
    width: s.screen === "almanac" ? 490 : 500,
    height: h - 5,
  }));
};
const tabRects = (s: WickState): WickRect[] =>
  s.screen === "almanac"
    ? C.ALMANAC_TABS.map((_, i) => ({
        x: 125 + i * 252,
        y: 106,
        width: 235,
        height: 54,
      }))
    : [];
const entries = (tab: number): string[] =>
  tab === 0
    ? [...C.BASE_WEAPON_IDS, ...C.EVOLUTION_IDS]
    : tab === 1
      ? [...C.PASSIVE_IDS]
      : tab === 2
        ? [...C.ENEMY_IDS]
        : [...C.GEM_TIERS, ...C.PICKUP_KINDS];
const copy = <T>(s: DeepReadonly<T>): T => s as unknown as T;
const poseRun = (
  s: DeepReadonly<WickState>,
  f: (r: RunState) => RunState,
): WickState => ({ ...copy(s), run: f(copy(s.run)) });
const changeEnemy = (
  s: DeepReadonly<WickState>,
  id: number,
  f: (e: EnemyState) => EnemyState,
): WickState =>
  poseRun(s, (r) => {
    check(r.enemies.some((e) => e.id === id));
    return { ...r, enemies: r.enemies.map((e) => (e.id === id ? f(e) : e)) };
  });
const validId = (list: readonly string[], id: string) =>
  check(list.includes(id));
const nat = (v: number, min = 0) => {
  n(v);
  check(Number.isInteger(v) && v >= min);
  return v;
};
const positive = (v: number) => {
  n(v);
  check(v >= 0);
  return v;
};
const flag = (v: boolean) => {
  check(typeof v === "boolean");
  return v;
};
const baseIds: string[] = [...C.BASE_WEAPON_IDS, ...C.EVOLUTION_IDS],
  allOffers: string[] = [...baseIds, ...C.PASSIVE_IDS, C.LAMP_OIL_ID];
const debug: WickDebugApi = {
  version: C.WICK_DEBUG_VERSION,
  reset: (s) => ({ ...initial(), muted: s.muted }),
  snapshot: (s) => {
    const a = copy(s),
      r = a.run,
      st = stats(r);
    const {
      movedTicks: _movedTicks,
      lastMovedTick: _lastMovedTick,
      puffs: _puffs,
      ...reported
    } = r;
    return {
      version: C.WICK_DEBUG_VERSION,
      screen: a.screen,
      menuIndex: a.menuIndex,
      almanacTab: a.almanacTab,
      almanacScroll: a.almanacScroll,
      accumulator: a.accumulator,
      simTime: a.simTime,
      muted: a.muted,
      spawning: a.spawning,
      events: a.events,
      despawning: a.despawning,
      enemyMotion: a.enemyMotion,
      enemyContact: a.enemyContact,
      weaponFire: a.weaponFire,
      effectMotion: a.effectMotion,
      drops: a.drops,
      progression: a.progression,
      run: {
        ...reported,
        zones: r.zones.map((z) => {
          const {
            orbitAngle: _orbitAngle,
            lastPulseTick: _lastPulseTick,
            ...visible
          } = z;
          return visible;
        }),
        time: r.tick / C.TICK_HZ,
        xpToNext: xpNext(r),
        maxHp: st.maxHp,
        armor: st.armor,
        moveSpeed: st.speed,
        pickupRadius: st.pickup,
        spawnWindow: Math.min(
          19,
          Math.floor(r.tick / C.TICK_HZ / C.SPAWN_WINDOW),
        ),
        aliveCommons: r.enemies.filter(
          (e) => C.ENEMIES[e.type].rank === "common" && e.type !== "gnat",
        ).length,
        pool: a.screen === "levelup" ? pool(r) : [],
      },
    };
  },
  reconcile: (s) => copy(s),
  menuRects: (s) => menuRects(copy(s)),
  tabRects: (s) => tabRects(copy(s)),
  setScreen: (s, name) => {
    validId(
      [
        "title",
        "howto",
        "almanac",
        "playing",
        "levelup",
        "chest",
        "paused",
        "fallen",
        "dawn",
      ],
      name,
    );
    return {
      ...copy(s),
      screen: name,
      menuIndex: 0,
      almanacTab: 0,
      almanacScroll: 0,
      accumulator: name === "playing" ? s.accumulator : 0,
    };
  },
  choose: (s, index) => choose(copy(s), index),
  setSpawning: (s, on) => ({ ...copy(s), spawning: flag(on) }),
  setEvents: (s, on) => ({ ...copy(s), events: flag(on) }),
  setDespawning: (s, on) => ({ ...copy(s), despawning: flag(on) }),
  setEnemyMotion: (s, on) => ({ ...copy(s), enemyMotion: flag(on) }),
  setEnemyContact: (s, on) => ({ ...copy(s), enemyContact: flag(on) }),
  setWeaponFire: (s, on) => ({ ...copy(s), weaponFire: flag(on) }),
  setEffectMotion: (s, on) => ({ ...copy(s), effectMotion: flag(on) }),
  setDrops: (s, on) => ({ ...copy(s), drops: flag(on) }),
  setProgression: (s, on) => ({ ...copy(s), progression: flag(on) }),
  setTick: (s, tick) =>
    poseRun(s, (r) => {
      nat(tick);
      check(tick < C.DAWN_TIME * C.TICK_HZ);
      return { ...r, tick };
    }),
  setSpawnTimer: (s, seconds) =>
    poseRun(s, (r) => ({ ...r, spawnTimer: positive(seconds) })),
  setNextSpawnAngle: (s, degrees) =>
    poseRun(s, (r) => {
      check(n(degrees) >= 0 && degrees < 360);
      return { ...r, nextSpawnAngle: degrees };
    }),
  setNextSwarmAngle: (s, degrees) =>
    poseRun(s, (r) => {
      check(n(degrees) >= 0 && degrees < 360);
      return { ...r, nextSwarmAngle: degrees };
    }),
  setNextSpawnType: (s, id) =>
    poseRun(s, (r) => {
      validId(C.ENEMY_IDS, id);
      return { ...r, nextSpawnType: id };
    }),
  setNextPuddleOffset: (s, dx, dy) =>
    poseRun(s, (r) => {
      check(Math.hypot(n(dx), n(dy)) <= C.OIL_SCATTER);
      return { ...r, nextPuddleOffset: { x: dx, y: dy } };
    }),
  setNextStrikeTarget: (s, id) =>
    poseRun(s, (r) => {
      check(r.enemies.some((e) => e.id === id));
      return { ...r, nextStrikeTarget: id };
    }),
  setNextChestItem: (s, id) =>
    poseRun(s, (r) => {
      validId([...C.BASE_WEAPON_IDS, ...C.PASSIVE_IDS], id);
      return { ...r, nextChestItem: id };
    }),
  setNextDrop: (s, kind) =>
    poseRun(s, (r) => {
      validId(["bread", "draft", "none"], kind);
      return { ...r, nextDrop: kind };
    }),
  rollDrop: () => rollDrop(),
  setPlayerPosition: (s, x, y) =>
    poseRun(s, (r) => ({ ...r, player: { ...r.player, x: n(x), y: n(y) } })),
  setFacing: (s, facing) =>
    poseRun(s, (r) => {
      validId(["left", "right"], facing);
      return { ...r, player: { ...r.player, facing } };
    }),
  setHp: (s, hp) =>
    poseRun(s, (r) => ({ ...r, player: { ...r.player, hp: n(hp) } })),
  setLevel: (s, level) => poseRun(s, (r) => ({ ...r, level: nat(level, 1) })),
  setXp: (s, xp) => poseRun(s, (r) => ({ ...r, xp: positive(xp) })),
  setKills: (s, kills) => poseRun(s, (r) => ({ ...r, kills: nat(kills) })),
  setPendingLevelUps: (s, count) =>
    poseRun(s, (r) => ({ ...r, pendingLevelUps: nat(count) })),
  setNextOffers: (s, ids) =>
    poseRun(s, (r) => {
      check(
        ids.length >= 1 &&
          ids.length <= C.OFFER_COUNT &&
          new Set(ids).size === ids.length &&
          ids.every((id) => allOffers.includes(id)),
      );
      return { ...r, nextOffers: [...ids] };
    }),
  setWeapon: (s, slot, id, level) =>
    poseRun(s, (r) => {
      nat(slot);
      validId(baseIds, id);
      check(slot <= r.weapons.length && slot < C.WEAPON_SLOTS);
      check(
        level >= 1 &&
          Number.isInteger(level) &&
          level <=
            ((C.EVOLUTION_IDS as readonly string[]).includes(id)
              ? 1
              : C.MAX_WEAPON_LEVEL),
      );
      check(
        !r.weapons.some(
          (w, i) =>
            i !== slot &&
            (w.id === id ||
              Object.entries(C.EVOLUTIONS).some(
                ([e, v]) =>
                  (e === w.id && v.from === id) ||
                  (e === id && v.from === w.id),
              )),
        ),
      );
      const old = r.weapons[slot];
      const next = { id, level, cooldown: old?.id === id ? old.cooldown : 0 };
      return {
        ...r,
        weapons:
          slot === r.weapons.length
            ? [...r.weapons, next]
            : r.weapons.map((w, i) => (i === slot ? next : w)),
      };
    }),
  setWeaponCooldown: (s, slot, seconds) =>
    poseRun(s, (r) => {
      nat(slot);
      check(slot < r.weapons.length);
      return {
        ...r,
        weapons: r.weapons.map((w, i) =>
          i === slot ? { ...w, cooldown: positive(seconds) } : w,
        ),
      };
    }),
  removeWeapon: (s, slot) =>
    poseRun(s, (r) => {
      nat(slot);
      check(slot < r.weapons.length);
      return { ...r, weapons: r.weapons.filter((_, i) => i !== slot) };
    }),
  setPassive: (s, slot, id, level) =>
    poseRun(s, (r) => {
      nat(slot);
      validId(C.PASSIVE_IDS, id);
      check(
        slot <= r.passives.length &&
          slot < C.PASSIVE_SLOTS &&
          Number.isInteger(level) &&
          level >= 1 &&
          level <= C.PASSIVES[id].maxLevel &&
          !r.passives.some((p, i) => i !== slot && p.id === id),
      );
      return {
        ...r,
        passives:
          slot === r.passives.length
            ? [...r.passives, { id, level }]
            : r.passives.map((p, i) => (i === slot ? { id, level } : p)),
      };
    }),
  removePassive: (s, slot) =>
    poseRun(s, (r) => {
      nat(slot);
      check(slot < r.passives.length);
      return { ...r, passives: r.passives.filter((_, i) => i !== slot) };
    }),
  spawnEnemy: (s, type, x, y) =>
    poseRun(s, (r) => {
      validId(C.ENEMY_IDS, type);
      return spawn(r, type, n(x), n(y));
    }),
  setEnemyPosition: (s, id, x, y) =>
    changeEnemy(s, id, (e) => ({ ...e, x: n(x), y: n(y) })),
  setEnemyHp: (s, id, hp) =>
    changeEnemy(s, id, (e) => {
      check(n(hp) > 0);
      return { ...e, hp };
    }),
  setEnemyHeading: (s, id, hx, hy) =>
    changeEnemy(s, id, (e) => {
      check(Math.hypot(n(hx), n(hy)) > 0);
      return { ...e, heading: unit(hx, hy) };
    }),
  setEnemyAge: (s, id, seconds) =>
    changeEnemy(s, id, (e) => ({ ...e, age: positive(seconds) })),
  setEnemyContactCooldown: (s, id, seconds) =>
    changeEnemy(s, id, (e) => ({ ...e, contactCooldown: positive(seconds) })),
  removeEnemy: (s, id) =>
    poseRun(s, (r) => {
      check(r.enemies.some((e) => e.id === id));
      return { ...r, enemies: r.enemies.filter((e) => e.id !== id) };
    }),
  clearEnemies: (s) => poseRun(s, (r) => ({ ...r, enemies: [] })),
  spawnProjectile: (s, weapon, x, y, vx, vy, pierce) =>
    poseRun(s, (r) => {
      validId(["ember", "pin", "shard", "sconce", "beacon", "hail"], weapon);
      check(
        pierce === C.INFINITE_PIERCE ||
          (Number.isInteger(pierce) && pierce >= 0),
      );
      if (weapon === "sconce") check(Math.hypot(vx, vy) > 0);
      return projectile(r, weapon, n(x), n(y), n(vx), n(vy), pierce);
    }),
  clearProjectiles: (s) => poseRun(s, (r) => ({ ...r, projectiles: [] })),
  spawnPuddle: (s, weapon, x, y) =>
    poseRun(s, (r) => {
      validId(["oil-splash", "blaze"], weapon);
      const v = row(
          weapon,
          r.weapons.find((w) => w.id === weapon)?.level ?? 1,
        ) as C.PuddleLevel,
        st = stats(r);
      return zone(
        r,
        weapon,
        "puddle",
        n(x),
        n(y),
        v.radius * st.area,
        v.damage * st.damage,
        v.duration,
      );
    }),
  clearZones: (s) => poseRun(s, (r) => ({ ...r, zones: [] })),
  spawnGem: (s, tier, x, y) =>
    poseRun(s, (r) => {
      validId(C.GEM_TIERS, tier);
      return {
        ...r,
        gems: [
          ...r.gems,
          { id: r.nextId, tier, x: n(x), y: n(y), attracted: false },
        ],
        nextId: r.nextId + 1,
      };
    }),
  setGemAttracted: (s, id, attracted) =>
    poseRun(s, (r) => {
      check(r.gems.some((g) => g.id === id));
      return {
        ...r,
        gems: r.gems.map((g) =>
          g.id === id ? { ...g, attracted: flag(attracted) } : g,
        ),
      };
    }),
  clearGems: (s) => poseRun(s, (r) => ({ ...r, gems: [] })),
  spawnPickup: (s, kind, x, y) =>
    poseRun(s, (r) => {
      validId(C.PICKUP_KINDS, kind);
      return {
        ...r,
        pickups: [...r.pickups, { id: r.nextId, kind, x: n(x), y: n(y) }],
        nextId: r.nextId + 1,
      };
    }),
  clearPickups: (s) => poseRun(s, (r) => ({ ...r, pickups: [] })),
};
function select(s: WickState, api: UpdateApi, index: number): WickState {
  if (s.screen === "title") {
    api.audio.play(C.CUES.menuConfirm);
    return index === 0
      ? fresh(s)
      : {
          ...s,
          screen: index === 1 ? "almanac" : "howto",
          menuIndex: 0,
          almanacTab: 0,
          almanacScroll: 0,
        };
  }
  if (s.screen === "levelup") {
    api.audio.play(C.CUES.choose);
    const next = choose(s, index);
    if (next.screen === "levelup") api.audio.play(C.CUES.levelUp);
    return next;
  }
  if (s.screen === "chest" || s.screen === "howto")
    return {
      ...s,
      screen: s.screen === "chest" ? "playing" : "title",
      menuIndex: s.screen === "howto" ? 2 : 0,
      run: s.screen === "howto" ? idleRun() : { ...s.run, chestResult: null },
    };
  if (s.screen === "paused") {
    api.audio.play(C.CUES.menuConfirm);
    return index === 0
      ? { ...s, screen: "playing" }
      : { ...s, screen: "title", run: idleRun() };
  }
  if (s.screen === "fallen" || s.screen === "dawn") {
    api.audio.play(C.CUES.menuConfirm);
    return index === 0 ? fresh(s) : { ...s, screen: "title", run: idleRun() };
  }
  return s;
}
function handleInput(s: WickState, api: UpdateApi): WickState {
  const input = api.input;
  if (input.pressed("mute")) api.audio.setMuted(!api.audio.muted());
  if (
    s.screen === "playing" &&
    (input.pressed("pause") || input.pressed("back"))
  )
    return { ...s, screen: "paused", menuIndex: 0, accumulator: 0 };
  if (
    s.screen === "paused" &&
    (input.pressed("pause") || input.pressed("back"))
  )
    return { ...s, screen: "playing" };
  if (s.screen === "almanac") {
    let tab = s.almanacTab;
    if (input.pressed("left")) tab = (tab + 3) % 4;
    if (input.pressed("right")) tab = (tab + 1) % 4;
    if (tab !== s.almanacTab) {
      api.audio.play(C.CUES.menuMove);
      s = { ...s, almanacTab: tab, menuIndex: 0, almanacScroll: 0 };
    }
    const wheel = input.wheel().y;
    if (wheel)
      s = {
        ...s,
        almanacScroll: Math.max(
          0,
          Math.min(
            s.almanacScroll + Math.trunc(wheel / C.WHEEL_ROW),
            entries(tab).length - C.ALMANAC_ROWS,
          ),
        ),
      };
    if (input.pressed("back"))
      return {
        ...s,
        screen: "title",
        menuIndex: 1,
        almanacTab: 0,
        almanacScroll: 0,
      };
  }
  if (s.screen === "howto" && input.pressed("back"))
    return { ...s, screen: "title", menuIndex: 2 };
  if ((s.screen === "fallen" || s.screen === "dawn") && input.pressed("back"))
    return { ...s, screen: "title", menuIndex: 0, run: idleRun() };
  const count =
    s.screen === "almanac" ? entries(s.almanacTab).length : menuRects(s).length;
  if (count > 1) {
    const delta =
      (input.pressed("down") ? 1 : 0) - (input.pressed("up") ? 1 : 0);
    if (delta) {
      api.audio.play(C.CUES.menuMove);
      const i = (s.menuIndex + delta + count) % count;
      s = {
        ...s,
        menuIndex: i,
        almanacScroll:
          s.screen === "almanac"
            ? Math.min(Math.max(i - C.ALMANAC_ROWS + 1, s.almanacScroll), i)
            : 0,
      };
    }
  }
  if (input.pressed("confirm") && s.screen !== "almanac")
    s = select(s, api, s.menuIndex);
  for (const sample of input.pointerSamples()) {
    if (!sample.primary) continue;
    const rects = menuRects(s);
    const tabs = tabRects(s);
    const inside = (r: WickRect) =>
      sample.x >= r.x &&
      sample.x < r.x + r.width &&
      sample.y >= r.y &&
      sample.y < r.y + r.height;
    const tab = tabs.findIndex(inside);
    const row = rects.findIndex(inside);
    const actual =
      row < 0 ? -1 : s.screen === "almanac" ? row + s.almanacScroll : row;
    const marker = tab >= 0 ? -tab - 2 : actual;
    if (sample.type === "down" && sample.button === "primary") {
      if (actual >= 0 && s.menuIndex !== actual) {
        api.audio.play(C.CUES.menuMove);
        s = { ...s, menuIndex: actual };
      }
      s = { ...s, pointerDownAt: marker };
    } else if (sample.type === "up" && sample.button === "primary") {
      if (s.pointerDownAt === marker) {
        if (tab >= 0 && s.screen === "almanac" && tab !== s.almanacTab) {
          api.audio.play(C.CUES.menuMove);
          s = { ...s, almanacTab: tab, menuIndex: 0, almanacScroll: 0 };
        } else if (actual >= 0 && s.screen !== "almanac")
          s = select(s, api, actual);
      }
      s = { ...s, pointerDownAt: null };
    } else if (
      sample.type === "move" &&
      sample.buttons.length === 0 &&
      sample.device !== "touch" &&
      actual >= 0 &&
      s.menuIndex !== actual
    ) {
      api.audio.play(C.CUES.menuMove);
      s = { ...s, menuIndex: actual };
    }
  }
  return s;
}
function reconcileLoops(s: WickState, api: UpdateApi): void {
  const music = ["playing", "levelup", "chest", "paused"].includes(s.screen),
    hum =
      s.screen === "playing" &&
      s.run.weapons.some((w) => w.id === "halo" || w.id === "corona");
  for (const [cue, on] of [
    [C.CUES.music, music],
    [C.CUES.hum, hum],
  ] as const) {
    if (on && !api.audio.looping(cue)) api.audio.loop(cue);
    if (!on && api.audio.looping(cue)) api.audio.stop(cue);
  }
}
const sprite = (
  ctx: CanvasRenderingContext2D,
  path: string,
  x: number,
  y: number,
  w: number,
  h: number,
  flip = false,
) => {
  const img = images.get(path);
  if (!img) return;
  ctx.save();
  ctx.translate(x, y);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();
};
const sheet = (dir: string, frame: number) => `${dir}/${frame}.png`;
function world(s: WickState, ctx: CanvasRenderingContext2D): void {
  const r = s.run,
    p = r.player;
  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, C.STAGE_W, C.STAGE_H);
  const x0 = Math.floor((p.x - C.STAGE_CX) / C.GROUND_TILE_SIZE),
    x1 = Math.ceil((p.x + C.STAGE_CX) / C.GROUND_TILE_SIZE),
    y0 = Math.floor((p.y - C.STAGE_CY) / C.GROUND_TILE_SIZE),
    y1 = Math.ceil((p.y + C.STAGE_CY) / C.GROUND_TILE_SIZE);
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++)
      sprite(
        ctx,
        C.GROUND_TILE_PATH,
        x * C.GROUND_TILE_SIZE - p.x + C.STAGE_CX + 32,
        y * C.GROUND_TILE_SIZE - p.y + C.STAGE_CY + 32,
        64,
        64,
      );
  const sx = (x: number) => x - p.x + C.STAGE_CX,
    sy = (y: number) => y - p.y + C.STAGE_CY;
  for (const z of r.zones) {
    const def = C.EFFECT_SPRITES[z.weapon],
      frame =
        def.frames === 1
          ? 0
          : z.kind === "strike"
            ? Math.min(
                def.frames - 1,
                Math.floor(
                  ((C.SPARK_FLASH - (z.ttl ?? 0)) / C.SPARK_FLASH) * def.frames,
                ),
              )
            : z.kind === "burst"
              ? Math.min(
                  def.frames - 1,
                  Math.floor(
                    ((C.FLARE_FLASH - (z.ttl ?? 0)) / C.FLARE_FLASH) *
                      def.frames,
                  ),
                )
              : Math.floor((r.tick * C.TICK_DT) / C.WALK_FRAME_TIME) %
                def.frames;
    const path = def.frames === 1 ? def.path : sheet(def.path, frame),
      w = z.kind === "slash" ? (z.width ?? 0) : z.radius * 2,
      h = z.kind === "slash" ? (z.height ?? 0) : z.radius * 2;
    sprite(ctx, path, sx(z.x), sy(z.y), w, h);
    if (z.kind === "aura") {
      ctx.strokeStyle = z.weapon === "corona" ? "#fff5b8aa" : "#f9c97777";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx(z.x), sy(z.y), z.radius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  for (const g of r.gems)
    sprite(
      ctx,
      C.GEM_PATHS[g.tier],
      sx(g.x),
      sy(g.y),
      C.GEM_SPRITE_SIZES[g.tier],
      C.GEM_SPRITE_SIZES[g.tier],
    );
  for (const q of r.pickups)
    sprite(ctx, C.PICKUP_PATHS[q.kind], sx(q.x), sy(q.y), 24, 24);
  for (const puff of r.puffs)
    sprite(
      ctx,
      sheet(
        C.PUFF_SHEET.dir,
        Math.min(
          C.PUFF_SHEET.frames - 1,
          Math.floor(puff.age / (C.PUFF_TIME / C.PUFF_SHEET.frames)),
        ),
      ),
      sx(puff.x),
      sy(puff.y),
      C.PUFF_SPRITE_SIZE,
      C.PUFF_SPRITE_SIZE,
    );
  for (const e of r.enemies) {
    const size = C.ENEMIES[e.type].radius * 2;
    sprite(
      ctx,
      sheet(
        `${C.ENEMY_SHEET_DIR}/${e.type}`,
        Math.floor(e.age / C.WALK_FRAME_TIME) % C.ENEMY_FRAMES,
      ),
      sx(e.x),
      sy(e.y),
      size,
      size,
      e.heading.x < 0,
    );
    if (C.ENEMIES[e.type].rank !== "common") {
      ctx.fillStyle = "#151b29";
      ctx.fillRect(sx(e.x) - 30, sy(e.y) - size / 2 - 10, 60, 4);
      ctx.fillStyle = "#e0ae85";
      ctx.fillRect(
        sx(e.x) - 30,
        sy(e.y) - size / 2 - 10,
        60 * Math.max(0, e.hp / e.maxHp),
        4,
      );
    }
  }
  for (const q of r.projectiles) {
    const def = C.EFFECT_SPRITES[q.weapon];
    sprite(
      ctx,
      def.frames === 1
        ? def.path
        : sheet(
            def.path,
            Math.floor((r.tick * C.TICK_DT) / C.WALK_FRAME_TIME) % def.frames,
          ),
      sx(q.x),
      sy(q.y),
      q.radius * 2,
      q.radius * 2,
    );
  }
  ctx.save();
  ctx.shadowColor = "#f4bd69";
  ctx.shadowBlur = 35;
  sprite(
    ctx,
    r.lastMovedTick === r.tick
      ? sheet(
          C.LAMPLIGHTER_WALK_SHEET.dir,
          Math.floor((r.movedTicks * C.TICK_DT) / C.WALK_FRAME_TIME) %
            C.LAMPLIGHTER_WALK_SHEET.frames,
        )
      : C.LAMPLIGHTER_IDLE_PATH,
    C.STAGE_CX,
    C.STAGE_CY,
    24,
    32,
    p.facing === "left",
  );
  ctx.restore();
  if (r.hurtFlash > 0) {
    ctx.fillStyle = `rgba(182,42,66,${Math.min(0.35, (r.hurtFlash / C.HURT_FLASH) * 0.35)})`;
    ctx.fillRect(0, 0, C.STAGE_W, C.STAGE_H);
  }
  hud(r, ctx);
}
const text = (
  ctx: CanvasRenderingContext2D,
  t: string,
  x: number,
  y: number,
  size = 24,
  color = "#ede2c8",
  align: CanvasTextAlign = "left",
) => {
  ctx.fillStyle = color;
  ctx.font = `${size}px Georgia, serif`;
  ctx.textAlign = align;
  ctx.fillText(t, x, y);
};
const panel = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) => {
  ctx.fillStyle = "#0b1325ed";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#b9905a";
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  ctx.strokeStyle = "#594a44";
  ctx.strokeRect(x + 7, y + 7, w - 14, h - 14);
};
function hud(r: RunState, ctx: CanvasRenderingContext2D): void {
  const st = stats(r);
  panel(ctx, 22, 18, 315, 95);
  text(ctx, "LAMPLIGHTER", 40, 45, 17, "#d4ae79");
  ctx.fillStyle = "#3b2431";
  ctx.fillRect(40, 58, 220, 15);
  ctx.fillStyle = "#d96d67";
  ctx.fillRect(40, 58, 220 * Math.max(0, r.player.hp / st.maxHp), 15);
  text(
    ctx,
    `${Math.ceil(Math.max(0, r.player.hp))} / ${st.maxHp}`,
    274,
    71,
    15,
  );
  ctx.fillStyle = "#263448";
  ctx.fillRect(40, 86, 220, 10);
  ctx.fillStyle = "#79c8b8";
  ctx.fillRect(40, 86, 220 * Math.min(1, r.xp / xpNext(r)), 10);
  text(ctx, `LEVEL ${r.level}`, 272, 96, 14);
  panel(ctx, 1060, 18, 195, 95);
  const sec = Math.floor(r.tick / C.TICK_HZ);
  text(
    ctx,
    `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`,
    1158,
    58,
    33,
    "#f9d89a",
    "center",
  );
  text(ctx, `KILLS  ${r.kills}`, 1158, 91, 17, "#d4ae79", "center");
  const all = [...r.weapons, ...r.passives];
  for (let i = 0; i < 12; i++) {
    const x = 380 + (i % 6) * 88,
      y = i < 6 ? 22 : 85;
    ctx.fillStyle = "#15243a";
    ctx.fillRect(x, y, 68, 57);
    ctx.strokeStyle = "#8e7259";
    ctx.strokeRect(x, y, 68, 57);
    const item = all[i];
    if (!item) continue;
    sprite(ctx, C.ICON_PATHS[item.id], x + 34, y + 25, 34, 34);
    if ("cooldown" in item && item.cooldown > 0) {
      ctx.fillStyle = "#06101abb";
      ctx.fillRect(
        x + 7,
        y + 5,
        54,
        Math.min(
          43,
          (item.cooldown /
            Math.max(C.MIN_COOLDOWN, row(item.id, item.level).cooldown)) *
            43,
        ),
      );
    }
    for (let j = 0; j < item.level; j++) {
      ctx.fillStyle = "#f8cb79";
      ctx.fillRect(x + 6 + j * 7, y + 50, 5, 3);
    }
  }
}
function drawMenu(
  s: WickState,
  ctx: CanvasRenderingContext2D,
  items: readonly string[],
): void {
  const rects = menuRects(s);
  items.forEach((item, i) => {
    const r = rects[i];
    if (!r) return;
    ctx.fillStyle = i === s.menuIndex ? "#ab754c55" : "#1a2439aa";
    ctx.fillRect(r.x, r.y, r.width, r.height);
    ctx.strokeStyle = i === s.menuIndex ? "#eac58a" : "#526074";
    ctx.strokeRect(r.x, r.y, r.width, r.height);
    text(
      ctx,
      item,
      r.x + r.width / 2,
      r.y + r.height / 2 + 8,
      25,
      i === s.menuIndex ? "#ffe5b7" : "#ddd3c2",
      "center",
    );
  });
}
function overlay(s: WickState, ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = "#050915cc";
  ctx.fillRect(0, 0, C.STAGE_W, C.STAGE_H);
  if (s.screen === "levelup") {
    panel(ctx, 330, 128, 620, 485);
    text(ctx, C.LEVEL_UP_TEXT, 640, 190, 34, "#f5d192", "center");
    drawMenu(
      s,
      ctx,
      s.run.offers.map((id) =>
        id === C.LAMP_OIL_ID
          ? C.LAMP_OIL_NAME
          : ((C.WEAPON_NAMES as Record<string, string>)[id] ??
            C.PASSIVES[id as PassiveId].name),
      ),
    );
    for (let i = 0; i < s.run.offers.length; i++) {
      const id = s.run.offers[i],
        r = menuRects(s)[i];
      sprite(ctx, C.ICON_PATHS[id], r.x + 32, r.y + r.height / 2, 43, 43);
      const held =
        s.run.weapons.find((w) => w.id === id)?.level ??
        s.run.passives.find((p) => p.id === id)?.level;
      text(
        ctx,
        held ? `${C.LEVEL_LABEL} ${held + 1}` : C.OFFER_NEW_TEXT,
        r.x + r.width - 22,
        r.y + r.height / 2 + 5,
        15,
        "#e7b876",
        "right",
      );
    }
    const id = s.run.offers[s.menuIndex];
    if (id)
      text(
        ctx,
        id === C.LAMP_OIL_ID
          ? C.LAMP_OIL_DESCRIPTION
          : ((C.WEAPON_DESCRIPTIONS as Record<string, string>)[id] ??
              C.PASSIVE_DESCRIPTIONS[id as PassiveId]),
        640,
        566,
        17,
        "#dbd2c1",
        "center",
      );
  } else if (s.screen === "chest") {
    panel(ctx, 360, 160, 560, 430);
    text(ctx, C.CHEST_TEXT, 640, 235, 40, "#f5d192", "center");
    const res = s.run.chestResult;
    if (res?.kind === "evolve") {
      sprite(ctx, C.ICON_PATHS[res.weapon], 640, 344, 80, 80);
      text(ctx, C.WEAPON_NAMES[res.weapon], 640, 435, 36, "#f6dfb0", "center");
    } else if (res?.kind === "level") {
      sprite(ctx, C.ICON_PATHS[res.item], 640, 344, 80, 80);
      text(
        ctx,
        `${(C.WEAPON_NAMES as Record<string, string>)[res.item] ?? C.PASSIVES[res.item as PassiveId].name}  ${C.LEVEL_LABEL} ${res.level}`,
        640,
        435,
        32,
        "#f6dfb0",
        "center",
      );
    } else
      text(
        ctx,
        `Healed ${C.CHEST_HEAL} health`,
        640,
        380,
        28,
        "#f6dfb0",
        "center",
      );
    text(ctx, "CONTINUE", 640, 635, 24, "#f6dfb0", "center");
  } else {
    const heading =
      s.screen === "paused"
        ? C.PAUSED_TEXT
        : s.screen === "fallen"
          ? C.FALLEN_TEXT
          : C.DAWN_TEXT;
    panel(ctx, 350, 165, 580, 475);
    text(ctx, heading, 640, 255, 43, "#f5d192", "center");
    if (s.screen !== "paused") {
      const sec = Math.floor(s.run.tick / C.TICK_HZ);
      text(
        ctx,
        `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}    LEVEL ${s.run.level}    ${s.run.kills} KILLS`,
        640,
        340,
        22,
        "#e7d8bd",
        "center",
      );
    }
    drawMenu(s, ctx, s.screen === "paused" ? C.PAUSE_ITEMS : C.END_ITEMS);
  }
}
function almanac(s: WickState, ctx: CanvasRenderingContext2D): void {
  panel(ctx, 80, 45, 1120, 630);
  text(ctx, C.ALMANAC_TEXT, 640, 94, 38, "#f5d192", "center");
  for (let i = 0; i < 4; i++) {
    const r = tabRects(s)[i];
    ctx.fillStyle = i === s.almanacTab ? "#987448" : "#1b263b";
    ctx.fillRect(r.x, r.y, r.width, r.height);
    text(
      ctx,
      C.ALMANAC_TABS[i],
      r.x + r.width / 2,
      r.y + 34,
      20,
      "#fff1d0",
      "center",
    );
  }
  const list = entries(s.almanacTab),
    rects = menuRects(s);
  rects.forEach((r, i) => {
    const id = list[i + s.almanacScroll];
    ctx.fillStyle =
      i + s.almanacScroll === s.menuIndex ? "#83684966" : "#16213799";
    ctx.fillRect(r.x, r.y, r.width, r.height);
    const name =
      (C.WEAPON_NAMES as Record<string, string>)[id] ??
      (C.PASSIVES as Record<string, { name: string }>)[id]?.name ??
      (C.ENEMIES as Record<string, { name: string }>)[id]?.name ??
      (C.GEM_NAMES as Record<string, string>)[id] ??
      (C.PICKUP_NAMES as Record<string, string>)[id];
    text(ctx, name, r.x + 14, r.y + 29, 21);
  });
  const id = list[s.menuIndex];
  if (!id) return;
  const path =
    s.almanacTab === 0
      ? C.ICON_PATHS[id as WeaponId]
      : s.almanacTab === 1
        ? C.ICON_PATHS[id as PassiveId]
        : s.almanacTab === 2
          ? sheet(
              `${C.ENEMY_SHEET_DIR}/${id}`,
              Math.floor(s.simTime / C.WALK_FRAME_TIME) % 4,
            )
          : ((C.GEM_PATHS as Record<string, string>)[id] ??
            (C.PICKUP_PATHS as Record<string, string>)[id]);
  sprite(
    ctx,
    path,
    865,
    300,
    s.almanacTab === 2 ? C.ENEMIES[id as EnemyId].radius * 4 : 85,
    s.almanacTab === 2 ? C.ENEMIES[id as EnemyId].radius * 4 : 85,
  );
  const desc =
    (C.WEAPON_DESCRIPTIONS as Record<string, string>)[id] ??
    (C.PASSIVE_DESCRIPTIONS as Record<string, string>)[id] ??
    (C.ENEMY_DESCRIPTIONS as Record<string, string>)[id] ??
    (C.GEM_DESCRIPTIONS as Record<string, string>)[id] ??
    (C.PICKUP_DESCRIPTIONS as Record<string, string>)[id];
  const words = desc.split(" ");
  let line = "",
    y = 458;
  for (const word of words) {
    if ((line + " " + word).length > 53) {
      text(ctx, line, 670, y, 17);
      y += 27;
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) text(ctx, line, 670, y, 17);
  let facts = "";
  if (s.almanacTab === 0) {
    const weapon = row(id as WeaponId, 1);
    facts = `DAMAGE ${weapon.damage}`;
    if (id !== "chandelier") facts += `    COOLDOWN ${weapon.cooldown}s`;
  } else if (s.almanacTab === 1)
    facts = `MAX LEVEL ${C.PASSIVES[id as PassiveId].maxLevel}`;
  else if (s.almanacTab === 2) {
    const enemy = C.ENEMIES[id as EnemyId];
    facts = `HEALTH ${enemy.hp}    SPEED ${enemy.speed}    DAMAGE ${enemy.damage}`;
  } else if ((C.GEM_TIERS as readonly string[]).includes(id))
    facts = `EXPERIENCE ${C.GEM_VALUES[id as GemTier]}`;
  else if (id === "bread") facts = `HEALS ${C.BREAD_HEAL}`;
  if (facts) text(ctx, facts, 670, 560, 17, "#efc583");
  text(ctx, "ESC  BACK", 1060, 635, 17, "#ad9f8a");
}
function render(s: WickState, api: RenderApi): void {
  const ctx = api.ctx;
  ctx.imageSmoothingEnabled = false;
  if (s.screen === "title") {
    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, C.STAGE_W, C.STAGE_H);
    for (let i = 0; i < 30; i++) {
      const x = (i * 197 + Math.sin(s.simTime * 0.4 + i) * 35) % 1280,
        y = (i * 263) % 720;
      ctx.fillStyle = "#e3bc7966";
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.save();
    ctx.shadowColor = "#efb765";
    ctx.shadowBlur = 80;
    sprite(ctx, C.LAMPLIGHTER_IDLE_PATH, 640, 265, 92, 122);
    ctx.restore();
    text(ctx, C.TITLE_TEXT, 640, 130, 98, "#f6d08f", "center");
    text(ctx, C.TAGLINE_TEXT, 640, 367, 24, "#c5b5a0", "center");
    drawMenu(s, ctx, C.TITLE_ITEMS);
    text(ctx, "A TEN MINUTE NIGHT", 640, 685, 16, "#998a7f", "center");
  } else if (s.screen === "howto") {
    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, 1280, 720);
    panel(ctx, 225, 75, 830, 550);
    text(ctx, "HOW TO PLAY", 640, 145, 45, "#f5d192", "center");
    [
      "WALK with WASD or arrow keys. Your tools fire themselves.",
      "Collect gems to grow stronger. Choose one of three gifts.",
      "Find elite chests to transform a fully grown tool.",
      "Survive the Dark until dawn at ten minutes.",
      "P pauses   •   M mutes   •   Esc returns",
    ].forEach((line, i) =>
      text(ctx, line, 640, 225 + i * 67, 22, "#e7d8bd", "center"),
    );
    text(ctx, "RETURN TO THE NIGHT", 640, 625, 24, "#f5d192", "center");
  } else if (s.screen === "almanac") almanac(s, ctx);
  else {
    world(s, ctx);
    if (s.screen !== "playing") overlay(s, ctx);
  }
}
export const game: Game<WickState, WickDebugApi> = {
  async initialize(api: InitApi<WickState>) {
    for (const action of C.ACTIONS)
      api.input.register(action, { keys: [...C.BINDINGS[action]] });
    const paths = [
      C.LAMPLIGHTER_IDLE_PATH,
      ...Array.from({ length: C.LAMPLIGHTER_WALK_SHEET.frames }, (_, i) =>
        sheet(C.LAMPLIGHTER_WALK_SHEET.dir, i),
      ),
      ...C.ENEMY_IDS.flatMap((id) =>
        Array.from({ length: C.ENEMY_FRAMES }, (_, i) =>
          sheet(`${C.ENEMY_SHEET_DIR}/${id}`, i),
        ),
      ),
      ...Array.from({ length: C.PUFF_SHEET.frames }, (_, i) =>
        sheet(C.PUFF_SHEET.dir, i),
      ),
      ...Object.values(C.GEM_PATHS),
      ...Object.values(C.PICKUP_PATHS),
      C.GROUND_TILE_PATH,
      ...Object.values(C.EFFECT_SPRITES).flatMap((e) =>
        e.frames === 1
          ? [e.path]
          : Array.from({ length: e.frames }, (_, i) => sheet(e.path, i)),
      ),
      ...Object.values(C.ICON_PATHS),
    ];
    await Promise.all(
      [...new Set(paths)].map(async (p) =>
        images.set(p, await api.assets.loadImage(p)),
      ),
    );
    await Promise.all(
      Object.entries(C.CUE_PATHS).map(([name, path]) =>
        api.audio.load(name, path),
      ),
    );
    for (const [name, reader] of Object.entries({
      screen: (s: WickState) => s.screen,
      time: (s: WickState) => `${(s.run.tick / C.TICK_HZ).toFixed(1)}s`,
      level: (s: WickState) =>
        `${s.run.level} ${s.run.xp.toFixed(1)}/${xpNext(s.run)}`,
      health: (s: WickState) =>
        `${s.run.player.hp.toFixed(1)}/${stats(s.run).maxHp}`,
      kills: (s: WickState) => s.run.kills,
      position: (s: WickState) =>
        `${s.run.player.x.toFixed(0)}, ${s.run.player.y.toFixed(0)} ${s.run.player.facing}`,
      enemies: (s: WickState) =>
        `${s.run.enemies.length} window ${Math.floor(s.run.tick / C.TICK_HZ / C.SPAWN_WINDOW)}`,
      effects: (s: WickState) =>
        `${s.run.projectiles.length} / ${s.run.zones.length}`,
      gems: (s: WickState) => s.run.gems.length,
      weapons: (s: WickState) =>
        s.run.weapons
          .map((w) => `${w.id} ${w.level} ${w.cooldown.toFixed(1)}`)
          .join(", "),
      passives: (s: WickState) =>
        s.run.passives.map((p) => `${p.id} ${p.level}`).join(", "),
      pending: (s: WickState) => s.run.pendingLevelUps,
      drivers: (s: WickState) =>
        [
          s.spawning,
          s.events,
          s.despawning,
          s.enemyMotion,
          s.enemyContact,
          s.weaponFire,
          s.effectMotion,
          s.drops,
          s.progression,
        ]
          .map((v) => (v ? 1 : 0))
          .join(""),
    }))
      api.diagnostics.register(name, (s) => reader(copy(s)));
    return [initial(), debug];
  },
  update(input, api, dt) {
    let s = handleInput(copy(input), api);
    s = { ...s, simTime: s.simTime + dt, muted: api.audio.muted() };
    if (s.screen === "playing") {
      let a = s.accumulator + dt;
      const dx = api.input.value("right") - api.input.value("left"),
        dy = api.input.value("down") - api.input.value("up");
      while (a >= C.TICK_DT - C.TICK_EPSILON && s.screen === "playing") {
        s = tick(s, api, dx, dy);
        a -= C.TICK_DT;
      }
      s = {
        ...s,
        accumulator: s.screen === "playing" && a >= C.TICK_EPSILON ? a : 0,
      };
    } else s = { ...s, accumulator: 0 };
    reconcileLoops(s, api);
    return s;
  },
  render(input, api) {
    render(copy(input), api);
  },
};
