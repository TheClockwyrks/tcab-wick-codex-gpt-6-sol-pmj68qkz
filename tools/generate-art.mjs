import { createCanvas } from "@napi-rs/canvas";
import { mkdirSync, writeFileSync } from "node:fs";
const root = "assets/";
function canvas(w, h, fn) {
  const c = createCanvas(w, h),
    g = c.getContext("2d");
  g.imageSmoothingEnabled = false;
  fn(g, w, h);
  return c;
}
function save(path, w, h, fn) {
  const file = root + path;
  mkdirSync(file.slice(0, file.lastIndexOf("/")), { recursive: true });
  writeFileSync(file, canvas(w, h, fn).toBuffer("image/png"));
}
const fill = (g, c) => (g.fillStyle = c);
function poly(g, points, color) {
  fill(g, color);
  g.beginPath();
  g.moveTo(...points[0]);
  for (const p of points.slice(1)) g.lineTo(...p);
  g.closePath();
  g.fill();
}
function ellipse(g, x, y, rx, ry, c) {
  fill(g, c);
  g.beginPath();
  g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  g.fill();
}
function line(g, x1, y1, x2, y2, c, w = 2) {
  g.strokeStyle = c;
  g.lineWidth = w;
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(x2, y2);
  g.stroke();
}
function lamp(g, w, h, phase = 0) {
  const bob = Math.round(Math.sin((phase * Math.PI) / 3) * 1);
  g.translate(0, bob);
  poly(
    g,
    [
      [7, 11],
      [17, 11],
      [20, 27],
      [4, 27],
    ],
    "#26344c",
  );
  poly(
    g,
    [
      [8, 12],
      [16, 12],
      [17, 23],
      [7, 23],
    ],
    "#a27f5a",
  );
  ellipse(g, 12, 8, 5, 5, "#d4ae84");
  fill(g, "#463b42");
  g.fillRect(7, 3, 10, 3);
  g.fillRect(9, 0, 6, 4);
  fill(g, "#b7d1c9");
  g.fillRect(15, 8, 2, 2);
  const step = Math.round(Math.sin((phase * Math.PI) / 3) * 2);
  fill(g, "#161f31");
  g.fillRect(6, 25, 4, 6 - step);
  g.fillRect(14, 25, 4, 6 + step);
  line(g, 18, 15, 23, 15, "#e6bb73", 2);
  g.fillStyle = "#f6d68c";
  g.fillRect(20, 13, 4, 5);
  g.fillStyle = "#fff3ba";
  g.fillRect(21, 14, 2, 2);
}
save("sprites/lamplighter/idle.png", 24, 32, (g) => lamp(g, 24, 32));
for (let i = 0; i < 6; i++)
  save(`sprites/lamplighter/walk/${i}.png`, 24, 32, (g) => lamp(g, 24, 32, i));
