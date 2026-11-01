# Optional game sprites

All files are optional PNGs. Missing files leave the generated game sprites in
place. Images are centered and scaled to fit the game's native sprite size.
The PWA build copies these files into its output and precaches them together
with the audio, so the sprites are available offline after installation.

## Enemies

Place enemy images in `enemies/`:

- `basic.png`
- `fast.png`
- `tank.png`
- `boss.png`
- `megaboss.png`

## Towers

Place tower images in `towers/`. A full image replaces the menu icon and is
used as a stationary in-game tower:

- `arrow.png`, `cannon.png`, `frost.png`, `lightning.png`

For a rotating in-game tower, provide separate transparent layers instead:

- `<type>-body.png`
- `<type>-head.png`

For example, `arrow-body.png` and `arrow-head.png`. Layers can also be used
alongside `<type>.png`: the full image is used in the menu, while the layers
are used on the game board. Tower artwork is shared by all upgrade levels.
