/**
 * Core type definitions for the WFC algorithm
 */

/** Direction indices: 0=Left, 1=Down, 2=Right, 3=Up */
export type Direction = 0 | 1 | 2 | 3;

/** Direction deltas: dx, dy for each direction */
export const DX: readonly number[] = [-1, 0, 1, 0];
export const DY: readonly number[] = [0, 1, 0, -1];

/** Opposite direction lookup */
export const OPPOSITE: readonly Direction[] = [2, 3, 0, 1];

/** Cell selection heuristic */
export type Heuristic = 'entropy' | 'mrv' | 'scanline';

/** Result of an observation step */
export type ObserveResult = 'continue' | 'success' | 'failure';

/** Entropy memoization structure for O(1) entropy updates */
export interface EntropyMemo {
  /** Sum of p*log(p) for patterns still possible at each cell */
  plogpSum: Float64Array;
  /** Sum of weights for patterns still possible at each cell */
  sum: Float64Array;
  /** log(sum) cached for each cell */
  logSum: Float64Array;
  /** Count of patterns still possible at each cell */
  patternCount: Uint32Array;
  /** Cached entropy value for each cell */
  entropy: Float64Array;
}

/** Propagator adjacency data structure */
export interface PropagatorData {
  /**
   * Compatible patterns for each direction
   * propagator[pattern][direction] = array of compatible pattern indices
   */
  data: number[][][];
}

/** Base WFC options */
export interface WFCOptions {
  width: number;
  height: number;
  periodic: boolean;
  heuristic: Heuristic;
  seed: number;
}

/** Overlapping model specific options */
export interface OverlappingOptions extends WFCOptions {
  /** Pattern size N (typically 2 or 3) */
  patternSize: number;
  /** Number of symmetry variants (1-8) */
  symmetry: number;
  /** Whether input image wraps */
  periodicInput: boolean;
  /** Enforce ground constraint (bottom row) */
  ground: boolean;
}

/** Simple tiled model specific options */
export interface SimpleTiledOptions extends WFCOptions {
  /** Optional subset of tiles to use */
  subset?: string;
  /** Black background for output */
  blackBackground: boolean;
}

/** Common model interface satisfied by both OverlappingModel and SimpleTiledModel */
export interface WFCModel {
  step(): ObserveResult;
  run(maxSteps?: number): boolean;
  render(buffer: Uint32Array): void;
  getState(): WFCState;
  getEntropyData(): { entropy: number; remaining: number; collapsed: boolean }[];
  clear(): void;
  readonly patternCount: number;
}

/** Current state of the WFC algorithm */
export interface WFCState {
  totalCells: number;
  collapsedCount: number;
  patternCount: number;
  isComplete: boolean;
  hasContradiction: boolean;
}

/** Simple PRNG using mulberry32 algorithm */
export class Random {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Returns a random float in [0, 1) */
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Returns a random integer in [0, max) */
  nextInt(max: number): number {
    return Math.floor(this.next() * max);
  }
}