const enemies = {
  moth: [20, "#bfa77b"],
  bat: [20, "#695f83"],
  rat: [24, "#8f7665"],
  gnat: [16, "#9dacc8"],
  beetle: [28, "#486d72"],
  wisp: [20, "#a4d7da"],
  spider: [28, "#5e6978"],
  crow: [24, "#454d68"],
  shade: [32, "#5b5672"],
  hound: [36, "#695568"],
  mothwing: [56, "#b28e78"],
  owl: [72, "#8a776f"],
  dark: [80, "#27283a"],
};
function enemy(g, id, n, base, frame) {
  const c = n / 2,
    flap = Math.sin((frame * Math.PI) / 2) * n * 0.07;
  g.save();
  g.translate(c, c);
  const S = n / 24;
  g.scale(S, S);
  g.translate(-12, -12);
  const eye = id === "dark" ? "#e2ab72" : "#ffe6a6";
  if (id === "moth" || id === "mothwing") {
    poly(
      g,
      [
        [12, 11],
        [2, 4 + flap],
        [3, 17],
        [11, 15],
      ],
      base,
    );
    poly(
      g,
      [
        [12, 11],
        [22, 4 + flap],
        [21, 17],
        [13, 15],
      ],
      base,
    );
    poly(
      g,
      [
        [3, 17],
        [9, 14],
        [12, 18],
        [15, 14],
        [21, 17],
        [17, 21],
        [7, 21],
      ],
      "#5e5260",
    );
    ellipse(g, 12, 12, 4, 6, "#6c5a61");
    line(g, 10, 8, 7, 4, base, 1);
    line(g, 14, 8, 17, 4, base, 1);
  } else if (id === "bat" || id === "crow") {
    poly(
      g,
      [
        [12, 10],
        [1, 5 + flap],
        [4, 13],
        [1, 19],
        [9, 16],
        [12, 19],
        [15, 16],
        [23, 19],
        [20, 13],
        [23, 5 + flap],
      ],
      base,
    );
    ellipse(g, 12, 12, 4, 5, "#34384d");
    if (id === "crow")
      poly(
        g,
        [
          [16, 12],
          [22, 14],
          [16, 16],
        ],
        "#c99364",
      );
  } else if (id === "rat" || id === "hound") {
    ellipse(g, 12, 14, 9, 6, base);
    ellipse(g, 7, 10, 4, 4, "#b99586");
    poly(
      g,
      [
        [2, 14],
        [0, 12],
        [0, 17],
      ],
      "#e2aaa1",
    );
    line(g, 18, 17, 24, 21, base, 2);
    fill(g, "#3d3341");
    g.fillRect(7, 19, 2, 3);
    g.fillRect(16, 19, 2, 3);
  } else if (id === "gnat") {
    poly(
      g,
      [
        [12, 11],
        [1, 6 + flap],
        [5, 14],
        [12, 14],
      ],
      base,
    );
    poly(
      g,
      [
        [12, 11],
        [23, 6 + flap],
        [19, 14],
        [12, 14],
      ],
      base,
    );
    ellipse(g, 12, 12, 3, 5, "#645e75");
  } else if (id === "beetle") {
    ellipse(g, 12, 14, 10, 8, "#243f49");
    ellipse(g, 12, 13, 8, 7, base);
    line(g, 12, 7, 12, 19, "#b5a574", 1);
    for (let a of [7, 14, 19]) {
      line(g, a, 17, a - 4, 22, "#293f4b", 2);
      line(g, 24 - a, 17, 28 - a, 22, "#293f4b", 2);
    }
  } else if (id === "wisp") {
    ellipse(g, 12, 12, 8, 8, "#456e80");
    poly(
      g,
      [
        [5, 13],
        [7, 22 + flap],
        [11, 18],
        [14, 23],
        [18, 17],
        [20, 10],
      ],
      base,
    );
    ellipse(g, 12, 10, 5, 5, base);
  } else if (id === "spider") {
    for (let a of [6, 11, 16, 20]) {
      line(g, 10, a, a - 5, a - 5 + flap, base, 2);
      line(g, 14, a, 29 - a, a - 5 + flap, base, 2);
    }
    ellipse(g, 12, 13, 7, 8, base);
  } else if (id === "shade" || id === "dark") {
    poly(
      g,
      [
        [12, 2],
        [19, 5],
        [22, 22],
        [17, 19],
        [13, 24],
        [9, 20],
        [2, 22],
        [5, 6],
      ],
      base,
    );
    poly(
      g,
      [
        [12, 5],
        [17, 8],
        [18, 17],
        [12, 15],
        [6, 17],
        [7, 8],
      ],
      "#171c2f",
    );
    if (id === "dark") {
      for (let k = 0; k < 3; k++)
        line(g, 4 + k * 8, 20, 1 + k * 8, 24 + flap, "#6d536b", 1);
    }
  } else if (id === "owl") {
    poly(
      g,
      [
        [4, 7],
        [0, 12 + flap],
        [4, 21],
        [12, 24],
        [20, 21],
        [24, 12 + flap],
        [20, 7],
        [17, 2],
        [12, 6],
        [7, 2],
      ],
      base,
    );
    ellipse(g, 12, 13, 8, 9, "#4a4655");
    ellipse(g, 8, 11, 3, 4, "#d2b991");
    ellipse(g, 16, 11, 3, 4, "#d2b991");
    poly(
      g,
      [
        [12, 13],
        [9, 17],
        [15, 17],
      ],
      "#c69366",
    );
  } else {
    ellipse(g, 12, 12, 9, 9, base);
  }
  if (id !== "owl") {
    fill(g, eye);
    g.fillRect(id === "dark" ? 8 : 9, 11, 2, 2);
    g.fillRect(id === "dark" ? 15 : 14, 11, 2, 2);
  }
  g.restore();
}
for (const [id, [size, color]] of Object.entries(enemies))
  for (let i = 0; i < 4; i++)
    save(`sprites/enemies/${id}/${i}.png`, size, size, (g) =>
      enemy(g, id, size, color, i),
    );
