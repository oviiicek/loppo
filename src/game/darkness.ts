// The darkness of the dungeon and its fog of war, drawn by one small shader in a single pass: every pixel of the
// view works out how dark it is from the lights around it (the hero, torches, glowing missiles …) and how much
// fog lies on it (a tiny texture with one texel per tile, smoothed by the GPU). It replaces a render texture
// that was cleared, filled, drawn into and blitted every frame (eight framebuffer switches) and a whole layer of
// fog tiles – the heaviest part of a frame for a phone's GPU. Old GPUs that cannot run it keep the old way.
import Phaser from 'phaser';

const FOG_RGB = [7 / 255, 6 / 255, 10 / 255];

/** how many lights one frame can hold (fewer on GPUs with few uniform slots) */
let maxLights = 0;
let tested = false;

/** whether this device draws the darkness with the shader (tested once) */
export function darknessSupported(scene: Phaser.Scene): boolean {
  if ((window as any).__legacyDark) return false; // dev testing hook: the old way, to compare
  if (tested) return maxLights > 0;
  tested = true;
  try {
    const r = scene.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer;
    const gl = r?.gl;
    if (!gl || scene.game.config.renderType === Phaser.CANVAS) return false;
    const slots = gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS) as number;
    const n = slots >= 48 ? 32 : slots >= 28 ? 16 : slots >= 20 ? 10 : 0;
    if (!n) return false;
    // compile and link it once by hand: a driver that cannot is found out before the map is built
    const vs = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vs, 'attribute vec2 inPosition;varying vec2 fragCoord;void main(){fragCoord=inPosition;gl_Position=vec4(inPosition,0.0,1.0);}');
    gl.compileShader(vs);
    const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fs, fragment(n));
    gl.compileShader(fs);
    const p = gl.createProgram()!;
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    const ok = !!gl.getShaderParameter(fs, gl.COMPILE_STATUS) && !!gl.getProgramParameter(p, gl.LINK_STATUS);
    gl.deleteProgram(p);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    maxLights = ok ? n : 0;
  } catch {
    maxLights = 0;
  }
  return maxLights > 0;
}

function fragment(n: number) {
  return `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 resolution;
uniform vec4 uDark;
uniform vec4 uFogInfo;
uniform float uFogAlpha;
uniform vec4 uLights[${n}];
uniform int uCount;
uniform sampler2D iChannel0;
varying vec2 fragCoord;
// the light's gradient: full in the middle, 0.75 at 45 % of the radius, 0.2 at 80 %, nothing at the edge
float fall(float d) {
  if (d < 0.45) return 1.0 - d * 0.5556;
  if (d < 0.8) return 0.75 - (d - 0.45) * 1.5714;
  return max(0.0, 0.2 - (d - 0.8));
}
void main() {
  vec2 p = vec2(fragCoord.x, resolution.y - fragCoord.y);
  float a = uDark.a;
  for (int i = 0; i < ${n}; i++) {
    if (i >= uCount) break;
    vec4 L = uLights[i];
    vec2 dv = p - L.xy;
    float d2 = dot(dv, dv);
    if (d2 < L.z * L.z) a *= 1.0 - fall(sqrt(d2) / L.z) * L.w;
  }
  float f = 0.0;
  if (uFogAlpha > 0.0) f = texture2D(iChannel0, uFogInfo.xy + p * uFogInfo.zw).r * uFogAlpha;
  gl_FragColor = vec4(uDark.rgb * a + vec3(${FOG_RGB.map((v) => v.toFixed(4)).join(', ')}) * f * (1.0 - a), 1.0 - (1.0 - f) * (1.0 - a));
}`;
}

interface Light {
  x: number;
  y: number;
  r: number;
  s: number;
  /** what goes first when there are more lights than slots (lower first) */
  k: number;
}

/** the fog of war of a map: one texel per tile (255 fog, 0 explored), uploaded when it changed */
export class FogTexture {
  w: number;
  h: number;
  data: Uint8Array;
  tex: Phaser.Renderer.WebGL.Wrappers.WebGLTextureWrapper | null = null;
  dirty = true;
  private renderer: Phaser.Renderer.WebGL.WebGLRenderer;
  private lastUpload = 0;

  constructor(scene: Phaser.Scene, w: number, h: number) {
    this.w = w;
    this.h = h;
    this.data = new Uint8Array(w * h * 4).fill(255);
    this.renderer = scene.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer;
  }

  /** a tile is explored: its fog is gone */
  clear(x: number, y: number) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    if (this.data[i] === 0) return;
    this.data[i] = this.data[i + 1] = this.data[i + 2] = 0;
    this.dirty = true;
  }

  /** the texture for this frame (at most a few uploads a second while the hero explores) */
  texture(now: number) {
    const gl = this.renderer.gl;
    if (!this.tex) {
      this.tex = this.renderer.createTexture2D(0, gl.LINEAR, gl.LINEAR, gl.CLAMP_TO_EDGE, gl.CLAMP_TO_EDGE, gl.RGBA, this.data, this.w, this.h, false, true, false);
      this.dirty = false;
      this.lastUpload = now;
    } else if (this.dirty && now - this.lastUpload > 120) {
      this.tex.update(this.data, this.w, this.h, false, gl.CLAMP_TO_EDGE, gl.CLAMP_TO_EDGE, gl.LINEAR, gl.LINEAR, gl.RGBA);
      this.dirty = false;
      this.lastUpload = now;
    }
    return this.tex;
  }

  destroy() {
    this.tex?.destroy();
    this.tex = null;
  }
}

