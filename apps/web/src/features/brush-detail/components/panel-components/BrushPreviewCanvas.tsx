import { createResizeObserver } from '@solid-primitives/resize-observer';
import { createEffect, createSignal, onCleanup, onMount } from 'solid-js';
import type { BrushTipImage, BrushWithPreview } from '~/lib/abr';
import type { BrushFormValues } from '../../brush-form-schema';

export interface BrushPreviewCanvasProps {
  brush: BrushWithPreview;
  values: BrushFormValues;
  /** Height of the preview in pixels */
  height?: number;
  /** Aspect ratio (width/height). If not provided, uses container width */
  aspectRatio?: number;
  backgroundColor?: string;
  brushColor?: string;
}

// Seeded random for consistent preview
function seededRandom(seed: number) {
  return () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
}

// Generate a smooth S-curve path for preview
function generatePreviewPath(width: number, height: number): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  const padding = 20;
  const amplitude = (height - padding * 2) * 0.35;
  const centerY = height / 2;

  // S-curve using cubic bezier-like sampling
  for (let t = 0; t <= 1; t += 0.005) {
    const x = padding + (width - padding * 2) * t;
    // S-curve formula
    const y = centerY + amplitude * Math.sin(t * Math.PI * 2 - Math.PI / 2) * (1 - Math.abs(t - 0.5) * 0.5);
    points.push({ x, y });
  }

  return points;
}

// Calculate distance along path for each point
function calculatePathDistances(path: { x: number; y: number }[]): number[] {
  const distances = [0];
  for (let i = 1; i < path.length; i++) {
    const dx = path[i].x - path[i - 1].x;
    const dy = path[i].y - path[i - 1].y;
    distances.push(distances[i - 1] + Math.sqrt(dx * dx + dy * dy));
  }
  return distances;
}

// Get angle of path at a point (in radians)
function getPathAngle(path: { x: number; y: number }[], index: number): number {
  const i1 = Math.max(0, index - 1);
  const i2 = Math.min(path.length - 1, index + 1);
  const dx = path[i2].x - path[i1].x;
  const dy = path[i2].y - path[i1].y;
  return Math.atan2(dy, dx);
}

// Helper to convert hex to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      }
    : { r: 255, g: 255, b: 255 };
}

// Generate computed brush tip (circular with hardness)
function generateComputedBrushTip(size: number, hardness: number): BrushTipImage {
  const width = Math.ceil(size);
  const height = Math.ceil(size);
  const data = new Uint8Array(width * height);
  const center = size / 2;
  const radius = center;
  const hardnessRadius = (hardness / 100) * radius;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - center + 0.5;
      const dy = y - center + 0.5;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= hardnessRadius) {
        data[y * width + x] = 255;
      } else if (dist <= radius) {
        const falloff = 1 - (dist - hardnessRadius) / (radius - hardnessRadius);
        data[y * width + x] = Math.round(255 * falloff);
      }
    }
  }

  return { width, height, depth: 8, data };
}

