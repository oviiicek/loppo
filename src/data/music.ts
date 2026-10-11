// The music of Loppo: every area of the descent, the village by day and by night, the menu, the rifts and the
// guardians have their own tune. The tracks are not recordings: a small sequencer (systems/audio.ts) plays
// them from these descriptions – the key and the mode, the tempo, the chords, who plays the chords, the bass,
// the broken chords and the melody, how many drums and a sound of the place (drips in the caves, an anvil in
// the forges, wind on the ash plains). The melody grows from a short motif of its own (a seed per track),
// asked and answered like a folk tune, so every place keeps a theme the player learns to recognise.
import { areaIndex } from './biomes';

export type Voice = 'sine' | 'tri' | 'square' | 'saw' | 'bell' | 'glass' | 'pluck' | 'harp' | 'xylo' | 'organ' | 'choir' | 'flute' | 'brass' | 'strings';

/** the modes (semitones above the tonic) */
export const MODES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  minor: [0, 2, 3, 5, 7, 8, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10],
  /** harmonic minor: the dramatic major fifth chord */
  harmonic: [0, 2, 3, 5, 7, 8, 11],
  /** the desert: a minor second and a major third */
  hijaz: [0, 1, 4, 5, 7, 8, 10],
  /** Hungarian minor: exotic, murky */
  gypsy: [0, 2, 3, 6, 7, 8, 11],
  /** lydian with a raised fifth: a dream that is not quite right */
  dream: [0, 2, 4, 6, 8, 9, 11],
  penta: [0, 3, 5, 7, 10],
} as const;

export type Bass = 'none' | 'long' | 'beat' | 'pulse' | 'gallop' | 'waltz' | 'march';
export type Extra = 'anvil' | 'chains' | 'wind' | 'drip' | 'bell' | 'heart' | 'crickets' | 'bubbles';

export interface Track {
  /** the tonic (a MIDI note: 48 = C3, the chords sound from it upwards) and the mode */
  key: number;
  mode: keyof typeof MODES;
  bpm: number;
  /** beats in a bar (3: a waltz) */
  meter?: 3 | 4;
  /** the chords: the degree of the mode each one stands on (0 the tonic), one per `chordBars` bars */
  prog: number[];
  chordBars?: number;
  /** who holds the chords; `fifths`: bare fifths instead of full chords (old, cold, empty places) */
  pad: Voice | null;
  fifths?: boolean;
  /** a low hum under everything */
  drone?: boolean;
  bass: Bass;
  bassVoice?: Voice;
  /** broken chords: 1 in eighths, 2 in sixteenths */
  arp?: 0 | 1 | 2;
  arpVoice?: Voice;
  /** who sings the melody and how busy it is (0 … 1); `steps`: it only moves by steps (a chant) */
  lead: Voice | null;
  density: number;
  steps?: boolean;
  /** drums: 0 none, 1 a soft hand drum, 2 a march, 3 a battle */
  drums: 0 | 1 | 2 | 3;
  /** how long the echo rings (0 … 0.6) and how bright the chords are (a lowpass in Hz) */
  echo: number;
  cutoff: number;
  /** a sound of the place */
  extra?: Extra;
  /** a fight: drums from the first bar and no quiet passages */
  battle?: boolean;
  /** loudness against the other tracks (1) */
  vol?: number;
  /** another motif, when the first one does not sing */
  seed?: number;
}

