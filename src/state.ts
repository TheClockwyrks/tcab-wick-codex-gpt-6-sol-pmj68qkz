import type { DeepReadonly } from "ts-essentials";
import type {
  EnemyId,
  GemTier,
  OfferId,
  PassiveId,
  PickupKind,
  WeaponId,
} from "./constants";
export type {
  EnemyId,
  GemTier,
  OfferId,
  PassiveId,
  PickupKind,
  WeaponId,
} from "./constants";
export type Screen =
  | "title"
  | "howto"
  | "almanac"
  | "playing"
  | "levelup"
  | "chest"
  | "paused"
  | "fallen"
  | "dawn";
export type Facing = "left" | "right";
export type ZoneKind =
  "puddle" | "lantern" | "aura" | "slash" | "strike" | "burst";
export type NextDrop = "bread" | "draft" | "none";
export type ChestResult =
  | { readonly kind: "evolve"; readonly weapon: WeaponId }
  | {
      readonly kind: "level";
      readonly item: WeaponId | PassiveId;
      readonly level: number;
    }
  | { readonly kind: "heal" };
export interface PlayerState {
  readonly x: number;
  readonly y: number;
  readonly facing: Facing;
  readonly hp: number;
}
export interface WeaponSlot {
  readonly id: WeaponId;
  readonly level: number;
  readonly cooldown: number;
}
export interface PassiveSlot {
  readonly id: PassiveId;
  readonly level: number;
}
export interface EnemyState {
  readonly id: number;
  readonly type: EnemyId;
  readonly x: number;
  readonly y: number;
  readonly hp: number;
  readonly maxHp: number;
  readonly heading: { readonly x: number; readonly y: number };
  readonly age: number;
  readonly contactCooldown: number;
}
export interface EnemyHit {
  readonly enemy: number;
  readonly cooldown: number;
}
export interface ProjectileState {
  readonly id: number;
  readonly weapon: WeaponId;
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly ax: number;
  readonly ay: number;
  readonly radius: number;
  readonly damage: number;
  readonly ttl: number;
  readonly pierce: number;
  readonly hits: readonly EnemyHit[];
}
export interface ZoneState {
  readonly id: number;
  readonly weapon: WeaponId;
  readonly kind: ZoneKind;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly width?: number;
  readonly height?: number;
  readonly damage: number;
  readonly ttl: number | null;
  readonly hits: readonly EnemyHit[];
  readonly orbitAngle?: number;
  readonly lastPulseTick?: number | null;
}
export interface GemState {
  readonly id: number;
  readonly tier: GemTier;
  readonly x: number;
  readonly y: number;
  readonly attracted: boolean;
}
export interface PickupState {
  readonly id: number;
  readonly kind: PickupKind;
  readonly x: number;
  readonly y: number;
}
export interface RunState {
  readonly tick: number;
  readonly level: number;
  readonly xp: number;
  readonly kills: number;
  readonly player: PlayerState;
  readonly hurtFlash: number;
  readonly weapons: readonly WeaponSlot[];
  readonly passives: readonly PassiveSlot[];
  readonly enemies: readonly EnemyState[];
  readonly projectiles: readonly ProjectileState[];
  readonly zones: readonly ZoneState[];
  readonly gems: readonly GemState[];
  readonly pickups: readonly PickupState[];
  readonly offers: readonly OfferId[];
  readonly nextOffers: readonly OfferId[] | null;
  readonly pendingLevelUps: number;
  readonly chestResult: ChestResult | null;
  readonly spawnTimer: number;
  readonly firedEvents: readonly number[];
  readonly nextId: number;
  readonly nextSpawnAngle: number | null;
  readonly nextSwarmAngle: number | null;
  readonly nextSpawnType: EnemyId | null;
  readonly nextPuddleOffset: { readonly x: number; readonly y: number } | null;
  readonly nextStrikeTarget: number | null;
  readonly nextChestItem: WeaponId | PassiveId | null;
  readonly nextDrop: NextDrop | null;
  readonly movedTicks: number;
  readonly lastMovedTick: number;
  readonly puffs: readonly {
    readonly x: number;
    readonly y: number;
    readonly age: number;
  }[];
}
export interface WickState {
  readonly screen: Screen;
  readonly menuIndex: number;
  readonly almanacTab: number;
  readonly almanacScroll: number;
  readonly run: RunState;
  readonly accumulator: number;
  readonly simTime: number;
  readonly muted: boolean;
  readonly spawning: boolean;
  readonly events: boolean;
  readonly despawning: boolean;
  readonly enemyMotion: boolean;
  readonly enemyContact: boolean;
  readonly weaponFire: boolean;
  readonly effectMotion: boolean;
  readonly drops: boolean;
  readonly progression: boolean;
  readonly pointerDownAt: number | null;
}
export interface WickRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}
export interface WickSnapshot extends Omit<WickState, "run" | "pointerDownAt"> {
  readonly version: number;
  readonly run: Omit<RunState, "movedTicks" | "lastMovedTick" | "puffs"> & {
    readonly time: number;
    readonly xpToNext: number;
    readonly maxHp: number;
    readonly armor: number;
    readonly moveSpeed: number;
    readonly pickupRadius: number;
    readonly spawnWindow: number;
    readonly aliveCommons: number;
    readonly pool: readonly OfferId[];
  };
}
export interface WickDebugApi {
  readonly version: number;
  reset(s: DeepReadonly<WickState>): WickState;
  snapshot(s: DeepReadonly<WickState>): WickSnapshot;
  reconcile(s: DeepReadonly<WickState>): WickState;
  menuRects(s: DeepReadonly<WickState>): readonly WickRect[];
  tabRects(s: DeepReadonly<WickState>): readonly WickRect[];
  setScreen(s: DeepReadonly<WickState>, name: Screen): WickState;
  choose(s: DeepReadonly<WickState>, index: number): WickState;
  setSpawning(s: DeepReadonly<WickState>, on: boolean): WickState;
  setEvents(s: DeepReadonly<WickState>, on: boolean): WickState;
  setDespawning(s: DeepReadonly<WickState>, on: boolean): WickState;
  setEnemyMotion(s: DeepReadonly<WickState>, on: boolean): WickState;
  setEnemyContact(s: DeepReadonly<WickState>, on: boolean): WickState;
  setWeaponFire(s: DeepReadonly<WickState>, on: boolean): WickState;
  setEffectMotion(s: DeepReadonly<WickState>, on: boolean): WickState;
  setDrops(s: DeepReadonly<WickState>, on: boolean): WickState;
  setProgression(s: DeepReadonly<WickState>, on: boolean): WickState;
  setTick(s: DeepReadonly<WickState>, tick: number): WickState;
  setSpawnTimer(s: DeepReadonly<WickState>, seconds: number): WickState;
  setNextSpawnAngle(s: DeepReadonly<WickState>, degrees: number): WickState;
  setNextSwarmAngle(s: DeepReadonly<WickState>, degrees: number): WickState;
  setNextSpawnType(s: DeepReadonly<WickState>, id: EnemyId): WickState;
  setNextPuddleOffset(
    s: DeepReadonly<WickState>,
    dx: number,
    dy: number,
  ): WickState;
  setNextStrikeTarget(s: DeepReadonly<WickState>, id: number): WickState;
  setNextChestItem(
    s: DeepReadonly<WickState>,
    id: WeaponId | PassiveId,
  ): WickState;
  setNextDrop(s: DeepReadonly<WickState>, kind: NextDrop): WickState;
  rollDrop(s: DeepReadonly<WickState>): NextDrop;
  setPlayerPosition(
    s: DeepReadonly<WickState>,
    x: number,
    y: number,
  ): WickState;
  setFacing(s: DeepReadonly<WickState>, facing: Facing): WickState;
  setHp(s: DeepReadonly<WickState>, hp: number): WickState;
  setLevel(s: DeepReadonly<WickState>, level: number): WickState;
  setXp(s: DeepReadonly<WickState>, xp: number): WickState;
  setKills(s: DeepReadonly<WickState>, kills: number): WickState;
  setPendingLevelUps(s: DeepReadonly<WickState>, count: number): WickState;
  setNextOffers(s: DeepReadonly<WickState>, ids: readonly OfferId[]): WickState;
  setWeapon(
    s: DeepReadonly<WickState>,
    slot: number,
    id: WeaponId,
    level: number,
  ): WickState;
  setWeaponCooldown(
    s: DeepReadonly<WickState>,
    slot: number,
    seconds: number,
  ): WickState;
  removeWeapon(s: DeepReadonly<WickState>, slot: number): WickState;
  setPassive(
    s: DeepReadonly<WickState>,
    slot: number,
    id: PassiveId,
    level: number,
  ): WickState;
  removePassive(s: DeepReadonly<WickState>, slot: number): WickState;
  spawnEnemy(
    s: DeepReadonly<WickState>,
    type: EnemyId,
    x: number,
    y: number,
  ): WickState;
  setEnemyPosition(
    s: DeepReadonly<WickState>,
    id: number,
    x: number,
    y: number,
  ): WickState;
  setEnemyHp(s: DeepReadonly<WickState>, id: number, hp: number): WickState;
  setEnemyHeading(
    s: DeepReadonly<WickState>,
    id: number,
    hx: number,
    hy: number,
  ): WickState;
  setEnemyAge(
    s: DeepReadonly<WickState>,
    id: number,
    seconds: number,
  ): WickState;
  setEnemyContactCooldown(
    s: DeepReadonly<WickState>,
    id: number,
    seconds: number,
  ): WickState;
  removeEnemy(s: DeepReadonly<WickState>, id: number): WickState;
  clearEnemies(s: DeepReadonly<WickState>): WickState;
  spawnProjectile(
    s: DeepReadonly<WickState>,
    weapon: "ember" | "pin" | "shard" | "sconce" | "beacon" | "hail",
    x: number,
    y: number,
    vx: number,
    vy: number,
    pierce: number,
  ): WickState;
  clearProjectiles(s: DeepReadonly<WickState>): WickState;
  spawnPuddle(
    s: DeepReadonly<WickState>,
    weapon: "oil-splash" | "blaze",
    x: number,
    y: number,
  ): WickState;
  clearZones(s: DeepReadonly<WickState>): WickState;
  spawnGem(
    s: DeepReadonly<WickState>,
    tier: GemTier,
    x: number,
    y: number,
  ): WickState;
  setGemAttracted(
    s: DeepReadonly<WickState>,
    id: number,
    attracted: boolean,
  ): WickState;
  clearGems(s: DeepReadonly<WickState>): WickState;
  spawnPickup(
    s: DeepReadonly<WickState>,
    kind: PickupKind,
    x: number,
    y: number,
  ): WickState;
  clearPickups(s: DeepReadonly<WickState>): WickState;
}
