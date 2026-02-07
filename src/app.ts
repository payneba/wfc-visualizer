import { OverlappingModel } from './core/overlapping-model';
import { SimpleTiledModel } from './core/simple-tiled-model';
import { loadTileset } from './core/tileset-loader';
import { SampleManifest, TilesetManifest, OVERLAPPING_SAMPLES, TILED_SAMPLES, Heuristic } from './data/sample-manifest';

type ModelType = 'overlapping' | 'simpletiled';

export class App {
  private outputCanvas: HTMLCanvasElement;
  private overlayCanvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private overlayCtx: CanvasRenderingContext2D;

  private model: OverlappingModel | SimpleTiledModel | null = null;
  private modelType: ModelType = 'overlapping';
  private currentSample: SampleManifest | null = null;
  private currentTileset: TilesetManifest | null = null;
  private currentTilesize: number = 1;
  private isPlaying = false;
  private stopRequested = false;
  private animationId: number | null = null;
  private stepDelay = 50;

  private showEntropy = false;

  // UI element references
  private readonly ui = {
    modelType: () => document.getElementById('model-type') as HTMLSelectElement,
    width: () => document.getElementById('width') as HTMLInputElement,
    height: () => document.getElementById('height') as HTMLInputElement,
    patternSize: () => document.getElementById('pattern-size') as HTMLInputElement,
    symmetry: () => document.getElementById('symmetry') as HTMLSelectElement,
    periodic: () => document.getElementById('periodic') as HTMLInputElement,
    periodicInput: () => document.getElementById('periodic-input') as HTMLInputElement,
    ground: () => document.getElementById('ground') as HTMLInputElement,
    heuristic: () => document.getElementById('heuristic') as HTMLSelectElement,
    seed: () => document.getElementById('seed') as HTMLInputElement,
    sampleSelect: () => document.getElementById('sample-select') as HTMLSelectElement,
    subsetSelect: () => document.getElementById('subset-select') as HTMLSelectElement,
    sampleDescription: () => document.getElementById('sample-description') as HTMLParagraphElement,
    sampleImage: () => document.getElementById('sample-image') as HTMLImageElement,
    patternExtraction: () => document.getElementById('pattern-extraction') as HTMLFieldSetElement,
    samplePreview: () => document.getElementById('sample-preview') as HTMLDivElement,
  };

  constructor() {
    this.outputCanvas = document.getElementById('output-canvas') as HTMLCanvasElement;
    this.overlayCanvas = document.getElementById('overlay-canvas') as HTMLCanvasElement;
    this.ctx = this.outputCanvas.getContext('2d')!;
    this.overlayCtx = this.overlayCanvas.getContext('2d')!;
  }

  init(): void {
    this.applyTheme();
    this.setupEventListeners();
    this.populateSampleSelector();
    this.updateStatus('Ready - select a sample to begin');
  }

