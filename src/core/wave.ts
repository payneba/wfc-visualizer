/**
 * Wave data structure with entropy memoization
 *
 * Based on fast-wfc optimization patterns from wave.cpp
 * Key optimization: Entropy is updated incrementally when patterns are removed,
 * rather than recalculated from scratch. This reduces entropy calculation from
 * O(patterns) to O(1) per cell update.
 */

import { EntropyMemo, Random } from './types';

export class Wave {
  /** Flattened wave data: wave[cell * patternCount + pattern] = 0 or 1 */
  private readonly data: Uint8Array;

  /** Entropy memoization for O(1) updates */
  private readonly memo: EntropyMemo;

  /** Precomputed p * log(p) for each pattern weight */
  private readonly plogp: Float64Array;

  /** Pattern weights (frequencies) */
  private readonly weights: Float64Array;

  /** Minimum absolute half plogp - used for noise range */
  private readonly minAbsHalfPlogp: number;

  /** Starting entropy for all-possible cell */
  private readonly startingEntropy: number;

  /** Grid dimensions */
  public readonly width: number;
  public readonly height: number;
  public readonly size: number;
  public readonly patternCount: number;

  constructor(width: number, height: number, weights: Float64Array) {
    this.width = width;
    this.height = height;
    this.size = width * height;
    this.patternCount = weights.length;
    this.weights = weights;

    // Allocate wave data - all patterns possible initially
    this.data = new Uint8Array(this.size * this.patternCount);
    this.data.fill(1);

    // Compute plogp for each pattern
    const sumOfWeights = weights.reduce((a, b) => a + b, 0);
    this.plogp = new Float64Array(this.patternCount);
    let minPlogp = Infinity;
    let sumOfPlogp = 0;

    for (let i = 0; i < this.patternCount; i++) {
      const p = weights[i] / sumOfWeights;
      const plogpVal = p > 0 ? p * Math.log(p) : 0;
      this.plogp[i] = plogpVal;
      sumOfPlogp += plogpVal;
      if (Math.abs(plogpVal) > 0 && Math.abs(plogpVal) < minPlogp) {
        minPlogp = Math.abs(plogpVal);
      }
    }

    this.minAbsHalfPlogp = minPlogp / 2;
    this.startingEntropy = Math.log(sumOfWeights) - sumOfPlogp;

    // Initialize entropy memoization
    this.memo = {
      plogpSum: new Float64Array(this.size),
      sum: new Float64Array(this.size),
      logSum: new Float64Array(this.size),
      patternCount: new Uint32Array(this.size),
      entropy: new Float64Array(this.size),
    };

    // Fill initial memoized values
    this.memo.plogpSum.fill(sumOfPlogp);
    this.memo.sum.fill(sumOfWeights);
    this.memo.logSum.fill(Math.log(sumOfWeights));
    this.memo.patternCount.fill(this.patternCount);
    this.memo.entropy.fill(this.startingEntropy);
  }

  /** Check if a pattern is still possible at a cell */
  get(cellIndex: number, pattern: number): boolean {
    return this.data[cellIndex * this.patternCount + pattern] === 1;
  }

  /** Get all possible patterns for a cell */
  getPossiblePatterns(cellIndex: number): number[] {
    const result: number[] = [];
    const offset = cellIndex * this.patternCount;
    for (let p = 0; p < this.patternCount; p++) {
      if (this.data[offset + p] === 1) {
        result.push(p);
      }
    }
    return result;
  }

  /** Get count of remaining patterns at a cell */
  getRemainingCount(cellIndex: number): number {
    return this.memo.patternCount[cellIndex];
  }

  /** Get cached entropy for a cell */
  getEntropy(cellIndex: number): number {
    return this.memo.entropy[cellIndex];
  }

  /**
   * Remove a pattern from a cell and update entropy incrementally
   * Returns true if removal was successful, false if pattern was already removed
   */
  remove(cellIndex: number, pattern: number): boolean {
    const dataIndex = cellIndex * this.patternCount + pattern;
    if (this.data[dataIndex] === 0) {
      return false; // Already removed
    }

    this.data[dataIndex] = 0;

    // Update memoized entropy values incrementally
    this.memo.plogpSum[cellIndex] -= this.plogp[pattern];
    this.memo.sum[cellIndex] -= this.weights[pattern];
    this.memo.patternCount[cellIndex]--;

    // Recompute log and entropy only for this cell
    if (this.memo.sum[cellIndex] > 0) {
      this.memo.logSum[cellIndex] = Math.log(this.memo.sum[cellIndex]);
      this.memo.entropy[cellIndex] =
        this.memo.logSum[cellIndex] -
        this.memo.plogpSum[cellIndex] / this.memo.sum[cellIndex];
    } else {
      this.memo.entropy[cellIndex] = 0;
    }

    return true;
  }

