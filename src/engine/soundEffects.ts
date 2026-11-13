import { EmergencyType } from '../types/greenroute';

class GreenRouteAudioEngine {
  private ctx: AudioContext | null = null;
  private sirenOsc: OscillatorNode | null = null;
  private sirenGain: GainNode | null = null;
  private sirenTimer: number | null = null;
  private activeSirenType: EmergencyType | null = null;

  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;

  private isMuted = false;
  private masterVolume = 0.5;
  private sirenVolume = 0.45;
  private phaseStep = 0;
  private userInteracted = false;

  public markUserInteraction() {
    this.userInteracted = true;
    this.ensureContext();
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined' || !this.userInteracted) return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public configureAudio(
    masterVolume: number,
    sirenVolume: number,
    isMuted: boolean,
  ) {
    this.masterVolume = Math.max(0, Math.min(1, masterVolume));
    this.sirenVolume = Math.max(0, Math.min(1, sirenVolume));
    this.isMuted = isMuted;

    if (isMuted) {
      this.stopSirenLoop();
      this.stopEngineSound();
    } else if (this.sirenGain && this.ctx) {
      this.sirenGain.gain.setTargetAtTime(
        this.masterVolume * this.sirenVolume * 0.16,
        this.ctx.currentTime,
        0.05,
      );
    }
  }

  public updateEngineHum(speedMps: number, isPlaying: boolean) {
    if (this.isMuted || !isPlaying || !this.userInteracted) {
      this.stopEngineSound();
      return;
    }

    const ctx = this.ensureContext();
    if (!ctx) return;

    try {
      if (!this.engineOsc || !this.engineGain) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(52, ctx.currentTime);
        gain.gain.setValueAtTime(0.01, ctx.currentTime);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        this.engineOsc = osc;
        this.engineGain = gain;
      }

      const absSpd = Math.abs(speedMps);
      const targetFreq = 48 + Math.min(42, absSpd) * 2.6;
      const targetGain =
        this.masterVolume * (0.018 + Math.min(1, absSpd / 35) * 0.035);

      this.engineOsc.frequency.setTargetAtTime(
        targetFreq,
        ctx.currentTime,
        0.06,
      );
      this.engineGain.gain.setTargetAtTime(targetGain, ctx.currentTime, 0.06);
    } catch {
      // Ignore audio errors
    }
  }

  public stopEngineSound() {
    if (this.engineOsc) {
      try {
        this.engineOsc.stop();
        this.engineOsc.disconnect();
      } catch {
        // ignore
      }
      this.engineOsc = null;
    }
    if (this.engineGain) {
      try {
        this.engineGain.disconnect();
      } catch {
        // ignore
      }
      this.engineGain = null;
    }
  }

  public updateSiren(activeType: EmergencyType | null, isPaused: boolean) {
    if (this.isMuted || isPaused || !activeType || !this.userInteracted) {
      this.stopSirenLoop();
      return;
    }

    if (this.activeSirenType === activeType && this.sirenOsc) {
      return;
    }

    this.stopSirenLoop();
    const ctx = this.ensureContext();
    if (!ctx) return;

    try {
      this.activeSirenType = activeType;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = activeType === 'FIRE_BRIGADE' ? 'sawtooth' : 'triangle';
      gain.gain.setValueAtTime(
        this.masterVolume * this.sirenVolume * 0.16,
        ctx.currentTime,
      );

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();

      this.sirenOsc = osc;
      this.sirenGain = gain;
      this.phaseStep = 0;

      this.sirenTimer = window.setInterval(
        () => {
          if (!this.sirenOsc || !this.ctx || this.isMuted) return;
          const now = this.ctx.currentTime;
          this.phaseStep++;

          if (activeType === 'AMBULANCE') {
            const freq = this.phaseStep % 2 === 0 ? 660 : 880;
            this.sirenOsc.frequency.setValueAtTime(freq, now);
          } else if (activeType === 'FIRE_BRIGADE') {
            const cycle = this.phaseStep % 6;
            const target =
              cycle < 3 ? 410 + cycle * 115 : 755 - (cycle - 3) * 115;
            this.sirenOsc.frequency.linearRampToValueAtTime(target, now + 0.28);
          } else {
            const freq = this.phaseStep % 2 === 0 ? 640 : 1040;
            this.sirenOsc.frequency.exponentialRampToValueAtTime(
              freq,
              now + 0.14,
            );
          }
        },
        activeType === 'POLICE' ? 160 : 350,
      );
    } catch {
      // Ignore
    }
  }

  public stopSirenLoop() {
    if (this.sirenTimer !== null) {
      clearInterval(this.sirenTimer);
      this.sirenTimer = null;
    }
    if (this.sirenOsc) {
      try {
        this.sirenOsc.stop();
        this.sirenOsc.disconnect();
      } catch {
        // ignore
      }
      this.sirenOsc = null;
    }
    if (this.sirenGain) {
      try {
        this.sirenGain.disconnect();
      } catch {
        // ignore
      }
      this.sirenGain = null;
    }
    this.activeSirenType = null;
  }

  public playChime(
    kind:
      | 'MISSION_START'
      | 'PRIORITY_GRANTED'
      | 'REROUTE'
      | 'COLLISION'
      | 'MISSION_SUCCESS'
      | 'MISSION_FAILED',
  ) {
    if (this.isMuted || !this.userInteracted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const baseVol = Math.max(0.02, this.masterVolume * 0.22);

      if (kind === 'MISSION_START') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.setValueAtTime(880.0, now + 0.11); // A5
        gain.gain.setValueAtTime(baseVol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (kind === 'PRIORITY_GRANTED') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.08);
        gain.gain.setValueAtTime(baseVol * 0.85, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
        osc.start(now);
        osc.stop(now + 0.25);
      } else if (kind === 'REROUTE') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(520, now + 0.08);
        gain.gain.setValueAtTime(baseVol * 0.75, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.start(now);
        osc.stop(now + 0.23);
      } else if (kind === 'COLLISION') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(110, now);
        osc.frequency.exponentialRampToValueAtTime(45, now + 0.15);
        gain.gain.setValueAtTime(baseVol * 0.9, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
        osc.start(now);
        osc.stop(now + 0.17);
      } else if (kind === 'MISSION_SUCCESS') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.11);
        osc.frequency.setValueAtTime(783.99, now + 0.22);
        osc.frequency.setValueAtTime(1046.5, now + 0.33);
        gain.gain.setValueAtTime(baseVol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
        osc.start(now);
        osc.stop(now + 0.56);
      } else if (kind === 'MISSION_FAILED') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(340, now);
        osc.frequency.setValueAtTime(250, now + 0.16);
        osc.frequency.setValueAtTime(180, now + 0.32);
        gain.gain.setValueAtTime(baseVol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.52);
      }
    } catch {
      // Ignore
    }
  }
}

export const soundEngine = new GreenRouteAudioEngine();
