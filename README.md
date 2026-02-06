# WFC Visualizer

An interactive browser-based visualizer for the [Wave Function Collapse](https://github.com/mxgmn/WaveFunctionCollapse) algorithm. Supports both the Overlapping Model and Simple Tiled Model with step-by-step animation, entropy heatmaps, and pattern inspection.

## Features

- **Overlapping Model** — Extracts NxN patterns from a sample image and generates new output respecting local constraints. 40+ built-in samples from mxgmn's original collection.
- **Simple Tiled Model** — Uses predefined tiles with explicit adjacency rules loaded from XML. 7 tilesets included (Castle, Knots, Summer, Circuit, Circles, FloorPlan, Rooms) with subset support.
- **Step-by-step animation** — Watch the algorithm collapse cells one at a time, or run to completion instantly.
- **Entropy heatmap overlay** — Visualize remaining uncertainty across the grid.
- **Pattern/tile inspector** — View all extracted patterns or tile variants with their weights.
- **Configurable parameters** — Output size, pattern size, symmetry, periodicity, ground constraints, heuristic (entropy/MRV/scanline), and random seed.
- **Light/dark theme** with persistent preference.

## Getting Started

```bash
cd wfc-visualizer
npm install
npm run dev
```

Open `http://localhost:5173/wfc-visualizer/` in your browser.

## Building

```bash
npm run build
```

Produces a static site in `dist/` that can be deployed to any static host.

## Deploy to GitHub Pages

The Vite config sets `base: '/wfc-visualizer/'`, which works when the GitHub repo is named `wfc-visualizer`. If using a different repo name, update `base` in `vite.config.ts` to match.

A GitHub Actions workflow is included at `.github/workflows/deploy.yml`. To enable it, go to repo Settings > Pages and set the source to "GitHub Actions".

## Architecture

The core algorithm is split into model-agnostic components shared by both model types:

- **`Wave`** — Tracks which patterns/tiles are still possible at each cell, computes entropy.
- **`Propagator`** — Enforces arc consistency by removing incompatible patterns from neighboring cells.
- **`OverlappingModel`** — Extracts patterns from a sample image, builds propagator from pattern overlaps.
- **`SimpleTiledModel`** — Uses pre-parsed tile data and adjacency rules from XML configs.
- **`tileset-loader`** — Parses tileset XML, loads tile images, handles symmetry transforms, builds propagator data.

## Credits

- Algorithm and samples by [mxgmn](https://github.com/mxgmn/WaveFunctionCollapse)
- Built with [Vite](https://vitejs.dev/) + TypeScript