  /**
   * Collapse a cell to a single pattern, removing all others
   * Returns the selected pattern index
   */
  collapse(cellIndex: number, rng: Random): number {
    const offset = cellIndex * this.patternCount;
    const remaining = this.memo.patternCount[cellIndex];

    if (remaining === 0) {
      return -1; // Contradiction
    }

    if (remaining === 1) {
      // Already collapsed - find the one remaining pattern
      for (let p = 0; p < this.patternCount; p++) {
        if (this.data[offset + p] === 1) {
          return p;
        }
      }
      return -1;
    }

    // Weighted random selection
    const target = rng.next() * this.memo.sum[cellIndex];
    let cumulative = 0;
    let selected = -1;

    for (let p = 0; p < this.patternCount; p++) {
      if (this.data[offset + p] === 1) {
        cumulative += this.weights[p];
        if (cumulative >= target) {
          selected = p;
          break;
        }
      }
    }

    if (selected === -1) {
      // Edge case: select last possible pattern
      for (let p = this.patternCount - 1; p >= 0; p--) {
        if (this.data[offset + p] === 1) {
          selected = p;
          break;
        }
      }
    }

    // Remove all other patterns
    for (let p = 0; p < this.patternCount; p++) {
      if (p !== selected && this.data[offset + p] === 1) {
        this.remove(cellIndex, p);
      }
    }

    return selected;
  }

  /**
   * Find the cell with minimum entropy (not yet collapsed)
   * Returns: cell index, or -1 if all collapsed (success), or -2 if contradiction
   *
   * Based on fast-wfc wave.cpp get_min_entropy optimization:
   * - Skip already-collapsed cells
   * - Only add noise when entropy is potentially minimal
   */
  getMinEntropyCell(rng: Random): number {
    let minEntropy = Infinity;
    let argmin = -1;

    for (let i = 0; i < this.size; i++) {
      const count = this.memo.patternCount[i];

      // Skip already collapsed cells
      if (count === 1) continue;

      // Contradiction: no patterns possible
      if (count === 0) return -2;

      const entropy = this.memo.entropy[i];

      // Lazy noise computation - only if potentially minimal
      if (entropy <= minEntropy) {
        const noise = rng.next() * this.minAbsHalfPlogp;
        if (entropy + noise < minEntropy) {
          minEntropy = entropy + noise;
          argmin = i;
        }
      }
    }

    return argmin;
  }

  /** Check if a cell is fully collapsed (has exactly one pattern) */
  isCollapsed(cellIndex: number): boolean {
    return this.memo.patternCount[cellIndex] === 1;
  }

  /** Check if wave is fully collapsed */
  isFullyCollapsed(): boolean {
    for (let i = 0; i < this.size; i++) {
      if (this.memo.patternCount[i] !== 1) return false;
    }
    return true;
  }

  /** Check if any cell has a contradiction */
  hasContradiction(): boolean {
    for (let i = 0; i < this.size; i++) {
      if (this.memo.patternCount[i] === 0) return true;
    }
    return false;
  }

  /** Get the observed pattern at a cell (only valid if collapsed) */
  getObserved(cellIndex: number): number {
    if (!this.isCollapsed(cellIndex)) return -1;
    const offset = cellIndex * this.patternCount;
    for (let p = 0; p < this.patternCount; p++) {
      if (this.data[offset + p] === 1) return p;
    }
    return -1;
  }

  /** Reset wave to initial state (all patterns possible) */
  clear(): void {
    this.data.fill(1);

    const sumOfWeights = this.weights.reduce((a, b) => a + b, 0);
    const sumOfPlogp = this.plogp.reduce((a, b) => a + b, 0);

    this.memo.plogpSum.fill(sumOfPlogp);
    this.memo.sum.fill(sumOfWeights);
    this.memo.logSum.fill(Math.log(sumOfWeights));
    this.memo.patternCount.fill(this.patternCount);
    this.memo.entropy.fill(this.startingEntropy);
  }
}
