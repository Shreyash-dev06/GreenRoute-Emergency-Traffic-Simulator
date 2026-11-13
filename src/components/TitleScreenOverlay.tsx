import React, { useState } from 'react';
import {
  Play,
  BookOpen,
  Settings,
  Siren,
  Shield,
  Flame,
  HeartPulse,
  ArrowLeft,
  Check,
  X,
} from 'lucide-react';
import { EmergencyType, GameScreenState } from '../types/greenroute';

interface TitleAndVehicleSelectProps {
  screenState: GameScreenState;
  selectedVehicleType: EmergencyType;
  onHighlightVehicle: (type: EmergencyType) => void;
  onClickPlayGame: () => void;
  onConfirmSelectVehicle: (type: EmergencyType) => void;
  onBackToIntro: () => void;
  onOpenSettings: () => void;
}

const VEHICLE_SPECS: Array<{
  type: EmergencyType;
  title: string;
  badge: string;
  missionType: string;
  targetType: string;
  topSpeedKmh: number;
  accelRating: string;
  appearance: string;
  accentColor: string;
}> = [
  {
    type: 'AMBULANCE',
    title: 'Ambulance Unit',
    badge: 'MEDICAL RESPONDER',
    missionType: 'Medical Emergency Missions',
    targetType: 'Nearest Reachable Hospital (4 in City)',
    topSpeedKmh: 137,
    accelRating: 'Balanced Handling & High Stability',
    appearance:
      'White ambulance with red medical markings and flashing red/cyan emergency lightbar.',
    accentColor: 'text-sky-400 border-sky-500/50',
  },
  {
    type: 'FIRE_BRIGADE',
    title: 'Fire Brigade Engine',
    badge: 'HEAVY FIRE & RESCUE',
    missionType: 'Fire Emergency Missions',
    targetType: 'Nearest Reachable Fire Station (4 in City)',
    topSpeedKmh: 122,
    accelRating: 'High Momentum & Heavy Duty Chassis',
    appearance:
      'Red fire engine with aerial extension ladder and flashing red/amber emergency lights.',
    accentColor: 'text-rose-400 border-rose-500/50',
  },
  {
    type: 'POLICE',
    title: 'Police Patrol Vehicle',
    badge: 'TACTICAL INTERCEPTOR',
    missionType: 'Police Emergency Missions',
    targetType: 'Nearest Reachable Police Station (4 in City)',
    topSpeedKmh: 151,
    accelRating: 'Rapid Acceleration & Sharp Cornering',
    appearance:
      'High-speed police cruiser with interceptor markings and red/blue strobe lightbar.',
    accentColor: 'text-blue-400 border-blue-500/50',
  },
];

