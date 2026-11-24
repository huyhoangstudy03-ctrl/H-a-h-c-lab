import React, { useEffect, useRef, useState } from 'react';
import {
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  Shield,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type {
  AnalyzedElectrolysisCell,
  AnalyzedElectrolyte,
  DissociationCalculation,
  ElectrolysisCalculation,
} from '../utils/chemistryEngine';

interface ElectrolysisDissociationCanvasProps {
  activeTab: 'electrolysis' | 'dissociation';
  activeCell: AnalyzedElectrolysisCell;
  currentAmp: number;
  durationSec: number;
  electrolysisResult: ElectrolysisCalculation;
  activeElectrolyte: AnalyzedElectrolyte;
  phResult: DissociationCalculation;
  molarity: number;
  hasMembrane?: boolean;
  onToggleMembrane?: () => void;
}

interface IonParticle {
  seedX: number;
  seedY: number;
  isCation: boolean;
  phase: number;
  speedFactor: number;
}

interface MoleculePair {
  cx: number;
  cy: number;
  angle: number;
  phase: number;
}

interface BubbleParticle {
  offset: number;
  speed: number;
  radius: number;
  phase: number;
  wobble: number;
}

interface DischargeSpark {
  isCatot: boolean;
  yFrac: number;
  bornAt: number;
  color: string;
}

function cubicPoint(
  p0x: number,
  p0y: number,
  p1x: number,
  p1y: number,
  p2x: number,
  p2y: number,
  p3x: number,
  p3y: number,
  t: number,
): [number, number] {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;
  return [
    uuu * p0x + 3 * uu * t * p1x + 3 * u * tt * p2x + ttt * p3x,
    uuu * p0y + 3 * uu * t * p1y + 3 * u * tt * p2y + ttt * p3y,
  ];
}

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export const ElectrolysisDissociationCanvas: React.FC<ElectrolysisDissociationCanvasProps> = ({
  activeTab,
  activeCell,
  currentAmp,
  durationSec,
  electrolysisResult,
  activeElectrolyte,
  phResult,
  molarity,
  hasMembrane = false,
  onToggleMembrane,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState<0.5 | 1 | 2>(1);
  const [showOverlayGuides, setShowOverlayGuides] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [resetEpoch, setResetEpoch] = useState(0);

  const dragStateRef = useRef<{ active: boolean; startX: number; startY: number; origX: number; origY: number }>({
    active: false,
    startX: 0,
    startY: 0,
    origX: 0,
    origY: 0,
  });

  const simTimeRef = useRef(0);
  const redrawRef = useRef<(() => void) | null>(null);
  const stateRef = useRef({
    activeTab,
    activeCell,
    currentAmp,
    durationSec,
    electrolysisResult,
    activeElectrolyte,
    phResult,
    molarity,
    isPlaying,
    speed,
    showOverlayGuides,
    zoomLevel,
    panOffset,
  });
  stateRef.current = {
    activeTab,
    activeCell,
    currentAmp,
    durationSec,
    electrolysisResult,
    activeElectrolyte,
    phResult,
    molarity,
    isPlaying,
    speed,
    showOverlayGuides,
    zoomLevel,
    panOffset,
  };

  useEffect(() => {
    if (!isExpanded) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsExpanded(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isExpanded]);

  useEffect(() => {
    simTimeRef.current = 0;
  }, [activeTab, activeCell.id, activeCell.hasMembrane, activeElectrolyte.formula, resetEpoch]);

  useEffect(() => {
    redrawRef.current?.();
  }, [
    activeTab,
    activeCell,
    currentAmp,
    durationSec,
    electrolysisResult,
    activeElectrolyte,
    phResult,
    molarity,
    isPlaying,
    speed,
    showOverlayGuides,
    isExpanded,
    zoomLevel,
    panOffset,
    resetEpoch,
  ]);

  const adjustZoom = (delta: number) => {
    setZoomLevel((prev) => {
      const next = Math.min(2.0, Math.max(0.85, Number((prev + delta).toFixed(2))));
      if (next <= 1) setPanOffset({ x: 0, y: 0 });
      return next;
    });
  };

  const resetViewAndSim = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
    setResetEpoch((e) => e + 1);
  };

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const sphereCache = new Map<string, HTMLCanvasElement>();
    const getSphereSprite = (r: number, baseHex: string, haloRgba: string): HTMLCanvasElement => {
      const key = `${r}|${baseHex}|${haloRgba}`;
      const existing = sphereCache.get(key);
      if (existing) return existing;

      const pad = haloRgba ? Math.ceil(r * 1.35) : 4;
      const size = Math.ceil((r + pad) * 2);
      const off = document.createElement('canvas');
      off.width = size * 2;
      off.height = size * 2;
      const octx = off.getContext('2d');
      if (octx) {
        octx.scale(2, 2);
        const cx = size / 2;
        const cy = size / 2;

        if (haloRgba) {
          const halo = octx.createRadialGradient(cx, cy, r * 0.35, cx, cy, r * 2.05);
          halo.addColorStop(0, haloRgba);
          halo.addColorStop(1, 'rgba(0,0,0,0)');
          octx.fillStyle = halo;
          octx.beginPath();
          octx.arc(cx, cy, r * 2.05, 0, Math.PI * 2);
          octx.fill();
        }

        const grad = octx.createRadialGradient(cx - r * 0.32, cy - r * 0.34, r * 0.1, cx, cy, r);
        grad.addColorStop(0, '#FFFFFF');
        grad.addColorStop(0.28, baseHex);
        grad.addColorStop(0.88, baseHex);
        grad.addColorStop(1, '#090D16');

        octx.fillStyle = grad;
        octx.beginPath();
        octx.arc(cx, cy, r, 0, Math.PI * 2);
        octx.fill();

        octx.strokeStyle = 'rgba(255,255,255,0.42)';
        octx.lineWidth = 0.9;
        octx.stroke();
      }
      sphereCache.set(key, off);
      return off;
    };

    const drawCachedSphere = (
      x: number,
      y: number,
      r: number,
      baseHex: string,
      haloRgba: string,
    ) => {
      const sprite = getSphereSprite(r, baseHex, haloRgba);
      const logicalSize = sprite.width / 2;
      ctx.drawImage(sprite, x - logicalSize / 2, y - logicalSize / 2, logicalSize, logicalSize);
    };

    const pulseCache = new Map<string, HTMLCanvasElement>();
    const getPulseSprite = (r: number, innerColor: string, outerRgba: string): HTMLCanvasElement => {
      const key = `${r}|${innerColor}|${outerRgba}`;
      const existing = pulseCache.get(key);
      if (existing) return existing;
      const size = Math.ceil(r * 2.4);
      const off = document.createElement('canvas');
      off.width = size * 2;
      off.height = size * 2;
      const octx = off.getContext('2d');
      if (octx) {
        octx.scale(2, 2);
        const c = size / 2;
        const g = octx.createRadialGradient(c, c, 1, c, c, r);
        g.addColorStop(0, outerRgba);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        octx.fillStyle = g;
        octx.beginPath();
        octx.arc(c, c, r, 0, Math.PI * 2);
        octx.fill();

        octx.fillStyle = innerColor;
        octx.beginPath();
        octx.arc(c, c, Math.max(2.6, r * 0.34), 0, Math.PI * 2);
        octx.fill();
      }
      pulseCache.set(key, off);
      return off;
    };

    let logicalW = 780;
    let logicalH = 480;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      logicalW = Math.max(360, Math.round(rect.width || 780));
      logicalH = Math.max(340, Math.round(rect.height || 480));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(logicalW * dpr);
      canvas.height = Math.round(logicalH * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      redrawRef.current?.();
    };
    updateSize();

    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);

    const ionParticles: IonParticle[] = Array.from({ length: 16 }, (_, i) => ({
      seedX: (i * 0.173) % 1,
      seedY: (i * 0.271) % 1,
      isCation: i % 2 === 0,
      phase: i * 0.72,
      speedFactor: 0.8 + ((i * 7) % 5) * 0.11,
    }));

    const bubblesLeft: BubbleParticle[] = Array.from({ length: 14 }, (_, i) => ({
      offset: ((i * 19) % 22) - 11,
      speed: 56 + ((i * 13) % 28),
      radius: 2.1 + (i % 4) * 1.05,
      phase: i * 0.55,
      wobble: 3.5 + (i % 3) * 2.2,
    }));

    const bubblesRight: BubbleParticle[] = Array.from({ length: 16 }, (_, i) => ({
      offset: ((i * 23) % 22) - 11,
      speed: 60 + ((i * 17) % 30),
      radius: 2.2 + (i % 4) * 1.1,
      phase: i * 0.61,
      wobble: 4 + (i % 3) * 2.2,
    }));

    const moleculePairs: MoleculePair[] = Array.from({ length: 12 }, (_, i) => ({
      cx: 0.14 + ((i * 0.21 + 0.05) % 0.72),
      cy: 0.16 + ((i * 0.29 + 0.08) % 0.68),
      angle: i * 0.8,
      phase: i * 0.9,
    }));

    const sparks: DischargeSpark[] = [];
    let lastSparkTime = 0;

    let animId = 0;
    let lastFrameMs = performance.now();

    const drawFrame = (nowMs: number) => {
      const dt = Math.min(0.05, Math.max(0, (nowMs - lastFrameMs) / 1000));
      lastFrameMs = nowMs;

      const s = stateRef.current;
      if (s.isPlaying && !prefersReducedMotion) {
        simTimeRef.current += dt * s.speed;
      }
      const t = simTimeRef.current;

      const W = logicalW;
      const H = logicalH;

      ctx.clearRect(0, 0, W, H);

      // Deep calibrated obsidian laboratory canvas
      const bgGrad = ctx.createRadialGradient(W * 0.5, H * 0.45, 20, W * 0.5, H * 0.5, W * 0.78);
      bgGrad.addColorStop(0, '#0E1930');
      bgGrad.addColorStop(0.65, '#081020');
      bgGrad.addColorStop(1, '#050914');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // Hairline instrument blueprint grid
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.045)';
      ctx.lineWidth = 1;
      for (let gx = 40; gx < W; gx += 40) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, H);
        ctx.stroke();
      }
      for (let gy = 40; gy < H; gy += 40) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(W, gy);
        ctx.stroke();
      }

      // Apply user zoom & pan around viewport center
      ctx.save();
      ctx.translate(W / 2 + s.panOffset.x, H / 2 + s.panOffset.y);
      ctx.scale(s.zoomLevel, s.zoomLevel);
      ctx.translate(-W / 2, -H / 2);

      if (s.activeTab === 'electrolysis') {
        const cell = s.activeCell;
        const calc = s.electrolysisResult;
        const isMolten = cell.modeType === 'molten';
        const isPlating = cell.modeType === 'electroplating';
        const hasMembrane = cell.modeType === 'aqueous' && Boolean(cell.hasMembrane);
        const progressNorm = Math.min(1, (s.currentAmp * s.durationSec) / 28000);
        const animatedGrowth = Math.min(1, progressNorm * Math.min(1, 0.25 + t * 0.15));

        const hasSidePanels = W >= 620;
        const vesselW = hasSidePanels ? Math.min(W * 0.52, 460) : Math.min(W * 0.78, 420);
        const vesselX = (W - vesselW) / 2;
        const vesselTop = Math.max(124, H * 0.27);
        const vesselH = isMolten ? H * 0.48 : H * 0.57;
        const vesselBottom = vesselTop + vesselH;
        const liqTop = vesselTop + 26;

        const catCenterX = vesselX + vesselW * 0.185;
        const anoCenterX = vesselX + vesselW * 0.815;
        const elecTop = vesselTop - 6;
        const elecBottom = vesselBottom - 18;

        // Ambient electrode glow
        if (s.currentAmp > 0) {
          const catGlow = ctx.createRadialGradient(
            catCenterX,
            (liqTop + elecBottom) / 2,
            8,
            catCenterX,
            (liqTop + elecBottom) / 2,
            96,
          );
          catGlow.addColorStop(0, 'rgba(56, 189, 248, 0.16)');
          catGlow.addColorStop(1, 'rgba(56, 189, 248, 0)');
          ctx.fillStyle = catGlow;
          ctx.fillRect(vesselX, vesselTop, vesselW * 0.5, vesselH);

          const anoGlow = ctx.createRadialGradient(
            anoCenterX,
            (liqTop + elecBottom) / 2,
            8,
            anoCenterX,
            (liqTop + elecBottom) / 2,
            96,
          );
          anoGlow.addColorStop(0, isMolten ? 'rgba(251, 146, 60, 0.18)' : 'rgba(251, 191, 36, 0.14)');
          anoGlow.addColorStop(1, 'rgba(251, 191, 36, 0)');
          ctx.fillStyle = anoGlow;
          ctx.fillRect(vesselX + vesselW * 0.5, vesselTop, vesselW * 0.5, vesselH);
        }

        // --- 1. Compact Benchtop DC Power Supply (Top Center) ---
        const psuW = Math.min(254, W * 0.40);
        const psuH = 54;
        const psuX = W / 2 - psuW / 2;
        const psuY = 12;

        // --- 2. Outward-Routed Cables (Never cross behind PSU or labels!) ---
        const leftOutX = Math.min(psuX - 54, catCenterX - 46);
        const rightOutX = Math.max(psuX + psuW + 54, anoCenterX + 46);
        const leftPlugX = psuX - 4;
        const leftPlugY = psuY + 27;
        const rightPlugX = psuX + psuW + 4;
        const rightPlugY = psuY + 27;

        // Left cable: PSU(-) -> Outward Left Arch -> straight down into Catot clamp
        ctx.strokeStyle = '#0F172A';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(leftPlugX, leftPlugY);
        ctx.bezierCurveTo(leftOutX, leftPlugY, catCenterX - 18, elecTop - 30, catCenterX, elecTop);
        ctx.stroke();
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Right cable: Anot(+) -> Outward Right Arch -> PSU(+)
        ctx.strokeStyle = '#0F172A';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(anoCenterX, elecTop);
        ctx.bezierCurveTo(anoCenterX + 18, elecTop - 30, rightOutX, rightPlugY, rightPlugX, rightPlugY);
        ctx.stroke();
        ctx.strokeStyle = '#FBBF24';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Draw PSU Housing on top of plug stems
        const psuGrad = ctx.createLinearGradient(psuX, psuY, psuX, psuY + psuH);
        psuGrad.addColorStop(0, '#16233B');
        psuGrad.addColorStop(1, '#0B1324');
        ctx.fillStyle = psuGrad;
        ctx.strokeStyle = s.currentAmp > 0 ? '#38BDF8' : '#475569';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.roundRect(psuX, psuY, psuW, psuH, 10);
        ctx.fill();
        ctx.stroke();

        // Molded side banana-jack plugs
        ctx.fillStyle = '#0284C7';
        ctx.beginPath();
        ctx.roundRect(psuX - 8, leftPlugY - 5, 10, 10, 3);
        ctx.fill();
        ctx.fillStyle = '#F59E0B';
        ctx.beginPath();
        ctx.roundRect(psuX + psuW - 2, rightPlugY - 5, 10, 10, 3);
        ctx.fill();

        // Analog Ammeter Arc Gauge
        const gaugeCx = psuX + 30;
        const gaugeCy = psuY + 30;
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(gaugeCx, gaugeCy, 14, Math.PI * 0.85, Math.PI * 2.15);
        ctx.stroke();

        const ampRatio = Math.min(1, s.currentAmp / 25);
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(gaugeCx, gaugeCy, 14, Math.PI * 0.85, Math.PI * (0.85 + ampRatio * 1.3));
        ctx.stroke();

        const needleAngle = Math.PI * (0.85 + ampRatio * 1.3);
        ctx.strokeStyle = '#F8FAFC';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(gaugeCx, gaugeCy);
        ctx.lineTo(gaugeCx + Math.cos(needleAngle) * 11, gaugeCy + Math.sin(needleAngle) * 11);
        ctx.stroke();

        ctx.fillStyle = '#94A3B8';
        ctx.font = '700 7px "IBM Plex Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('AMPE', gaugeCx, gaugeCy + 13);

        // Digital Readout in PSU
        ctx.textAlign = 'left';
        ctx.fillStyle = '#F8FAFC';
        ctx.font = '700 12px "IBM Plex Mono", monospace';
        ctx.fillText(
          `DC ${s.currentAmp.toFixed(1)} A · ${calc.chargeCoulombs.toFixed(0)} C`,
          psuX + 54,
          psuY + 24,
        );
        ctx.fillStyle = isMolten ? '#FDBA74' : isPlating ? '#34D399' : '#38BDF8';
        ctx.font = '600 9.5px "IBM Plex Mono", monospace';
        ctx.fillText(
          isMolten
            ? 'ĐIỆN PHÂN NÓNG CHẢY'
            : isPlating
              ? 'MẠ ĐIỆN ANOT TAN'
              : hasMembrane
                ? 'ĐP DUNG DỊCH · CÓ MÀNG NGĂN'
                : 'ĐP DUNG DỊCH',
          psuX + 54,
          psuY + 41,
        );

        // Flowing electron pulses (Anot -> PSU -> Catot) strictly along unobstructed cable path
        if (s.currentAmp > 0) {
          const pulseN = Math.max(4, Math.min(9, Math.round(s.currentAmp * 0.4 + 3)));
          const rate = 0.28 + s.currentAmp * 0.025;
          const ePulse = getPulseSprite(8, '#E0F2FE', 'rgba(56, 189, 248, 0.9)');
          const pulseSize = ePulse.width / 2;
          for (let i = 0; i < pulseN; i++) {
            const p = (t * rate + i / pulseN) % 1;
            let ex = 0;
            let ey = 0;
            if (p < 0.5) {
              [ex, ey] = cubicPoint(
                anoCenterX, elecTop,
                anoCenterX + 18, elecTop - 30,
                rightOutX, rightPlugY,
                rightPlugX, rightPlugY,
                p * 2,
              );
            } else {
              [ex, ey] = cubicPoint(
                leftPlugX, leftPlugY,
                leftOutX, leftPlugY,
                catCenterX - 18, elecTop - 30,
                catCenterX, elecTop,
                (p - 0.5) * 2,
              );
            }
            ctx.drawImage(ePulse, ex - pulseSize / 2, ey - pulseSize / 2, pulseSize, pulseSize);
          }
        }

        // --- 3. Furnace Coils in Molten Mode ---
        if (isMolten) {
          const baseW = vesselW + 20;
          const baseX = vesselX - 10;
          const baseY = vesselBottom + 8;

          ctx.fillStyle = '#1E293B';
          ctx.strokeStyle = '#F97316';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.roundRect(baseX, baseY, baseW, 28, 8);
          ctx.fill();
          ctx.stroke();

          const coilCount = 7;
          const step = (baseW - 30) / coilCount;
          for (let c = 0; c < coilCount; c++) {
            const cx = baseX + 18 + c * step;
            const pulse = 0.65 + 0.35 * Math.sin(t * 5 + c * 0.9);
            ctx.fillStyle = `rgba(251, 146, 60, ${0.22 * pulse})`;
            ctx.beginPath();
            ctx.roundRect(cx - 4, baseY + 3, Math.max(20, step - 4), 22, 8);
            ctx.fill();

            ctx.fillStyle = `rgba(253, 186, 116, ${0.72 + 0.28 * pulse})`;
            ctx.beginPath();
            ctx.roundRect(cx, baseY + 8, Math.max(14, step - 12), 11, 5);
            ctx.fill();
          }

          ctx.fillStyle = '#FDBA74';
          ctx.font = '600 11px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('Lò nung nóng chảy cao tần (800°C – 1000°C)', W / 2, baseY + 48);
        }

        // --- 4. Borosilicate Glass Vessel & Electrolyte Liquid ---
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(vesselX + 3, liqTop - 6, vesselW - 6, vesselBottom - liqTop + 3, [0, 0, 16, 16]);
        ctx.clip();

        const liqGrad = ctx.createLinearGradient(0, liqTop, 0, vesselBottom);
        if (isMolten) {
          liqGrad.addColorStop(0, 'rgba(251, 146, 60, 0.65)');
          liqGrad.addColorStop(0.5, 'rgba(234, 88, 12, 0.78)');
          liqGrad.addColorStop(1, 'rgba(154, 52, 18, 0.92)');
        } else {
          liqGrad.addColorStop(0, cell.solutionColor + '55');
          liqGrad.addColorStop(1, cell.solutionColor + 'BB');
        }
        ctx.fillStyle = liqGrad;

        ctx.beginPath();
        ctx.moveTo(vesselX, vesselBottom);
        for (let wx = vesselX; wx <= vesselX + vesselW; wx += 10) {
          const wave =
            Math.sin(wx * 0.032 + t * 2.2) * 2 +
            Math.cos(wx * 0.018 - t * 1.6) * 1.2;
          ctx.lineTo(wx, liqTop + wave);
        }
        ctx.lineTo(vesselX + vesselW, vesselBottom);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = isMolten ? 'rgba(254, 215, 170, 0.9)' : 'rgba(186, 230, 253, 0.78)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let wx = vesselX + 3; wx <= vesselX + vesselW - 3; wx += 8) {
          const wave =
            Math.sin(wx * 0.032 + t * 2.2) * 2 +
            Math.cos(wx * 0.018 - t * 1.6) * 1.2;
          if (wx === vesselX + 3) ctx.moveTo(wx, liqTop + wave);
          else ctx.lineTo(wx, liqTop + wave);
        }
        ctx.stroke();

        // Electric Field Lines with directional arrows
        if (s.showOverlayGuides && s.currentAmp > 0) {
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.18)';
          ctx.fillStyle = 'rgba(148, 163, 184, 0.28)';
          ctx.lineWidth = 1;
          ctx.setLineDash([6, 6]);
          ctx.lineDashOffset = t * 22;
          for (let row = 0; row < 4; row++) {
            const fy = liqTop + 34 + row * ((elecBottom - liqTop - 52) / 3);
            ctx.beginPath();
            ctx.moveTo(anoCenterX - 24, fy);
            ctx.lineTo(catCenterX + 24, fy);
            ctx.stroke();

            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.moveTo(catCenterX + 24, fy);
            ctx.lineTo(catCenterX + 30, fy - 3);
            ctx.lineTo(catCenterX + 30, fy + 3);
            ctx.closePath();
            ctx.fill();
            ctx.setLineDash([6, 6]);
          }
          ctx.setLineDash([]);
        }
        ctx.restore();

        // --- 5. Porous Membrane Divider (when hasMembrane is active) ---
        const midX = vesselX + vesselW / 2;
        if (hasMembrane) {
          ctx.save();
          ctx.fillStyle = 'rgba(186, 230, 253, 0.12)';
          ctx.fillRect(midX - 5, vesselTop + 6, 10, vesselBottom - vesselTop - 10);

          ctx.strokeStyle = 'rgba(125, 211, 252, 0.72)';
          ctx.lineWidth = 2;
          ctx.setLineDash([7, 5]);
          ctx.beginPath();
          ctx.moveTo(midX, vesselTop + 6);
          ctx.lineTo(midX, vesselBottom - 4);
          ctx.stroke();
          ctx.setLineDash([]);

          // Micro-pores glow dots along membrane
          ctx.fillStyle = 'rgba(186, 230, 253, 0.55)';
          for (let py = liqTop + 14; py < vesselBottom - 16; py += 20) {
            ctx.beginPath();
            ctx.arc(midX, py, 1.8, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }

        // --- 6. Electrodes (Catot & Anot) ---
        const barW = 26;
        const catGrad = ctx.createLinearGradient(catCenterX - barW / 2, 0, catCenterX + barW / 2, 0);
        catGrad.addColorStop(0, '#334155');
        catGrad.addColorStop(0.4, '#64748B');
        catGrad.addColorStop(1, '#1E293B');
        ctx.fillStyle = catGrad;
        ctx.beginPath();
        ctx.roundRect(catCenterX - barW / 2, elecTop + 10, barW, elecBottom - elecTop - 10, 4);
        ctx.fill();

        if (!cell.cathodeIsGas && s.currentAmp > 0) {
          const coatExtra = isPlating ? 4 + animatedGrowth * 12 : 4 + animatedGrowth * 8;
          const coatGrad = ctx.createLinearGradient(
            catCenterX - barW / 2 - coatExtra * 0.5,
            0,
            catCenterX + barW / 2 + coatExtra * 0.5,
            0,
          );
          coatGrad.addColorStop(0, cell.cathodeColor);
          coatGrad.addColorStop(0.35, '#FFFFFFAA');
          coatGrad.addColorStop(0.7, cell.cathodeColor);
          coatGrad.addColorStop(1, '#0F172A99');
          ctx.fillStyle = coatGrad;
          ctx.beginPath();
          ctx.roundRect(
            catCenterX - barW / 2 - coatExtra * 0.5,
            liqTop + 6,
            barW + coatExtra,
            elecBottom - liqTop - 6,
            5,
          );
          ctx.fill();
        }

        // Catot terminal clamp
        ctx.fillStyle = '#0284C7';
        ctx.beginPath();
        ctx.roundRect(catCenterX - 17, elecTop, 34, 13, 4);
        ctx.fill();

        // Anot bar
        const anoShrink = cell.anodeDissolves ? animatedGrowth * 10 : 0;
        const anoW = Math.max(12, barW - anoShrink);
        const anoGrad = ctx.createLinearGradient(anoCenterX - anoW / 2, 0, anoCenterX + anoW / 2, 0);
        if (cell.anodeDissolves) {
          anoGrad.addColorStop(0, cell.cathodeColor);
          anoGrad.addColorStop(0.4, '#FFFFFF88');
          anoGrad.addColorStop(1, cell.cathodeColor);
        } else {
          anoGrad.addColorStop(0, '#334155');
          anoGrad.addColorStop(0.4, '#64748B');
          anoGrad.addColorStop(1, '#1E293B');
        }
        ctx.fillStyle = anoGrad;
        ctx.beginPath();
        ctx.roundRect(anoCenterX - anoW / 2, elecTop + 10, anoW, elecBottom - elecTop - 10, 4);
        ctx.fill();

        // Anot terminal clamp
        ctx.fillStyle = '#D97706';
        ctx.beginPath();
        ctx.roundRect(anoCenterX - 17, elecTop, 34, 13, 4);
        ctx.fill();

        // --- 7. Gas Bubbles & Halogen Plumes ---
        const gasRange = Math.max(40, elecBottom - liqTop - 16);
        if (cell.cathodeIsGas && s.currentAmp > 0) {
          bubblesLeft.forEach((b) => {
            const prog = ((t * b.speed * (0.6 + s.currentAmp * 0.04) + b.phase * 40) % gasRange) / gasRange;
            const by = elecBottom - 6 - prog * gasRange;
            const bx = catCenterX + b.offset + Math.sin(t * 4.2 + b.phase) * b.wobble;
            const r = b.radius * (0.7 + prog * 0.55);

            ctx.fillStyle = 'rgba(226, 232, 240, 0.72)';
            ctx.beginPath();
            ctx.arc(bx, by, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.beginPath();
            ctx.arc(bx - r * 0.3, by - r * 0.3, r * 0.32, 0, Math.PI * 2);
            ctx.fill();
          });
        }

        if (cell.anodeIsGas && s.currentAmp > 0) {
          const isCl = cell.anodeProductName.includes('Cl');
          const isBr = cell.anodeProductName.includes('Br');
          const bFill = isBr
            ? 'rgba(217, 119, 6, 0.85)'
            : isCl
              ? 'rgba(163, 230, 53, 0.85)'
              : 'rgba(226, 232, 240, 0.78)';

          // Only show escaping halogen vapor plume if NOT dissolving into Javel
          if ((isCl || isBr) && !cell.anodeReactsInSolution) {
            const plumeGrad = ctx.createRadialGradient(anoCenterX, liqTop - 12, 4, anoCenterX, liqTop - 20, 42);
            plumeGrad.addColorStop(0, isBr ? 'rgba(217, 119, 6, 0.42)' : 'rgba(163, 230, 53, 0.36)');
            plumeGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = plumeGrad;
            ctx.beginPath();
            ctx.arc(anoCenterX, liqTop - 16, 42, 0, Math.PI * 2);
            ctx.fill();
          }

          bubblesRight.forEach((b) => {
            const prog = ((t * b.speed * (0.6 + s.currentAmp * 0.04) + b.phase * 40) % gasRange) / gasRange;
            // If Cl2 reacts inside solution (no membrane), bubbles curve leftward into solution and shrink before reaching surface
            const effectiveProg = cell.anodeReactsInSolution ? prog * 0.78 : prog;
            const by = elecBottom - 6 - effectiveProg * gasRange;
            const driftLeft = cell.anodeReactsInSolution ? prog * 46 : 0;
            const bx = anoCenterX - driftLeft + b.offset + Math.cos(t * 4.5 + b.phase) * b.wobble;
            const r = b.radius * (cell.anodeReactsInSolution ? Math.max(0.25, 1 - prog * 0.8) : 0.7 + prog * 0.55);

            ctx.fillStyle = bFill;
            ctx.beginPath();
            ctx.arc(bx, by, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
            ctx.beginPath();
            ctx.arc(bx - r * 0.3, by - r * 0.3, r * 0.3, 0, Math.PI * 2);
            ctx.fill();
          });
        }

        // --- 8. Migrating 3D Ions & Normalized Discharge Sparks ---
        const ionMinX = catCenterX + 24;
        const ionMaxX = anoCenterX - 24;
        const ionSpan = Math.max(70, ionMaxX - ionMinX);
        const hasJavelBanner = !hasMembrane && cell.modeType === 'aqueous' && Boolean(cell.anodeReactsInSolution);
        const ionTopPad = hasJavelBanner ? 44 : 24;
        const ionSpanY = Math.max(40, elecBottom - liqTop - ionTopPad - 20);

        if (s.currentAmp > 0 && (t - lastSparkTime > 0.38 || t < lastSparkTime)) {
          if (t < lastSparkTime) sparks.length = 0;
          lastSparkTime = t;
          sparks.push({
            isCatot: true,
            yFrac: (sparks.length * 0.29) % 1,
            bornAt: t,
            color: '#38BDF8',
          });
          sparks.push({
            isCatot: false,
            yFrac: (sparks.length * 0.43 + 0.17) % 1,
            bornAt: t,
            color: '#FBBF24',
          });
          if (sparks.length > 10) sparks.splice(0, sparks.length - 10);
        }

        for (let i = sparks.length - 1; i >= 0; i--) {
          const sp = sparks[i];
          const age = t - sp.bornAt;
          if (age > 0.68 || age < 0) continue;
          const sx = sp.isCatot ? catCenterX + 16 : anoCenterX - 16;
          const sy = liqTop + ionTopPad + sp.yFrac * ionSpanY;
          ctx.strokeStyle = sp.color;
          ctx.globalAlpha = (1 - age / 0.68) * 0.72;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.arc(sx, sy, 4 + age * 20, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }

        ionParticles.forEach((pt) => {
          const dir = pt.isCation ? -1 : 1;
          const speedPx = s.currentAmp > 0 ? (24 + s.currentAmp * 2.5) * pt.speedFactor : 0;
          const relX = ((((pt.seedX * ionSpan) + dir * t * speedPx) % ionSpan) + ionSpan) % ionSpan;
          const px = ionMinX + relX;
          const py = liqTop + ionTopPad + pt.seedY * ionSpanY + Math.sin(t * 2.1 + pt.phase) * 4;

          if (s.currentAmp > 0) {
            ctx.strokeStyle = pt.isCation ? 'rgba(249, 115, 22, 0.32)' : 'rgba(16, 185, 129, 0.32)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(px - dir * 16, py);
            ctx.stroke();
          }

          drawCachedSphere(
            px,
            py,
            13,
            pt.isCation ? '#F97316' : '#10B981',
            pt.isCation ? 'rgba(249, 115, 22, 0.34)' : 'rgba(16, 185, 129, 0.3)',
          );

          ctx.fillStyle = '#040914';
          ctx.font = '700 8px "IBM Plex Mono", monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const lbl = pt.isCation ? cell.cationFormula : cell.anionFormula;
          ctx.fillText(lbl.slice(0, 5), px, py + 0.5);
        });

        // Glass wall frame + volumetric ticks + specular highlight
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.65)';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.roundRect(vesselX, vesselTop, vesselW, vesselBottom - vesselTop, [4, 4, 18, 18]);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(203, 213, 225, 0.32)';
        ctx.lineWidth = 1;
        for (let tick = 1; tick <= 4; tick++) {
          const ty = vesselBottom - (tick * (vesselBottom - liqTop)) / 5;
          ctx.beginPath();
          ctx.moveTo(vesselX + 6, ty);
          ctx.lineTo(vesselX + (tick % 2 === 0 ? 18 : 12), ty);
          ctx.stroke();
        }

        const glassHighlight = ctx.createLinearGradient(vesselX + 12, 0, vesselX + 34, 0);
        glassHighlight.addColorStop(0, 'rgba(255, 255, 255, 0)');
        glassHighlight.addColorStop(0.5, 'rgba(255, 255, 255, 0.08)');
        glassHighlight.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = glassHighlight;
        ctx.fillRect(vesselX + 12, vesselTop + 6, 22, vesselBottom - vesselTop - 16);

        // --- 9. Non-Overlapping Electrode & Membrane Badges ---
        ctx.textBaseline = 'middle';
        const drawTagBadge = (
          label: string,
          centerX: number,
          centerY: number,
          accent: string,
        ) => {
          ctx.font = '700 10.5px sans-serif';
          const w = ctx.measureText(label).width + 14;
          ctx.fillStyle = 'rgba(9, 15, 30, 0.94)';
          ctx.strokeStyle = accent;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.roundRect(centerX - w / 2, centerY - 10, w, 20, 6);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = accent;
          ctx.textAlign = 'center';
          ctx.fillText(label, centerX, centerY + 0.5);
        };

        drawTagBadge('CATOT (-)', catCenterX + 46, vesselTop - 16, '#38BDF8');
        if (hasMembrane) {
          drawTagBadge('MÀNG NGĂN', midX, vesselTop - 16, '#7DD3FC');
        }
        drawTagBadge('ANOT (+)', anoCenterX - 46, vesselTop - 16, '#FBBF24');

        if (hasJavelBanner) {
          ctx.save();
          const jText = 'Cl₂ + 2OH⁻ → ClO⁻ + Cl⁻ (Nước Javel)';
          ctx.font = '600 10px "IBM Plex Mono", monospace';
          const jw = Math.min(vesselW - 96, ctx.measureText(jText).width + 18);
          ctx.fillStyle = 'rgba(11, 19, 36, 0.94)';
          ctx.strokeStyle = 'rgba(251, 191, 36, 0.55)';
          ctx.lineWidth = 1.1;
          ctx.beginPath();
          ctx.roundRect(midX - jw / 2, liqTop + 8, jw, 22, 6);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#FDE68A';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(jText, midX, liqTop + 19);
          ctx.restore();
        }

        // --- 10. Structured Side Readout Cards with Explicit Increase/Decrease (+g / -g) ---
        if (hasSidePanels) {
          const leftMarginW = Math.max(100, vesselX - 20);
          const rightMarginW = Math.max(100, W - (vesselX + vesselW) - 20);

          const drawDeltaCard = (
            cardX: number,
            cardY: number,
            cardW: number,
            title: string,
            productText: string,
            mainValueText: string,
            mainAccent: string,
            deltaLine1: string,
            deltaColor1: string,
            deltaLine2?: string,
            deltaColor2?: string,
          ) => {
            ctx.font = '600 10.5px sans-serif';
            const wrapped = wrapCanvasText(ctx, productText, cardW - 18).slice(0, 3);
            const extraLines = deltaLine2 ? 2 : 1;
            const cardH = 54 + wrapped.length * 14 + extraLines * 15;

            ctx.fillStyle = 'rgba(11, 19, 36, 0.90)';
            ctx.strokeStyle = 'rgba(51, 65, 85, 0.85)';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.roundRect(cardX, cardY, cardW, cardH, 10);
            ctx.fill();
            ctx.stroke();

            ctx.textBaseline = 'alphabetic';
            ctx.textAlign = 'left';
            ctx.fillStyle = '#94A3B8';
            ctx.font = '700 9px "IBM Plex Mono", monospace';
            ctx.fillText(title, cardX + 9, cardY + 16);

            ctx.fillStyle = '#E2E8F0';
            ctx.font = '600 10.5px sans-serif';
            wrapped.forEach((line, idx) => {
              ctx.fillText(line, cardX + 9, cardY + 32 + idx * 14);
            });

            const valY = cardY + 34 + wrapped.length * 14;
            ctx.fillStyle = mainAccent;
            ctx.font = '700 13px "IBM Plex Mono", monospace';
            ctx.fillText(mainValueText, cardX + 9, valY);

            // Divider line before delta breakdown
            ctx.strokeStyle = 'rgba(51, 65, 85, 0.65)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(cardX + 9, valY + 7);
            ctx.lineTo(cardX + cardW - 9, valY + 7);
            ctx.stroke();

            ctx.font = '600 10px "IBM Plex Mono", monospace';
            ctx.fillStyle = deltaColor1;
            ctx.fillText(deltaLine1, cardX + 9, valY + 21);

            if (deltaLine2 && deltaColor2) {
              ctx.fillStyle = deltaColor2;
              ctx.fillText(deltaLine2, cardX + 9, valY + 35);
            }
          };

          const leftCardW = Math.min(182, leftMarginW);
          const catDeltaText =
            calc.cathodeElectrodeDeltaG > 0.001
              ? `▲ Cực: +${calc.cathodeElectrodeDeltaG.toFixed(2)} g (Tăng)`
              : '• Cực: ±0.00 g';
          const catDeltaColor = calc.cathodeElectrodeDeltaG > 0.001 ? '#34D399' : '#94A3B8';
          const catSubLine = cell.cathodeIsGas
            ? `▼ Khí bay: -${calc.cathodeMassG.toFixed(2)} g`
            : undefined;

          drawDeltaCard(
            vesselX - leftCardW - 10,
            liqTop + 8,
            leftCardW,
            'BÊN CATOT (-)',
            cell.cathodeProductName,
            cell.cathodeIsGas
              ? `${calc.cathodeMassG.toFixed(2)} g · ${calc.cathodeGasLiters.toFixed(2)} L`
              : `${calc.cathodeMassG.toFixed(2)} g`,
            '#38BDF8',
            catDeltaText,
            catDeltaColor,
            catSubLine,
            '#38BDF8',
          );

          const rightCardW = Math.min(182, rightMarginW);
          let anoMain = `${calc.anodeMassG.toFixed(2)} g`;
          if (cell.anodeIsGas && !cell.anodeReactsInSolution) {
            anoMain = `${calc.anodeMassG.toFixed(2)} g · ${calc.anodeGasLiters.toFixed(2)} L`;
          } else if (cell.anodeReactsInSolution) {
            anoMain = `${calc.anodeMassG.toFixed(2)} g (trong dd)`;
          }

          let anoDelta1 = '• Cực: ±0.00 g';
          let anoColor1 = '#94A3B8';
          let anoDelta2: string | undefined;
          let anoColor2: string | undefined;

          if (cell.anodeDissolves) {
            anoDelta1 = `▼ Cực: -${Math.abs(calc.anodeElectrodeDeltaG).toFixed(2)} g (Giảm)`;
            anoColor1 = '#FB7185';
            anoDelta2 = `▲ Bù ion: +${calc.anodeMassG.toFixed(2)} g`;
            anoColor2 = '#34D399';
          } else if (cell.anodeReactsInSolution) {
            anoDelta1 = '• Giữ lại dd (Javel)';
            anoColor1 = '#FBBF24';
          } else if (cell.anodeIsGas) {
            anoDelta2 = `▼ Khí bay: -${calc.anodeMassG.toFixed(2)} g`;
            anoColor2 = '#FBBF24';
          }

          drawDeltaCard(
            vesselX + vesselW + 10,
            liqTop + 8,
            rightCardW,
            'BÊN ANOT (+)',
            cell.anodeProductName,
            anoMain,
            '#FBBF24',
            anoDelta1,
            anoColor1,
            anoDelta2,
            anoColor2,
          );
        }
      } else {
        // === DISSOCIATION & CONDUCTIVITY SIMULATION ===
        const el = s.activeElectrolyte;
        const ph = s.phResult;

        const hasRightMeter = W >= 600;
        const beakerW = hasRightMeter ? Math.min(W * 0.56, 450) : Math.min(W * 0.78, 400);
        const beakerX = hasRightMeter ? (W - beakerW) / 2 - 52 : (W - beakerW) / 2;
        const beakerTop = Math.max(118, H * 0.27);
        const beakerH = H * 0.59;
        const beakerBottom = beakerTop + beakerH;
        const liqTop = beakerTop + 26;

        const probeLeftX = beakerX + beakerW * 0.24;
        const probeRightX = beakerX + beakerW * 0.76;
        const bulbX = beakerX + beakerW / 2;
        const bulbY = 40;

        const brightness =
          ph.conductivityLevel === 'Mạnh' ? 1 : ph.conductivityLevel === 'Yếu' ? 0.38 : 0;

        if (brightness > 0) {
          const haloR = brightness === 1 ? 86 : 48;
          const halo = ctx.createRadialGradient(bulbX, bulbY, 6, bulbX, bulbY, haloR);
          halo.addColorStop(0, `rgba(253, 224, 71, ${0.72 * brightness})`);
          halo.addColorStop(0.45, `rgba(250, 204, 21, ${0.26 * brightness})`);
          halo.addColorStop(1, 'rgba(250, 204, 21, 0)');
          ctx.fillStyle = halo;
          ctx.beginPath();
          ctx.arc(bulbX, bulbY, haloR, 0, Math.PI * 2);
          ctx.fill();
        }

        // Circuit wires from bulb to probes
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(probeLeftX, beakerTop - 10);
        ctx.bezierCurveTo(probeLeftX, bulbY + 4, bulbX - 36, bulbY + 4, bulbX - 18, bulbY + 14);
        ctx.moveTo(probeRightX, beakerTop - 10);
        ctx.bezierCurveTo(probeRightX, bulbY + 4, bulbX + 36, bulbY + 4, bulbX + 18, bulbY + 14);
        ctx.stroke();

        if (brightness > 0) {
          const pCount = brightness === 1 ? 6 : 3;
          const pRate = brightness === 1 ? 0.8 : 0.35;
          for (let i = 0; i < pCount; i++) {
            const p = (t * pRate + i / pCount) % 1;
            const [cx, cy] =
              p < 0.5
                ? cubicPoint(
                    probeLeftX, beakerTop - 10,
                    probeLeftX, bulbY + 4,
                    bulbX - 36, bulbY + 4,
                    bulbX - 18, bulbY + 14,
                    p * 2,
                  )
                : cubicPoint(
                    bulbX + 18, bulbY + 14,
                    bulbX + 36, bulbY + 4,
                    probeRightX, bulbY + 4,
                    probeRightX, beakerTop - 10,
                    (p - 0.5) * 2,
                  );
            ctx.fillStyle = brightness === 1 ? '#FDE047' : '#F59E0B';
            ctx.beginPath();
            ctx.arc(cx, cy, brightness === 1 ? 3.5 : 2.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        ctx.fillStyle =
          brightness > 0
            ? `rgba(254, 240, 138, ${0.24 + brightness * 0.65})`
            : 'rgba(30, 41, 59, 0.75)';
        ctx.beginPath();
        ctx.arc(bulbX, bulbY - 2, 21, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = brightness > 0 ? '#FEF08A' : '#64748B';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#B45309';
        ctx.beginPath();
        ctx.roundRect(bulbX - 9, bulbY + 15, 18, 9, 3);
        ctx.fill();

        ctx.strokeStyle = brightness === 1 ? '#FFFFFF' : brightness > 0 ? '#FBBF24' : '#475569';
        ctx.lineWidth = brightness > 0 ? 2.2 : 1.5;
        ctx.beginPath();
        ctx.moveTo(bulbX - 6, bulbY + 13);
        ctx.lineTo(bulbX - 7, bulbY - 3);
        ctx.lineTo(bulbX - 3, bulbY - 7);
        ctx.lineTo(bulbX, bulbY - 1);
        ctx.lineTo(bulbX + 3, bulbY - 7);
        ctx.lineTo(bulbX + 7, bulbY - 3);
        ctx.lineTo(bulbX + 6, bulbY + 13);
        ctx.stroke();

        ctx.fillStyle = '#F8FAFC';
        ctx.font = '700 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(
          brightness === 1
            ? 'Đèn sáng rực · Điện li mạnh (α = 100%)'
            : brightness > 0
              ? `Đèn sáng mờ · Điện li yếu (α = ${ph.alphaPercent.toFixed(1)}%)`
              : 'Đèn tắt · Chất không điện li',
          bulbX,
          beakerTop - 16,
        );

        ctx.save();
        ctx.beginPath();
        ctx.roundRect(beakerX + 3, liqTop - 6, beakerW - 6, beakerBottom - liqTop + 3, [0, 0, 16, 16]);
        ctx.clip();

        const liqGrad = ctx.createLinearGradient(0, liqTop, 0, beakerBottom);
        liqGrad.addColorStop(0, el.solutionColorHex + '40');
        liqGrad.addColorStop(1, el.solutionColorHex + '90');
        ctx.fillStyle = liqGrad;
        ctx.beginPath();
        ctx.moveTo(beakerX, beakerBottom);
        for (let wx = beakerX; wx <= beakerX + beakerW; wx += 10) {
          const wave = Math.sin(wx * 0.03 + t * 1.9) * 1.8;
          ctx.lineTo(wx, liqTop + wave);
        }
        ctx.lineTo(beakerX + beakerW, beakerBottom);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = el.solutionColorHex;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let wx = beakerX + 3; wx <= beakerX + beakerW - 3; wx += 8) {
          const wave = Math.sin(wx * 0.03 + t * 1.9) * 1.8;
          if (wx === beakerX + 3) ctx.moveTo(wx, liqTop + wave);
          else ctx.lineTo(wx, liqTop + wave);
        }
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = '#475569';
        ctx.beginPath();
        ctx.roundRect(probeLeftX - 7, beakerTop - 10, 14, beakerH - 22, 4);
        ctx.roundRect(probeRightX - 7, beakerTop - 10, 14, beakerH - 22, 4);
        ctx.fill();

        const isStrong =
          el.type === 'strong_acid' || el.type === 'strong_base' || el.type === 'neutral_salt';
        const isWeak = el.type === 'weak_acid' || el.type === 'weak_base';
        const innerLeft = beakerX + 34;
        const innerW = beakerW - 68;
        const innerTop = liqTop + 26;
        const innerH = beakerBottom - liqTop - 52;

        moleculePairs.forEach((mp, idx) => {
          const cx = innerLeft + ((mp.cx + Math.sin(t * 0.65 + mp.phase) * 0.09 + 1) % 1) * innerW;
          const cy = innerTop + ((mp.cy + Math.cos(t * 0.55 + mp.phase) * 0.09 + 1) % 1) * innerH;
          const rot = mp.angle + Math.sin(t * 1.2 + mp.phase) * 0.35;

          let split = 0;
          if (isStrong) {
            split = 1;
          } else if (isWeak) {
            const wave = Math.sin(t * 1.3 + idx * 1.7);
            split = wave > 0.35 ? Math.min(1, (wave - 0.35) / 0.35) : 0;
          }

          const sep = 8 + split * 22;
          const dx = Math.cos(rot) * sep;
          const dy = Math.sin(rot) * sep;

          if (split < 0.35) {
            ctx.strokeStyle = 'rgba(203, 213, 225, 0.78)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(cx - dx, cy - dy);
            ctx.lineTo(cx + dx, cy + dy);
            ctx.stroke();

            drawCachedSphere(cx - dx, cy - dy, 8.5, '#94A3B8', '');
            drawCachedSphere(cx + dx, cy + dy, 8.5, '#64748B', '');
          } else {
            const ax = cx - dx;
            const ay = cy - dy;
            const bx = cx + dx;
            const by = cy + dy;

            if (s.showOverlayGuides) {
              [0, 1].forEach((k) => {
                const ang = t * 1.8 + idx + k * Math.PI;
                ctx.fillStyle = 'rgba(186, 230, 253, 0.65)';
                ctx.beginPath();
                ctx.arc(ax + Math.cos(ang) * 16, ay + Math.sin(ang) * 16, 2.4, 0, Math.PI * 2);
                ctx.arc(bx - Math.cos(ang) * 16, by - Math.sin(ang) * 16, 2.4, 0, Math.PI * 2);
                ctx.fill();
              });
            }

            drawCachedSphere(ax, ay, 11.5, '#38BDF8', 'rgba(56, 189, 248, 0.32)');
            drawCachedSphere(bx, by, 11.5, '#F472B6', 'rgba(244, 114, 182, 0.32)');

            ctx.fillStyle = '#040914';
            ctx.font = '700 8px "IBM Plex Mono", monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(el.cationLabel.slice(0, 5), ax, ay + 0.5);
            ctx.fillText(el.anionLabel.slice(0, 5), bx, by + 0.5);
          }
        });

        ctx.strokeStyle = 'rgba(148, 163, 184, 0.65)';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.roundRect(beakerX, beakerTop, beakerW, beakerH, [4, 4, 18, 18]);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(203, 213, 225, 0.32)';
        ctx.lineWidth = 1;
        for (let tick = 1; tick <= 4; tick++) {
          const ty = beakerBottom - (tick * (beakerBottom - liqTop)) / 5;
          ctx.beginPath();
          ctx.moveTo(beakerX + 6, ty);
          ctx.lineTo(beakerX + (tick % 2 === 0 ? 18 : 12), ty);
          ctx.stroke();
        }

        const phMeterX = beakerX + beakerW + 22;
        const phMeterY = beakerTop + 16;
        const phProbeX = beakerX + beakerW - 22;

        ctx.strokeStyle = '#64748B';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(phProbeX, beakerTop - 12);
        ctx.bezierCurveTo(phProbeX, beakerTop - 34, phMeterX + 52, beakerTop - 30, phMeterX + 52, phMeterY);
        ctx.stroke();

        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.roundRect(phProbeX - 4, beakerTop - 12, 8, beakerH - 42, 4);
        ctx.fill();
        ctx.fillStyle = '#38BDF8';
        ctx.beginPath();
        ctx.arc(phProbeX, beakerTop + beakerH - 52, 5, 0, Math.PI * 2);
        ctx.fill();

        if (hasRightMeter && phMeterX + 114 < W - 8) {
          ctx.fillStyle = '#0F1B33';
          ctx.strokeStyle = '#38BDF8';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(phMeterX, phMeterY, 114, 70, 10);
          ctx.fill();
          ctx.stroke();

          ctx.textBaseline = 'alphabetic';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#94A3B8';
          ctx.font = '700 9px "IBM Plex Mono", monospace';
          ctx.fillText('MÁY ĐO pH', phMeterX + 57, phMeterY + 18);

          const phColor = ph.pH < 6.5 ? '#FB7185' : ph.pH > 7.5 ? '#818CF8' : '#34D399';
          ctx.fillStyle = phColor;
          ctx.font = '700 18px "IBM Plex Mono", monospace';
          ctx.fillText(`${ph.pH.toFixed(2)}`, phMeterX + 57, phMeterY + 42);

          ctx.fillStyle = '#CBD5E1';
          ctx.font = '600 10px sans-serif';
          ctx.fillText(
            ph.pH < 6.5 ? 'Môi trường Axit' : ph.pH > 7.5 ? 'Môi trường Bazơ' : 'Trung tính',
            phMeterX + 57,
            phMeterY + 59,
          );
        }
      }

      ctx.restore();

      if (s.isPlaying && !prefersReducedMotion) {
        animId = requestAnimationFrame(drawFrame);
      } else {
        animId = 0;
      }
    };

    redrawRef.current = () => {
      if (animId === 0) {
        lastFrameMs = performance.now();
        animId = requestAnimationFrame(drawFrame);
      }
    };

    animId = requestAnimationFrame(drawFrame);
    return () => {
      redrawRef.current = null;
      if (animId !== 0) cancelAnimationFrame(animId);
      resizeObserver.disconnect();
    };
  }, []);

  const solDelta = electrolysisResult.solutionDeltaG;
  const solDeltaLabel =
    Math.abs(solDelta) < 0.005
      ? '±0.00 g (Không đổi)'
      : solDelta < 0
        ? `${solDelta.toFixed(2)} g (Giảm)`
        : `+${solDelta.toFixed(2)} g (Tăng)`;

  return (
    <div
      className={
        isExpanded
          ? 'fixed inset-0 z-50 w-screen h-screen bg-[#050914] flex flex-col select-none'
          : 'rounded-2xl border border-slate-800 bg-[#070E1D] p-3 space-y-2.5 select-none'
      }
      data-testid="electrolysis-stage-wrapper"
      data-expanded={isExpanded ? 'true' : 'false'}
      data-zoom={zoomLevel.toFixed(2)}
    >
      {/* Dedicated Non-Occluding Instrument Toolbar */}
      <div
        className={
          isExpanded
            ? 'flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-950/95 px-4 py-2.5'
            : 'flex flex-wrap items-center justify-between gap-2 px-0.5'
        }
      >
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 min-w-0">
          <span className="truncate">
            {activeTab === 'electrolysis'
              ? `${activeCell.formula} — ${activeCell.title}`
              : `${activeElectrolyte.formula} — ${activeElectrolyte.name}`}
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {activeTab === 'electrolysis' && activeCell.modeType === 'aqueous' && onToggleMembrane && (
            <button
              type="button"
              onClick={onToggleMembrane}
              data-testid="canvas-membrane-toggle"
              aria-pressed={hasMembrane}
              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                hasMembrane
                  ? 'border-sky-400/70 bg-sky-500/20 text-sky-200 hover:bg-sky-500/30'
                  : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
              }`}
              title="Bật/tắt màng ngăn xốp giữa hai điện cực"
            >
              <Shield className="h-3.5 w-3.5 text-sky-400" />
              {hasMembrane ? 'Có màng ngăn' : 'Không màng ngăn'}
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsPlaying((v) => !v)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 whitespace-nowrap"
          >
            {isPlaying ? (
              <Pause className="h-3.5 w-3.5 text-amber-400" />
            ) : (
              <Play className="h-3.5 w-3.5 text-emerald-400" />
            )}
            {isPlaying ? 'Tạm dừng' : 'Tiếp tục'}
          </button>

          <button
            type="button"
            onClick={() => setSpeed((s) => (s === 0.5 ? 1 : s === 1 ? 2 : 0.5))}
            className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 font-mono text-xs font-semibold text-sky-300 hover:bg-slate-800 whitespace-nowrap tabular-nums"
            title="Tốc độ hoạt ảnh"
          >
            {speed}x
          </button>

          {/* In-Canvas Magnification Controls */}
          <div className="inline-flex items-center rounded-lg border border-slate-700 bg-slate-900 overflow-hidden">
            <button
              type="button"
              onClick={() => adjustZoom(-0.15)}
              aria-label="Thu nhỏ mô phỏng"
              title="Thu nhỏ khung nhìn"
              className="px-2 py-1.5 text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setZoomLevel(1);
                setPanOffset({ x: 0, y: 0 });
              }}
              className="px-2 py-1.5 font-mono text-[11px] font-semibold text-slate-200 hover:bg-slate-800 border-x border-slate-800 tabular-nums whitespace-nowrap"
              title="Đưa tỉ lệ phóng đại về 100%"
            >
              {Math.round(zoomLevel * 100)}%
            </button>
            <button
              type="button"
              onClick={() => adjustZoom(0.15)}
              aria-label="Phóng to cận cảnh mô phỏng"
              title="Phóng to cận cảnh"
              className="px-2 py-1.5 text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowOverlayGuides((v) => !v)}
            className="hidden sm:inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 whitespace-nowrap"
            title="Ẩn/hiện đường sức & vỏ hydrat"
          >
            {showOverlayGuides ? (
              <Eye className="h-3.5 w-3.5 text-sky-400" />
            ) : (
              <EyeOff className="h-3.5 w-3.5" />
            )}
            {activeTab === 'electrolysis' ? 'Điện trường' : 'Hydrat'}
          </button>

          <button
            type="button"
            onClick={resetViewAndSim}
            aria-label="Khởi động lại mô phỏng"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 whitespace-nowrap"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded((v) => !v)}
            aria-label={isExpanded ? 'Thu nhỏ mô phỏng điện phân' : 'Phóng to mô phỏng điện phân'}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-slate-100 hover:bg-slate-800 hover:border-sky-500/60 whitespace-nowrap"
          >
            {isExpanded ? (
              <>
                <Minimize2 className="h-3.5 w-3.5 text-sky-400" />
                Thu nhỏ
              </>
            ) : (
              <>
                <Maximize2 className="h-3.5 w-3.5 text-sky-400" />
                Toàn màn hình
              </>
            )}
          </button>
        </div>
      </div>

      {/* Roomier Stage Viewport (supports wheel zoom & drag-pan when zoomed) */}
      <div
        ref={containerRef}
        onWheel={(e) => {
          if (e.ctrlKey || Math.abs(e.deltaY) > 0) {
            e.preventDefault();
            adjustZoom(e.deltaY < 0 ? 0.1 : -0.1);
          }
        }}
        onPointerDown={(e) => {
          if (zoomLevel <= 1) return;
          dragStateRef.current = {
            active: true,
            startX: e.clientX,
            startY: e.clientY,
            origX: panOffset.x,
            origY: panOffset.y,
          };
        }}
        onPointerMove={(e) => {
          if (!dragStateRef.current.active) return;
          const dx = e.clientX - dragStateRef.current.startX;
          const dy = e.clientY - dragStateRef.current.startY;
          setPanOffset({
            x: Math.max(-220, Math.min(220, dragStateRef.current.origX + dx)),
            y: Math.max(-160, Math.min(160, dragStateRef.current.origY + dy)),
          });
        }}
        onPointerUp={() => {
          dragStateRef.current.active = false;
        }}
        onPointerLeave={() => {
          dragStateRef.current.active = false;
        }}
        className={
          isExpanded
            ? `relative flex-1 w-full overflow-hidden ${zoomLevel > 1 ? 'cursor-grab active:cursor-grabbing' : ''}`
            : `relative w-full h-[420px] sm:h-[490px] rounded-xl overflow-hidden border border-slate-800/80 ${zoomLevel > 1 ? 'cursor-grab active:cursor-grabbing' : ''}`
        }
      >
        <canvas
          ref={canvasRef}
          className="block w-full h-full"
          data-testid="electrolysis-canvas"
          data-zoom={zoomLevel.toFixed(2)}
        />
      </div>

      {/* Concise Legend Strip + Solution Mass Delta Below Viewport */}
      <div
        className={
          isExpanded
            ? 'flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 bg-slate-950 px-5 py-2.5 text-xs text-slate-300'
            : 'flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-slate-400'
        }
      >
        {activeTab === 'electrolysis' ? (
          <>
            <div className="flex flex-wrap items-center gap-3.5">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-orange-500" />
                Cation ({activeCell.cationFormula}) → Catot (-)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                Anion ({activeCell.anionFormula}) → Anot (+)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-sky-300" />
                Dòng electron e⁻
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] tabular-nums">
              <span
                className={
                  Math.abs(solDelta) < 0.005
                    ? 'text-emerald-300 font-semibold'
                    : 'text-rose-300 font-semibold'
                }
                data-testid="solution-delta-mass"
              >
                Δm dd: {solDeltaLabel}
              </span>
              <span className="text-slate-500">|</span>
              <span className="text-slate-400">
                I = {currentAmp.toFixed(1)} A · t = {durationSec} s
              </span>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-sky-400" />
                Cation ({activeElectrolyte.cationLabel})
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-pink-400" />
                Anion ({activeElectrolyte.anionLabel})
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
                Phân tử chưa điện li
              </span>
            </div>
            <span className="font-mono text-[11px] text-slate-400 tabular-nums">
              C = {molarity} M · pH = {phResult.pH.toFixed(2)}
            </span>
          </>
        )}
      </div>
    </div>
  );
};
