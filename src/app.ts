import { OverlappingModel } from './core/overlapping-model';
import { SampleManifest, OVERLAPPING_SAMPLES, Heuristic } from './data/sample-manifest';

export class App {
  private outputCanvas: HTMLCanvasElement;
  private overlayCanvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private overlayCtx: CanvasRenderingContext2D;

  private model: OverlappingModel | null = null;
  private currentSample: SampleManifest | null = null;
  private isPlaying = false;
  private animationId: number | null = null;
  private stepDelay = 50;

  private showEntropy = false;

  // UI element references
  private readonly ui = {
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
    sampleDescription: () => document.getElementById('sample-description') as HTMLParagraphElement,
    sampleImage: () => document.getElementById('sample-image') as HTMLImageElement,
  };

  constructor() {
    this.outputCanvas = document.getElementById('output-canvas') as HTMLCanvasElement;
    this.overlayCanvas = document.getElementById('overlay-canvas') as HTMLCanvasElement;
    this.ctx = this.outputCanvas.getContext('2d')!;
    this.overlayCtx = this.overlayCanvas.getContext('2d')!;
  }

  init(): void {
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

    // Sample selector
    this.ui.sampleSelect()?.addEventListener('change', (e) => {
      const select = e.target as HTMLSelectElement;
      this.selectSample(select.value);
    });

    // Random seed button
    document.getElementById('random-seed')?.addEventListener('click', () => {
      this.ui.seed().value = Math.floor(Math.random() * 1000000).toString();
    });

    // Reset to defaults button
    document.getElementById('reset-defaults')?.addEventListener('click', () => {
      if (this.currentSample) {
        this.populateUIFromSample(this.currentSample);
      }
    });

    // Visualization toggles
    const entropyCheckbox = document.getElementById('show-entropy') as HTMLInputElement;
    entropyCheckbox?.addEventListener('change', () => {
      this.showEntropy = entropyCheckbox.checked;
      this.renderOverlay();
    });

    // Patterns modal
    document.getElementById('show-patterns-btn')?.addEventListener('click', () => {
      this.showPatternsModal();
    });
    document.getElementById('close-patterns-btn')?.addEventListener('click', () => {
      this.hidePatternsModal();
    });
    document.getElementById('patterns-modal')?.addEventListener('click', (e) => {
      // Close when clicking outside the modal content
      if (e.target === e.currentTarget) {
        this.hidePatternsModal();
      }
    });
  }

  private populateSampleSelector(): void {
    const select = this.ui.sampleSelect();
    select.innerHTML = '';

    for (const sample of OVERLAPPING_SAMPLES) {
      const option = document.createElement('option');
      option.value = sample.name;
      option.textContent = sample.name;
      select.appendChild(option);
    }

    // Load first sample by default
    if (OVERLAPPING_SAMPLES.length > 0) {
      this.selectSample(OVERLAPPING_SAMPLES[0].name);
    }
  }

  /**
   * Select a sample and populate UI with its default values
   */
  private selectSample(name: string): void {
    const sample = OVERLAPPING_SAMPLES.find(s => s.name === name);
    if (!sample) {
      this.updateStatus(`Sample not found: ${name}`);
      return;
    }

    this.currentSample = sample;
    this.populateUIFromSample(sample);
    this.loadCurrentSample();
  }