// Create a canvas from brush tip for stamping
function createBrushTipCanvas(brushTip: BrushTipImage, color: { r: number; g: number; b: number }): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = brushTip.width;
  canvas.height = brushTip.height;
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.createImageData(brushTip.width, brushTip.height);

  for (let i = 0; i < brushTip.data.length; i++) {
    const idx = i * 4;
    imageData.data[idx] = color.r;
    imageData.data[idx + 1] = color.g;
    imageData.data[idx + 2] = color.b;
    imageData.data[idx + 3] = brushTip.data[i];
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

// Draw a transformed brush stamp
function drawBrushStamp(
  ctx: CanvasRenderingContext2D,
  brushCanvas: HTMLCanvasElement,
  x: number,
  y: number,
  size: number,
  angle: number,
  roundness: number,
  flipX: boolean,
  flipY: boolean,
  opacity: number
) {
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.translate(x, y);
  ctx.rotate((angle * Math.PI) / 180);
  ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
  ctx.scale(1, roundness / 100);

  const drawSize = size;
  ctx.drawImage(brushCanvas, -drawSize / 2, -drawSize / 2, drawSize, drawSize);

  ctx.restore();
}

export function BrushPreviewCanvas(props: BrushPreviewCanvasProps) {
  let canvasRef: HTMLCanvasElement | undefined;
  let containerRef: HTMLDivElement | undefined;
  let animationFrameId: number | undefined;

  const [canvasSize, setCanvasSize] = createSignal({ width: 400, height: 100 });

  const render = () => {
    if (!canvasRef) return;

    const canvas = canvasRef;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvasSize();
    if (width <= 0 || height <= 0) return;

    const bgColor = props.backgroundColor ?? '#1a1a1a';
    const brushColor = props.brushColor ?? '#ffffff';
    const rgb = hexToRgb(brushColor);

    // Set canvas size (with device pixel ratio for sharpness)
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    // Clear background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    const values = props.values;
    const brush = props.brush;

    // Get or generate brush tip
    let brushTip: BrushTipImage;
    if (brush.brushTip) {
      brushTip = brush.brushTip;
    } else {
      // Generate computed brush tip
      brushTip = generateComputedBrushTip(100, values.hardness);
    }

    // Create cached brush tip canvas
    const brushTipCanvas = createBrushTipCanvas(brushTip, rgb);

    // Get dual brush tip if available (for dual brush feature)
    let dualBrushCanvas: HTMLCanvasElement | undefined;
    if (values.useDualBrush && brush.dualBrushTip) {
      dualBrushCanvas = createBrushTipCanvas(brush.dualBrushTip, rgb);
    }

    // Calculate actual brush size for preview (scale to fit)
    const maxBrushSize = Math.min(height * 0.8, values.diameter);
    const brushSize = Math.max(4, Math.min(maxBrushSize, values.diameter * 0.5));

    // Generate path
    const path = generatePreviewPath(width, height);
    const distances = calculatePathDistances(path);
    const totalLength = distances[distances.length - 1];

    // Calculate spacing in pixels
    const spacingPx = Math.max(1, (brushSize * values.spacing) / 100);

    // Seeded random for consistent results
    const random = seededRandom(42);

    // Shape dynamics
    const shapeDynamics = values.useShapeDynamics ? values.shapeDynamics : null;
    const scattering = values.useScattering ? values.scattering : null;
    const transfer = values.useTransfer ? values.transfer : null;

    // Stamp along path
    let currentDist = 0;
    let pathIndex = 0;

    while (currentDist < totalLength) {
      // Find path position at current distance
      while (pathIndex < distances.length - 1 && distances[pathIndex + 1] < currentDist) {
        pathIndex++;
      }

      // Interpolate position
      const t =
        pathIndex < distances.length - 1 && distances[pathIndex + 1] !== distances[pathIndex]
          ? (currentDist - distances[pathIndex]) / (distances[pathIndex + 1] - distances[pathIndex])
          : 0;

      const p1 = path[pathIndex];
      const p2 = path[Math.min(pathIndex + 1, path.length - 1)];
      let x = p1.x + (p2.x - p1.x) * t;
      let y = p1.y + (p2.y - p1.y) * t;

      // Path angle for direction-based effects
      const pathAngle = getPathAngle(path, pathIndex);

      // Apply scattering
      let scatterCount = 1;
      if (scattering) {
        scatterCount = scattering.count;
        if (scattering.countJitter > 0) {
          scatterCount = Math.max(1, Math.round(scatterCount * (1 - (random() * scattering.countJitter) / 100)));
        }
      }

      for (let s = 0; s < scatterCount; s++) {
        let stampX = x;
        let stampY = y;

        // Apply scatter offset
        if (scattering && scattering.scatter > 0) {
          const scatterAmount = (scattering.scatter / 100) * brushSize;
          const perpAngle = pathAngle + Math.PI / 2;

          if (scattering.bothAxes) {
            stampX += (random() - 0.5) * 2 * scatterAmount;
            stampY += (random() - 0.5) * 2 * scatterAmount;
          } else {
            const offset = (random() - 0.5) * 2 * scatterAmount;
            stampX += Math.cos(perpAngle) * offset;
            stampY += Math.sin(perpAngle) * offset;
          }
        }

        // Calculate stamp properties
        let stampSize = brushSize;
        let stampAngle = values.angle;
        let stampRoundness = values.roundness;
        let stampFlipX = values.flipX;
        let stampFlipY = values.flipY;
        let stampOpacity = 1;

        // Apply shape dynamics
        if (shapeDynamics) {
          // Size jitter
          if (shapeDynamics.sizeJitter > 0) {
            const minSize = (shapeDynamics.minimumDiameter / 100) * brushSize;
            const jitterRange = (shapeDynamics.sizeJitter / 100) * (brushSize - minSize);
            stampSize = Math.max(minSize, brushSize - random() * jitterRange);
          }

          // Angle jitter
          if (shapeDynamics.angleJitter > 0) {
            stampAngle += (random() - 0.5) * 2 * shapeDynamics.angleJitter;
          }

          // Roundness jitter
          if (shapeDynamics.roundnessJitter > 0) {
            const minRoundness = shapeDynamics.roundnessMinimum;
            const jitterRange = (shapeDynamics.roundnessJitter / 100) * (stampRoundness - minRoundness);
            stampRoundness = Math.max(minRoundness, stampRoundness - random() * jitterRange);
          }

          // Flip jitters
          if (shapeDynamics.flipXJitter && random() > 0.5) stampFlipX = !stampFlipX;
          if (shapeDynamics.flipYJitter && random() > 0.5) stampFlipY = !stampFlipY;
        }

        // Apply transfer (opacity)
        if (transfer) {
          if (transfer.opacityJitter > 0) {
            const minOpacity = transfer.opacityMinimum / 100;
            const jitterRange = (transfer.opacityJitter / 100) * (1 - minOpacity);
            stampOpacity = Math.max(minOpacity, 1 - random() * jitterRange);
          }
        }

        // Draw main brush stamp
        drawBrushStamp(
          ctx,
          brushTipCanvas,
          stampX,
          stampY,
          stampSize,
          stampAngle,
          stampRoundness,
          stampFlipX,
          stampFlipY,
          stampOpacity
        );

        // Draw dual brush stamp (if enabled and available)
        if (dualBrushCanvas) {
          // Dual brush typically uses multiply blend mode and different scatter
          ctx.globalCompositeOperation = 'multiply';
          const dualOffset = (random() - 0.5) * stampSize * 0.3;
          drawBrushStamp(
            ctx,
            dualBrushCanvas,
            stampX + dualOffset,
            stampY + dualOffset * 0.5,
            stampSize * 0.8,
            stampAngle + (random() - 0.5) * 30,
            stampRoundness,
            random() > 0.5,
            random() > 0.5,
            stampOpacity * 0.7
          );
          ctx.globalCompositeOperation = 'source-over';
        }
      }

      currentDist += spacingPx;
    }
  };

  // Debounced render
  const debouncedRender = () => {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
    animationFrameId = requestAnimationFrame(render);
  };

  // Use solid-primitives resize observer
  createResizeObserver(
    () => containerRef,
    ({ width, height }) => {
      const newHeight = props.height ?? 100;
      if (width > 0) {
        setCanvasSize({ width, height: newHeight });
      }
    }
  );

  onMount(() => {
    // Initial render after mount
    if (containerRef) {
      const width = containerRef.clientWidth || 400;
      setCanvasSize({ width, height: props.height ?? 100 });
    }
    render();
  });

  // Re-render when values or size change
  createEffect(() => {
    // Access reactive values to track them
    const _ = JSON.stringify(props.values);
    const __ = props.brush;
    const ___ = canvasSize();
    debouncedRender();
  });

  onCleanup(() => {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
  });

  return (
    <div ref={containerRef} class="bg-ps-bg-dark border-ps-border w-full overflow-hidden rounded border">
      <canvas ref={canvasRef} class="block" />
    </div>
  );
}
