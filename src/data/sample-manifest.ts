/**
 * Sample manifest - defines available samples and their configurations
 */

export interface SampleManifest {
  name: string;
  file: string;
  N?: number;
  symmetry?: number;
  periodic?: boolean;
  periodicInput?: boolean;
  ground?: boolean;
  size?: number;
  description?: string;
}

export interface TilesetManifest {
  name: string;
  folder: string;
  subsets?: string[];
  description?: string;
}

/**
 * Overlapping model samples from mxgmn's WaveFunctionCollapse
 * Configuration derived from samples.xml
 */
export const OVERLAPPING_SAMPLES: SampleManifest[] = [
  // Simple samples (good for demos)
  { name: 'Chess', file: 'Chess.png', N: 2, periodic: true, description: 'Simple checkerboard' },
  { name: 'SimpleMaze', file: 'SimpleMaze.png', N: 2, description: 'Basic maze' },
  { name: 'SimpleKnot', file: 'SimpleKnot.png', N: 3, periodic: true, description: 'Simple knot pattern' },
  { name: 'SimpleWall', file: 'SimpleWall.png', N: 3, symmetry: 2, periodic: true, description: 'Simple wall' },

  // Medium complexity
  { name: 'Rooms', file: 'Rooms.png', N: 3, periodic: true, description: 'Room layouts' },
  { name: 'Knot', file: 'Knot.png', N: 3, periodic: true, description: 'Knot pattern' },
  { name: 'Flowers', file: 'Flowers.png', N: 3, symmetry: 2, ground: true, periodic: true, description: 'Flower field' },
  { name: 'Skyline', file: 'Skyline.png', N: 3, symmetry: 2, ground: true, periodic: true, description: 'City skyline' },
  { name: 'Hogs', file: 'Hogs.png', N: 3, periodic: true, description: 'Hog patterns' },
  { name: 'LessRooms', file: 'LessRooms.png', N: 3, periodic: true, description: 'Less rooms variant' },
  { name: 'Mountains', file: 'Mountains.png', N: 3, symmetry: 2, periodic: true, description: 'Mountain landscape' },
  { name: 'Office', file: 'Office.png', N: 3, periodic: true, description: 'Office layout' },
  { name: 'Paths', file: 'Paths.png', N: 3, periodic: true, description: 'Path networks' },
  { name: 'Platformer', file: 'Platformer.png', N: 2, symmetry: 2, ground: true, periodic: true, description: 'Platformer level' },
  { name: 'RedMaze', file: 'RedMaze.png', N: 2, description: 'Red maze' },
  { name: 'Rule126', file: 'Rule126.png', N: 3, symmetry: 2, periodicInput: false, periodic: false, description: 'Rule 126' },
  { name: 'TrickKnot', file: 'TrickKnot.png', N: 3, periodic: true, description: 'Trick knot' },
  { name: 'Village', file: 'Village.png', N: 3, symmetry: 2, periodic: true, description: 'Village layout' },
  { name: 'Water', file: 'Water.png', N: 3, symmetry: 1, periodic: true, description: 'Water pattern' },

  // Higher complexity
  { name: 'Cat', file: 'Cat.png', N: 3, symmetry: 2, periodic: true, size: 80, description: 'Cat pixel art' },
  { name: 'Cats', file: 'Cats.png', N: 3, symmetry: 2, periodic: true, description: 'Multiple cats' },
  { name: 'Skyline2', file: 'Skyline2.png', N: 3, symmetry: 2, periodic: true, ground: true, description: 'Skyline variant' },
  { name: 'Angular', file: 'Angular.png', N: 3, periodic: true, description: 'Angular patterns' },
  { name: 'City', file: 'City.png', N: 3, periodic: true, size: 80, description: 'City blocks' },
  { name: 'ColoredCity', file: 'ColoredCity.png', N: 3, periodic: true, description: 'Colored city' },
  { name: 'Dungeon', file: 'Dungeon.png', N: 3, periodic: true, description: 'Dungeon layout' },
  { name: 'Lake', file: 'Lake.png', N: 3, periodic: true, size: 60, description: 'Lake landscape' },
  { name: 'Link', file: 'Link.png', N: 3, periodic: true, description: 'Link pattern' },
  { name: 'Link2', file: 'Link2.png', N: 3, periodic: true, description: 'Link variant' },
  { name: 'Mazelike', file: 'Mazelike.png', N: 3, periodic: true, description: 'Maze-like' },
  { name: 'Nested', file: 'Nested.png', N: 3, periodic: true, description: 'Nested patterns' },
  { name: 'MagicOffice', file: 'MagicOffice.png', N: 3, periodic: true, description: 'Magic office' },
  { name: 'Office2', file: 'Office2.png', N: 3, periodic: true, description: 'Office variant' },
  { name: 'Qud', file: 'Qud.png', N: 3, periodic: true, size: 80, description: 'Caves of Qud style' },
  { name: 'RedDot', file: 'RedDot.png', N: 3, periodic: true, description: 'Red dot pattern' },
  { name: 'ScaledMaze', file: 'ScaledMaze.png', N: 2, periodic: true, description: 'Scaled maze' },
  { name: 'Sewers', file: 'Sewers.png', N: 3, periodic: true, description: 'Sewer tunnels' },
  { name: 'Skew1', file: 'Skew1.png', N: 3, periodic: true, description: 'Skew pattern 1' },
  { name: 'Skew2', file: 'Skew2.png', N: 3, periodic: true, description: 'Skew pattern 2' },
  { name: 'SmileCity', file: 'SmileCity.png', N: 3, periodic: true, description: 'Smile city' },
  { name: 'Spirals', file: 'Spirals.png', N: 3, periodic: true, description: 'Spiral patterns' },
  { name: 'Town', file: 'Town.png', N: 3, periodic: true, description: 'Town layout' },
  { name: 'Wall', file: 'Wall.png', N: 2, symmetry: 1, description: 'Wall pattern' },
  { name: 'Lines', file: 'Lines.png', N: 3, description: 'Line patterns' },
  { name: 'WalledDot', file: 'WalledDot.png', N: 3, description: 'Walled dot' },
  { name: 'NotKnot', file: 'NotKnot.png', N: 3, periodic: true, periodicInput: false, description: 'Not knot' },
  { name: 'Sand', file: 'Sand.png', N: 3, periodic: true, periodicInput: false, description: 'Sand pattern' },
  { name: 'Wrinkles', file: 'Wrinkles.png', N: 3, periodic: true, size: 120, description: 'Wrinkle pattern' },
  { name: '3Bricks', file: '3Bricks.png', N: 3, symmetry: 1, periodic: true, description: 'Three bricks' },
  { name: 'Circle', file: 'Circle.png', N: 3, symmetry: 1, periodic: true, size: 90, description: 'Circle pattern' },
  { name: 'Disk', file: 'Disk.png', N: 3, symmetry: 1, periodic: true, size: 90, description: 'Disk pattern' },
  { name: 'BrownFox', file: 'BrownFox.png', N: 4, symmetry: 1, size: 90, description: 'Brown fox text' },
  { name: 'Font', file: 'Font.png', N: 5, symmetry: 2, periodic: true, size: 90, description: 'Font pattern' },

  // Additional samples
  { name: 'Cave', file: 'Cave.png', N: 3, periodic: true, description: 'Cave system' },
  { name: 'Fabric', file: 'Fabric.png', N: 3, periodic: true, description: 'Fabric pattern' },
  { name: 'Forest', file: 'Forest.png', N: 3, periodic: true, description: 'Forest' },
  { name: 'Maze', file: 'Maze.png', N: 3, periodic: true, description: 'Complex maze' },
  { name: 'MoreFlowers', file: 'MoreFlowers.png', N: 3, symmetry: 2, ground: true, description: 'More flowers' },
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
