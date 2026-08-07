/** Photo/document reference. `p` is the IndexedDB blob key; `f` is the path
 *  in the data repo once uploaded. A ref with no `f` has not synced yet. */
export interface PhotoRef { p: string; f?: string }

export interface Booking {
  id: string; type: 'stay'|'car'|'fly'|'act'|'eat'; name: string;
  date: string;            // ISO yyyy-mm-dd, start
  end?: string;            // ISO yyyy-mm-dd, added in Plan 3; older builds ignore it
  addr?: string; checkin?: string; checkout?: string;
  conf?: string; cost?: number; note?: string;
  files?: PhotoRef[];      // added in Plan 3
}

export interface Outfit { img?: PhotoRef; img2?: PhotoRef; pieces?: string; note?: string }
export interface TripDoc { id: string; label: string; img?: PhotoRef }
export interface Spend {
  id: string; date: string; cur: string;
  amt: number;
  card?: string; what?: string;
}

export interface Card {
  id: string;
  type: string;
  nick: string;
  bank?: string; network?: string; holder?: string; last4?: string;
  markup?: number; fee?: number; cur?: string;
  limit?: number;
}

export interface TripState {
  done: Record<string, boolean>;
  items: Record<string, { t?: string }>;
  bookings: Booking[];
  photos: Record<string, PhotoRef | string>;
  outfits: Record<string, Outfit>;
  docs: TripDoc[];
  todos: Record<string, boolean>;
  packing: Record<string, boolean>;
  spend: Spend[];
  notes: Record<string, string>;
  cards: Card[];
  _t?: Record<string, number>;
  _updated?: string;
  _by?: string;
  _note?: string;
  v?: number;
}

export const SYNCED = ['done','items','bookings','photos','outfits',
  'docs','todos','packing','spend','notes','cards'] as const;

export const BY_ID = ['bookings','docs','spend','cards'] as const;

export function emptyState(): TripState {
  return { done:{}, items:{}, bookings:[], photos:{}, outfits:{}, docs:[],
    todos:{}, packing:{}, spend:[], notes:{}, cards:[], v:1 };
}
