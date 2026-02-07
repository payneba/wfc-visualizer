# WFC Visualizer Help

## What is Wave Function Collapse?

Wave Function Collapse (WFC) is a constraint-based procedural generation algorithm created by [Maxim Gumin](https://github.com/mxgmn/WaveFunctionCollapse). It takes a small input example and generates a larger output that is locally similar to the input.

The algorithm works by:

1. **Analyzing** the input to extract patterns (overlapping model) or tile adjacency rules (simple tiled model)
2. **Initializing** an output grid where every cell starts in a superposition of all possible patterns/tiles
3. **Observing** — selecting the cell with the lowest entropy (fewest remaining possibilities) and collapsing it to a single pattern/tile
4. **Propagating** — removing patterns/tiles from neighboring cells that are now incompatible with the observation
5. **Repeating** until every cell is collapsed (success) or a contradiction is reached (no valid pattern remains for some cell)

---

## Overlapping Model

The overlapping model extracts NxN pixel patterns from the input image and uses them to generate the output. It works best with pixel art and textures.

### Settings

- **N** (Pattern Size) — Size of the patterns to extract (2-5). Larger N captures more structure but is slower and needs more variety in the input.
- **Symmetry** — How many symmetry transformations to apply when extracting patterns:
  - **1** — No transformations (use patterns as-is)
  - **2** — Add 180-degree rotation
  - **8** — Add all rotations and reflections (most variety)
- **Periodic input** — Whether the input image wraps around (tiles seamlessly). Enable for seamless textures.
- **Ground** — Constrains the bottom row of the output to use patterns found at the bottom of the input. Useful for landscapes or anything with a distinct ground.

---

## Simple Tiled Model

The simple tiled model uses pre-defined tiles with explicit adjacency rules (defined in a `data.xml` file per tileset). Each tile specifies which other tiles can appear next to it on each side.

### Subsets

Some tilesets define **subsets** — named groups of tiles that produce different styles of output. Select a subset from the dropdown to constrain which tiles are used.

---

## Custom Image Upload

In **Overlapping Model** mode, you can use your own image as input:

- Select **"Custom Image..."** from the sample dropdown
- Click **Choose Image...** or **drag and drop** an image onto the preview area
- Small images (under ~64px) work best — the algorithm analyzes pixel patterns

---

## Output Settings

- **Width / Height** — Dimensions of the output grid. For the overlapping model, this is in pixels. For the simple tiled model, this is in tiles (multiplied by tile size for the final image).
- **Periodic output** — Whether the output wraps around horizontally and vertically (producing a seamlessly tileable result).

---

## Algorithm Settings

- **Heuristic** — How to choose which cell to collapse next:
  - **Entropy** — Pick the cell with the lowest Shannon entropy (standard WFC behavior)
  - **MRV** — Minimum Remaining Values; pick the cell with the fewest remaining options
  - **Scanline** — Process cells left-to-right, top-to-bottom
- **Seed** — Random seed for reproducible results. Use the dice button to randomize.

---

## Controls

- **Run** — Start the algorithm. If animation is enabled, you'll see it collapse step by step. If disabled, it runs to completion instantly.
- **Pause** — Stop a running animation. You can resume by clicking Run again.
- **Step** — Advance the algorithm by one observation+propagation cycle.
- **Animate** — Toggle whether Run shows the step-by-step process or jumps to the result.
- **Speed** — How fast the animation runs (delay between steps in milliseconds).

---

## Visualization

- **Entropy heatmap** — Overlays a color map on the output showing the entropy of each uncollapsed cell. Blue = low entropy (few options), red = high entropy (many options). Collapsed cells are transparent.
- **Show Patterns / Show Tiles** — Opens a modal showing all extracted patterns (overlapping model) or tile variants (simple tiled model) with their weights.
