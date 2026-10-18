import { describe, expect, it } from "vitest";
import type { InitApi, UpdateApi } from "@clockwyrks/simple-2d";
import { game, type WickState } from "./game";
import { DAWN_TIME, TICK_DT, TICK_HZ } from "./constants";

async function harness() {
  const cues: string[] = [];
  let muted = false;
  const loops = new Set<string>();
  const init = {
    input: { register() {} },
    assets: { loadImage: async () => ({}) },
    audio: { load: async () => {} },
    diagnostics: { register() {} },
  } as unknown as InitApi<WickState>;
  const [initial, debug] = await game.initialize(init);
  const api = {
    input: {
      pressed: () => false,
      value: () => 0,
      wheel: () => ({ x: 0, y: 0 }),
      pointerSamples: () => [],
    },
    audio: {
      play: (cue: string) => cues.push(cue),
      loop: (cue: string) => loops.add(cue),
      stop: (cue: string) => loops.delete(cue),
      looping: (cue: string) => loops.has(cue),
      muted: () => muted,
      setMuted: (value: boolean) => {
        muted = value;
      },
    },
  } as unknown as UpdateApi;
  const frame = (state: WickState, dt = TICK_DT) => game.update(state, api, dt);
  return { initial, debug, frame, cues, loops };
}

describe("Wick simulation", () => {
  it("consumes fixed ticks and discards the remainder outside play", async () => {
    const { initial, debug, frame } = await harness();
    let s = debug.setScreen(initial, "playing");
    s = debug.setSpawning(s, false);
    s = debug.setEvents(s, false);
    s = frame(s, TICK_DT / 2);
    expect(s.run.tick).toBe(0);
    expect(s.accumulator).toBeCloseTo(TICK_DT / 2);
    s = frame(s, TICK_DT / 2);
    expect(s.run.tick).toBe(1);
    expect(s.accumulator).toBe(0);
    s = debug.setScreen(s, "paused");
    expect(s.accumulator).toBe(0);
    expect(frame(s, 1).run.tick).toBe(1);
  });

  it("damages, kills, drops and collects a gem through the tick", async () => {
    const { initial, debug, frame, cues } = await harness();
    let s = debug.setScreen(initial, "playing");
    s = debug.setSpawning(s, false);
    s = debug.setEvents(s, false);
    s = debug.setEnemyMotion(s, false);
    s = debug.setEnemyContact(s, false);
    s = debug.setWeapon(s, 0, "taper", 8);
    s = debug.spawnEnemy(s, "moth", 25, 0);
    s = debug.setNextDrop(s, "none");
    s = frame(s);
    expect(s.run.kills).toBe(1);
    expect(s.run.enemies).toHaveLength(0);
    expect(s.run.gems).toHaveLength(1);
    s = frame(frame(s));
    expect(s.run.xp).toBe(1);
    expect(cues).toContain("hit");
    expect(cues).toContain("kill");
    expect(cues).toContain("gem");
  });

  it("applies several contact hits and respects the contact cooldown", async () => {
    const { initial, debug, frame } = await harness();
    let s = debug.setScreen(initial, "playing");
    s = debug.setSpawning(s, false);
    s = debug.setEvents(s, false);
    s = debug.setWeaponFire(s, false);
    s = debug.setEnemyMotion(s, false);
    s = debug.spawnEnemy(s, "moth", 0, 0);
    s = debug.spawnEnemy(s, "bat", 0, 0);
    s = frame(s);
    expect(s.run.player.hp).toBe(90);
    s = frame(s);
    expect(s.run.player.hp).toBe(90);
  });

  it("opens offers from experience and reaches both endings", async () => {
    const { initial, debug, frame } = await harness();
    let s = debug.setScreen(initial, "playing");
    s = debug.setSpawning(s, false);
    s = debug.setEvents(s, false);
    s = debug.setWeaponFire(s, false);
    s = debug.spawnGem(s, "large", 0, 0);
    s = debug.setNextOffers(s, ["halo", "wick", "tallow"]);
    s = frame(s);
    expect(s.screen).toBe("levelup");
    expect(s.run.offers).toEqual(["halo", "wick", "tallow"]);
    s = debug.choose(s, 0);
    expect(s.run.weapons[0].id).toBe("halo");
    s = debug.setHp(s, 0);
    s = frame(s);
    expect(s.screen).toBe("fallen");
    s = debug.setScreen(s, "playing");
    s = debug.setHp(s, 100);
    s = debug.setTick(s, DAWN_TIME * TICK_HZ - 1);
    s = frame(s);
    expect(s.screen).toBe("dawn");
  });
});
