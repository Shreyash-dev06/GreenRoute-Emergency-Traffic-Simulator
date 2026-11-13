import React from 'react';
import {
  Siren,
  ArrowUp,
  CornerUpLeft,
  CornerUpRight,
  MapPin,
  Clock,
  Pause,
  Camera,
  RotateCcw,
  ShieldCheck,
  AlertTriangle,
  XCircle,
} from 'lucide-react';
import {
  ActiveMissionState,
  BackgroundEmergencyVehicle,
  DrivingCameraMode,
  GameSettings,
  IntersectionSignalState,
  NavigationGuidance,
  PlayMode,
  PlayerVehicleState,
  PriorityRequest,
  RouteResult,
  SignalNotificationBanner,
} from '../types/greenroute';
import { MinimapCanvas } from './MinimapCanvas';

interface DrivingGameHUDProps {
  playMode: PlayMode;
  player: PlayerVehicleState;
  mission: ActiveMissionState | null;
  navigation: NavigationGuidance | null;
  activeRoute: RouteResult | null;
  intersections: Record<string, IntersectionSignalState>;
  priorityRequests: PriorityRequest[];
  backgroundEmergency: BackgroundEmergencyVehicle | null;
  settings: GameSettings;
  cameraMode: DrivingCameraMode;
  notifications: SignalNotificationBanner[];
  showCancelMissionConfirm: boolean;
  onTriggerCapsLockSiren: () => void;
  onConfirmCancelMission: () => void;
  onDismissCancelMission: () => void;
  onCycleCamera: () => void;
  onResetCarPosition: () => void;
  onOpenPauseMenu: () => void;
  onToggleMinimapRotate: () => void;
}

