import type { GameScene } from '../scenes/GameScene';
import { sfx } from '../systems/audio';
import { bus } from '../systems/events';
import { saveGame, SaveData } from '../systems/state';
import { Quest, QUEST_COUNTER, makeTreasureMap, MAX_TREASURE_MAPS } from '../data/quests';
import { villageOf } from '../data/village';
import { isBossFloor } from '../data/enemies';

/** the value of the counter a counting quest follows */
export function questCounter(s: SaveData, key: string): number {
  if (key === 'kills') return s.kills;
  if (key === 'lore') return s.lore?.length ?? 0;
  if (key === 'maxFloor') return s.maxFloor;
  return ((s.stats ?? {}) as Record<string, number | undefined>)[key] ?? 0;
}

/** the hero's quests on a floor: what they place, what they count, when they are done */
export class QuestLog {
  sc: GameScene;
  /** a guardian fight is on (for the quest without potions) and whether a potion was drunk in it */
  bossFight = false;
  potionUsed = false;
  private warned = false;
  private tickT = 0;

  constructor(sc: GameScene) {
    this.sc = sc;
  }

  /** the board's quests and the king's task */
  get list(): Quest[] {
    const v = villageOf(this.sc.save);
    const board = (v.quests ??= []);
    const royal = v.royal?.quest;
    return royal ? [...board, royal] : board;
  }

  /** quests that send the hero to this floor leave something here (a calm floor only takes a treasure) */
  placeFloorQuests(calm = false) {
    const sc = this.sc;
    const f = sc.floor;
    for (const q of this.list) {
      if (q.done || q.floor > f || (calm && q.type !== 'treasure')) continue;
      if (q.type === 'lost' && !isBossFloor(f)) sc.enc.placeLost(q);
      else if (q.type === 'tomb' && !isBossFloor(f)) sc.placeCursedChest(q.id);
      else if (q.type === 'rift' && !isBossFloor(f)) sc.enc.placePortal('rift', q.id);
      else if (q.type === 'treasure' && !isBossFloor(f)) sc.enc.placeTreasure(q);
    }
  }

  /** counting quests follow their counters */
  update(dt: number) {
    this.tickT -= dt;
    if (this.tickT > 0) return;
    this.tickT = 1;
    const s = this.sc.save;
    for (const q of this.list) {
      if (q.done) continue;
      const key = QUEST_COUNTER[q.type];
      if (!key) continue;
      q.have = Math.min(q.goal, Math.max(0, questCounter(s, key) - (q.base ?? 0)));
      if (q.have >= q.goal) this.complete(q);
    }
  }

  complete(q: Quest) {
    if (q.done) return;
    q.done = true;
    q.have = q.goal;
    const sc = this.sc;
    sfx('levelup');
    sc.ui.toast(`📜 Úkol splněn: ${q.title}! Odměnu si vyzvedni ${(q as { royal?: boolean }).royal ? 'u krále' : 'na nástěnce'} v Loppu.`, '#9dff7a');
    saveGame(sc.save);
    bus.emit('stats');
  }

  /** treasure maps the hero carries (not dug up yet) */
  get maps(): Quest[] {
    return this.list.filter((q) => q.type === 'treasure');
  }

  /** maybe a treasure map falls out (of a chest, a champion, a thief): a new side quest with a cross on a
   *  floor below; true when one was found */
  maybeMap(chance: number): boolean {
    const sc = this.sc;
    if (sc.rift || sc.inVillage || Math.random() >= chance || this.maps.length >= MAX_TREASURE_MAPS) return false;
    const q = makeTreasureMap(sc.floor);
    (villageOf(sc.save).quests ??= []).push(q);
    sfx('chest');
    sc.ui.toast(`🗺 Mapa pokladu! Křížek je zakreslen v ${q.floor}. patře – najdeš ji v deníku úkolů.`, '#ffd23a');
    saveGame(sc.save);
    bus.emit('quests');
    return true;
  }

  /** a treasure was dug up: the map is used up */
  removeMap(id: number) {
    const v = villageOf(this.sc.save);
    v.quests = (v.quests ?? []).filter((q) => q.id !== id);
    saveGame(this.sc.save);
    bus.emit('quests');
  }

  completeById(id: number) {
    const q = this.list.find((x) => x.id === id);
    if (q) this.complete(q);
  }

  onBossAggro() {
    this.bossFight = true;
    this.potionUsed = false;
    this.warned = false;
  }

  onPotion() {
    if (!this.bossFight || this.potionUsed) return;
    this.potionUsed = true;
    if (!this.warned && this.list.some((q) => q.type === 'nopotion' && !q.done && this.sc.floor >= q.floor)) {
      this.warned = true;
      this.sc.ui.toast('Zkouška odvahy: tentokrát s lektvarem – zkus to u dalšího strážce', '#ffb070');
    }
  }

  onBossKilled() {
    const f = this.sc.floor;
    for (const q of this.list) {
      if (q.done || f < q.floor) continue;
      if (q.type === 'artifact') {
        this.sc.ui.toast('Artefakt Pětice je tvůj!', '#ffd76a');
        this.complete(q);
      } else if (q.type === 'nopotion' && !this.potionUsed) this.complete(q);
    }
    this.bossFight = false;
  }
}