/** the darkness over the view; lights are added every frame between begin() and end() */
export class Darkness {
  readonly shader: Phaser.GameObjects.Shader;
  private lights: Light[] = [];
  private ox = 0;
  private oy = 0;
  private vw = 0;
  private vh = 0;
  private fog: FogTexture | null;
  private tileSize: number;

  constructor(scene: Phaser.Scene, depth: number, fog: FogTexture | null, tileSize: number) {
    const n = maxLights;
    const key = 'loppoDark' + n;
    const base = new Phaser.Display.BaseShader(key, fragment(n), undefined, {
      uDark: { type: '4f', value: { x: 0, y: 0, z: 0, w: 0 } },
      uFogInfo: { type: '4f', value: { x: 0, y: 0, z: 0, w: 0 } },
      uFogAlpha: { type: '1f', value: 0 },
      uLights: { type: '4fv', value: new Float32Array(n * 4) },
      uCount: { type: '1i', value: 0 },
    });
    this.fog = fog;
    this.tileSize = tileSize;
    this.shader = scene.add.shader(base, 0, 0, 64, 64).setOrigin(0).setDepth(depth);
    // Phaser draws a shader object and then resets every pipeline (each rebuilds its attributes on its next use,
    // a hundred GL calls a frame); this one is drawn without that: the batch so far is flushed (which also sets
    // the normal blend mode), the quad is drawn, and the next pipeline binds itself as it always does. Its
    // position is attribute 0, the one every pipeline points at its own buffer again when it binds – it must stay
    // enabled (a pipeline enables its attributes only when it is reset); a driver that put it elsewhere gets
    // Phaser's full reset
    const sh = this.shader as any;
    let inPos = -2;
    sh.renderWebGL = function (renderer: Phaser.Renderer.WebGL.WebGLRenderer, src: any, camera: Phaser.Cameras.Scene2D.Camera, parentMatrix: unknown) {
      if (!src.shader) return;
      camera.addToRenderList(src);
      renderer.pipelines.clear();
      const calc = (Phaser.GameObjects as any).GetCalcMatrix(src, camera, parentMatrix).calc;
      if (renderer.width !== src._rendererWidth || renderer.height !== src._rendererHeight) src.projOrtho(0, renderer.width, renderer.height, 0);
      src.load(calc.matrix);
      src.flush();
      if (inPos === -2) inPos = renderer.gl.getAttribLocation(src.program.webGLProgram, 'inPosition');
      if (inPos !== 0) renderer.pipelines.rebind();
    };
  }

  setVisible(v: boolean) {
    this.shader.setVisible(v);
    return this;
  }

  /** a new frame: the view (world coordinates, a little larger than the camera's) */
  begin(x: number, y: number, w: number, h: number) {
    this.ox = x;
    this.oy = y;
    if (w !== this.vw || h !== this.vh) {
      this.vw = w;
      this.vh = h;
      this.shader.setSize(w, h);
    }
    this.shader.setPosition(x, y);
    this.lights.length = 0;
  }

  /** a light at a world position with its radius and strength (0 … 1); `k` orders them when there are too many */
  light(x: number, y: number, r: number, s = 1, k = 5) {
    const lx = x - this.ox,
      ly = y - this.oy;
    if (lx < -r || ly < -r || lx > this.vw + r || ly > this.vh + r || r <= 0 || s <= 0) return;
    this.lights.push({ x: lx, y: ly, r, s, k });
  }

  /** writes the frame's uniforms: the darkness (colour and alpha) and the fog's strength */
  end(color: number, alpha: number, fogAlpha: number, now: number) {
    const u = (this.shader as any).uniforms;
    const L = this.lights;
    if (L.length > maxLights) L.sort((a, b) => a.k - b.k);
    const n = Math.min(maxLights, L.length);
    const arr: Float32Array = u.uLights.value;
    for (let i = 0; i < n; i++) {
      const l = L[i];
      arr[i * 4] = l.x;
      arr[i * 4 + 1] = l.y;
      arr[i * 4 + 2] = l.r;
      arr[i * 4 + 3] = l.s;
    }
    u.uCount.value = n;
    const d = u.uDark.value;
    d.x = ((color >> 16) & 255) / 255;
    d.y = ((color >> 8) & 255) / 255;
    d.z = (color & 255) / 255;
    d.w = alpha;
    const fog = this.fog;
    if (fog && fogAlpha > 0) {
      u.iChannel0.value = fog.texture(now);
      const fi = u.uFogInfo.value;
      const sx = 1 / (this.tileSize * fog.w),
        sy = 1 / (this.tileSize * fog.h);
      fi.x = this.ox * sx;
      fi.y = this.oy * sy;
      fi.z = sx;
      fi.w = sy;
      u.uFogAlpha.value = fogAlpha;
    } else u.uFogAlpha.value = 0;
  }

  destroy() {
    this.shader.destroy();
  }
}
