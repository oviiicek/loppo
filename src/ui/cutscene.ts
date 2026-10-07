// Cutscene player: an illustrated scene with a dialogue box (portrait, name, typed text), chapter
// cards, screen shake and flashes. In overlay mode it is a letterboxed dialogue over the (paused) game.
import { Shot, SPEAKERS, SceneId } from '../data/story';
import { sceneCanvas, runParticles, portraitURL, ART_W, ART_H } from '../gfx/story';
import { sfx } from '../systems/audio';

export interface CutsceneOpts {
  /** in-engine dialogue over the paused game (no illustration) */
  overlay?: boolean;
  /** illustration for shots that do not name one */
  scene?: SceneId;
}

const CHARS_PER_SEC = 34;

export function playCutscene(root: HTMLElement, shots: Shot[], opts: CutsceneOpts = {}): Promise<void> {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'cutscene' + (opts.overlay ? ' overlay' : '');
    el.innerHTML = `
      <canvas class="cs-bg" width="${ART_W}" height="${ART_H}"></canvas>
      <div class="cs-stage">
        <canvas class="cs-art" width="${ART_W}" height="${ART_H}"></canvas>
        <canvas class="cs-art" width="${ART_W}" height="${ART_H}"></canvas>
        <canvas class="cs-fx" width="${ART_W}" height="${ART_H}"></canvas>
      </div>
      <div class="cs-flash"></div>
      <div class="cs-bar top"></div><div class="cs-bar bottom"></div>
      <div class="cs-title"><small></small><b></b></div>
      <div class="cs-box"><div class="cs-portrait"><img alt=""></div><div class="cs-body"><div class="cs-name"></div><div class="cs-text"></div></div><div class="cs-next">▼</div></div>
      <button class="cs-skip">Přeskočit ▸▸</button>`;
    root.appendChild(el);
    const arts = Array.from(el.querySelectorAll<HTMLCanvasElement>('.cs-art'));
    const fx = el.querySelector('.cs-fx') as HTMLCanvasElement;
    const bg = el.querySelector('.cs-bg') as HTMLCanvasElement;
    const flash = el.querySelector('.cs-flash') as HTMLElement;
    const title = el.querySelector('.cs-title') as HTMLElement;
    const box = el.querySelector('.cs-box') as HTMLElement;
    const img = el.querySelector('.cs-portrait img') as HTMLImageElement;
    const nameEl = el.querySelector('.cs-name') as HTMLElement;
    const textEl = el.querySelector('.cs-text') as HTMLElement;

    let i = -1;
    let front = 0;
    let scene: SceneId | null = null;
    let stopParticles = () => {};
    let full = '';
    let typed = 0;
    let typeTimer = 0;
    let titleTimer = 0;
    let finished = false;
    let typingStart = 0;

    const setScene = (id: SceneId) => {
      if (id === scene) return;
      const back = 1 - front;
      const ctx = arts[back].getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, ART_W, ART_H);
      ctx.drawImage(sceneCanvas(id), 0, 0);
      // blurred copy fills the screen around the picture
      const bctx = bg.getContext('2d')!;
      bctx.clearRect(0, 0, ART_W, ART_H);
      bctx.drawImage(sceneCanvas(id), 0, 0);
      arts[back].classList.remove('kb');
      void arts[back].offsetWidth; // restart the slow zoom
      arts[back].classList.add('kb', 'front');
      arts[front].classList.remove('front');
      front = back;
      scene = id;
      stopParticles();
      stopParticles = runParticles(fx, id);
    };

    const typeStep = () => {
      const n = Math.min(full.length, Math.floor(((performance.now() - typingStart) / 1000) * CHARS_PER_SEC));
      if (n !== typed) {
        typed = n;
        textEl.textContent = full.slice(0, n);
      }
      if (typed >= full.length) {
        clearInterval(typeTimer);
        typeTimer = 0;
        box.classList.add('done');
      }
    };

    const completeLine = () => {
      clearInterval(typeTimer);
      typeTimer = 0;
      typed = full.length;
      textEl.textContent = full;
      box.classList.add('done');
    };

    const show = (s: Shot) => {
      if (!opts.overlay) setScene(s.scene ?? scene ?? opts.scene ?? 'black');
      if (s.fx === 'shake') {
        el.classList.remove('shake');
        void el.offsetWidth;
        el.classList.add('shake');
      }
      if (s.fx === 'flash') {
        flash.classList.remove('on');
        void flash.offsetWidth;
        flash.classList.add('on');
      }
      if (s.title) {
        box.classList.add('hidden');
        (title.querySelector('small') as HTMLElement).textContent = s.title[0];
        (title.querySelector('b') as HTMLElement).textContent = s.title[1];
        title.classList.add('on');
        titleTimer = window.setTimeout(next, 3200);
        return;
      }
      title.classList.remove('on');
      box.classList.remove('hidden', 'done');
      const sp = SPEAKERS[s.speaker ?? 'narrator'];
      box.classList.toggle('narrator', !s.speaker || s.speaker === 'narrator');
      nameEl.textContent = sp.name;
      nameEl.style.color = sp.color;
      const url = s.speaker ? portraitURL(s.speaker) : '';
      if (url) img.src = url;
      box.classList.toggle('noportrait', !url);
      full = s.text;
      typed = 0;
      textEl.textContent = '';
      typingStart = performance.now();
      clearInterval(typeTimer);
      typeTimer = window.setInterval(typeStep, 30);
      sfx('ui');
    };

    function next() {
      clearTimeout(titleTimer);
      i++;
      if (i >= shots.length) return finish();
      show(shots[i]);
    }

    const advance = () => {
      if (finished) return;
      if (typeTimer) completeLine();
      else next();
    };

    // only a press that started on the cutscene counts (not a finger lifted from the joystick)
    let pressed = false;
    const onDown = () => {
      pressed = true;
    };
    const onTap = (e: Event) => {
      if (!pressed || (e.target as HTMLElement).closest('.cs-skip')) return;
      pressed = false;
      e.preventDefault();
      advance();
    };
    const onKey = (e: KeyboardEvent) => {
      const k = e.key;
      if (k === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        finish();
      } else if (k === 'Enter' || k === ' ' || k.toLowerCase() === 'e') {
        e.preventDefault();
        e.stopPropagation();
        advance();
      }
    };

    function finish() {
      if (finished) return;
      finished = true;
      clearInterval(typeTimer);
      clearTimeout(titleTimer);
      stopParticles();
      document.removeEventListener('keydown', onKey, true);
      el.classList.add('out');
      setTimeout(() => el.remove(), 320);
      resolve();
    }

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointerup', onTap);
    el.querySelector('.cs-skip')!.addEventListener('pointerup', (e) => {
      e.stopPropagation();
      if (pressed) finish();
    });
    document.addEventListener('keydown', onKey, true);
    next();
  });
}
