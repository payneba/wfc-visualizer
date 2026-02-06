/**
 * Sample manifest - defines available samples and their configurations
 * Parameters derived from mxgmn's WaveFunctionCollapse samples.xml
 */

export type Heuristic = 'entropy' | 'mrv' | 'scanline';

export interface SampleManifest {
  name: string;
  file: string;
  N: number;                    // Pattern size (required, no default)
  symmetry: number;             // 1, 2, or 8 (default 8)
  periodic: boolean;            // Output wraps (default false)
  periodicInput: boolean;       // Input wraps (default true)
  ground: boolean;              // Ground constraint (default false)
  heuristic: Heuristic;         // Cell selection heuristic (default 'entropy')
  size?: number;                // Suggested output size (optional)
  description?: string;
}

export interface TilesetManifest {
  name: string;
  folder: string;
  subsets?: string[];
  description?: string;
}

/** Default values for parameters not specified in samples.xml */
const DEFAULTS = {
  symmetry: 8,
  periodic: false,
  periodicInput: true,
  ground: false,
  heuristic: 'entropy' as Heuristic,
};

/** Helper to create sample with defaults applied */
function sample(
  name: string,
  file: string,
  N: number,
  opts: Partial<Omit<SampleManifest, 'name' | 'file' | 'N'>> = {}
): SampleManifest {
  return {
    name,
    file,
    N,
    symmetry: opts.symmetry ?? DEFAULTS.symmetry,
    periodic: opts.periodic ?? DEFAULTS.periodic,
    periodicInput: opts.periodicInput ?? DEFAULTS.periodicInput,
    ground: opts.ground ?? DEFAULTS.ground,
    heuristic: opts.heuristic ?? DEFAULTS.heuristic,
    size: opts.size,
    description: opts.description,
  };
}

/**
 * Overlapping model samples from mxgmn's WaveFunctionCollapse
 * Configuration matches samples.xml exactly
 */
