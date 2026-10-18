# Wick

Wick is a browser survival game about a lamplighter crossing a moth-choked city. Move through the night while your tools fire automatically, collect gems, choose new tools and trinkets, and survive ten minutes to dawn. Elites leave chests that can transform a fully leveled tool when its matching trinket is held.

## Run

```sh
npm ci
npm run dev
```

Open the local URL Vite prints. The game needs no server beyond static files and makes no network requests outside its own assets.

## Production build

```sh
npm run build
npm run preview
```

`dist/` is the complete static site. It can be served at the root of a host or beneath a subpath. The artwork and audio are committed under `assets/`; the build copies those files through `public/assets` and does not generate assets.

## Controls

| Action | Keys |
| --- | --- |
| Walk | WASD or arrow keys |
| Confirm a menu choice | Enter or Space |
| Go back / pause | Escape |
| Pause or resume | P |
| Mute | M |

Menus also work with mouse and touch. Hover to highlight, then press and release on an item. In the almanac, left and right switch tabs and the wheel scrolls the list.

## Checks

```sh
npm run typecheck
npm run lint
npm run format
npm test
```

The asset source scripts are in `tools/`. They were run to create the committed files and are not part of `npm ci` or `npm run build`.
