/**
 * Tileset loader - parses XML config and loads tile images for SimpleTiledModel
 *
 * Ported from mxgmn's SimpleTiledModel.cs constructor.
 * Handles symmetry transforms, neighbor rules, and propagator construction.
 */

import { PropagatorData } from './types';

/** Result of loading a tileset */
export interface TilesetData {
  tiles: Int32Array[];
  tilenames: string[];
  tilesize: number;
  weights: Float64Array;
  propagatorData: PropagatorData;
}

/** Rotate pixel array 90 degrees clockwise */
function rotate(array: Int32Array, size: number): Int32Array {
  const result = new Int32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      result[x + y * size] = array[size - 1 - y + x * size];
    }
  }
  return result;
}

/** Reflect pixel array horizontally */
function reflect(array: Int32Array, size: number): Int32Array {
  const result = new Int32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      result[x + y * size] = array[size - 1 - x + y * size];
    }
  }
  return result;
}

/** Load an image and extract pixel data as Int32Array (ABGR packed) */
async function loadTilePixels(url: string): Promise<{ pixels: Int32Array; size: number }> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = url;
  });

  const size = img.width; // tiles are square
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, size, size);
  const pixels = new Int32Array(imageData.data.buffer);
  return { pixels, size };
}

/**
 * Get symmetry functions for a given symmetry character.
 * Returns: cardinality, a (90° rotation index transform), b (reflection index transform)
 */
function getSymmetry(sym: string): {
  cardinality: number;
  a: (i: number) => number;
  b: (i: number) => number;
} {
  switch (sym) {
    case 'L':
      return {
        cardinality: 4,
        a: (i: number) => (i + 1) % 4,
        b: (i: number) => i % 2 === 0 ? i + 1 : i - 1,
      };
    case 'T':
      return {
        cardinality: 4,
        a: (i: number) => (i + 1) % 4,
        b: (i: number) => i % 2 === 0 ? i : 4 - i,
      };
    case 'I':
      return {
        cardinality: 2,
        a: (i: number) => 1 - i,
        b: (i: number) => i,
      };
    case '\\':
      return {
        cardinality: 2,
        a: (i: number) => 1 - i,
        b: (i: number) => 1 - i,
      };
    case 'F':
      return {
        cardinality: 8,
        a: (i: number) => i < 4 ? (i + 1) % 4 : 4 + (i - 1) % 4,
        b: (i: number) => i < 4 ? i + 4 : i - 4,
      };
    default: // 'X' or unrecognized
      return {
        cardinality: 1,
        a: (i: number) => i,
        b: (i: number) => i,
      };
  }
}

/**
 * Load and parse a tileset folder.
 *
 * @param baseUrl - Base URL for assets (e.g. import.meta.env.BASE_URL)
 * @param folder - Tileset folder name (e.g. 'Castle')
 * @param subsetName - Optional subset filter
 */
