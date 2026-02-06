/**
 * Simple Tiled Model - Tile-based WFC using predefined adjacency rules
 *
 * Ported from mxgmn's SimpleTiledModel.cs
 * Uses pre-made tiles with explicit neighbor constraints loaded from XML.
 * Shares Wave and Propagator with the Overlapping Model.
 */

import { Wave } from './wave';
import { Propagator } from './propagator';
import {
  SimpleTiledOptions,
  PropagatorData,
  ObserveResult,
  WFCState,
  Random,
  Heuristic,
} from './types';

export class SimpleTiledModel {
  private readonly wave: Wave;
  private readonly propagator: Propagator;
  private readonly rng: Random;

  /** Pixel data for each tile variant (ABGR packed Int32Array) */
  private readonly tiles: Int32Array[];

  /** Name of each tile variant (e.g. "bridge 0", "bridge 1") */
  private readonly tilenames: string[];

  /** Pattern weights */
  private readonly weights: Float64Array;

  /** Tile pixel dimensions (tiles are square) */
  public readonly tilesize: number;

  /** Output grid dimensions (in tiles) */
  private readonly width: number;
  private readonly height: number;
  private readonly periodic: boolean;

  /** Render uncollapsed cells as black when true */
  private readonly blackBackground: boolean;

  /** Cell selection heuristic */
  private readonly heuristic: Heuristic;

  /** Scanline cursor */
  private scanlineCursor: number = 0;

  /** Number of tile variants */
  public readonly patternCount: number;

  constructor(
    tiles: Int32Array[],
    tilenames: string[],
    tilesize: number,
    weights: Float64Array,
    propagatorData: PropagatorData,
    options: SimpleTiledOptions,
  ) {
    this.tiles = tiles;
    this.tilenames = tilenames;
    this.tilesize = tilesize;
    this.weights = weights;
    this.width = options.width;
    this.height = options.height;
    this.periodic = options.periodic;
    this.blackBackground = options.blackBackground ?? false;
    this.heuristic = options.heuristic ?? 'entropy';
    this.patternCount = tiles.length;

    this.rng = new Random(options.seed);

    // Initialize wave and propagator (reuses same classes as OverlappingModel)
    this.wave = new Wave(this.width, this.height, this.weights);
    this.propagator = new Propagator(
      this.width,
      this.height,
      this.patternCount,
      this.periodic,
      propagatorData,
    );
  }

  /**
   * Perform one step of the algorithm (observe + propagate)
   */
  step(): ObserveResult {
    let cellIndex: number;

    if (this.heuristic === 'mrv') {
      cellIndex = this.wave.getMRVCell(this.rng);
    } else if (this.heuristic === 'scanline') {
      const result = this.wave.getScanlineCell(this.scanlineCursor);
      cellIndex = result.cell;
      this.scanlineCursor = result.nextStart;
    } else {
      cellIndex = this.wave.getMinEntropyCell(this.rng);
    }

    if (cellIndex === -1) return 'success';
    if (cellIndex === -2) return 'failure';

    // Collapse the cell
    const remainingPatterns = this.wave.getPossiblePatterns(cellIndex);
    const selectedPattern = this.wave.collapse(cellIndex, this.rng);

    if (selectedPattern === -1) return 'failure';

    // Add removed patterns to propagation stack
    for (const pattern of remainingPatterns) {
      if (pattern !== selectedPattern) {
        this.propagator.addToPropagate(cellIndex, pattern);
      }
    }

    // Propagate constraints
    const success = this.propagator.propagate(this.wave);
    return success ? 'continue' : 'failure';
  }

  /**
   * Run the algorithm to completion
   */
  run(maxSteps: number = -1): boolean {
    let steps = 0;
    while (maxSteps < 0 || steps < maxSteps) {
      const result = this.step();
      if (result === 'success') return true;
      if (result === 'failure') return false;
      steps++;
    }
    return true;
  }