  /**
   * Populate all UI controls from sample's default values
   */
  private populateUIFromSample(sample: SampleManifest): void {
    // Output size - use sample's suggested size or default 48
    const size = sample.size ?? 48;
    this.ui.width().value = size.toString();
    this.ui.height().value = size.toString();

    // Pattern extraction settings
    this.ui.patternSize().value = sample.N.toString();
    this.ui.symmetry().value = sample.symmetry.toString();
    this.ui.periodicInput().checked = sample.periodicInput;
    this.ui.ground().checked = sample.ground;

    // Output settings
    this.ui.periodic().checked = sample.periodic;

    // Algorithm settings
    this.ui.heuristic().value = sample.heuristic;

    // Update description
    const descEl = this.ui.sampleDescription();
    if (descEl) {
      descEl.textContent = sample.description || '';
    }

    // Update sample image preview
    const imgEl = this.ui.sampleImage();
    if (imgEl) {
      imgEl.onload = () => {
        // Scale image to fit preview area (120px) with pixel replication
        const maxSize = 110;
        const scale = Math.floor(maxSize / Math.max(imgEl.naturalWidth, imgEl.naturalHeight));
        const finalScale = Math.max(1, scale); // At least 1x
        imgEl.style.width = `${imgEl.naturalWidth * finalScale}px`;
        imgEl.style.height = `${imgEl.naturalHeight * finalScale}px`;
      };
      imgEl.src = `${import.meta.env.BASE_URL}samples/${sample.file}`;
    }
  }

  /**
   * Read all parameters from UI controls
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
   * Load the currently selected sample with current UI parameters
   */
  private async loadCurrentSample(): Promise<void> {
    if (!this.currentSample) return;

    const sample = this.currentSample;
    this.updateStatus(`Loading ${sample.name}...`);

    try {
      // Load sample image
      const img = await this.loadImage(`${import.meta.env.BASE_URL}samples/${sample.file}`);

      // Get parameters from UI
      const params = this.getUIParams();

      // Extract pixel data from image
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = img.width;
      tempCanvas.height = img.height;
      const tempCtx = tempCanvas.getContext('2d')!;
      tempCtx.drawImage(img, 0, 0);
      const imageData = tempCtx.getImageData(0, 0, img.width, img.height);
      const pixels = new Uint32Array(imageData.data.buffer);

      // Create model with all parameters from UI
      this.model = new OverlappingModel(
        pixels,
        img.width,
        img.height,
        {
          width: params.width,
          height: params.height,
          patternSize: params.patternSize,
          periodic: params.periodic,
          periodicInput: params.periodicInput,
          symmetry: params.symmetry,
          ground: params.ground,
          heuristic: params.heuristic,
          seed: params.seed,
        }
      );

      // Setup canvases
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

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  private setupCanvases(width: number, height: number): void {
    // Set internal resolution
    this.outputCanvas.width = width;
    this.outputCanvas.height = height;
    this.overlayCanvas.width = width;
    this.overlayCanvas.height = height;

    // Scale up for display - target ~800px for the larger dimension
    const scale = Math.min(12, Math.floor(800 / Math.max(width, height)));
    const displayWidth = width * scale;
    const displayHeight = height * scale;

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

    // Clear overlay
    this.overlayCtx.clearRect(0, 0, width, height);

    if (!this.showEntropy) return;

    // Get entropy data
    const entropyData = this.model.getEntropyData();

    // Find max entropy for normalization (skip collapsed cells)
    let maxEntropy = 0;
    for (const cell of entropyData) {
      if (!cell.collapsed && cell.entropy > maxEntropy) {
        maxEntropy = cell.entropy;
      }
    }

    if (maxEntropy === 0) return; // All collapsed

    // Create overlay image data
    const imageData = this.overlayCtx.createImageData(width, height);
    const data = imageData.data;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = x + y * width;
        const cell = entropyData[i];
        const pixelOffset = i * 4;

        if (cell.collapsed) {
          // Collapsed cells are transparent
          data[pixelOffset] = 0;
          data[pixelOffset + 1] = 0;
          data[pixelOffset + 2] = 0;
          data[pixelOffset + 3] = 0;
        } else {
          // Map entropy to color: low entropy = blue (cool), high entropy = red (hot)
          const t = cell.entropy / maxEntropy;

          // Color gradient: blue -> cyan -> green -> yellow -> red
          let r: number, g: number, b: number;
          if (t < 0.25) {
            const s = t / 0.25;
            r = 0;
            g = Math.floor(255 * s);
            b = 255;
          } else if (t < 0.5) {
            const s = (t - 0.25) / 0.25;
            r = 0;
            g = 255;
            b = Math.floor(255 * (1 - s));
          } else if (t < 0.75) {
            const s = (t - 0.5) / 0.25;
            r = Math.floor(255 * s);
            g = 255;
            b = 0;
          } else {
            const s = (t - 0.75) / 0.25;
            r = 255;
            g = Math.floor(255 * (1 - s));
            b = 0;
          }

          data[pixelOffset] = r;
          data[pixelOffset + 1] = g;
          data[pixelOffset + 2] = b;
          data[pixelOffset + 3] = 180;
        }
      }
    }

    this.overlayCtx.putImageData(imageData, 0, 0);
  }