function formatCountdown(sec: number): string {
  const clamped = Math.max(0, sec);
  const mins = Math.floor(clamped / 60);
  const secs = Math.floor(clamped % 60);
  const tenths = Math.floor((clamped % 1) * 10);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${tenths}`;
}

export const DrivingGameHUD: React.FC<DrivingGameHUDProps> = ({
  playMode,
  player,
  mission,
  navigation,
  activeRoute,
  intersections,
  priorityRequests,
  backgroundEmergency,
  settings,
  cameraMode,
  notifications,
  showCancelMissionConfirm,
  onTriggerCapsLockSiren,
  onConfirmCancelMission,
  onDismissCancelMission,
  onCycleCamera,
  onResetCarPosition,
  onOpenPauseMenu,
  onToggleMinimapRotate,
}) => {
  // Convert world m/s to realistic arcade km/h readout
  const speedKmh = Math.round(Math.abs(player.speed) * 3.6);
  const maxSpeedKmh = Math.round(player.maxSpeed * 3.6);
  const speedPct = Math.min(100, Math.round((speedKmh / maxSpeedKmh) * 100));

  const isMissionActive = playMode === 'EMERGENCY_MISSION' && mission !== null;
  const activeReq = priorityRequests.find((r) => r.status === 'ACTIVE');
  const queuedReq = priorityRequests.find((r) => r.status === 'QUEUED');

  const renderTurnIcon = () => {
    if (!navigation || navigation.turnType === 'STRAIGHT') {
      return <ArrowUp className="w-6 h-6 text-emerald-400 shrink-0" />;
    }
    if (navigation.turnType === 'LEFT') {
      return <CornerUpLeft className="w-6 h-6 text-amber-400 shrink-0" />;
    }
    if (navigation.turnType === 'RIGHT') {
      return <CornerUpRight className="w-6 h-6 text-amber-400 shrink-0" />;
    }
    return <MapPin className="w-6 h-6 text-emerald-400 shrink-0" />;
  };

  return (
    <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-4">
      {/* TOP ROW: TOP-LEFT (Logo & Mode) | CENTER NOTIFICATIONS | TOP-RIGHT (Mission Timer & Difficulty) */}
      <div className="flex items-start justify-between gap-4">
        {/* TOP LEFT: Game Name, Current Mode & Compact Keybinds */}
        <div className="space-y-2 max-w-sm">
          <div className="pointer-events-auto bg-[#070e1b]/90 border border-slate-700/90 rounded-xl px-4 py-2.5 shadow-xl flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-base font-bold tracking-tight text-white font-display">
                GREENROUTE
              </span>
              <span className="text-slate-600">·</span>
              <span
                className={`text-xs font-mono font-bold ${
                  isMissionActive ? 'text-emerald-400' : 'text-sky-400'
                }`}
              >
                {isMissionActive ? 'EMERGENCY MISSION' : 'FREE ROAM'}
              </span>
            </div>

            <div className="ml-auto flex items-center gap-1.5">
              <button
                onClick={onCycleCamera}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                title={`Switch Camera View (C) — Current: ${cameraMode}`}
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onResetCarPosition}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                title="Reset Vehicle to Nearest Safe Road (R)"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onOpenPauseMenu}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                title="Pause Game (ESC)"
              >
                <Pause className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Compact Controls Hint Pill */}
          <div className="bg-[#070e1b]/85 border border-slate-800/90 rounded-lg px-3 py-1.5 text-[11px] font-mono text-slate-300">
            WASD/Arrows: Drive · Space: Brake ·{' '}
            <span className="text-emerald-400 font-bold">
              CAPS LOCK: Siren/Mission
            </span>{' '}
            · C: Cam · M: Map
          </div>

          {/* Compact Secondary Priority Arbitration Indicator (Only when requests exist) */}
          {(activeReq || queuedReq) && (
            <div className="bg-[#070e1b]/90 border border-emerald-500/40 rounded-xl px-3.5 py-2 text-[11px] font-mono space-y-1 shadow-lg">
              {activeReq && (
                <div className="text-emerald-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>
                    ACTIVE: {activeReq.callSign} → {activeReq.intersectionId} (
                    {activeReq.requestedAxis}, ETA{' '}
                    {activeReq.etaSeconds.toFixed(1)}s)
                  </span>
                </div>
              )}
              {queuedReq && (
                <div className="text-amber-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>
                    QUEUED: {queuedReq.callSign} at {queuedReq.intersectionId} (
                    {queuedReq.requestedAxis} conflict)
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* TOP CENTER: Contextual Signal Priority Notification Banners */}
        <div className="hidden md:flex flex-col items-center gap-1.5 max-w-md">
          {notifications.slice(0, 2).map((n) => (
            <div
              key={n.id}
              className={`px-4 py-2 rounded-xl border shadow-xl bg-[#070e1b]/95 text-xs text-center ${
                n.tone === 'EMERALD'
                  ? 'border-emerald-500/60 text-emerald-300'
                  : n.tone === 'AMBER'
                    ? 'border-amber-500/60 text-amber-300'
                    : n.tone === 'RED'
                      ? 'border-rose-500/60 text-rose-300'
                      : 'border-sky-500/60 text-sky-300'
              }`}
            >
              <div className="font-bold text-white">{n.title}</div>
              <div className="text-[11px] text-slate-300">{n.subtitle}</div>
            </div>
          ))}
        </div>

        {/* TOP RIGHT: Mission Countdown Timer, Mission Status & Difficulty */}
        <div className="space-y-2 text-right">
          {isMissionActive && mission ? (
            <div className="pointer-events-auto bg-[#070e1b]/95 border border-emerald-500/50 rounded-xl px-4 py-3 shadow-2xl space-y-1 min-w-[230px]">
              <div className="flex items-center justify-between gap-3 text-[11px] font-mono">
                <span className="text-emerald-400 font-bold">
                  ACTIVE DISPATCH
                </span>
                <span className="text-slate-400">
                  DIFF: {settings.difficulty}
                </span>
              </div>

              <div
                className={`text-3xl font-bold font-mono tabular-nums flex items-center justify-end gap-2 ${
                  mission.remainingTimeSeconds <= 12
                    ? 'text-rose-400'
                    : 'text-white'
                }`}
              >
                <Clock className="w-5 h-5 text-emerald-400" />
                {formatCountdown(mission.remainingTimeSeconds)}
              </div>

              <div className="text-xs font-semibold text-slate-200 truncate">
                Target: {mission.destinationName}
              </div>
              <div className="text-[11px] font-mono text-slate-400 tabular-nums">
                Priority Grants: {mission.signalsGrantedPriority} · Crossed:{' '}
                {mission.intersectionsCrossed}
              </div>
            </div>
          ) : (
            <div className="pointer-events-auto bg-[#070e1b]/90 border border-slate-800 rounded-xl px-4 py-2.5 shadow-xl space-y-1">
              <div className="text-[11px] font-mono text-slate-400">
                DIFFICULTY:{' '}
                <span className="text-white font-bold">
                  {settings.difficulty}
                </span>
              </div>
              <div className="text-xs text-slate-200">
                Press{' '}
                <button
                  onClick={onTriggerCapsLockSiren}
                  className="px-2 py-0.5 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono font-bold cursor-pointer"
                >
                  CAPS LOCK
                </button>{' '}
                to Start Mission
              </div>
            </div>
          )}

          {/* Cancel Mission Confirmation Prompt (When Caps Lock is pressed during active mission) */}
          {showCancelMissionConfirm && isMissionActive && (
            <div className="pointer-events-auto bg-[#0a1324] border border-amber-500/70 rounded-xl p-3 shadow-2xl text-left space-y-2 max-w-xs">
              <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <XCircle className="w-4 h-4 shrink-0" />
                Cancel Active Emergency Mission?
              </div>
              <p className="text-[11px] text-slate-300 leading-snug">
                Cancelling will stop the siren, safely release traffic signal
                priority, and return to Free Roam.
              </p>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  onClick={onDismissCancelMission}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold cursor-pointer"
                >
                  Keep Driving
                </button>
                <button
                  onClick={onConfirmCancelMission}
                  className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold cursor-pointer"
                >
                  Confirm Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* BOTTOM ROW: BOTTOM-LEFT (Minimap) | BOTTOM-CENTER (Speedometer) | BOTTOM-RIGHT (Navigation Guidance) */}
      <div className="flex items-end justify-between gap-4">
        {/* BOTTOM LEFT: Real Road-Graph Minimap */}
        <div>
          {settings.minimapVisible && (
            <MinimapCanvas
              player={player}
              activeRoute={activeRoute}
              activeDestinationId={mission?.destinationNodeId || null}
              intersections={intersections}
              backgroundEmergency={backgroundEmergency}
              rotateWithPlayer={settings.minimapRotateWithPlayer}
              onToggleRotationMode={onToggleMinimapRotate}
            />
          )}
        </div>

        {/* BOTTOM CENTER: Speedometer, Gear, Siren Indicator & Vehicle Condition */}
        <div className="pointer-events-auto bg-[#070e1b]/95 border border-slate-700/90 rounded-2xl px-5 py-3 shadow-2xl flex items-center gap-5 font-mono tabular-nums">
          {/* Speed Readout */}
          <div className="min-w-[92px]">
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-bold text-white">{speedKmh}</span>
              <span className="text-xs text-slate-400">km/h</span>
            </div>
            <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1">
              <div
                className="h-full bg-emerald-400 transition-transform duration-75 origin-left"
                style={{ transform: `scaleX(${speedPct / 100})` }}
              />
            </div>
          </div>

          {/* Gear Indicator */}
          <div className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-center">
            <div className="text-[9px] text-slate-400 font-sans">GEAR</div>
            <div
              className={`text-sm font-bold ${
                player.gear === 'R'
                  ? 'text-amber-400'
                  : player.gear === 'D'
                    ? 'text-emerald-400'
                    : 'text-slate-300'
              }`}
            >
              {player.gear}
            </div>
          </div>

          {/* Interactive Siren Status Button (Also triggered via CAPS LOCK) */}
          <button
            onClick={onTriggerCapsLockSiren}
            className={`px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors ${
              player.sirenActive
                ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-700'
            }`}
            title="Press CAPS LOCK to toggle Siren & Emergency Mission"
          >
            <Siren className="w-4 h-4" />
            <div className="text-left leading-tight">
              <div>{player.sirenActive ? 'SIREN ON' : 'SIREN OFF'}</div>
              <div className="text-[9px] opacity-80">[CAPS LOCK]</div>
            </div>
          </button>

          {/* Vehicle Condition */}
          <div className="hidden sm:block text-right">
            <div className="text-[10px] text-slate-400 font-sans">
              Condition
            </div>
            <div
              className={`text-xs font-bold ${
                player.condition > 70 ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {Math.round(player.condition)}%
            </div>
          </div>
        </div>

        {/* BOTTOM RIGHT: Navigation Guidance, Next Turn, Remaining Distance & ETA */}
        <div className="w-72 md:w-80 pointer-events-auto">
          {isMissionActive && navigation ? (
            <div className="bg-[#070e1b]/95 border border-slate-700/90 rounded-2xl p-4 shadow-2xl space-y-2.5">
              {navigation.isRerouting && (
                <div className="px-2.5 py-1 rounded-md bg-amber-500/20 border border-amber-500/50 text-amber-300 text-[11px] font-mono font-bold">
                  REROUTING FROM CURRENT POSITION...
                </div>
              )}

              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                  {renderTurnIcon()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-white leading-snug">
                    {navigation.instructionText}
                  </div>
                  <div className="text-[11px] text-slate-400 truncate mt-0.5">
                    {navigation.subInstructionText}
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800/90 flex items-center justify-between text-xs font-mono tabular-nums">
                <div>
                  <span className="text-slate-400">Dist: </span>
                  <span className="text-white font-bold">
                    {navigation.remainingDistanceMeters} m
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">ETA: </span>
                  <span className="text-emerald-400 font-bold">
                    {navigation.etaSeconds.toFixed(1)} s
                  </span>
                </div>
                {navigation.nextIntersectionId && (
                  <div className="flex items-center gap-1">
                    <span className="text-slate-400">
                      {navigation.nextIntersectionId}:
                    </span>
                    <span
                      className={`font-bold ${
                        navigation.nextIntersectionLamp === 'GREEN'
                          ? 'text-emerald-400'
                          : navigation.nextIntersectionLamp === 'YELLOW'
                            ? 'text-amber-400'
                            : 'text-rose-400'
                      }`}
                    >
                      {navigation.nextIntersectionLamp}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-[#070e1b]/90 border border-slate-800 rounded-2xl p-3.5 shadow-xl text-xs space-y-1">
              <div className="font-bold text-white flex items-center justify-between">
                <span>Free Roam Navigation</span>
                <span className="font-mono text-emerald-400">
                  {player.currentCardinal}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Explore the city freely. Press{' '}
                <strong className="text-emerald-400">CAPS LOCK</strong> anytime
                to dispatch an emergency mission to the nearest reachable{' '}
                {player.type === 'AMBULANCE'
                  ? 'Hospital'
                  : player.type === 'FIRE_BRIGADE'
                    ? 'Fire Station'
                    : 'Police Station'}
                .
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