export const TitleScreenOverlay: React.FC<TitleAndVehicleSelectProps> = ({
  screenState,
  selectedVehicleType,
  onHighlightVehicle,
  onClickPlayGame,
  onConfirmSelectVehicle,
  onBackToIntro,
  onOpenSettings,
}) => {
  const [showHowToPlay, setShowHowToPlay] = useState(false);

  if (screenState === 'PLAYING') return null;

  return (
    <div className="fixed inset-0 z-30 pointer-events-none flex flex-col justify-between p-6 md:p-10">
      {/* SCREEN 1: CINEMATIC GAME INTRO */}
      {screenState === 'INTRO' && (
        <>
          {/* Top Minimal Identity Strip */}
          <div className="flex items-center justify-between text-xs text-slate-300 font-mono">
            <span>
              GreenRoute: Intelligent Emergency Vehicle Traffic Signal Priority
              &amp; Coordination System
            </span>
            <span>3D Open-World Emergency Driving Game</span>
          </div>

          {/* Left-Aligned Cinematic Title Lockup leaving 65%+ of the live 3D city ambulance unobstructed */}
          <div className="my-auto max-w-xl pointer-events-auto bg-[#070e1b]/90 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6">
            <div className="flex items-center gap-4">
              <svg
                width="54"
                height="54"
                viewBox="0 0 64 64"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="shrink-0"
                aria-hidden="true"
              >
                <rect
                  x="4"
                  y="4"
                  width="56"
                  height="56"
                  rx="14"
                  fill="#06281E"
                  stroke="#10B981"
                  strokeWidth="2"
                />
                <rect
                  x="14"
                  y="11"
                  width="16"
                  height="42"
                  rx="5"
                  fill="#0F172A"
                  stroke="#334155"
                  strokeWidth="1.5"
                />
                <circle cx="22" cy="19" r="4" fill="#EF4444" fillOpacity="0.4" />
                <circle cx="22" cy="32" r="4" fill="#F59E0B" fillOpacity="0.4" />
                <circle cx="22" cy="45" r="4.5" fill="#10B981" />
                <path
                  d="M35 24C39 24 42 27 42 31M35 18C42.5 18 48 23.5 48 31"
                  stroke="#10B981"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
                <rect
                  x="34"
                  y="36"
                  width="18"
                  height="11"
                  rx="2.5"
                  fill="#F8FAFC"
                />
                <path
                  d="M43 39V44M40.5 41.5H45.5"
                  stroke="#EF4444"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>

              <div>
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white font-display">
                  GREENROUTE
                </h1>
                <p className="text-emerald-400 font-semibold text-base md:text-lg mt-0.5">
                  Drive Fast. Save Time. Clear the Way.
                </p>
              </div>
            </div>

            <div className="text-sm text-slate-300 leading-relaxed space-y-1">
              <p className="font-semibold text-white">
                Developed By Shreyash Ahire
              </p>
              <p className="text-xs text-slate-400">
                Take manual control of an emergency response vehicle across an
                open-world 3D city. Activate your siren with{' '}
                <strong className="text-emerald-400">CAPS LOCK</strong> to
                trigger real-time road-graph routing and early traffic-signal
                preemption before the mission timer runs out.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={onClickPlayGame}
                className="px-7 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm rounded-xl flex items-center gap-2 cursor-pointer transition-colors shadow-lg whitespace-nowrap"
              >
                <Play className="w-4 h-4 fill-current" />
                PLAY GAME
              </button>

              <button
                onClick={() => setShowHowToPlay(true)}
                className="px-5 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 font-semibold text-sm rounded-xl flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap"
              >
                <BookOpen className="w-4 h-4 text-emerald-400" />
                HOW TO PLAY
              </button>

              <button
                onClick={onOpenSettings}
                className="px-5 py-3.5 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-semibold text-sm rounded-xl flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap"
              >
                <Settings className="w-4 h-4 text-slate-400" />
                SETTINGS
              </button>
            </div>
          </div>

          {/* Bottom Flat Control Hint Line */}
          <div className="bg-[#070e1b]/85 border border-slate-800/90 rounded-xl px-4 py-2.5 text-xs font-mono text-slate-300 flex flex-wrap items-center justify-between gap-2">
            <span>
              WASD / Arrows: Drive · CAPS LOCK: Toggle Siren &amp; Start Mission
              · SPACE: Handbrake · R: Reset Car · C: Camera · M: Minimap · ESC:
              Pause
            </span>
            <span className="text-emerald-400">Developed By Shreyash Ahire</span>
          </div>
        </>
      )}

      {/* SCREEN 2: 3D ROTATING VEHICLE SELECTION */}
      {screenState === 'VEHICLE_SELECT' && (
        <>
          <div className="pointer-events-auto flex items-center justify-between bg-[#070e1b]/90 border border-slate-800 rounded-xl px-5 py-3">
            <div className="flex items-center gap-3">
              <button
                onClick={onBackToIntro}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back
              </button>
              <div>
                <h2 className="text-lg font-bold text-white font-display">
                  SELECT EMERGENCY VEHICLE
                </h2>
                <p className="text-xs text-slate-400">
                  Live 3D rotating preview in center · Spawns at a valid random
                  city road location in Free Roam
                </p>
              </div>
            </div>

            <button
              onClick={onOpenSettings}
              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5 text-emerald-400" />
              Settings
            </button>
          </div>

          {/* Bottom Vehicle Cards + SELECT VEHICLE CTA (Leaves center 3D rotating vehicle unobstructed) */}
          <div className="pointer-events-auto bg-[#070e1b]/95 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4 max-w-5xl mx-auto w-full">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {VEHICLE_SPECS.map((spec) => {
                const isSelected = selectedVehicleType === spec.type;
                const Icon =
                  spec.type === 'AMBULANCE'
                    ? HeartPulse
                    : spec.type === 'FIRE_BRIGADE'
                      ? Flame
                      : Shield;
                return (
                  <div
                    key={spec.type}
                    onClick={() => onHighlightVehicle(spec.type)}
                    className={`p-4 rounded-xl border transition-colors cursor-pointer flex flex-col justify-between space-y-3 ${
                      isSelected
                        ? 'bg-slate-900 border-emerald-500 shadow-lg'
                        : 'bg-[#0a1324] border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-[11px] font-mono font-bold ${
                            spec.accentColor.split(' ')[0]
                          }`}
                        >
                          {spec.badge}
                        </span>
                        <Icon
                          className={`w-4 h-4 ${spec.accentColor.split(' ')[0]}`}
                        />
                      </div>

                      <h3 className="text-lg font-bold text-white font-display">
                        {spec.title}
                      </h3>

                      <p className="text-xs text-slate-300 leading-relaxed">
                        {spec.appearance}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 space-y-1 text-xs">
                      <div className="text-slate-300">
                        <strong className="text-white">Missions:</strong>{' '}
                        {spec.missionType}
                      </div>
                      <div className="text-slate-300">
                        <strong className="text-white">Destination:</strong>{' '}
                        <span className="text-emerald-400">
                          {spec.targetType}
                        </span>
                      </div>
                      <div className="text-slate-400 font-mono text-[11px] tabular-nums pt-1">
                        Top Speed: {spec.topSpeedKmh} km/h · {spec.accelRating}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-800">
              <div className="text-xs text-slate-300">
                Selected:{' '}
                <strong className="text-emerald-400">
                  {
                    VEHICLE_SPECS.find((s) => s.type === selectedVehicleType)
                      ?.title
                  }
                </strong>{' '}
                — Once spawned in Free Roam, press{' '}
                <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-white">
                  CAPS LOCK
                </kbd>{' '}
                anytime to activate the siren and start a mission.
              </div>

              <button
                onClick={() => onConfirmSelectVehicle(selectedVehicleType)}
                className="px-7 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm rounded-xl flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap shadow-lg"
              >
                <Check className="w-4 h-4 stroke-[2.5]" />
                SELECT VEHICLE
              </button>
            </div>
          </div>
        </>
      )}

      {/* HOW TO PLAY MODAL */}
      {showHowToPlay && (
        <div className="fixed inset-0 z-50 pointer-events-auto flex items-center justify-center p-4 bg-[#070e1b]/85">
          <div className="w-full max-w-3xl bg-[#0a1324] border border-slate-700 rounded-2xl p-6 md:p-8 text-slate-100 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-2xl font-bold text-white font-display">
                  HOW TO PLAY · GREENROUTE
                </h2>
                <p className="text-xs text-slate-400">
                  Controls, Emergency Siren Missions &amp; Traffic Signal
                  Preemption
                </p>
              </div>
              <button
                onClick={() => setShowHowToPlay(false)}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-[#070e1b] border border-slate-800 space-y-2">
                <div className="text-sm font-bold text-emerald-400">
                  Driving &amp; Camera Controls
                </div>
                <ul className="space-y-1.5 font-mono text-slate-200">
                  <li>
                    <strong className="text-white">W / Up Arrow:</strong>{' '}
                    Accelerate forward
                  </li>
                  <li>
                    <strong className="text-white">S / Down Arrow:</strong>{' '}
                    Brake or Reverse
                  </li>
                  <li>
                    <strong className="text-white">A / D or Left/Right:</strong>{' '}
                    Steer left / right
                  </li>
                  <li>
                    <strong className="text-white">SPACE:</strong> Handbrake for
                    sharp turns
                  </li>
                  <li>
                    <strong className="text-white">CAPS LOCK:</strong> Activate
                    Siren &amp; Start Mission
                  </li>
                  <li>
                    <strong className="text-white">R:</strong> Reset vehicle to
                    nearest safe road
                  </li>
                  <li>
                    <strong className="text-white">C:</strong> Switch Camera
                    (Chase / Elevated / Top-Down)
                  </li>
                  <li>
                    <strong className="text-white">M:</strong> Toggle Minimap
                  </li>
                  <li>
                    <strong className="text-white">ESC:</strong> Pause / Resume
                    Game
                  </li>
                </ul>
              </div>

              <div className="p-4 rounded-xl bg-[#070e1b] border border-slate-800 space-y-2.5 leading-relaxed text-slate-300">
                <div className="text-sm font-bold text-sky-400 flex items-center gap-1.5">
                  <Siren className="w-4 h-4" />
                  Mission &amp; Signal Priority Loop
                </div>
                <p>
                  1. <strong className="text-white">Free Roam:</strong> Explore
                  the 49-intersection city freely without a timer.
                </p>
                <p>
                  2. <strong className="text-white">Press CAPS LOCK:</strong>{' '}
                  Activates your siren, locates the nearest reachable Hospital,
                  Fire Station, or Police Station via the road graph, highlights
                  the green route, and starts the mission countdown.
                </p>
                <p>
                  3.{' '}
                  <strong className="text-white">
                    Early GreenRoute Preemption:
                  </strong>{' '}
                  Upcoming intersections detect your ETA and transition through
                  Yellow &rarr; All-Red &rarr; Emergency Green before you
                  arrive.
                </p>
                <p>
                  4. <strong className="text-white">Wrong Turns:</strong> If you
                  miss a turn, the navigation system automatically recalculates
                  your route (<strong className="text-amber-400">REROUTING</strong>
                  ).
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowHowToPlay(false)}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowHowToPlay(false);
                  onClickPlayGame();
                }}
                className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl cursor-pointer"
              >
                PLAY GAME
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
