// Damage over time (burning, poison, bleeding) on monsters and heroes.
import type { Status } from './entities';

/** sets a damage over time on a monster or a hero: a stronger one takes over, a weaker one renews the old one
 *  while it fades (a burn does not stay as strong as the strongest blow for as long as more fire keeps landing) */
export function addDot(st: Status, kind: 'burn' | 'poison' | 'bleed', dps: number, t: number) {
  if (kind === 'burn') {
    st.burnDps = st.burnT > 0 ? Math.max(dps, st.burnDps * 0.6) : dps;
    st.burnT = Math.max(st.burnT, t);
  } else if (kind === 'poison') {
    st.poisonDps = st.poisonT > 0 ? Math.max(dps, st.poisonDps * 0.6) : dps;
    st.poisonT = Math.max(st.poisonT, t);
  } else {
    st.bleedDps = st.bleedT > 0 ? Math.max(dps, st.bleedDps * 0.6) : dps;
    st.bleedT = Math.max(st.bleedT, t);
  }
}