  private async play(): Promise<void> {
    if (this.isPlaying) return;

    // Check if model needs to be reset (finished or no model yet)
    if (!this.model) {
      await this.loadCurrentSample();
    } else {
      const state = this.model.getState();
      if (state.isComplete || state.hasContradiction) {
        // Previous run finished - start fresh
        await this.loadCurrentSample();
      }
      // Otherwise resume from paused state
    }

    if (!this.model) return;

    const animate = (document.getElementById('animate') as HTMLInputElement).checked;

    if (animate) {
      // Animated mode - show step by step
      this.isPlaying = true;
      document.getElementById('play-btn')!.setAttribute('disabled', 'true');
      document.getElementById('pause-btn')!.removeAttribute('disabled');
      this.runLoop();
    } else {
      // Instant mode - run to completion
      this.runToCompletion();
    }
  }

  private runToCompletion(): void {
    if (!this.model) return;

    this.updateStatus('Running...');

    // Run all steps synchronously
    let result: 'continue' | 'success' | 'failure' = 'continue';
    while (result === 'continue') {
      result = this.model.step();
    }

    this.render();
    this.renderOverlay();
    this.updateProgress();
    this.updateStatus(result === 'success' ? 'Completed successfully!' : 'Contradiction - no solution found');
  }

  private pause(): void {
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

    // Get pattern data from model
    const { patterns, weights, colors, N } = this.model.getPatternData();

    // Update count
    countEl.textContent = `(${patterns.length})`;

    // Clear grid
    grid.innerHTML = '';

    // Render each pattern
    const scale = Math.max(1, Math.floor(32 / N)); // Scale to ~32px
    const size = N * scale;

    for (let i = 0; i < patterns.length; i++) {
      const pattern = patterns[i];
      const weight = weights[i];

      // Create container
      const cell = document.createElement('div');
      cell.className = 'pattern-cell';

      // Create canvas for pattern
      const canvas = document.createElement('canvas');
      canvas.width = N;
      canvas.height = N;
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;

      const ctx = canvas.getContext('2d')!;
      const imageData = ctx.createImageData(N, N);
      const data = imageData.data;

      // Fill pattern pixels
      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
          const colorIndex = pattern[y * N + x];
          const color = colors[colorIndex];
          const pixelOffset = (y * N + x) * 4;

          data[pixelOffset] = color & 0xff;           // R
          data[pixelOffset + 1] = (color >> 8) & 0xff;  // G
          data[pixelOffset + 2] = (color >> 16) & 0xff; // B
          data[pixelOffset + 3] = 255;                  // A
        }
      }

      ctx.putImageData(imageData, 0, 0);

      // Add weight label
      const weightLabel = document.createElement('span');
      weightLabel.className = 'pattern-weight';
      weightLabel.textContent = weight.toString();

      cell.appendChild(canvas);
      cell.appendChild(weightLabel);
      grid.appendChild(cell);
    }

    // Show modal
    modal.classList.remove('hidden');
  }

  private hidePatternsModal(): void {
    const modal = document.getElementById('patterns-modal');
    if (modal) {
      modal.classList.add('hidden');
    }
  }
}
