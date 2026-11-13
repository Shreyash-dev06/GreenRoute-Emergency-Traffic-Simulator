import React, { useEffect, useRef } from 'react';
import { Compass } from 'lucide-react';
import {
  BackgroundEmergencyVehicle,
  IntersectionSignalState,
  PlayerVehicleState,
  RouteResult,
} from '../types/greenroute';
import { GRID_COORDS, getProceduralCityWorld } from '../engine/roadGraph';

interface MinimapCanvasProps {
  player: PlayerVehicleState;
  activeRoute: RouteResult | null;
  activeDestinationId: string | null;
  intersections: Record<string, IntersectionSignalState>;
  backgroundEmergency: BackgroundEmergencyVehicle | null;
  rotateWithPlayer: boolean;
  onToggleRotationMode: () => void;
}

export const MinimapCanvas: React.FC<MinimapCanvasProps> = ({
  player,
  activeRoute,
  activeDestinationId,
  intersections,
  backgroundEmergency,
  rotateWithPlayer,
  onToggleRotationMode,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const world = getProceduralCityWorld();
    const size = canvas.width;
    const half = size / 2;
    // Scale: 1 world meter = 0.36 minimap pixels (shows ~280m radius around player)
    const scale = 0.36;

    ctx.clearRect(0, 0, size, size);

    // Dark radar backing
    ctx.fillStyle = '#070e1b';
    ctx.fillRect(0, 0, size, size);

    ctx.save();
    ctx.translate(half, half);

    // If rotateWithPlayer is enabled:
    // Player forward direction in world is (sin(yaw), cos(yaw)).
    // On screen, UP is (0, -1). To align (sin(yaw), cos(yaw)) with (0, -1),
    // we rotate the world by (player.yaw - Math.PI).
    if (rotateWithPlayer) {
      ctx.rotate(player.yaw - Math.PI);
    }

    // Translate so player is at center (0, 0)
    ctx.translate(-player.x * scale, -player.z * scale);

    // 1. Draw City Roads
    for (let i = 0; i < GRID_COORDS.length; i++) {
      const c = GRID_COORDS[i] * scale;
      const isMain = i === 2 || i === 3 || i === 4;
      ctx.strokeStyle = isMain ? '#334155' : '#1e293b';
      ctx.lineWidth = isMain ? 6 : 4;

      // NS road
      ctx.beginPath();
      ctx.moveTo(c, -350 * scale);
      ctx.lineTo(c, 350 * scale);
      ctx.stroke();

      // EW road
      ctx.beginPath();
      ctx.moveTo(-350 * scale, c);
      ctx.lineTo(350 * scale, c);
      ctx.stroke();
    }

    // 2. Draw Highlighted Active Route
    if (activeRoute && activeRoute.waypoints.length > 0) {
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 4.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(player.x * scale, player.z * scale);
      for (const wp of activeRoute.waypoints) {
        ctx.lineTo(wp.x * scale, wp.z * scale);
      }
      ctx.stroke();
    }

    // 3. Draw Signalized Intersections (highlight preempted green junctions)
    for (const j of Object.values(intersections)) {
      const jx = j.x * scale;
      const jz = j.z * scale;
      if (j.phase === 'EMERGENCY_GREEN') {
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(jx, jz, 4.2, 0, Math.PI * 2);
        ctx.fill();
      } else if (j.phase.includes('PREEMPT')) {
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(jx, jz, 3.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 4. Draw All 12 Service Destinations (4 Hospitals, 4 Fire Stations, 4 Police Stations)
    for (const node of Object.values(world.nodes)) {
      if (node.type !== 'DESTINATION') continue;
      const nx = node.x * scale;
      const nz = node.z * scale;
      const isTarget = node.id === activeDestinationId;

      const color =
        node.emergencyCategory === 'AMBULANCE'
          ? '#38bdf8'
          : node.emergencyCategory === 'FIRE_BRIGADE'
            ? '#ef4444'
            : '#3b82f6';
      const letter =
        node.emergencyCategory === 'AMBULANCE'
          ? 'H'
          : node.emergencyCategory === 'FIRE_BRIGADE'
            ? 'F'
            : 'P';

      if (isTarget) {
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(nx, nz, 10, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(nx, nz, isTarget ? 6.5 : 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.translate(nx, nz);
      if (rotateWithPlayer) {
        ctx.rotate(-(player.yaw - Math.PI));
      }
      ctx.fillStyle = '#070e1b';
      ctx.font = 'bold 8px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(letter, 0, 0.5);
      ctx.restore();
    }

    // 5. Draw Background Emergency Vehicle if active
    if (backgroundEmergency) {
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(
        backgroundEmergency.x * scale,
        backgroundEmergency.z * scale,
        4.5,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }

    ctx.restore();

    // 6. Draw Player Vehicle Chevron at Center (half, half)
    ctx.save();
    ctx.translate(half, half);
    if (!rotateWithPlayer) {
      // In North-up mode, rotate player arrow to match world heading
      ctx.rotate(Math.PI - player.yaw);
    }
    ctx.fillStyle = player.sirenActive ? '#10b981' : '#f8fafc';
    ctx.strokeStyle = '#070e1b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(6.5, 7);
    ctx.lineTo(0, 3.5);
    ctx.lineTo(-6.5, 7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }, [
    player,
    activeRoute,
    activeDestinationId,
    intersections,
    backgroundEmergency,
    rotateWithPlayer,
  ]);

  return (
    <div className="relative w-48 h-48 rounded-2xl overflow-hidden border-2 border-slate-700/90 bg-[#070e1b] shadow-2xl pointer-events-auto">
      <canvas
        ref={canvasRef}
        width={192}
        height={192}
        className="w-full h-full block"
      />

      {/* Minimap Mode Toggle Button & Legend */}
      <button
        onClick={onToggleRotationMode}
        className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-[10px] font-mono text-slate-200 flex items-center gap-1 cursor-pointer"
        title="Switch between Heading-Up and North-Up radar mode"
      >
        <Compass className="w-3 h-3 text-emerald-400" />
        {rotateWithPlayer ? 'HEAD-UP' : 'NORTH-UP'}
      </button>

      <div className="absolute bottom-1.5 left-2 right-2 flex items-center justify-between text-[9px] font-mono text-slate-300 bg-slate-950/85 px-2 py-0.5 rounded border border-slate-800/80">
        <span className="text-sky-400 font-bold">H:Hosp</span>
        <span className="text-rose-400 font-bold">F:Fire</span>
        <span className="text-blue-400 font-bold">P:Police</span>
        <span className="text-slate-400">[M]</span>
      </div>
    </div>
  );
};