  private setupEventListeners(): void {
    // Playback controls
    document.getElementById('play-btn')?.addEventListener('click', () => this.play());
    document.getElementById('pause-btn')?.addEventListener('click', () => this.pause());
    document.getElementById('step-btn')?.addEventListener('click', () => this.step());

    // Speed control
    const speedSlider = document.getElementById('speed') as HTMLInputElement;
    speedSlider?.addEventListener('input', () => {
      this.stepDelay = 101 - parseInt(speedSlider.value);
      document.getElementById('speed-value')!.textContent = `${this.stepDelay}ms`;
    });

    // Model type selector
    this.ui.modelType()?.addEventListener('change', () => {
      this.modelType = this.ui.modelType().value as ModelType;
      this.model = null;
      this.currentSample = null;
      this.currentTileset = null;
      this.updateModelTypeUI();
      this.populateSampleSelector();
    });

    // Sample selector
    this.ui.sampleSelect()?.addEventListener('change', (e) => {
      const select = e.target as HTMLSelectElement;
      this.selectSample(select.value);
    });

    // Subset selector
    this.ui.subsetSelect()?.addEventListener('change', () => {
      if (this.currentTileset) {
        this.loadCurrentSample();
      }
    });

    // Random seed button
    document.getElementById('random-seed')?.addEventListener('click', () => {
      this.ui.seed().value = Math.floor(Math.random() * 1000000).toString();
    });

    // Reset to defaults button
    document.getElementById('reset-defaults')?.addEventListener('click', () => {
      if (this.modelType === 'overlapping' && this.currentSample) {
        this.populateUIFromSample(this.currentSample);
      } else if (this.modelType === 'simpletiled' && this.currentTileset) {
        this.populateUIFromTileset(this.currentTileset);
      }
    });

    // Pattern extraction settings - reload model when changed (overlapping only)
    const reloadOnChange = () => {
      if (this.modelType === 'overlapping' && this.currentSample) {
        this.loadCurrentSample().then(() => {
          this.refreshPatternsModalIfOpen();
        });
      }
    };
    this.ui.patternSize().addEventListener('change', reloadOnChange);
    this.ui.symmetry().addEventListener('change', reloadOnChange);
    this.ui.periodicInput().addEventListener('change', reloadOnChange);

    // Visualization toggles
    const entropyCheckbox = document.getElementById('show-entropy') as HTMLInputElement;
    entropyCheckbox?.addEventListener('change', () => {
      this.showEntropy = entropyCheckbox.checked;
      this.renderOverlay();
    });

    // Theme toggle
    document.getElementById('theme-toggle')?.addEventListener('click', () => {
      const html = document.documentElement;
      const current = html.dataset.theme;
      const next = current === 'light' ? 'dark' : 'light';
      html.dataset.theme = next;
      localStorage.setItem('theme', next);
      const btn = document.getElementById('theme-toggle')!;
      btn.textContent = next === 'light' ? '\u2600\uFE0F' : '\uD83C\uDF19';
    });

    // Patterns modal
    document.getElementById('show-patterns-btn')?.addEventListener('click', () => {
      this.showPatternsModal();
    });
    document.getElementById('close-patterns-btn')?.addEventListener('click', () => {
      this.hidePatternsModal();
    });
    document.getElementById('patterns-modal')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        this.hidePatternsModal();
      }
    });
  }

  /**
   * Show/hide UI elements based on current model type
   */
  private updateModelTypeUI(): void {
    const patternExtraction = this.ui.patternExtraction();
    const subsetSelect = this.ui.subsetSelect();
    const samplePreview = this.ui.samplePreview();
    const showPatternsBtn = document.getElementById('show-patterns-btn');

    if (this.modelType === 'simpletiled') {
      patternExtraction?.classList.add('hidden');
      samplePreview?.classList.add('hidden');
      if (showPatternsBtn) showPatternsBtn.textContent = 'Show Tiles';
    } else {
      patternExtraction?.classList.remove('hidden');
      samplePreview?.classList.remove('hidden');
      subsetSelect?.classList.add('hidden');
      if (showPatternsBtn) showPatternsBtn.textContent = 'Show Patterns';
    }
  }

  private populateSampleSelector(): void {
    const select = this.ui.sampleSelect();
    select.innerHTML = '';

    if (this.modelType === 'overlapping') {
      for (const sample of OVERLAPPING_SAMPLES) {
        const option = document.createElement('option');
        option.value = sample.name;
        option.textContent = sample.name;
        select.appendChild(option);
      }
      if (OVERLAPPING_SAMPLES.length > 0) {
        this.selectSample(OVERLAPPING_SAMPLES[0].name);
      }
    } else {
      for (const tileset of TILED_SAMPLES) {
        const option = document.createElement('option');
        option.value = tileset.name;
        option.textContent = tileset.name;
        select.appendChild(option);
      }
      if (TILED_SAMPLES.length > 0) {
        this.selectSample(TILED_SAMPLES[0].name);
      }
    }
  }

  /**
   * Select a sample/tileset and populate UI with its default values
   */
  private selectSample(name: string): void {
    if (this.modelType === 'overlapping') {
      const sample = OVERLAPPING_SAMPLES.find(s => s.name === name);
      if (!sample) {
        this.updateStatus(`Sample not found: ${name}`);
        return;
      }
      this.currentSample = sample;
      this.currentTileset = null;
      this.populateUIFromSample(sample);
      this.loadCurrentSample();
    } else {
      const tileset = TILED_SAMPLES.find(t => t.name === name);
      if (!tileset) {
        this.updateStatus(`Tileset not found: ${name}`);
        return;
      }
      this.currentTileset = tileset;
      this.currentSample = null;
      this.populateUIFromTileset(tileset);
      this.loadCurrentSample();
    }
  }

  /**
   * Populate UI controls from overlapping sample defaults
   */
  private populateUIFromSample(sample: SampleManifest): void {
    const size = sample.size ?? 48;
    this.ui.width().value = size.toString();
    this.ui.height().value = size.toString();

    this.ui.patternSize().value = sample.N.toString();
    this.ui.symmetry().value = sample.symmetry.toString();
    this.ui.periodicInput().checked = sample.periodicInput;
    this.ui.ground().checked = sample.ground;
    this.ui.periodic().checked = sample.periodic;
    this.ui.heuristic().value = sample.heuristic;

    const descEl = this.ui.sampleDescription();
    if (descEl) descEl.textContent = sample.description || '';

    // Update sample image preview
    const imgEl = this.ui.sampleImage();
    if (imgEl) {
      imgEl.onload = () => {
        const maxSize = 110;
        const scale = Math.floor(maxSize / Math.max(imgEl.naturalWidth, imgEl.naturalHeight));
        const finalScale = Math.max(1, scale);
        imgEl.style.width = `${imgEl.naturalWidth * finalScale}px`;
        imgEl.style.height = `${imgEl.naturalHeight * finalScale}px`;
      };
      imgEl.src = `${import.meta.env.BASE_URL}samples/${sample.file}`;
    }
  }

  /**
   * Populate UI controls from tileset defaults
   */
  private populateUIFromTileset(tileset: TilesetManifest): void {
    const size = tileset.size ?? 10;
    this.ui.width().value = size.toString();
    this.ui.height().value = size.toString();
    this.ui.periodic().checked = tileset.periodic ?? false;
    this.ui.heuristic().value = 'entropy';

    const descEl = this.ui.sampleDescription();
    if (descEl) descEl.textContent = tileset.description || '';

    // Populate subset selector
    const subsetSelect = this.ui.subsetSelect();
    if (tileset.subsets && tileset.subsets.length > 0) {
      subsetSelect.innerHTML = '<option value="">(All tiles)</option>';
      for (const sub of tileset.subsets) {
        const option = document.createElement('option');
        option.value = sub;
        option.textContent = sub;
        subsetSelect.appendChild(option);
      }
      subsetSelect.classList.remove('hidden');
    } else {
      subsetSelect.innerHTML = '';
      subsetSelect.classList.add('hidden');
    }
  }

  /**
   * Read parameters from UI controls
   */
  private getUIParams(): {
    width: number;
    height: number;
    patternSize: number;
    symmetry: number;
    periodic: boolean;
    periodicInput: boolean;
    ground: boolean;
    heuristic: Heuristic;
    seed: number;
  } {
    return {
      width: parseInt(this.ui.width().value),
      height: parseInt(this.ui.height().value),
      patternSize: parseInt(this.ui.patternSize().value),
      symmetry: parseInt(this.ui.symmetry().value),
      periodic: this.ui.periodic().checked,
      periodicInput: this.ui.periodicInput().checked,
      ground: this.ui.ground().checked,
      heuristic: this.ui.heuristic().value as Heuristic,
      seed: parseInt(this.ui.seed().value),
    };
  }

  /**
   * Load the currently selected sample/tileset with current UI parameters
   */
  private async loadCurrentSample(): Promise<void> {
    if (this.modelType === 'overlapping') {
      await this.loadOverlappingSample();
    } else {
      await this.loadTiledSample();
    }
  }

  private async loadOverlappingSample(): Promise<void> {
    if (!this.currentSample) return;

    const sample = this.currentSample;
    this.updateStatus(`Loading ${sample.name}...`);

    try {
      const img = await this.loadImage(`${import.meta.env.BASE_URL}samples/${sample.file}`);
      const params = this.getUIParams();

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = img.width;
      tempCanvas.height = img.height;
      const tempCtx = tempCanvas.getContext('2d')!;
      tempCtx.drawImage(img, 0, 0);
      const imageData = tempCtx.getImageData(0, 0, img.width, img.height);
      const pixels = new Uint32Array(imageData.data.buffer);

      this.model = new OverlappingModel(pixels, img.width, img.height, {
        width: params.width,
        height: params.height,
        patternSize: params.patternSize,
        periodic: params.periodic,
        periodicInput: params.periodicInput,
        symmetry: params.symmetry,
        ground: params.ground,
        heuristic: params.heuristic,
        seed: params.seed,
      });

      this.currentTilesize = 1;
      this.setupCanvases(params.width, params.height);
      this.render();
      this.renderOverlay();
      this.updateProgress();
      this.updateStatus(`Loaded ${sample.name} - ${this.model.patternCount} patterns extracted`);
    } catch (err) {
      this.updateStatus(`Error loading ${sample.name}: ${err}`);
      console.error(err);
    }
  }

  private async loadTiledSample(): Promise<void> {
    if (!this.currentTileset) return;

    const tileset = this.currentTileset;
    this.updateStatus(`Loading tileset ${tileset.name}...`);

    try {
      const params = this.getUIParams();
      const subsetName = this.ui.subsetSelect().value || undefined;

      const tilesetData = await loadTileset(
        import.meta.env.BASE_URL,
        tileset.folder,
        subsetName,
      );

      this.model = new SimpleTiledModel(
        tilesetData.tiles,
        tilesetData.tilenames,
        tilesetData.tilesize,
        tilesetData.weights,
        tilesetData.propagatorData,
        {
          width: params.width,
          height: params.height,
          periodic: params.periodic,
          heuristic: params.heuristic,
          seed: params.seed,
          blackBackground: false,
        },
      );

      this.currentTilesize = tilesetData.tilesize;
      const pixelWidth = params.width * tilesetData.tilesize;
      const pixelHeight = params.height * tilesetData.tilesize;
      this.setupCanvases(pixelWidth, pixelHeight);
      this.render();
      this.renderOverlay();
      this.updateProgress();
      this.updateStatus(`Loaded ${tileset.name} - ${this.model.patternCount} tile variants`);
    } catch (err) {
      this.updateStatus(`Error loading tileset ${tileset.name}: ${err}`);
      console.error(err);
    }
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  private setupCanvases(pixelWidth: number, pixelHeight: number): void {
    this.outputCanvas.width = pixelWidth;
    this.outputCanvas.height = pixelHeight;
    this.overlayCanvas.width = pixelWidth;
    this.overlayCanvas.height = pixelHeight;

    // Scale up for display - target ~800px for the larger dimension
    const scale = Math.min(12, Math.max(1, Math.floor(800 / Math.max(pixelWidth, pixelHeight))));
    const displayWidth = pixelWidth * scale;
    const displayHeight = pixelHeight * scale;

    this.outputCanvas.style.width = `${displayWidth}px`;
    this.outputCanvas.style.height = `${displayHeight}px`;
    this.overlayCanvas.style.width = `${displayWidth}px`;
    this.overlayCanvas.style.height = `${displayHeight}px`;
  }

  private render(): void {
    if (!this.model) return;

    const imageData = this.ctx.createImageData(this.outputCanvas.width, this.outputCanvas.height);
    const buffer = new Uint32Array(imageData.data.buffer);
    this.model.render(buffer);
    this.ctx.putImageData(imageData, 0, 0);
  }

  private renderOverlay(): void {
    if (!this.model) return;

    const width = this.overlayCanvas.width;
    const height = this.overlayCanvas.height;

    this.overlayCtx.clearRect(0, 0, width, height);
    if (!this.showEntropy) return;

    const entropyData = this.model.getEntropyData();

    let maxEntropy = 0;
    for (const cell of entropyData) {
      if (!cell.collapsed && cell.entropy > maxEntropy) {
        maxEntropy = cell.entropy;
      }
    }
    if (maxEntropy === 0) return;

    const imageData = this.overlayCtx.createImageData(width, height);
    const data = imageData.data;
    const ts = this.currentTilesize;

    // Entropy data is per grid cell; expand to pixel dimensions
    const gridWidth = Math.floor(width / ts);

    for (let gi = 0; gi < entropyData.length; gi++) {
      const cell = entropyData[gi];
      const gx = gi % gridWidth;
      const gy = Math.floor(gi / gridWidth);

      let r: number, g: number, b: number, a: number;
      if (cell.collapsed) {
        r = 0; g = 0; b = 0; a = 0;
      } else {
        const t = cell.entropy / maxEntropy;
        a = 180;

        if (t < 0.25) {
          const s = t / 0.25;
          r = 0; g = Math.floor(255 * s); b = 255;
        } else if (t < 0.5) {
          const s = (t - 0.25) / 0.25;
          r = 0; g = 255; b = Math.floor(255 * (1 - s));
        } else if (t < 0.75) {
          const s = (t - 0.5) / 0.25;
          r = Math.floor(255 * s); g = 255; b = 0;
        } else {
          const s = (t - 0.75) / 0.25;
          r = 255; g = Math.floor(255 * (1 - s)); b = 0;
        }
      }

      // Fill tilesize x tilesize pixel block
      for (let dy = 0; dy < ts; dy++) {
        for (let dx = 0; dx < ts; dx++) {
          const px = gx * ts + dx;
          const py = gy * ts + dy;
          const pixelOffset = (px + py * width) * 4;
          data[pixelOffset] = r;
          data[pixelOffset + 1] = g;
          data[pixelOffset + 2] = b;
          data[pixelOffset + 3] = a;
        }
      }
    }

    this.overlayCtx.putImageData(imageData, 0, 0);
  }

  private async play(): Promise<void> {
    if (this.isPlaying) return;

    if (!this.model) {
      await this.loadCurrentSample();
    } else {
      const state = this.model.getState();
      if (state.isComplete || state.hasContradiction) {
        await this.loadCurrentSample();
      }
    }

    if (!this.model) return;

    this.stopRequested = false;
    const animate = (document.getElementById('animate') as HTMLInputElement).checked;

    document.getElementById('play-btn')!.setAttribute('disabled', 'true');
    document.getElementById('pause-btn')!.removeAttribute('disabled');

    if (animate) {
      this.isPlaying = true;
      this.runLoop();
    } else {
      await this.runToCompletion();
    }
  }

  private async runToCompletion(): Promise<void> {
    if (!this.model) return;

    this.isPlaying = true;
    this.updateStatus('Running...');

    let result: 'continue' | 'success' | 'failure' = 'continue';
    while (result === 'continue' && !this.stopRequested) {
      for (let i = 0; i < 100 && result === 'continue'; i++) {
        result = this.model.step();
      }
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    this.isPlaying = false;
    this.render();
    this.renderOverlay();
    this.updateProgress();

    if (this.stopRequested) {
      this.updateStatus('Stopped');
    } else {
      this.updateStatus(result === 'success' ? 'Completed successfully!' : 'Contradiction - no solution found');
    }

    document.getElementById('play-btn')!.removeAttribute('disabled');
    document.getElementById('pause-btn')!.setAttribute('disabled', 'true');
  }

  private pause(): void {
    this.stopRequested = true;
    this.isPlaying = false;
    document.getElementById('pause-btn')!.setAttribute('disabled', 'true');
    document.getElementById('play-btn')!.removeAttribute('disabled');

    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  private runLoop(): void {
    if (!this.isPlaying || !this.model) return;

    const result = this.model.step();
    this.render();
    this.renderOverlay();
    this.updateProgress();

    if (result === 'continue') {
      setTimeout(() => {
        this.animationId = requestAnimationFrame(() => this.runLoop());
      }, this.stepDelay);
    } else {
      this.pause();
      this.updateStatus(result === 'success' ? 'Completed successfully!' : 'Contradiction - no solution found');
    }
  }

  private step(): void {
    if (!this.model) return;

    const result = this.model.step();
    this.render();
    this.renderOverlay();
    this.updateProgress();

    if (result !== 'continue') {
      this.updateStatus(result === 'success' ? 'Completed successfully!' : 'Contradiction - no solution found');
    }
  }

  private updateStatus(text: string): void {
    const statusEl = document.getElementById('status-text');
    if (statusEl) statusEl.textContent = text;
  }

  private updateProgress(): void {
    if (!this.model) return;

    const state = this.model.getState();
    const progressEl = document.getElementById('progress');
    if (progressEl) {
      const percent = ((state.collapsedCount / state.totalCells) * 100).toFixed(1);
      progressEl.textContent = `Collapsed: ${state.collapsedCount}/${state.totalCells} (${percent}%)`;
    }
  }

  private showPatternsModal(): void {
    if (!this.model) {
      this.updateStatus('Load a sample first to see patterns');
      return;
    }

    const modal = document.getElementById('patterns-modal');
    const grid = document.getElementById('patterns-grid');
    const countEl = document.getElementById('pattern-count');
    if (!modal || !grid || !countEl) return;

    grid.innerHTML = '';

    if (this.model instanceof OverlappingModel) {
      this.renderOverlappingPatternsGrid(grid, countEl);
    } else if (this.model instanceof SimpleTiledModel) {
      this.renderTiledPatternsGrid(grid, countEl);
    }

    modal.classList.remove('hidden');
  }

  private renderOverlappingPatternsGrid(grid: HTMLElement, countEl: HTMLElement): void {
    if (!(this.model instanceof OverlappingModel)) return;

    const { patterns, weights, colors, N } = this.model.getPatternData();
    countEl.textContent = `(${patterns.length})`;

    const scale = Math.max(1, Math.floor(64 / N));
    const size = N * scale;

    for (let i = 0; i < patterns.length; i++) {
      const pattern = patterns[i];
      const weight = weights[i];

      const cell = document.createElement('div');
      cell.className = 'pattern-cell';

      const canvas = document.createElement('canvas');
      canvas.width = N;
      canvas.height = N;
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;

      const ctx = canvas.getContext('2d')!;
      const imageData = ctx.createImageData(N, N);
      const data = imageData.data;

      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
          const colorIndex = pattern[y * N + x];
          const color = colors[colorIndex];
          const pixelOffset = (y * N + x) * 4;

          data[pixelOffset] = color & 0xff;
          data[pixelOffset + 1] = (color >> 8) & 0xff;
          data[pixelOffset + 2] = (color >> 16) & 0xff;
          data[pixelOffset + 3] = 255;
        }
      }

      ctx.putImageData(imageData, 0, 0);

      const weightLabel = document.createElement('span');
      weightLabel.className = 'pattern-weight';
      weightLabel.textContent = weight.toString();

      cell.appendChild(canvas);
      cell.appendChild(weightLabel);
      grid.appendChild(cell);
    }
  }

  private renderTiledPatternsGrid(grid: HTMLElement, countEl: HTMLElement): void {
    if (!(this.model instanceof SimpleTiledModel)) return;

    const { tiles, tilenames, weights, tilesize } = this.model.getTileData();
    countEl.textContent = `(${tiles.length})`;

    const scale = Math.max(1, Math.floor(64 / tilesize));
    const displaySize = tilesize * scale;

    for (let i = 0; i < tiles.length; i++) {
      const tile = tiles[i];
      const weight = weights[i];

      const cell = document.createElement('div');
      cell.className = 'pattern-cell';

      const canvas = document.createElement('canvas');
      canvas.width = tilesize;
      canvas.height = tilesize;
      canvas.style.width = `${displaySize}px`;
      canvas.style.height = `${displaySize}px`;

      const ctx = canvas.getContext('2d')!;
      const imageData = ctx.createImageData(tilesize, tilesize);
      const pixels = new Uint32Array(imageData.data.buffer);

      // Copy tile pixel data directly (already in ABGR format from canvas)
      for (let j = 0; j < tile.length; j++) {
        pixels[j] = tile[j];
      }

      ctx.putImageData(imageData, 0, 0);

      const label = document.createElement('span');
      label.className = 'pattern-weight';
      label.textContent = `${tilenames[i]} (${weight})`;

      cell.appendChild(canvas);
      cell.appendChild(label);
      grid.appendChild(cell);
    }
  }

  private hidePatternsModal(): void {
    const modal = document.getElementById('patterns-modal');
    if (modal) {
      modal.classList.add('hidden');
    }
  }

  private refreshPatternsModalIfOpen(): void {
    const modal = document.getElementById('patterns-modal');
    if (modal && !modal.classList.contains('hidden')) {
      this.showPatternsModal();
    }
  }

  private applyTheme(): void {
    const saved = localStorage.getItem('theme');
    const theme = saved === 'light' ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme;
    const btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.textContent = theme === 'light' ? '\u2600\uFE0F' : '\uD83C\uDF19';
    }
  }
}