export const TRACKS: Record<string, Track> = {
  // the main menu: the old theme of Loppo, a slow dorian tune over a hum
  menu: { key: 50, mode: 'dorian', bpm: 70, prog: [0, 3, 0, 6], chordBars: 2, pad: 'strings', drone: true, bass: 'long', lead: 'flute', density: 0.45, drums: 0, echo: 0.42, cutoff: 900, vol: 0.73},
  // Loppo by day: a village dance with a lute and a flute
  village: { key: 55, mode: 'major', bpm: 104, meter: 3, prog: [0, 3, 4, 0, 5, 3, 4, 4], pad: 'strings', bass: 'waltz', arpVoice: 'pluck', lead: 'flute', density: 0.6, drums: 1, echo: 0.18, cutoff: 1500, vol: 0.84 },
  // Loppo at night: a quiet harp and the crickets
  village_night: { key: 52, mode: 'major', bpm: 66, prog: [0, 5, 3, 4], pad: 'strings', bass: 'long', arp: 1, arpVoice: 'harp', lead: 'flute', density: 0.28, drums: 0, echo: 0.36, cutoff: 850, extra: 'crickets', vol: 0.77},

  // ------------------------------------------------------------- Chapter I · the frozen lock
  // the old crypt: the monks' chant over bare fifths, a bell in the distance
  area0: { key: 50, mode: 'dorian', bpm: 62, prog: [0, 6, 3, 0], chordBars: 2, pad: 'choir', fifths: true, drone: true, bass: 'long', lead: 'choir', density: 0.42, steps: true, drums: 0, echo: 0.45, cutoff: 700, extra: 'bell', vol: 0.75},
  // the caves: drops of water, a goblin drum far away
  area1: { key: 52, mode: 'penta', bpm: 84, prog: [0, 2, 0, 4], pad: 'tri', bass: 'beat', bassVoice: 'tri', lead: 'pluck', density: 0.36, drums: 1, echo: 0.5, cutoff: 800, extra: 'drip', vol: 0.64 },
  // the catacombs: walls of bones, a xylophone of them
  area2: { key: 53, mode: 'phrygian', bpm: 70, prog: [0, 1, 0, 6], pad: 'saw', drone: true, bass: 'long', lead: 'xylo', density: 0.4, drums: 0, echo: 0.5, cutoff: 520, vol: 0.88},
  // the flooded ruins: a harp under water, bubbles
  area3: { key: 54, mode: 'minor', bpm: 68, prog: [0, 5, 3, 4], pad: 'strings', bass: 'long', arp: 1, arpVoice: 'harp', lead: 'flute', density: 0.32, drums: 0, echo: 0.5, cutoff: 800, extra: 'bubbles', vol: 0.75},
  // the ice dungeon: icicles ringing, wind in the halls of Isolda
  area4: { key: 59, mode: 'minor', bpm: 62, prog: [0, 5, 2, 6], chordBars: 2, pad: 'strings', bass: 'long', arp: 2, arpVoice: 'glass', lead: 'bell', density: 0.25, drums: 0, echo: 0.55, cutoff: 1200, extra: 'wind', vol: 0.89 },

  // ------------------------------------------------------------- Chapter II · the hungry depths
  // the demonic underworld: a burning ostinato and brass of the cultists
  area5: { key: 48, mode: 'hijaz', bpm: 96, prog: [0, 1, 0, 6], pad: 'saw', drone: true, bass: 'pulse', bassVoice: 'saw', lead: 'brass', density: 0.4, drums: 1, echo: 0.3, cutoff: 600, vol: 1.13},
  // the mushroom forest: a strange little waltz in the spores
  area6: { key: 55, mode: 'lydian', bpm: 92, meter: 3, prog: [0, 1, 0, 1, 5, 4, 1, 0], pad: 'tri', bass: 'waltz', arpVoice: 'xylo', lead: 'xylo', density: 0.5, drums: 0, echo: 0.35, cutoff: 1000, extra: 'bubbles', vol: 0.68},
  // the spider nests: creeping pizzicato, a glint in the webs
  area7: { key: 50, mode: 'harmonic', bpm: 112, prog: [0, 4, 0, 4, 5, 1, 4, 4], pad: 'strings', bass: 'beat', bassVoice: 'pluck', arp: 2, arpVoice: 'pluck', lead: 'glass', density: 0.2, drums: 0, echo: 0.25, cutoff: 900, vol: 1.65 },
  // the tomb of the desert kings: an oud, a hum and a hand drum
  area8: { key: 52, mode: 'hijaz', bpm: 90, prog: [0, 1, 0, 6, 5, 1, 0, 0], pad: 'strings', drone: true, bass: 'beat', bassVoice: 'tri', lead: 'pluck', density: 0.6, drums: 1, echo: 0.25, cutoff: 1000, vol: 0.9},
  // the roots of the world: the slow heartbeat of the old tree
  area9: { key: 57, mode: 'dorian', bpm: 66, prog: [0, 3, 0, 3, 6, 3, 0, 0], pad: 'choir', bass: 'long', lead: 'flute', density: 0.35, drums: 0, echo: 0.4, cutoff: 900, extra: 'heart', vol: 0.68},

  // ------------------------------------------------------------- Chapter III · the gate of the underworld
  // the crystal caves: the crystals sing in the light
  area10: { key: 49, mode: 'lydian', bpm: 80, prog: [0, 1, 0, 4], pad: 'strings', bass: 'long', arp: 2, arpVoice: 'glass', lead: 'bell', density: 0.3, drums: 0, echo: 0.55, cutoff: 1600, vol: 1.01 },
  // the dwarven halls: a deep choir, a march and a far anvil
  area11: { key: 50, mode: 'minor', bpm: 86, prog: [0, 6, 5, 6], pad: 'choir', bass: 'march', bassVoice: 'saw', lead: 'brass', density: 0.45, drums: 2, echo: 0.3, cutoff: 900, extra: 'anvil', vol: 1.05},
  // the ossuary: the bones whisper names
  area12: { key: 46, mode: 'locrian', bpm: 58, prog: [0, 1, 0, 1], chordBars: 2, pad: 'choir', fifths: true, drone: true, bass: 'none', lead: 'xylo', density: 0.25, drums: 0, echo: 0.5, cutoff: 600, extra: 'wind', vol: 1.15},
  // the drowned cathedral: an organ and the bells under the water
  area13: { key: 53, mode: 'dorian', bpm: 60, prog: [0, 3, 6, 0], pad: 'organ', bass: 'long', lead: 'choir', density: 0.35, steps: true, drums: 0, echo: 0.55, cutoff: 900, extra: 'bell', vol: 0.62},
  // the gate of the underworld: chains and a heavy march
  area14: { key: 48, mode: 'harmonic', bpm: 78, prog: [0, 5, 3, 4], pad: 'strings', drone: true, bass: 'march', bassVoice: 'saw', lead: 'brass', density: 0.4, drums: 2, echo: 0.3, cutoff: 800, extra: 'chains', vol: 1.09},

  // ------------------------------------------------------------- Chapter IV · the shadow citadel
  // the ash plains: a lonely flute in the wind
  area15: { key: 55, mode: 'phrygian', bpm: 60, prog: [0, 1, 0, 6], chordBars: 2, pad: 'strings', fifths: true, bass: 'long', lead: 'flute', density: 0.3, drums: 0, echo: 0.5, cutoff: 700, extra: 'wind', vol: 0.87},
  // the forges of the Five: hammers on anvils
  area16: { key: 52, mode: 'minor', bpm: 100, prog: [0, 0, 5, 4], pad: 'saw', bass: 'pulse', bassVoice: 'saw', lead: 'brass', density: 0.35, drums: 1, echo: 0.25, cutoff: 700, extra: 'anvil', vol: 1.54},
  // the rotting swamps: something bubbles in the warm water
  area17: { key: 51, mode: 'gypsy', bpm: 76, prog: [0, 1, 0, 5], pad: 'tri', drone: true, bass: 'beat', bassVoice: 'tri', lead: 'sine', density: 0.35, drums: 0, echo: 0.45, cutoff: 600, extra: 'bubbles', vol: 0.58},
  // the obsidian depth: black glass and pulsing lava
  area18: { key: 54, mode: 'phrygian', bpm: 100, prog: [0, 1, 6, 1], pad: 'saw', bass: 'pulse', bassVoice: 'saw', arp: 2, arpVoice: 'glass', lead: 'square', density: 0.3, drums: 1, echo: 0.4, cutoff: 900, vol: 1.32 },
  // the shadow citadel: a gothic waltz on the organ and the harpsichord
  area19: { key: 48, mode: 'harmonic', bpm: 108, meter: 3, prog: [0, 3, 4, 0, 5, 1, 4, 4], pad: 'organ', bass: 'waltz', arpVoice: 'pluck', lead: 'pluck', density: 0.6, drums: 0, echo: 0.3, cutoff: 1000, vol: 0.74},

  // ------------------------------------------------------------- Chapter V · the bottom of the world
  // the edge of the void: wide empty chords, a bell over nothing
  area20: { key: 45, mode: 'minor', bpm: 54, prog: [0, 5, 0, 3], chordBars: 2, pad: 'strings', fifths: true, drone: true, bass: 'none', lead: 'bell', density: 0.2, drums: 0, echo: 0.6, cutoff: 700, extra: 'wind', vol: 1.3},
  // the floating islands: a harp drifting in the air
  area21: { key: 52, mode: 'lydian', bpm: 74, prog: [0, 1, 0, 1, 4, 5, 1, 1], pad: 'strings', bass: 'long', arp: 1, arpVoice: 'harp', lead: 'flute', density: 0.4, drums: 0, echo: 0.5, cutoff: 1500, vol: 0.74},
  // the mirror palace: a music box that plays a little wrong
  area22: { key: 58, mode: 'dream', bpm: 92, meter: 3, prog: [0, 1, 0, 6], pad: 'strings', bass: 'waltz', arpVoice: 'glass', lead: 'bell', density: 0.6, drums: 0, echo: 0.4, cutoff: 1200, vol: 1.14 },
  // the depth of dreams: a lullaby that turns into a nightmare
  area23: { key: 49, mode: 'lydian', bpm: 70, meter: 3, prog: [0, 4, 5, 1], pad: 'choir', bass: 'long', lead: 'glass', density: 0.45, drums: 0, echo: 0.55, cutoff: 900, extra: 'heart', vol: 0.91},
  // the bottom of the world: Nyx'thar breathes in its sleep
  area24: { key: 48, mode: 'locrian', bpm: 50, prog: [0, 1, 0, 4], chordBars: 2, pad: 'choir', fifths: true, drone: true, bass: 'long', bassVoice: 'saw', lead: 'bell', density: 0.15, drums: 0, echo: 0.55, cutoff: 500, extra: 'heart', vol: 1.08},

  // ------------------------------------------------------------- the guardians of the floors, one theme per chapter
  boss0: { key: 50, mode: 'harmonic', bpm: 132, prog: [0, 5, 3, 4], pad: 'strings', bass: 'gallop', bassVoice: 'saw', arp: 2, arpVoice: 'pluck', lead: 'brass', density: 0.55, drums: 3, echo: 0.2, cutoff: 1400, battle: true, vol: 1.32},
  boss1: { key: 52, mode: 'phrygian', bpm: 138, prog: [0, 1, 0, 6], pad: 'saw', bass: 'gallop', bassVoice: 'saw', arp: 2, arpVoice: 'square', lead: 'brass', density: 0.5, drums: 3, echo: 0.2, cutoff: 1200, battle: true, vol: 1.22},
  boss2: { key: 48, mode: 'minor', bpm: 128, prog: [0, 6, 5, 6], pad: 'choir', bass: 'pulse', bassVoice: 'saw', arp: 1, arpVoice: 'pluck', lead: 'brass', density: 0.5, drums: 3, echo: 0.22, cutoff: 1300, battle: true, vol: 1.04},
  boss3: { key: 54, mode: 'gypsy', bpm: 146, prog: [0, 1, 0, 4], pad: 'strings', bass: 'gallop', bassVoice: 'saw', arp: 2, arpVoice: 'pluck', lead: 'saw', density: 0.55, drums: 3, echo: 0.2, cutoff: 1300, battle: true, vol: 1.28},
  boss4: { key: 47, mode: 'locrian', bpm: 120, prog: [0, 1, 4, 1], pad: 'choir', drone: true, bass: 'pulse', bassVoice: 'saw', arp: 2, arpVoice: 'glass', lead: 'brass', density: 0.45, drums: 3, echo: 0.3, cutoff: 1100, battle: true, vol: 0.91},

  // ------------------------------------------------------------- the guardians of the story
  // abbot Benedikt: an organ toccata in the catacombs
  story_abbot: { key: 50, mode: 'harmonic', bpm: 116, prog: [0, 4, 0, 4, 5, 3, 4, 4], pad: 'organ', bass: 'pulse', bassVoice: 'organ', arp: 2, arpVoice: 'organ', lead: 'choir', density: 0.3, drums: 2, echo: 0.3, cutoff: 1500, battle: true, vol: 0.6 },
  // Isolda: the tragedy in the ice
  story_isolda: { key: 47, mode: 'minor', bpm: 124, prog: [0, 5, 2, 6], pad: 'strings', bass: 'gallop', bassVoice: 'tri', arp: 2, arpVoice: 'glass', lead: 'strings', density: 0.4, drums: 2, echo: 0.35, cutoff: 1400, extra: 'wind', battle: true, vol: 1.07},
  // the Mother of Spores: a pulsing, growing thing
  story_sporeMother: { key: 45, mode: 'phrygian', bpm: 112, prog: [0, 1, 0, 1, 6, 5, 1, 1], pad: 'choir', drone: true, bass: 'pulse', bassVoice: 'saw', lead: 'xylo', density: 0.45, drums: 3, echo: 0.3, cutoff: 1100, extra: 'heart', battle: true, vol: 1.0},
  // the jailer: chains and a slow heavy march
  story_jailer: { key: 55, mode: 'harmonic', bpm: 100, prog: [0, 0, 3, 4], pad: 'strings', bass: 'march', bassVoice: 'saw', lead: 'brass', density: 0.45, drums: 2, echo: 0.25, cutoff: 1000, extra: 'chains', battle: true, vol: 1.41},
  // Morgrim, the keeper of the gates: the whole underworld against the hero
  story_morgrim: { key: 48, mode: 'harmonic', bpm: 136, prog: [0, 5, 3, 4, 0, 5, 1, 4], pad: 'choir', bass: 'gallop', bassVoice: 'saw', arp: 2, arpVoice: 'pluck', lead: 'brass', density: 0.55, drums: 3, echo: 0.22, cutoff: 1400, extra: 'chains', battle: true, vol: 1.08},
  // Elara, the voice of the depths: a fast dark waltz
  story_elara: { key: 52, mode: 'harmonic', bpm: 156, meter: 3, prog: [0, 3, 4, 0, 5, 1, 4, 4], pad: 'organ', bass: 'waltz', arpVoice: 'pluck', lead: 'strings', density: 0.6, drums: 2, echo: 0.3, cutoff: 1300, battle: true, vol: 0.7 },
  // Nyx'thar: the bottom of the world wakes up
  story_nyxthar: { key: 49, mode: 'locrian', bpm: 126, prog: [0, 1, 0, 4, 0, 1, 5, 4], pad: 'choir', drone: true, bass: 'gallop', bassVoice: 'saw', arp: 2, arpVoice: 'glass', lead: 'brass', density: 0.5, drums: 3, echo: 0.35, cutoff: 1200, extra: 'heart', battle: true, vol: 0.87},
  // Aurex, the golden dragon: a proud fanfare
  dragon: { key: 53, mode: 'mixolydian', bpm: 132, prog: [0, 6, 3, 0], pad: 'strings', bass: 'gallop', bassVoice: 'saw', arp: 2, arpVoice: 'pluck', lead: 'brass', density: 0.55, drums: 3, echo: 0.22, cutoff: 1600, battle: true, vol: 1.31},

  // ------------------------------------------------------------- the rifts
  // the rift: a pulse from a world beside ours
  rift: { key: 51, mode: 'dream', bpm: 112, prog: [0, 1, 0, 6], pad: 'saw', bass: 'pulse', bassVoice: 'saw', arp: 2, arpVoice: 'glass', lead: 'square', density: 0.35, drums: 1, echo: 0.4, cutoff: 900, vol: 1.25 },
  // the rift of dreams: a music box out of tune
  dream: { key: 53, mode: 'lydian', bpm: 80, meter: 3, prog: [0, 4, 1, 4], pad: 'choir', bass: 'waltz', arpVoice: 'glass', lead: 'bell', density: 0.5, drums: 0, echo: 0.55, cutoff: 1000, vol: 0.95},
  // the arena of the last chance: one more fight for life
  last: { key: 50, mode: 'phrygian', bpm: 140, prog: [0, 1, 6, 1], pad: 'strings', bass: 'gallop', bassVoice: 'saw', arp: 2, arpVoice: 'pluck', lead: 'brass', density: 0.5, drums: 3, echo: 0.2, cutoff: 1300, battle: true, vol: 1.33},
};

/** the music of an area of the descent */
export const areaTrack = (floor: number) => 'area' + areaIndex(floor);

/** the battle music of a guardian: a story guardian has its own, the others one for each chapter */
export function bossTrack(floor: number, storyId?: string | null, secret?: boolean) {
  if (secret) return 'dragon';
  if (storyId && TRACKS['story_' + storyId]) return 'story_' + storyId;
  return 'boss' + Math.min(4, Math.floor(areaIndex(floor) / 5));
}
