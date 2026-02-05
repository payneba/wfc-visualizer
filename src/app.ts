import { OverlappingModel } from './core/overlapping-model';
import { OVERLAPPING_SAMPLES } from './data/sample-manifest';

export class App {
  private outputCanvas: HTMLCanvasElement;
  private overlayCanvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private overlayCtx: CanvasRenderingContext2D;

  private model: OverlappingModel | null = null;
  private isPlaying = false;
  private animationId: number | null = null;
  private stepDelay = 50;

  private showEntropy = false;

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
    document.getElementById('reset-btn')?.addEventListener('click', () => this.reset());

    // Speed control
    const speedSlider = document.getElementById('speed') as HTMLInputElement;
    speedSlider?.addEventListener('input', () => {
      this.stepDelay = 101 - parseInt(speedSlider.value);
      document.getElementById('speed-value')!.textContent = `${this.stepDelay}ms`;
    });

    // Sample selector
    document.getElementById('sample-select')?.addEventListener('change', (e) => {
      const select = e.target as HTMLSelectElement;
      this.loadSample(select.value);
    });

    // Random seed button
    document.getElementById('random-seed')?.addEventListener('click', () => {
      const seedInput = document.getElementById('seed') as HTMLInputElement;
      seedInput.value = Math.floor(Math.random() * 1000000).toString();
    });

    // Visualization toggles
    const entropyCheckbox = document.getElementById('show-entropy') as HTMLInputElement;
    entropyCheckbox?.addEventListener('change', () => {
      this.showEntropy = entropyCheckbox.checked;
      this.renderOverlay();
    });
  }

  private populateSampleSelector(): void {
    const select = document.getElementById('sample-select') as HTMLSelectElement;
    select.innerHTML = '';

    for (const sample of OVERLAPPING_SAMPLES) {
      const option = document.createElement('option');
      option.value = sample.name;
      option.textContent = sample.name;
      select.appendChild(option);
    }

    // Load first sample by default
    if (OVERLAPPING_SAMPLES.length > 0) {
      this.loadSample(OVERLAPPING_SAMPLES[0].name);
    }
  }

  private async loadSample(name: string): Promise<void> {
    const sample = OVERLAPPING_SAMPLES.find(s => s.name === name);
    if (!sample) {
      this.updateStatus(`Sample not found: ${name}`);
      return;
    }

    this.updateStatus(`Loading ${name}...`);

    try {
      // Load sample image (use BASE_URL for correct path with Vite base config)
      const img = await this.loadImage(`${import.meta.env.BASE_URL}samples/${sample.file}`);
      const width = parseInt((document.getElementById('width') as HTMLInputElement).value);
      const height = parseInt((document.getElementById('height') as HTMLInputElement).value);
      const N = parseInt((document.getElementById('pattern-size') as HTMLInputElement).value);
      const periodic = (document.getElementById('periodic') as HTMLInputElement).checked;
      const seed = parseInt((document.getElementById('seed') as HTMLInputElement).value);

      // Extract pixel data from image
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = img.width;
      tempCanvas.height = img.height;
      const tempCtx = tempCanvas.getContext('2d')!;
      tempCtx.drawImage(img, 0, 0);
      const imageData = tempCtx.getImageData(0, 0, img.width, img.height);
      const pixels = new Uint32Array(imageData.data.buffer);

      // Create model
      this.model = new OverlappingModel(
        pixels,
        img.width,
        img.height,
        {
          width,
          height,
          patternSize: N,
          periodic,
          periodicInput: true,
          symmetry: sample.symmetry ?? 8,
          ground: sample.ground ?? false,
          heuristic: 'entropy',
          seed
        }
      );

      // Setup canvases
      this.setupCanvases(width, height);
      this.render();
      this.renderOverlay();
      this.updateStatus(`Loaded ${name} - ${this.model.patternCount} patterns extracted`);
    } catch (err) {
      this.updateStatus(`Error loading ${name}: ${err}`);
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

    // Scale up for display (8x for small outputs)
    const scale = Math.min(8, Math.floor(600 / Math.max(width, height)));
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
            // Blue to cyan
            const s = t / 0.25;
            r = 0;
            g = Math.floor(255 * s);
            b = 255;
          } else if (t < 0.5) {
            // Cyan to green
            const s = (t - 0.25) / 0.25;
            r = 0;
            g = 255;
            b = Math.floor(255 * (1 - s));
          } else if (t < 0.75) {
            // Green to yellow
            const s = (t - 0.5) / 0.25;
            r = Math.floor(255 * s);
            g = 255;
            b = 0;
          } else {
            // Yellow to red
            const s = (t - 0.75) / 0.25;
            r = 255;
            g = Math.floor(255 * (1 - s));
            b = 0;
          }

          data[pixelOffset] = r;
          data[pixelOffset + 1] = g;
          data[pixelOffset + 2] = b;
          data[pixelOffset + 3] = 180; // Semi-transparent
        }
      }
    }

    this.overlayCtx.putImageData(imageData, 0, 0);
  }

  private play(): void {
    if (!this.model || this.isPlaying) return;

    this.isPlaying = true;
    document.getElementById('play-btn')!.setAttribute('disabled', 'true');
    document.getElementById('pause-btn')!.removeAttribute('disabled');

    this.runLoop();
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

  private reset(): void {
    this.pause();
    if (this.model) {
      this.model.clear();
      this.render();
      this.renderOverlay();
      this.updateProgress();
      this.updateStatus('Reset - ready to run');
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
}