  /**
   * Render the current wave state to a pixel buffer.
   * Buffer must be (width * tilesize) * (height * tilesize) pixels.
   */
  render(buffer: Uint32Array): void {
    const ts = this.tilesize;
    const pixelWidth = this.width * ts;

    // Check if fully collapsed
    const fullyCollapsed = this.wave.isFullyCollapsed();

    if (fullyCollapsed) {
      // Fast path: just stamp collapsed tiles
      for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
          const observed = this.wave.getObserved(x + y * this.width);
          if (observed < 0) continue;
          const tile = this.tiles[observed];
          for (let dy = 0; dy < ts; dy++) {
            for (let dx = 0; dx < ts; dx++) {
              buffer[x * ts + dx + (y * ts + dy) * pixelWidth] = tile[dx + dy * ts];
            }
          }
        }
      }
      return;
    }

    // Superposition rendering: blend possible tiles
    for (let i = 0; i < this.wave.size; i++) {
      const x = i % this.width;
      const y = Math.floor(i / this.width);

      if (this.wave.isCollapsed(i)) {
        // Collapsed: stamp tile directly
        const observed = this.wave.getObserved(i);
        if (observed < 0) continue;
        const tile = this.tiles[observed];
        for (let dy = 0; dy < ts; dy++) {
          for (let dx = 0; dx < ts; dx++) {
            buffer[x * ts + dx + (y * ts + dy) * pixelWidth] = tile[dx + dy * ts];
          }
        }
      } else if (this.blackBackground && this.wave.getRemainingCount(i) === this.patternCount) {
        // Fully uncollapsed + blackBackground: render black
        for (let dy = 0; dy < ts; dy++) {
          for (let dx = 0; dx < ts; dx++) {
            buffer[x * ts + dx + (y * ts + dy) * pixelWidth] = 0xff000000;
          }
        }
      } else {
        // Superposition: weighted blend of possible tiles
        const possiblePatterns = this.wave.getPossiblePatterns(i);
        let sumWeight = 0;
        for (const t of possiblePatterns) sumWeight += this.weights[t];
        const normalization = 1.0 / sumWeight;

        for (let dy = 0; dy < ts; dy++) {
          for (let dx = 0; dx < ts; dx++) {
            let r = 0, g = 0, b = 0;
            for (const t of possiblePatterns) {
              const argb = this.tiles[t][dx + dy * ts];
              // Pixel format from canvas is ABGR in Int32Array
              r += (argb & 0xff) * this.weights[t] * normalization;
              g += ((argb >> 8) & 0xff) * this.weights[t] * normalization;
              b += ((argb >> 16) & 0xff) * this.weights[t] * normalization;
            }
            // Write back as ABGR
            buffer[x * ts + dx + (y * ts + dy) * pixelWidth] =
              0xff000000 | (Math.floor(b) << 16) | (Math.floor(g) << 8) | Math.floor(r);
          }
        }
      }
    }
  }

  /**
   * Get current algorithm state
   */
  getState(): WFCState {
    let collapsedCount = 0;
    let hasContradiction = false;

    for (let i = 0; i < this.wave.size; i++) {
      const count = this.wave.getRemainingCount(i);
      if (count === 1) collapsedCount++;
      if (count === 0) hasContradiction = true;
    }

    return {
      totalCells: this.wave.size,
      collapsedCount,
      patternCount: this.patternCount,
      isComplete: collapsedCount === this.wave.size,
      hasContradiction,
    };
  }

  /**
   * Reset to initial state
   */
  clear(): void {
    this.wave.clear();
    this.propagator.reset();
    this.scanlineCursor = 0;
  }

  /**
   * Get entropy data for visualization
   */
  getEntropyData(): { entropy: number; remaining: number; collapsed: boolean }[] {
    const data: { entropy: number; remaining: number; collapsed: boolean }[] = [];
    for (let i = 0; i < this.wave.size; i++) {
      const remaining = this.wave.getRemainingCount(i);
      data.push({
        entropy: this.wave.getEntropy(i),
        remaining,
        collapsed: remaining === 1,
      });
    }
    return data;
  }

  /**
   * Get tile data for visualization (tile viewer modal)
   */
  getTileData(): {
    tiles: Int32Array[];
    tilenames: string[];
    weights: Float64Array;
    tilesize: number;
  } {
    return {
      tiles: this.tiles,
      tilenames: this.tilenames,
      weights: this.weights,
      tilesize: this.tilesize,
    };
  }
}