for (let i = 0; i < 4; i++)
  save(`sprites/puff/${i}.png`, 24, 24, (g) => {
    const c = 12,
      r = 3 + i * 2;
    for (let j = 0; j < 8; j++) {
      const a = (j * Math.PI) / 4 + i * 0.2;
      ellipse(
        g,
        c + Math.cos(a) * r,
        c + Math.sin(a) * r,
        Math.max(1, 4 - i),
        Math.max(1, 3 - i),
        "#d8b980",
      );
    }
    ellipse(g, c, c, Math.max(1, 6 - i * 2), Math.max(1, 6 - i * 2), "#fff1c7");
  });
for (const [id, size, color] of [
  ["small", 8, "#67d5c1"],
  ["medium", 12, "#81b6ee"],
  ["large", 16, "#dcb0f6"],
])
  save(`sprites/gems/${id}.png`, size, size, (g) => {
    const c = size / 2;
    poly(
      g,
      [
        [c, 0],
        [size - 1, c - 1],
        [c, size - 1],
        [0, c - 1],
      ],
      color,
    );
    poly(
      g,
      [
        [c, 2],
        [size - 3, c - 1],
        [c, c + 1],
      ],
      "#ffffff",
    );
  });
for (const id of ["chest", "bread", "draft"])
  save(`sprites/pickups/${id}.png`, 24, 24, (g) => {
    if (id === "chest") {
      fill(g, "#5d3b36");
      g.fillRect(3, 7, 18, 14);
      fill(g, "#b18451");
      g.fillRect(3, 7, 18, 3);
      g.fillRect(3, 14, 18, 3);
      g.fillRect(10, 8, 4, 12);
      fill(g, "#f6d386");
      g.fillRect(11, 12, 2, 5);
    } else if (id === "bread") {
      ellipse(g, 12, 14, 10, 7, "#bf8058");
      ellipse(g, 11, 12, 8, 5, "#e9bd79");
      line(g, 6, 11, 9, 8, "#fff2c0", 1);
      line(g, 13, 10, 16, 8, "#fff2c0", 1);
    } else {
      poly(
        g,
        [
          [11, 2],
          [17, 6],
          [17, 13],
          [22, 19],
          [12, 22],
          [2, 19],
          [7, 13],
          [7, 6],
        ],
        "#568f9e",
      );
      ellipse(g, 12, 13, 5, 5, "#a9e6dc");
      fill(g, "#fff0bd");
      g.fillRect(10, 11, 4, 3);
    }
  });
