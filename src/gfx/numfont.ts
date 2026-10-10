// Floating numbers as a bitmap font: the glyphs of the game's pixel font are drawn once into one texture (white
// with a black edge, tinted per number). A Text object redraws its own canvas and sends a new texture to the
// graphics card for every number shown, which made fights with many monsters stutter on phones.
import Phaser from 'phaser';

export const NUM_FONT = 'numfont';
const GLYPHS =
  " 0123456789+-−×%!?.,:;/()'\"…♥♻★✦☠abcdefghijklmnopqrstuvwxyzáčďéěíňóřšťúůýžABCDEFGHIJKLMNOPQRSTUVWXYZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ";
const KNOWN = new Set([...GLYPHS]);
/** the glyphs are drawn this big and shown scaled down (smooth at any zoom) */
const PX = 30;

/** whether every letter of a text is in the font (anything else is shown as a plain text) */
export const fitsNumberFont = (text: string) => [...text].every((ch) => KNOWN.has(ch));

/** builds the font once (it stays for the whole game); false when it cannot be built here */
export function ensureNumberFont(scene: Phaser.Scene): boolean {
  if (scene.cache.bitmapFont.exists(NUM_FONT)) return true;
  if (typeof document === 'undefined') return false;
  const font = `${PX}px "Jersey 10", monospace`;
  const pad = 4;
  const c = document.createElement('canvas');
  let ctx = c.getContext('2d');
  if (!ctx) return false;
  ctx.font = font;
  const chars = [...GLYPHS];
  const widths = chars.map((ch) => Math.max(1, Math.ceil(ctx!.measureText(ch).width)));
  const cellH = PX + pad * 2;
  const W = 512;
  const pos: [number, number, number][] = [];
  let x = 0,
    y = 0;
  chars.forEach((_, i) => {
    const cw = widths[i] + pad * 2;
    if (x + cw > W) {
      x = 0;
      y += cellH;
    }
    pos.push([x, y, cw]);
    x += cw;
  });
  c.width = W;
  c.height = y + cellH;
  ctx = c.getContext('2d')!;
  ctx.font = font;
  ctx.textBaseline = 'top';
  ctx.lineJoin = 'round';
  ctx.lineWidth = PX * 0.22;
  ctx.strokeStyle = '#000';
  ctx.fillStyle = '#fff';
  chars.forEach((ch, i) => {
    const [gx, gy] = pos[i];
    ctx!.strokeText(ch, gx + pad, gy + pad);
    ctx!.fillText(ch, gx + pad, gy + pad);
  });
  const tex = scene.textures.addCanvas(NUM_FONT, c);
  if (!tex) return false;
  tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
  const data = { font: NUM_FONT, size: PX, lineHeight: cellH, chars: {} as Record<number, object> };
  chars.forEach((ch, i) => {
    const [gx, gy, cw] = pos[i];
    data.chars[ch.charCodeAt(0)] = {
      x: gx,
      y: gy,
      width: cw,
      height: cellH,
      centerX: Math.floor(cw / 2),
      centerY: Math.floor(cellH / 2),
      xOffset: 0,
      yOffset: 0,
      xAdvance: widths[i] + 3,
      data: {},
      kerning: {},
      u0: gx / W,
      v0: gy / c.height,
      u1: (gx + cw) / W,
      v1: (gy + cellH) / c.height,
    };
  });
  scene.cache.bitmapFont.add(NUM_FONT, { data, texture: NUM_FONT, frame: null });
  return true;
}