export async function loadTileset(
  baseUrl: string,
  folder: string,
  subsetName?: string,
): Promise<TilesetData> {
  // Fetch and parse XML
  const xmlUrl = `${baseUrl}tilesets/${folder}/data.xml`;
  const response = await fetch(xmlUrl);
  const xmlText = await response.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'text/xml');
  const root = doc.documentElement;

  const unique = root.getAttribute('unique')?.toLowerCase() === 'true';

  // Parse subset if specified
  let subset: Set<string> | null = null;
  if (subsetName) {
    const subsetsEl = root.querySelector('subsets');
    if (subsetsEl) {
      const subsetEl = Array.from(subsetsEl.querySelectorAll('subset'))
        .find(el => el.getAttribute('name') === subsetName);
      if (subsetEl) {
        subset = new Set(
          Array.from(subsetEl.querySelectorAll('tile'))
            .map(el => el.getAttribute('name')!)
        );
      }
    }
  }

  // Parse tiles
  const tiles: Int32Array[] = [];
  const tilenames: string[] = [];
  const weightList: number[] = [];
  const action: number[][] = [];
  const firstOccurrence = new Map<string, number>();

  const tileElements = root.querySelector('tiles')!.querySelectorAll('tile');
  let tilesize = 0;

  for (const xtile of Array.from(tileElements)) {
    const tilename = xtile.getAttribute('name')!;
    if (subset && !subset.has(tilename)) continue;

    const sym = xtile.getAttribute('symmetry') || 'X';
    const weight = parseFloat(xtile.getAttribute('weight') || '1.0');
    const { cardinality, a, b } = getSymmetry(sym);

    const T = action.length;
    firstOccurrence.set(tilename, T);

    // Build action map for this tile's variants
    for (let t = 0; t < cardinality; t++) {
      const map = new Array<number>(8);
      map[0] = t;
      map[1] = a(t);
      map[2] = a(a(t));
      map[3] = a(a(a(t)));
      map[4] = b(t);
      map[5] = b(a(t));
      map[6] = b(a(a(t)));
      map[7] = b(a(a(a(t))));

      for (let s = 0; s < 8; s++) map[s] += T;
      action.push(map);
    }

    // Load tile images
    if (unique) {
      for (let t = 0; t < cardinality; t++) {
        const url = `${baseUrl}tilesets/${folder}/${tilename} ${t}.png`;
        const { pixels, size } = await loadTilePixels(url);
        tilesize = size;
        tiles.push(pixels);
        tilenames.push(`${tilename} ${t}`);
      }
    } else {
      const url = `${baseUrl}tilesets/${folder}/${tilename}.png`;
      const { pixels, size } = await loadTilePixels(url);
      tilesize = size;
      tiles.push(pixels);
      tilenames.push(`${tilename} 0`);

      for (let t = 1; t < cardinality; t++) {
        if (t <= 3) tiles.push(rotate(tiles[T + t - 1], tilesize));
        if (t >= 4) tiles.push(reflect(tiles[T + t - 4], tilesize));
        tilenames.push(`${tilename} ${t}`);
      }
    }

    for (let t = 0; t < cardinality; t++) {
      weightList.push(weight);
    }
  }

  const totalTiles = action.length;

  // Build dense propagator from neighbor rules
  // densePropagator[direction][t1][t2] = can t2 be in direction d from t1
  const densePropagator: boolean[][][] = [];
  for (let d = 0; d < 4; d++) {
    densePropagator[d] = [];
    for (let t = 0; t < totalTiles; t++) {
      densePropagator[d][t] = new Array(totalTiles).fill(false);
    }
  }

  const neighborElements = root.querySelector('neighbors')!.querySelectorAll('neighbor');
  for (const xneighbor of Array.from(neighborElements)) {
    const leftParts = xneighbor.getAttribute('left')!.split(/\s+/);
    const rightParts = xneighbor.getAttribute('right')!.split(/\s+/);

    if (subset && (!subset.has(leftParts[0]) || !subset.has(rightParts[0]))) continue;
    if (!firstOccurrence.has(leftParts[0]) || !firstOccurrence.has(rightParts[0])) continue;

    const L = action[firstOccurrence.get(leftParts[0])!][leftParts.length === 1 ? 0 : parseInt(leftParts[1])];
    const D = action[L][1];
    const R = action[firstOccurrence.get(rightParts[0])!][rightParts.length === 1 ? 0 : parseInt(rightParts[1])];
    const U = action[R][1];

    // Left/Right (direction 0)
    densePropagator[0][R][L] = true;
    densePropagator[0][action[R][6]][action[L][6]] = true;
    densePropagator[0][action[L][4]][action[R][4]] = true;
    densePropagator[0][action[L][2]][action[R][2]] = true;

    // Down/Up (direction 1)
    densePropagator[1][U][D] = true;
    densePropagator[1][action[D][6]][action[U][6]] = true;
    densePropagator[1][action[U][4]][action[D][4]] = true;
    densePropagator[1][action[D][2]][action[U][2]] = true;
  }

  // Direction 2 (Right) = transpose of direction 0 (Left)
  // Direction 3 (Up) = transpose of direction 1 (Down)
  for (let t2 = 0; t2 < totalTiles; t2++) {
    for (let t1 = 0; t1 < totalTiles; t1++) {
      densePropagator[2][t2][t1] = densePropagator[0][t1][t2];
      densePropagator[3][t2][t1] = densePropagator[1][t1][t2];
    }
  }

  // Convert dense to sparse PropagatorData format
  // Our format: propagatorData.data[pattern][direction] = compatible pattern indices
  const data: number[][][] = [];
  for (let t = 0; t < totalTiles; t++) {
    data[t] = [];
    for (let d = 0; d < 4; d++) {
      const compatible: number[] = [];
      for (let t2 = 0; t2 < totalTiles; t2++) {
        if (densePropagator[d][t][t2]) {
          compatible.push(t2);
        }
      }
      data[t][d] = compatible;
    }
  }

  return {
    tiles,
    tilenames,
    tilesize,
    weights: new Float64Array(weightList),
    propagatorData: { data },
  };
}
