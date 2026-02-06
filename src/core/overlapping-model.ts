/**
 * Overlapping Model - Pattern extraction from sample images
 *
 * Based on mxgmn's OverlappingModel.cs
 * Extracts NxN patterns from input, creates symmetry variants,
 * and builds propagator based on overlap agreement.
 */

import { Wave } from './wave';
import { Propagator } from './propagator';
import {
  OverlappingOptions,
  PropagatorData,
  ObserveResult,
  WFCState,
  Random,
  Heuristic,
  DX,
  DY,
} from './types';

export class OverlappingModel {
  private readonly wave: Wave;
  private readonly propagator: Propagator;
  private readonly rng: Random;

  /** Extracted patterns (NxN color indices) */
  private readonly patterns: Uint8Array[];

  /** Unique colors found in input */
  private readonly colors: number[];

  /** Pattern size N */
  private readonly N: number;

  /** Output dimensions */
  private readonly width: number;
  private readonly height: number;
  private readonly periodic: boolean;
  private readonly ground: boolean;

  /** Cell selection heuristic */
  private readonly heuristic: Heuristic;

  /** Scanline cursor (for scanline heuristic) */
  private scanlineCursor: number = 0;

  /** Number of patterns */
  public readonly patternCount: number;

  constructor(
    inputPixels: Uint32Array,
    inputWidth: number,
    inputHeight: number,
    options: OverlappingOptions
  ) {
    this.N = options.patternSize;
    this.width = options.width;
    this.height = options.height;
    this.periodic = options.periodic;
    this.ground = options.ground ?? false;
    this.heuristic = options.heuristic ?? 'entropy';

    this.rng = new Random(options.seed);

    // Step 1: Extract unique colors and convert input to color indices
    const { sample, colors } = this.extractColors(
      inputPixels,
      inputWidth,
      inputHeight
    );
    this.colors = colors;

    // Step 2: Extract patterns with symmetry variants
    const { patterns, weights } = this.extractPatterns(
      sample,
      inputWidth,
      inputHeight,
      options.periodicInput,
      options.symmetry
    );
    this.patterns = patterns;
    this.patternCount = patterns.length;

    // Step 3: Build propagator based on pattern overlap agreement
    const propagatorData = this.buildPropagator(patterns);

    // Step 4: Initialize wave and propagator
    const weightsArray = new Float64Array(weights);
    this.wave = new Wave(this.width, this.height, weightsArray);
    this.propagator = new Propagator(
      this.width,
      this.height,
      this.patternCount,
      this.periodic,
      propagatorData
    );

    // Step 5: Apply ground constraint if enabled
    if (this.ground) {
      this.applyGroundConstraint();
    }
  }

  /**
   * Extract unique colors from input and create color index array
   */
  private extractColors(
    pixels: Uint32Array,
    width: number,
    height: number
  ): { sample: Uint8Array; colors: number[] } {
    const colors: number[] = [];
    const colorMap = new Map<number, number>();
    const sample = new Uint8Array(width * height);

    for (let i = 0; i < pixels.length; i++) {
      const color = pixels[i];
      let index = colorMap.get(color);
      if (index === undefined) {
        index = colors.length;
        colors.push(color);
        colorMap.set(color, index);
      }
      sample[i] = index;
    }

    return { sample, colors };
  }