export const OVERLAPPING_SAMPLES: SampleManifest[] = [
  // Simple samples (good for demos)
  sample('Chess', 'Chess.png', 2, { periodic: true, description: 'Simple checkerboard' }),
  sample('SimpleMaze', 'SimpleMaze.png', 2, { description: 'Basic maze' }),
  sample('SimpleKnot', 'SimpleKnot.png', 3, { periodic: true, description: 'Simple knot pattern' }),
  sample('SimpleWall', 'SimpleWall.png', 3, { symmetry: 2, periodic: true, description: 'Simple wall' }),

  // Medium complexity
  sample('Rooms', 'Rooms.png', 3, { periodic: true, description: 'Room layouts' }),
  sample('Knot', 'Knot.png', 3, { periodic: true, description: 'Knot pattern' }),
  sample('Flowers', 'Flowers.png', 3, { symmetry: 2, ground: true, periodic: true, description: 'Flower field' }),
  sample('Skyline', 'Skyline.png', 3, { symmetry: 2, ground: true, periodic: true, description: 'City skyline' }),
  sample('Hogs', 'Hogs.png', 3, { periodic: true, description: 'Hog patterns' }),
  sample('LessRooms', 'LessRooms.png', 3, { periodic: true, description: 'Less rooms variant' }),
  sample('Mountains', 'Mountains.png', 3, { symmetry: 2, periodic: true, description: 'Mountain landscape' }),
  sample('Office', 'Office.png', 3, { periodic: true, description: 'Office layout' }),
  sample('Paths', 'Paths.png', 3, { periodic: true, description: 'Path networks' }),
  sample('Platformer', 'Platformer.png', 2, { symmetry: 2, ground: true, periodic: true, description: 'Platformer level' }),
  sample('RedMaze', 'RedMaze.png', 2, { description: 'Red maze' }),
  sample('Rule126', 'Rule126.png', 3, { symmetry: 2, periodicInput: false, periodic: false, description: 'Rule 126 cellular automaton' }),
  sample('TrickKnot', 'TrickKnot.png', 3, { periodic: true, description: 'Trick knot' }),
  sample('Village', 'Village.png', 3, { symmetry: 2, periodic: true, description: 'Village layout' }),
  sample('Water', 'Water.png', 3, { symmetry: 1, periodic: true, description: 'Water pattern' }),

  // Higher complexity
  sample('Cat', 'Cat.png', 3, { symmetry: 2, periodic: true, size: 80, description: 'Cat pixel art' }),
  sample('Cats', 'Cats.png', 3, { symmetry: 2, periodic: true, description: 'Multiple cats' }),
  sample('Skyline2', 'Skyline2.png', 3, { symmetry: 2, periodic: true, ground: true, description: 'Skyline variant' }),
  sample('Angular', 'Angular.png', 3, { periodic: true, description: 'Angular patterns' }),
  sample('City', 'City.png', 3, { periodic: true, size: 80, description: 'City blocks' }),
  sample('ColoredCity', 'ColoredCity.png', 3, { periodic: true, description: 'Colored city' }),
  sample('Dungeon', 'Dungeon.png', 3, { periodic: true, description: 'Dungeon layout' }),
  sample('Lake', 'Lake.png', 3, { periodic: true, size: 60, description: 'Lake landscape' }),
  sample('Link', 'Link.png', 3, { periodic: true, description: 'Link pattern' }),
  sample('Link2', 'Link2.png', 3, { periodic: true, description: 'Link variant' }),
  sample('Mazelike', 'Mazelike.png', 3, { periodic: true, description: 'Maze-like' }),
  sample('Nested', 'Nested.png', 3, { periodic: true, description: 'Nested patterns' }),
  sample('MagicOffice', 'MagicOffice.png', 3, { periodic: true, description: 'Magic office' }),
  sample('Office2', 'Office2.png', 3, { periodic: true, description: 'Office variant' }),
  sample('Qud', 'Qud.png', 3, { periodic: true, size: 80, description: 'Caves of Qud style' }),
  sample('RedDot', 'RedDot.png', 3, { periodic: true, description: 'Red dot pattern' }),
  sample('ScaledMaze', 'ScaledMaze.png', 2, { periodic: true, description: 'Scaled maze' }),
  sample('Sewers', 'Sewers.png', 3, { periodic: true, description: 'Sewer tunnels' }),
  sample('Skew1', 'Skew1.png', 3, { periodic: true, description: 'Skew pattern 1' }),
  sample('Skew2', 'Skew2.png', 3, { periodic: true, description: 'Skew pattern 2' }),
  sample('SmileCity', 'SmileCity.png', 3, { periodic: true, description: 'Smile city' }),
  sample('Spirals', 'Spirals.png', 3, { periodic: true, description: 'Spiral patterns' }),
  sample('Town', 'Town.png', 3, { periodic: true, description: 'Town layout' }),
  sample('Wall', 'Wall.png', 2, { symmetry: 1, description: 'Wall pattern' }),
  sample('Lines', 'Lines.png', 3, { description: 'Line patterns' }),
  sample('WalledDot', 'WalledDot.png', 3, { description: 'Walled dot' }),
  sample('NotKnot', 'NotKnot.png', 3, { periodic: true, periodicInput: false, description: 'Not knot' }),
  sample('Sand', 'Sand.png', 3, { periodic: true, periodicInput: false, description: 'Sand pattern' }),

  // MRV heuristic samples (better for complex patterns)
  sample('Wrinkles', 'Wrinkles.png', 3, { periodic: true, heuristic: 'mrv', size: 120, description: 'Wrinkle pattern' }),
  sample('3Bricks', '3Bricks.png', 3, { symmetry: 1, periodic: true, description: 'Three bricks' }),
  sample('Circle', 'Circle.png', 3, { symmetry: 1, periodic: true, heuristic: 'mrv', size: 90, description: 'Circle pattern' }),
  sample('Disk', 'Disk.png', 3, { symmetry: 1, periodic: true, heuristic: 'mrv', size: 90, description: 'Disk pattern' }),
  sample('BrownFox', 'BrownFox.png', 4, { symmetry: 1, heuristic: 'mrv', size: 90, description: 'Brown fox text' }),
  sample('Font', 'Font.png', 5, { symmetry: 2, periodic: true, heuristic: 'mrv', size: 90, description: 'Font pattern' }),

  // Additional samples (not in original samples.xml, using reasonable defaults)
  sample('Cave', 'Cave.png', 3, { periodic: true, description: 'Cave system' }),
  sample('Fabric', 'Fabric.png', 3, { periodic: true, description: 'Fabric pattern' }),
  sample('Forest', 'Forest.png', 3, { periodic: true, description: 'Forest' }),
  sample('Maze', 'Maze.png', 3, { periodic: true, description: 'Complex maze' }),
  sample('MoreFlowers', 'MoreFlowers.png', 3, { symmetry: 2, ground: true, description: 'More flowers' }),
];

/**
 * Simple tiled model tilesets
 */
export const TILED_SAMPLES: TilesetManifest[] = [
  { name: 'Castle', folder: 'Castle', description: 'Medieval castle walls and roads' },
  { name: 'Knots', folder: 'Knots', subsets: ['Standard', 'Dense', 'Crossless', 'Fabric'], description: 'Celtic knot patterns' },
  { name: 'Summer', folder: 'Summer', description: 'Summer landscape tiles' },
  { name: 'Circuit', folder: 'Circuit', subsets: ['Turnless'], description: 'Electronic circuit patterns' },
  { name: 'Circles', folder: 'Circles', subsets: ['Large Circles', 'No Solid'], description: 'Circle patterns' },
  { name: 'FloorPlan', folder: 'FloorPlan', description: 'Architectural floor plans' },
  { name: 'Rooms', folder: 'Rooms', description: 'Room and corridor layouts' },
];
