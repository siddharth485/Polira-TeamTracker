# Mascot images

Drop the two cartoon character images here with these exact names:

- `mascot-1.png` — first character (e.g. the muffler strategist)
- `mascot-2.png` — second character (e.g. the yellow-turban campaigner)

Notes:
- **Transparent PNGs look best** (they "peek" cleanly). Plain images also work — they're shown in a rounded frame.
- They're served at `/characters/mascot-1.png` etc. (Vite serves the `public/` folder at the site root).
- To add more mascots, drop more images and add them to `src/config/mascots.ts`.
- If a file is missing, the mascot just won't show — nothing breaks.
