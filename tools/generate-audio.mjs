import { spawnSync } from "node:child_process";
import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
const temp = "/tmp/wick-audio";
mkdirSync(temp, { recursive: true });
mkdirSync("assets/audio", { recursive: true });
function call(tool, config, ...args) {
  const r = spawnSync(tool, ["--config", config, ...args], {
    encoding: "utf8",
  });
  if (r.status !== 0) throw Error(`${tool} ${args.join(" ")}: ${r.stderr}`);
}
const cues = {
  hit: [320, 85, "triangle", -25],
  kill: [220, 230, "sine", -15],
  gem: [880, 130, "sine", -20],
  hurt: [115, 420, "saw", -22],
  "level-up": [660, 700, "triangle", -19],
  choose: [540, 180, "sine", -19],
  chest: [300, 740, "triangle", -20],
  evolve: [440, 900, "saw", -25],
  pickup: [520, 160, "triangle", -23],
  fallen: [115, 1600, "triangle", -20],
  dawn: [392, 1700, "sine", -19],
  "menu-move": [660, 70, "sine", -27],
  "menu-confirm": [430, 140, "triangle", -25],
  hum: [110, 2400, "sine", -35],
};
for (const [name, [freq, dur, wave, gain]] of Object.entries(cues)) {
  const c = `${temp}/${name}.json`;
  writeFileSync(
    c,
    JSON.stringify({
      sample_rate: 44100,
      channels: "stereo",
      max_duration_ms: dur + 100,
      seed: 2341,
      actions: `${temp}/${name}.actions.json`,
      preview: `${temp}/${name}.png`,
      wav: `/work/assets/audio/${name}.wav`,
    }),
  );
  call("sfx-synth", c, "init");
  call(
    "sfx-synth",
    c,
    "add-voice",
    "--name",
    "tone",
    "--wave",
    wave,
    "--freq",
    String(freq),
    "--gain",
    String(gain),
    "--dur",
    String(dur),
  );
  call(
    "sfx-synth",
    c,
    "set-envelope",
    "--voice",
    "tone",
    "--env",
    name === "hum"
      ? "swell"
      : name === "fallen" || name === "dawn"
        ? "swell"
        : "pluck",
  );
  if (
    name === "hurt" ||
    name === "fallen" ||
    name === "dawn" ||
    name === "evolve"
  ) {
    call(
      "sfx-synth",
      c,
      "add-voice",
      "--name",
      "bass",
      "--wave",
      "sine",
      "--freq",
      String(freq / 2),
      "--gain",
      "-26",
      "--dur",
      String(dur),
    );
    call("sfx-synth", c, "set-envelope", "--voice", "bass", "--env", "swell");
  }
  call("sfx-synth", c, "render");
}
const c = `${temp}/music.json`;
writeFileSync(
  c,
  JSON.stringify({
    sample_rate: 44100,
    channels: "stereo",
    max_duration_ms: 34000,
    seed: 771,
    actions: `${temp}/music.actions.json`,
    preview: `${temp}/music.png`,
    wav: "/work/assets/audio/music.wav",
    mid: "/work/assets/audio/music.mid",
  }),
);
call("music", c, "init");
call("music", c, "set-tempo", "--bpm", "60");
for (const [name, instrument, gain] of [
  ["bass", "sine", "-29"],
  ["bell", "triangle", "-27"],
  ["pad", "sine", "-34"],
]) {
  call("music", c, "define-track", "--name", name, "--instrument", instrument);
  call(
    "music",
    c,
    "set-track-fx",
    "--track",
    name,
    "--gain",
    gain,
    "--env",
    name === "bell" ? "pluck" : "swell",
  );
}
const roots = ["A2", "F2", "C3", "G2", "A2", "F2", "E2", "G2"];
for (let bar = 0; bar < 8; bar++) {
  const t = bar * 4;
  call(
    "music",
    c,
    "add-note",
    "--track",
    "bass",
    "--pitch",
    roots[bar],
    "--t",
    String(t),
    "--dur",
    "3.5",
    "--velocity",
    "63",
  );
  const tones = bar % 2 ? ["A4", "C5", "E5", "C5"] : ["E5", "C5", "A4", "C5"];
  for (let i = 0; i < 4; i++)
    call(
      "music",
      c,
      "add-note",
      "--track",
      "bell",
      "--pitch",
      tones[i],
      "--t",
      String(t + i),
      "--dur",
      "0.4",
      "--velocity",
      String(55 + i * 3),
    );
  call(
    "music",
    c,
    "add-note",
    "--track",
    "pad",
    "--pitch",
    bar % 2 ? "C4" : "A3",
    "--t",
    String(t),
    "--dur",
    "3.8",
    "--velocity",
    "48",
  );
}
call("music", c, "render");
// Soften both sides of the loop seam without altering the score or its middle.
const musicPath = "assets/audio/music.wav";
const audio = readFileSync(musicPath);
let dataOffset = 12;
while (
  dataOffset + 8 < audio.length &&
  audio.toString("ascii", dataOffset, dataOffset + 4) !== "data"
)
  dataOffset += 8 + audio.readUInt32LE(dataOffset + 4);
const first = dataOffset + 8;
const samples = audio.readUInt32LE(dataOffset + 4) / 2;
const channels = audio.readUInt16LE(22);
for (let frame = 0; frame < 512; frame++)
  for (let channel = 0; channel < channels; channel++) {
    const nearStart = first + (frame * channels + channel) * 2;
    const nearEnd = first + (samples - (frame + 1) * channels + channel) * 2;
    audio.writeInt16LE(
      Math.round((audio.readInt16LE(nearStart) * frame) / 512),
      nearStart,
    );
    audio.writeInt16LE(
      Math.round((audio.readInt16LE(nearEnd) * frame) / 512),
      nearEnd,
    );
  }
writeFileSync(musicPath, audio);
