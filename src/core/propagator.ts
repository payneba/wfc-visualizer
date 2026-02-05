/**
 * Constraint propagation with stack-based processing
 *
 * Based on fast-wfc propagator.cpp optimization patterns.
 * Key optimization: Uses a stack to process constraint updates,
 * avoiding recursion and enabling efficient batch processing.
 */

import { Wave } from './wave';
import { Direction, DX, DY, OPPOSITE, PropagatorData } from './types';

export class Propagator {
  /** Adjacency constraints: compatible[pattern][direction] = compatible patterns */
  private readonly propagatorData: PropagatorData;

  /**
   * Compatible pattern counts: compatible[cell][pattern][direction] = count
   * Flattened as: compatible[cell * patternCount * 4 + pattern * 4 + direction]
   */
  private readonly compatible: Int32Array;

  /** Propagation stack: [cellIndex, pattern] pairs */
  private readonly stack: Uint32Array;
  private stackSize: number = 0;

  /** Grid dimensions */
  private readonly width: number;
  private readonly height: number;
  private readonly patternCount: number;
  private readonly periodic: boolean;

  /** Cells affected in current propagation (for visualization) */
  private affectedCells: Set<number> = new Set();

  constructor(
    width: number,
    height: number,
    patternCount: number,
    periodic: boolean,
    propagatorData: PropagatorData
  ) {
    this.width = width;
    this.height = height;
    this.patternCount = patternCount;
    this.periodic = periodic;
    this.propagatorData = propagatorData;

    // Allocate compatible counts array
    const size = width * height;
    this.compatible = new Int32Array(size * patternCount * 4);

    // Allocate propagation stack (worst case: all patterns in all cells)
    this.stack = new Uint32Array(size * patternCount * 2);

    // Initialize compatible counts
    this.initCompatible();
  }

  /**
   * Initialize compatible counts from propagator adjacency data
   * For each cell, pattern, and direction: count how many compatible patterns exist
   */
  private initCompatible(): void {
    const size = this.width * this.height;

    for (let i = 0; i < size; i++) {
      const x = i % this.width;
      const y = Math.floor(i / this.width);

      for (let pattern = 0; pattern < this.patternCount; pattern++) {
        for (let direction = 0; direction < 4; direction++) {
          // Check if neighbor exists
          const nx = x + DX[direction];
          const ny = y + DY[direction];

          let hasNeighbor: boolean;
          if (this.periodic) {
            hasNeighbor = true;
          } else {
            hasNeighbor =
              nx >= 0 && nx < this.width && ny >= 0 && ny < this.height;
          }

          if (hasNeighbor) {
            // Count compatible patterns in this direction
            const compatPatterns =
              this.propagatorData.data[pattern][direction];
            const idx =
              i * this.patternCount * 4 + pattern * 4 + direction;
            this.compatible[idx] = compatPatterns.length;
          }
        }
      }
    }
  }

  /** Reset compatible counts to initial state */
  reset(): void {
    this.initCompatible();
    this.stackSize = 0;
    this.affectedCells.clear();
  }

  /**
   * Add a pattern removal to the propagation stack
   */
  addToPropagate(cellIndex: number, pattern: number): void {
    const idx = this.stackSize * 2;
    this.stack[idx] = cellIndex;
    this.stack[idx + 1] = pattern;
    this.stackSize++;
  }

  /**
   * Process the entire propagation stack
   * Returns true if successful, false if contradiction detected
   */
  propagate(wave: Wave): boolean {
    this.affectedCells.clear();

    while (this.stackSize > 0) {
      // Pop from stack
      this.stackSize--;
      const idx = this.stackSize * 2;
      const cellIndex = this.stack[idx];
      const pattern = this.stack[idx + 1];

      const x1 = cellIndex % this.width;
      const y1 = Math.floor(cellIndex / this.width);

      // Propagate to 4 neighbors
      for (let direction = 0; direction < 4; direction++) {
        let x2 = x1 + DX[direction];
        let y2 = y1 + DY[direction];

        // Handle boundaries
        if (this.periodic) {
          x2 = (x2 + this.width) % this.width;
          y2 = (y2 + this.height) % this.height;
        } else if (
          x2 < 0 ||
          x2 >= this.width ||
          y2 < 0 ||
          y2 >= this.height
        ) {
          continue;
        }

        const neighborIndex = x2 + y2 * this.width;
        const oppositeDir = OPPOSITE[direction as Direction];

        // Get patterns that were compatible with the removed pattern
        const compatPatterns =
          this.propagatorData.data[pattern][direction];

        for (const compatPattern of compatPatterns) {
          const compatIdx =
            neighborIndex * this.patternCount * 4 +
            compatPattern * 4 +
            oppositeDir;

          this.compatible[compatIdx]--;

          // If no more compatible patterns, remove this pattern from neighbor
          if (this.compatible[compatIdx] === 0) {
            if (wave.get(neighborIndex, compatPattern)) {
              wave.remove(neighborIndex, compatPattern);
              this.addToPropagate(neighborIndex, compatPattern);
              this.affectedCells.add(neighborIndex);

              // Check for contradiction
              if (wave.getRemainingCount(neighborIndex) === 0) {
                return false;
              }
            }
          }
        }
      }
    }

    return true;
  }

  /**
   * Process a single item from the propagation stack (for step-by-step visualization)
   * Returns: { done: boolean, contradiction: boolean, affectedCells: number[] }
   */
  propagateStep(wave: Wave): {
    done: boolean;
    contradiction: boolean;
    affectedCells: number[];
  } {
    if (this.stackSize === 0) {
      return { done: true, contradiction: false, affectedCells: [] };
    }

    const affected: number[] = [];

    // Pop from stack
    this.stackSize--;
    const idx = this.stackSize * 2;
    const cellIndex = this.stack[idx];
    const pattern = this.stack[idx + 1];

    const x1 = cellIndex % this.width;
    const y1 = Math.floor(cellIndex / this.width);

    // Propagate to 4 neighbors
    for (let direction = 0; direction < 4; direction++) {
      let x2 = x1 + DX[direction];
      let y2 = y1 + DY[direction];

      if (this.periodic) {
        x2 = (x2 + this.width) % this.width;
        y2 = (y2 + this.height) % this.height;
      } else if (
        x2 < 0 ||
        x2 >= this.width ||
        y2 < 0 ||
        y2 >= this.height
      ) {
        continue;
      }

      const neighborIndex = x2 + y2 * this.width;
      const oppositeDir = OPPOSITE[direction as Direction];

      const compatPatterns =
        this.propagatorData.data[pattern][direction];

      for (const compatPattern of compatPatterns) {
        const compatIdx =
          neighborIndex * this.patternCount * 4 +
          compatPattern * 4 +
          oppositeDir;

        this.compatible[compatIdx]--;

        if (this.compatible[compatIdx] === 0) {
          if (wave.get(neighborIndex, compatPattern)) {
            wave.remove(neighborIndex, compatPattern);
            this.addToPropagate(neighborIndex, compatPattern);
            affected.push(neighborIndex);

            if (wave.getRemainingCount(neighborIndex) === 0) {
              return { done: false, contradiction: true, affectedCells: affected };
            }
          }
        }
      }
    }

    return {
      done: this.stackSize === 0,
      contradiction: false,
      affectedCells: affected,
    };
  }

  /** Get cells affected during last propagation (for visualization) */
  getAffectedCells(): number[] {
    return Array.from(this.affectedCells);
  }

  /** Check if propagation stack is empty */
  isEmpty(): boolean {
    return this.stackSize === 0;
  }
}