save("sprites/ground.png", 64, 64, (g) => {
  fill(g, "#111b2c");
  g.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 64; y += 16) {
    line(g, 0, y, 64, y, "#203047", 1);
    for (let x = y % 32 ? 8 : 0; x < 64; x += 16)
      line(g, x, y, x, y + 16, "#1c2a3e", 1);
  }
  for (const [x, y] of [
    [7, 6],
    [38, 8],
    [21, 31],
    [54, 49],
    [8, 56],
    [45, 27],
  ]) {
    fill(g, "#354144");
    g.fillRect(x, y, 2, 2);
    fill(g, "#6a5948");
    g.fillRect(x + 1, y + 1, 1, 1);
  }
});
const effects = {
  taper: [120, 40, "#eccb88"],
  ember: [16, 16, "#f3a36b"],
  pin: [12, 12, "#d2d7cc"],
  lantern: [28, 28, "#e5ba75"],
  halo: [160, 160, "#dfb574"],
  "oil-splash": [100, 100, "#b08b53"],
  spark: [80, 80, "#f9dd93"],
  shard: [16, 16, "#a2d2dc"],
  sconce: [24, 24, "#eab674"],
  flare: [128, 128, "#fff0b3"],
  pyre: [120, 40, "#ff8063"],
  beacon: [16, 16, "#ffdf84"],
  hail: [12, 12, "#b5ecf8"],
  chandelier: [28, 28, "#fff1c4"],
  corona: [160, 160, "#fff0b7"],
  blaze: [100, 100, "#e4774b"],
};
function effect(g, id, w, h, color, frame = 0) {
  const cx = w / 2,
    cy = h / 2;
  if (id === "taper" || id === "pyre") {
    poly(
      g,
      [
        [2, cy],
        [w * 0.35, cy - h * 0.35],
        [w - 3, cy - h * 0.2],
        [w * 0.7, cy],
        [w - 3, cy + h * 0.2],
        [w * 0.35, cy + h * 0.35],
      ],
      color,
    );
    poly(
      g,
      [
        [15, cy],
        [w * 0.5, cy - h * 0.16],
        [w * 0.84, cy],
        [w * 0.5, cy + h * 0.16],
      ],
      "#fff2c8",
    );
    if (id === "pyre")
      for (let i = 0; i < 6; i++)
        poly(
          g,
          [
            [i * 19 + 5, cy - 4],
            [i * 19 + 11, 3],
            [i * 19 + 15, cy + 3],
          ],
          "#f7b466",
        );
  } else if (id === "halo" || id === "corona") {
    g.strokeStyle = color;
    g.lineWidth = 8;
    g.beginPath();
    g.arc(cx, cy, w * 0.44, 0, Math.PI * 2);
    g.stroke();
    g.strokeStyle = "#fff8d0";
    g.lineWidth = 2;
    g.beginPath();
    g.arc(cx, cy, w * 0.4, 0, Math.PI * 2);
    g.stroke();
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      line(
        g,
        cx + Math.cos(a) * w * 0.44,
        cy + Math.sin(a) * w * 0.44,
        cx + Math.cos(a) * w * 0.49,
        cy + Math.sin(a) * w * 0.49,
        color,
        3,
      );
    }
  } else if (id === "oil-splash" || id === "blaze") {
    ellipse(g, cx, cy, w * 0.46, h * 0.43, color);
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4;
      ellipse(
        g,
        cx + Math.cos(a) * w * 0.28,
        cy + Math.sin(a) * h * 0.27,
        4 + (i % 4),
        3 + (i % 3),
        "#f8db8c",
      );
    }
  } else if (id === "spark" || id === "flare") {
    for (let i = 0; i < (id === "spark" ? 6 : 12); i++) {
      const a = ((i + frame * 0.17) * Math.PI) / (id === "spark" ? 3 : 6);
      poly(
        g,
        [
          [cx + Math.cos(a) * 5, cy + Math.sin(a) * 5],
          [cx + Math.cos(a) * (w * 0.48), cy + Math.sin(a) * (h * 0.48)],
          [cx + Math.cos(a + 0.16) * 7, cy + Math.sin(a + 0.16) * 7],
        ],
        color,
      );
    }
    ellipse(g, cx, cy, 10 + frame, "#fff8d8");
  } else if (id === "sconce" || id === "chandelier" || id === "lantern") {
    ellipse(g, cx, cy, w * 0.42, h * 0.42, "#63474a");
    ellipse(g, cx, cy, w * 0.32, h * 0.32, color);
    fill(g, "#fff6cf");
    g.fillRect(cx - 3, cy - 4, 6, 8);
    for (let i = 0; i < 4; i++)
      line(
        g,
        cx,
        cy,
        cx + Math.cos((i * Math.PI) / 2 + frame * 0.5) * w * 0.45,
        cy + Math.sin((i * Math.PI) / 2 + frame * 0.5) * h * 0.45,
        color,
        2,
      );
  } else if (id === "pin" || id === "hail" || id === "shard") {
    poly(
      g,
      [
        [cx, 1],
        [w - 1, cy],
        [cx, h - 1],
        [2, cy],
      ],
      color,
    );
    poly(
      g,
      [
        [cx, 2],
        [cx + 2, cy],
        [cx, cy],
      ],
      "#ffffff",
    );
  } else {
    ellipse(g, cx, cy, w * 0.45, h * 0.45, color);
    ellipse(g, cx - 2, cy - 2, w * 0.2, h * 0.2, "#fff8cf");
  }
}
for (const [id, [w, h, color]] of Object.entries(effects)) {
  const count = id === "spark" || id === "sconce" ? 4 : id === "flare" ? 6 : 1;
  for (let i = 0; i < count; i++)
    save(
      count === 1
        ? `sprites/effects/${id}.png`
        : `sprites/effects/${id}/${i}.png`,
      w,
      h,
      (g) => effect(g, id, w, h, color, i),
    );
}
const icons = [
  "taper",
  "ember",
  "pin",
  "lantern",
  "halo",
  "oil-splash",
  "spark",
  "shard",
  "sconce",
  "flare",
  "pyre",
  "beacon",
  "hail",
  "chandelier",
  "corona",
  "blaze",
  "wick",
  "oil",
  "glass",
  "brass",
  "mirror",
  "bellows",
  "tallow",
  "tinder",
  "soot",
  "lure",
  "lamp-oil",
];
for (const [index, id] of icons.entries())
  save(`icons/${id}.png`, 24, 24, (g) => {
    fill(g, "#172539");
    g.fillRect(0, 0, 24, 24);
    g.strokeStyle = "#806748";
    g.strokeRect(0.5, 0.5, 23, 23);
    if (effects[id]) {
      const [w, h, color] = effects[id];
      g.save();
      g.translate(2, 2);
      g.scale(20 / w, 20 / h);
      effect(g, id, w, h, color);
      g.restore();
    } else {
      const colors = [
        "#e7c981",
        "#7cbbd5",
        "#a9dde5",
        "#be9b78",
        "#ddd4c8",
        "#adc6ae",
        "#eed3a1",
        "#f3a66d",
        "#727a82",
        "#a9d2ba",
        "#e4bf7a",
      ];
      const color = colors[index - 16];
      ellipse(g, 12, 12, 9, 9, color);
      switch (id) {
        case "wick":
          poly(
            g,
            [
              [12, 3],
              [15, 10],
              [18, 14],
              [15, 20],
              [8, 20],
              [6, 14],
              [10, 9],
            ],
            "#ec9f62",
          );
          poly(
            g,
            [
              [12, 8],
              [14, 14],
              [12, 18],
              [9, 14],
            ],
            "#fff0bc",
          );
          break;
        case "oil":
          poly(
            g,
            [
              [12, 3],
              [18, 13],
              [16, 19],
              [8, 19],
              [6, 13],
            ],
            "#4c6578",
          );
          ellipse(g, 12, 15, 4, 4, "#a9d3df");
          break;
        case "glass":
          poly(
            g,
            [
              [12, 3],
              [20, 8],
              [17, 19],
              [7, 19],
              [4, 8],
            ],
            "#c4eff0",
          );
          line(g, 12, 3, 12, 19, "#6aaab9", 1);
          break;
        case "brass":
          poly(
            g,
            [
              [12, 3],
              [19, 7],
              [18, 17],
              [12, 21],
              [6, 17],
              [5, 7],
            ],
            "#a8784c",
          );
          poly(
            g,
            [
              [12, 6],
              [16, 9],
              [15, 16],
              [12, 18],
              [9, 16],
              [8, 9],
            ],
            "#f2d394",
          );
          break;
        case "mirror":
          ellipse(g, 12, 12, 7, 9, "#657e94");
          ellipse(g, 12, 12, 5, 7, "#d4eff1");
          line(g, 9, 17, 15, 7, "#ffffff", 2);
          break;
        case "bellows":
          poly(
            g,
            [
              [4, 8],
              [15, 5],
              [19, 9],
              [19, 17],
              [15, 20],
              [4, 16],
            ],
            "#92694c",
          );
          for (let j = 0; j < 3; j++)
            line(g, 7 + j * 3, 8, 7 + j * 3, 17, "#e4bd89", 1);
          break;
        case "tallow":
          fill(g, "#f4e4bf");
          g.fillRect(8, 8, 8, 12);
          poly(
            g,
            [
              [12, 2],
              [15, 7],
              [12, 10],
              [9, 7],
            ],
            "#f4a764",
          );
          break;
        case "tinder":
          for (let j = 0; j < 3; j++)
            line(g, 6 + j * 5, 17, 10 + j * 4, 6, "#b08355", 2);
          ellipse(g, 15, 8, 3, 3, "#ffca7c");
          break;
        case "soot":
          ellipse(g, 10, 15, 5, 4, "#424b58");
          ellipse(g, 14, 10, 4, 4, "#646e76");
          ellipse(g, 9, 6, 2, 2, "#8a9292");
          break;
        case "lure":
          g.strokeStyle = "#e2d3af";
          g.lineWidth = 2;
          g.beginPath();
          g.arc(11, 11, 7, 0, Math.PI * 1.6);
          g.stroke();
          ellipse(g, 17, 17, 3, 3, "#efaa79");
          break;
        case "lamp-oil":
          poly(
            g,
            [
              [8, 5],
              [16, 5],
              [19, 19],
              [5, 19],
            ],
            "#6e8392",
          );
          fill(g, "#eed39b");
          g.fillRect(9, 9, 6, 7);
          poly(
            g,
            [
              [12, 2],
              [15, 7],
              [12, 9],
              [9, 7],
            ],
            "#f5a764",
          );
          break;
      }
    }
  });