  /**
   * Extract NxN patterns from input with symmetry variants
   */
  private extractPatterns(
    sample: Uint8Array,
    sampleWidth: number,
    sampleHeight: number,
    periodicInput: boolean,
    symmetry: number
  ): { patterns: Uint8Array[]; weights: number[] } {
    const N = this.N;
    const C = this.colors.length;

    const patterns: Uint8Array[] = [];
    const patternIndices = new Map<string, number>();
    const weights: number[] = [];

    // Pattern extraction helper
    const patternFromSample = (x: number, y: number): Uint8Array => {
      const result = new Uint8Array(N * N);
      for (let dy = 0; dy < N; dy++) {
        for (let dx = 0; dx < N; dx++) {
          const sx = (x + dx) % sampleWidth;
          const sy = (y + dy) % sampleHeight;
          result[dx + dy * N] = sample[sx + sy * sampleWidth];
        }
      }
      return result;
    };

    // Rotate pattern 90 degrees clockwise
    const rotate = (p: Uint8Array): Uint8Array => {
      const result = new Uint8Array(N * N);
      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
          result[x + y * N] = p[N - 1 - y + x * N];
        }
      }
      return result;
    };

    // Reflect pattern horizontally
    const reflect = (p: Uint8Array): Uint8Array => {
      const result = new Uint8Array(N * N);
      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
          result[x + y * N] = p[N - 1 - x + y * N];
        }
      }
      return result;
    };

    // Hash pattern for uniqueness check
    const hash = (p: Uint8Array): string => {
      let result = 0n;
      let power = 1n;
      const bigC = BigInt(C);
      for (let i = p.length - 1; i >= 0; i--) {
        result += BigInt(p[i]) * power;
        power *= bigC;
      }
      return result.toString();
    };

    // Extraction bounds
    const xmax = periodicInput ? sampleWidth : sampleWidth - N + 1;
    const ymax = periodicInput ? sampleHeight : sampleHeight - N + 1;

    for (let y = 0; y < ymax; y++) {
      for (let x = 0; x < xmax; x++) {
        // Generate all 8 symmetry variants
        const ps: Uint8Array[] = new Array(8);
        ps[0] = patternFromSample(x, y);
        ps[1] = reflect(ps[0]);
        ps[2] = rotate(ps[0]);
        ps[3] = reflect(ps[2]);
        ps[4] = rotate(ps[2]);
        ps[5] = reflect(ps[4]);
        ps[6] = rotate(ps[4]);
        ps[7] = reflect(ps[6]);

        // Add patterns up to symmetry count
        for (let k = 0; k < symmetry; k++) {
          const p = ps[k];
          const h = hash(p);

          const existingIndex = patternIndices.get(h);
          if (existingIndex !== undefined) {
            weights[existingIndex]++;
          } else {
            patternIndices.set(h, patterns.length);
            weights.push(1);
            patterns.push(p);
          }
        }
      }
    }

    return { patterns, weights };
  }

  /**
   * Build propagator - for each pattern and direction, find compatible patterns
   */
  private buildPropagator(patterns: Uint8Array[]): PropagatorData {
    const N = this.N;
    const T = patterns.length;

    // Check if two patterns agree when offset by (dx, dy)
    const agrees = (
      p1: Uint8Array,
      p2: Uint8Array,
      dx: number,
      dy: number
    ): boolean => {
      const xmin = dx < 0 ? 0 : dx;
      const xmax = dx < 0 ? dx + N : N;
      const ymin = dy < 0 ? 0 : dy;
      const ymax = dy < 0 ? dy + N : N;

      for (let y = ymin; y < ymax; y++) {
        for (let x = xmin; x < xmax; x++) {
          if (p1[x + N * y] !== p2[x - dx + N * (y - dy)]) {
            return false;
          }
        }
      }
      return true;
    };

    // Build propagator data structure
    // propagator[pattern][direction] = array of compatible patterns
    const data: number[][][] = [];

    for (let t = 0; t < T; t++) {
      data[t] = [];
      for (let d = 0; d < 4; d++) {
        const compatible: number[] = [];
        for (let t2 = 0; t2 < T; t2++) {
          if (agrees(patterns[t], patterns[t2], DX[d], DY[d])) {
            compatible.push(t2);
          }
        }
        data[t][d] = compatible;
      }
    }

    return { data };
  }

  /**
   * Apply ground constraint - last pattern only at bottom, not elsewhere
   */
  private applyGroundConstraint(): void {
    const T = this.patternCount;

    for (let x = 0; x < this.width; x++) {
      // Bottom row: ban all patterns except the last one
      for (let t = 0; t < T - 1; t++) {
        const cellIndex = x + (this.height - 1) * this.width;
        if (this.wave.get(cellIndex, t)) {
          this.wave.remove(cellIndex, t);
          this.propagator.addToPropagate(cellIndex, t);
        }
      }

      // All other rows: ban the last pattern
      for (let y = 0; y < this.height - 1; y++) {
        const cellIndex = x + y * this.width;
        if (this.wave.get(cellIndex, T - 1)) {
          this.wave.remove(cellIndex, T - 1);
          this.propagator.addToPropagate(cellIndex, T - 1);
        }
      }
    }

    // Propagate ground constraints
    this.propagator.propagate(this.wave);
  }

  /**
   * Perform one step of the algorithm (observe + propagate)
   */
  step(): ObserveResult {
    // Find cell to collapse based on heuristic
    let cellIndex: number;

    if (this.heuristic === 'mrv') {
      cellIndex = this.wave.getMRVCell(this.rng);
    } else if (this.heuristic === 'scanline') {
      const result = this.wave.getScanlineCell(this.scanlineCursor);
      cellIndex = result.cell;
      this.scanlineCursor = result.nextStart;
    } else {
      // Default: entropy heuristic
      cellIndex = this.wave.getMinEntropyCell(this.rng);
    }

    if (cellIndex === -1) {
      // All cells collapsed - success
      return 'success';
    }

    if (cellIndex === -2) {
      // Contradiction detected
      return 'failure';
    }

    // Collapse the cell
    const remainingPatterns = this.wave.getPossiblePatterns(cellIndex);
    const selectedPattern = this.wave.collapse(cellIndex, this.rng);

    if (selectedPattern === -1) {
      return 'failure';
    }

    // Add removed patterns to propagation stack
    for (const pattern of remainingPatterns) {
      if (pattern !== selectedPattern) {
        this.propagator.addToPropagate(cellIndex, pattern);
      }
    }

    // Propagate constraints
    const success = this.propagator.propagate(this.wave);

    if (!success) {
      return 'failure';
    }

    return 'continue';
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
   * Render the current wave state to a pixel buffer
   */
  render(buffer: Uint32Array): void {
    const N = this.N;

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const i = x + y * this.width;
        const cellIndex = i;

        if (this.wave.isCollapsed(cellIndex)) {
          // Collapsed cell - show the pattern's top-left pixel
          const pattern = this.wave.getObserved(cellIndex);
          if (pattern >= 0) {
            const colorIndex = this.patterns[pattern][0];
            buffer[i] = this.colors[colorIndex];
          }
        } else {
          // Superposition - blend all possible patterns
          let r = 0,
            g = 0,
            b = 0;
          let contributors = 0;

          // For each pattern that contributes to this pixel
          for (let dy = 0; dy < N; dy++) {
            for (let dx = 0; dx < N; dx++) {
              let sx = x - dx;
              let sy = y - dy;

              if (this.periodic) {
                sx = (sx + this.width) % this.width;
                sy = (sy + this.height) % this.height;
              } else if (sx < 0 || sy < 0 || sx + N > this.width || sy + N > this.height) {
                continue;
              }

              const s = sx + sy * this.width;
              const possiblePatterns = this.wave.getPossiblePatterns(s);

              for (const t of possiblePatterns) {
                contributors++;
                const colorIndex = this.patterns[t][dx + dy * N];
                const argb = this.colors[colorIndex];
                r += (argb >> 16) & 0xff;
                g += (argb >> 8) & 0xff;
                b += argb & 0xff;
              }
            }
          }

          if (contributors > 0) {
            r = Math.floor(r / contributors);
            g = Math.floor(g / contributors);
            b = Math.floor(b / contributors);
            buffer[i] = 0xff000000 | (r << 16) | (g << 8) | b;
          } else {
            buffer[i] = 0xff000000; // Black if no contributors
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

    // Reapply ground constraint
    if (this.ground) {
      this.applyGroundConstraint();
    }
  }

  /**
   * Get entropy data for visualization
   * Returns array of {entropy, remainingCount, isCollapsed} for each cell
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
   * Get the index of the last collapsed cell (for propagation highlight)
   */
  getLastCollapsedCell(): number {
    return this.wave.getMinEntropyCell(this.rng);
  }
}
