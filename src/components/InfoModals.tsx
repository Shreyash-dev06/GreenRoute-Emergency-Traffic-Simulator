import React, { useState } from 'react';
import {
  Play,
  RotateCcw,
  Compass,
  Settings,
  Home,
  CheckCircle2,
  AlertOctagon,
  Volume2,
  VolumeX,
  Sliders,
  X,
} from 'lucide-react';
import {
  ActiveMissionState,
  DifficultyLevel,
  GameSettings,
  PlayMode,
  PriorityPolicyMode,
} from '../types/greenroute';

interface PauseAndSettingsModalProps {
  isOpen: boolean;
  settingsOnlyMode?: boolean;
  playMode: PlayMode;
  settings: GameSettings;
  onUpdateSettings: (partial: Partial<GameSettings>) => void;
  onResume: () => void;
  onRestartMission: () => void;
  onReturnToFreeRoam: () => void;
  onGoToMainMenu: () => void;
}

export const PauseAndSettingsModal: React.FC<PauseAndSettingsModalProps> = ({
  isOpen,
  settingsOnlyMode = false,
  playMode,
  settings,
  onUpdateSettings,
  onResume,
  onRestartMission,
  onReturnToFreeRoam,
  onGoToMainMenu,
}) => {
  const [showSettingsTab, setShowSettingsTab] = useState(settingsOnlyMode);

  if (!isOpen) return null;

  const isSettingsView = settingsOnlyMode || showSettingsTab;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#070e1b]/85">
      <div className="w-full max-w-xl bg-[#0a1324] border border-slate-700 rounded-2xl p-6 md:p-8 text-slate-100 shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <div className="text-xs font-mono text-emerald-400">
              {isSettingsView ? 'GAME CONFIGURATION' : 'GAME PAUSED · [ESC]'}
            </div>
            <h2 className="text-2xl font-bold text-white font-display">
              {isSettingsView ? 'SETTINGS' : 'PAUSE MENU'}
            </h2>
          </div>
          <button
            onClick={onResume}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
            aria-label="Close Menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {!isSettingsView ? (
          <div className="space-y-3">
            <button
              onClick={onResume}
              className="w-full py-3.5 px-5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <Play className="w-4 h-4 fill-current" />
              RESUME GAME
            </button>

            <button
              onClick={onRestartMission}
              className="w-full py-3 px-5 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <RotateCcw className="w-4 h-4 text-emerald-400" />
              {playMode === 'EMERGENCY_MISSION'
                ? 'RESTART CURRENT MISSION'
                : 'START NEW EMERGENCY MISSION'}
            </button>

            {playMode === 'EMERGENCY_MISSION' && (
              <button
                onClick={onReturnToFreeRoam}
                className="w-full py-3 px-5 bg-slate-800 hover:bg-slate-700 text-amber-300 font-semibold text-sm rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <Compass className="w-4 h-4" />
                CANCEL MISSION &amp; RETURN TO FREE ROAM
              </button>
            )}

            <button
              onClick={() => setShowSettingsTab(true)}
              className="w-full py-3 px-5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-semibold text-sm rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <Settings className="w-4 h-4 text-sky-400" />
              SETTINGS
            </button>

            <button
              onClick={onGoToMainMenu}
              className="w-full py-3 px-5 bg-slate-900 hover:bg-rose-950/60 border border-slate-800 text-rose-300 font-semibold text-sm rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <Home className="w-4 h-4" />
              MAIN MENU
            </button>
          </div>
        ) : (
          <div className="space-y-4 text-xs">
            {/* Audio Controls */}
            <div className="p-4 rounded-xl bg-[#070e1b] border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white flex items-center gap-1.5">
                  {settings.isMuted ? (
                    <VolumeX className="w-4 h-4 text-rose-400" />
                  ) : (
                    <Volume2 className="w-4 h-4 text-emerald-400" />
                  )}
                  Audio &amp; Siren Volume
                </span>
                <button
                  onClick={() =>
                    onUpdateSettings({ isMuted: !settings.isMuted })
                  }
                  className={`px-3 py-1 rounded-lg font-mono font-semibold cursor-pointer ${
                    settings.isMuted
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  }`}
                >
                  {settings.isMuted ? 'MUTED' : 'AUDIO ON'}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex justify-between text-slate-300 mb-1">
                    <span>Master Volume</span>
                    <span className="font-mono">
                      {Math.round(settings.masterVolume * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={settings.masterVolume}
                    onChange={(e) =>
                      onUpdateSettings({
                        masterVolume: parseFloat(e.target.value),
                      })
                    }
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-slate-300 mb-1">
                    <span>Siren Volume</span>
                    <span className="font-mono">
                      {Math.round(settings.sirenVolume * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={settings.sirenVolume}
                    onChange={(e) =>
                      onUpdateSettings({
                        sirenVolume: parseFloat(e.target.value),
                      })
                    }
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Difficulty & Priority Policy */}
            <div className="p-4 rounded-xl bg-[#070e1b] border border-slate-800 space-y-3">
              <div className="font-bold text-white flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-sky-400" />
                Difficulty &amp; GreenRoute Priority Policy
              </div>

              <div className="space-y-1.5">
                <span className="text-slate-400 block">Mission Difficulty</span>
                <div className="grid grid-cols-3 gap-2">
                  {(['EASY', 'NORMAL', 'HARD'] as DifficultyLevel[]).map(
                    (diff) => (
                      <button
                        key={diff}
                        onClick={() => onUpdateSettings({ difficulty: diff })}
                        className={`py-2 rounded-lg font-bold cursor-pointer ${
                          settings.difficulty === diff
                            ? 'bg-emerald-500 text-slate-950'
                            : 'bg-slate-900 text-slate-300 border border-slate-700'
                        }`}
                      >
                        {diff}
                      </button>
                    ),
                  )}
                </div>
              </div>

              <div className="space-y-1.5 pt-1">
                <span className="text-slate-400 block">
                  Competing Emergency Arbitration Policy
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'EMERGENCY_CLASS_FIRST', label: 'Class + ETA' },
                      { id: 'ETA_FIRST', label: 'Shortest ETA' },
                      { id: 'FIFO_FIRST', label: 'FIFO Order' },
                    ] as Array<{ id: PriorityPolicyMode; label: string }>
                  ).map((pol) => (
                    <button
                      key={pol.id}
                      onClick={() =>
                        onUpdateSettings({ priorityPolicy: pol.id })
                      }
                      className={`py-2 rounded-lg font-semibold cursor-pointer ${
                        settings.priorityPolicy === pol.id
                          ? 'bg-sky-500 text-slate-950'
                          : 'bg-slate-900 text-slate-300 border border-slate-700'
                      }`}
                    >
                      {pol.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Driving, Camera & World Toggles */}
            <div className="p-4 rounded-xl bg-[#070e1b] border border-slate-800 space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex justify-between text-slate-300 mb-1">
                    <span>Steering Sensitivity</span>
                    <span className="font-mono">
                      {settings.drivingSensitivity.toFixed(1)}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.6}
                    max={1.5}
                    step={0.1}
                    value={settings.drivingSensitivity}
                    onChange={(e) =>
                      onUpdateSettings({
                        drivingSensitivity: parseFloat(e.target.value),
                      })
                    }
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-slate-300 mb-1">
                    <span>Camera Follow Speed</span>
                    <span className="font-mono">
                      {settings.cameraSensitivity.toFixed(1)}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.6}
                    max={1.5}
                    step={0.1}
                    value={settings.cameraSensitivity}
                    onChange={(e) =>
                      onUpdateSettings({
                        cameraSensitivity: parseFloat(e.target.value),
                      })
                    }
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
                <button
                  onClick={() =>
                    onUpdateSettings({
                      backgroundEmergencyTraffic:
                        !settings.backgroundEmergencyTraffic,
                    })
                  }
                  className={`py-2 px-3 rounded-lg font-semibold border cursor-pointer ${
                    settings.backgroundEmergencyTraffic
                      ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                      : 'bg-slate-900 border-slate-700 text-slate-400'
                  }`}
                >
                  AI Emergency Traffic:{' '}
                  {settings.backgroundEmergencyTraffic ? 'ON' : 'OFF'}
                </button>

                <button
                  onClick={() =>
                    onUpdateSettings({
                      minimapVisible: !settings.minimapVisible,
                    })
                  }
                  className={`py-2 px-3 rounded-lg font-semibold border cursor-pointer ${
                    settings.minimapVisible
                      ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                      : 'bg-slate-900 border-slate-700 text-slate-400'
                  }`}
                >
                  Minimap (M): {settings.minimapVisible ? 'ON' : 'OFF'}
                </button>

                <button
                  onClick={() =>
                    onUpdateSettings({
                      simplifiedCollisions: !settings.simplifiedCollisions,
                    })
                  }
                  className={`py-2 px-3 rounded-lg font-semibold border cursor-pointer ${
                    settings.simplifiedCollisions
                      ? 'bg-amber-950/60 border-amber-500/50 text-amber-300'
                      : 'bg-slate-900 border-slate-700 text-slate-400'
                  }`}
                >
                  Simple Collisions:{' '}
                  {settings.simplifiedCollisions ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-1">
              {!settingsOnlyMode && (
                <button
                  onClick={() => setShowSettingsTab(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl cursor-pointer"
                >
                  Back to Pause Menu
                </button>
              )}
              <button
                onClick={onResume}
                className="px-6 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl cursor-pointer"
              >
                Save &amp; Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface MissionOutcomeModalProps {
  playMode: PlayMode;
  mission: ActiveMissionState | null;
  vehicleCondition: number;
  onRetryOrPlayAgain: () => void;
  onReturnToFreeRoam: () => void;
}

export const MissionOutcomeModal: React.FC<MissionOutcomeModalProps> = ({
  playMode,
  mission,
  vehicleCondition,
  onRetryOrPlayAgain,
  onReturnToFreeRoam,
}) => {
  if (
    !mission ||
    (playMode !== 'MISSION_SUCCESS' && playMode !== 'MISSION_FAILED')
  ) {
    return null;
  }

  const isSuccess = playMode === 'MISSION_SUCCESS';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#070e1b]/85">
      <div
        className={`w-full max-w-2xl bg-[#0a1324] border rounded-2xl p-6 md:p-8 text-slate-100 shadow-2xl space-y-6 ${
          isSuccess ? 'border-emerald-500/60' : 'border-rose-500/60'
        }`}
      >
        <div className="flex items-start gap-4 border-b border-slate-800 pb-4">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
              isSuccess
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
            }`}
          >
            {isSuccess ? (
              <CheckCircle2 className="w-7 h-7" />
            ) : (
              <AlertOctagon className="w-7 h-7" />
            )}
          </div>
          <div>
            <div
              className={`text-xs font-mono font-bold ${
                isSuccess ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {isSuccess ? 'EMERGENCY RESPONSE SUCCESS' : 'RESPONSE DEADLINE EXPIRED'}
            </div>
            <h2 className="text-3xl font-bold text-white font-display">
              {isSuccess ? 'MISSION COMPLETED' : 'MISSION FAILED'}
            </h2>
            <p className="text-xs text-slate-300 mt-1">
              {isSuccess
                ? `Arrived at ${mission.destinationName} (${mission.destinationDistrict}) with ${mission.remainingTimeSeconds.toFixed(1)}s remaining.`
                : mission.failureReason ||
                  `Failed to reach ${mission.destinationName} before the ${mission.deadlineTotalSeconds.toFixed(0)}s countdown expired.`}
            </p>
          </div>
        </div>

        {/* Mission Performance Telemetry Grid (tabular-nums) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 font-mono tabular-nums">
          <div className="p-3.5 rounded-xl bg-[#070e1b] border border-slate-800">
            <div className="text-[11px] text-slate-400 font-sans">
              Completion Time
            </div>
            <div className="text-lg font-bold text-white mt-0.5">
              {mission.elapsedTimeSeconds.toFixed(1)}s{' '}
              <span className="text-xs text-slate-400">
                / {mission.deadlineTotalSeconds.toFixed(0)}s
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#070e1b] border border-slate-800">
            <div className="text-[11px] text-slate-400 font-sans">
              Route Distance
            </div>
            <div className="text-lg font-bold text-white mt-0.5">
              {mission.initialRouteDistanceMeters} m
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#070e1b] border border-slate-800">
            <div className="text-[11px] text-slate-400 font-sans">
              Intersections Crossed
            </div>
            <div className="text-lg font-bold text-emerald-400 mt-0.5">
              {mission.intersectionsCrossed}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#070e1b] border border-slate-800">
            <div className="text-[11px] text-slate-400 font-sans">
              Signals Granted Priority
            </div>
            <div className="text-lg font-bold text-emerald-400 mt-0.5">
              {mission.signalsGrantedPriority}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#070e1b] border border-slate-800">
            <div className="text-[11px] text-slate-400 font-sans">
              Red-Signal Stops
            </div>
            <div className="text-lg font-bold text-amber-400 mt-0.5">
              {mission.redSignalStopsCount}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#070e1b] border border-slate-800">
            <div className="text-[11px] text-slate-400 font-sans">
              Final Score
            </div>
            <div className="text-xl font-bold text-sky-400 mt-0.5">
              {isSuccess ? mission.score : 0} pts
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
          <span>Vehicle Integrity: {Math.round(vehicleCondition)}%</span>
          <span>
            Signal Priority Safely Released · Intersections Restored to Normal
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-slate-800">
          <button
            onClick={onReturnToFreeRoam}
            className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-xs rounded-xl flex items-center gap-2 cursor-pointer"
          >
            <Compass className="w-4 h-4 text-emerald-400" />
            RETURN TO FREE ROAM
          </button>

          <button
            onClick={onRetryOrPlayAgain}
            className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer shadow-lg"
          >
            <RotateCcw className="w-4 h-4" />
            {isSuccess ? 'PLAY AGAIN (NEW MISSION)' : 'RETRY MISSION'}
          </button>
        </div>
      </div>
    </div>
  );
};
