'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePhantomStore } from '@/store/phantom-store';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Shield,
  ShieldAlert,
  ShieldOff,
  Eye,
  EyeOff,
  Timer,
  Wifi,
  WifiOff,
} from 'lucide-react';

type RiskLevel = 'green' | 'amber' | 'red';

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
  }
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

function getRiskLevel(
  opsecMode: 'passive' | 'active',
  proxyRotation: boolean,
  fingerprintRandomization: boolean
): RiskLevel {
  if (opsecMode === 'active') return 'red';
  if (!proxyRotation && !fingerprintRandomization) return 'red';
  if (!proxyRotation || !fingerprintRandomization) return 'amber';
  return 'green';
}

function getRiskWarnings(
  opsecMode: 'passive' | 'active',
  proxyRotation: boolean,
  fingerprintRandomization: boolean
): string[] {
  const warnings: string[] = [];
  if (opsecMode === 'active') {
    warnings.push('Active mode - direct target interaction');
  }
  if (!proxyRotation) {
    warnings.push('Proxy rotation disabled');
  }
  if (!fingerprintRandomization) {
    warnings.push('Fingerprint exposed');
  }
  return warnings;
}

export default function OPSECStatusBar() {
  const opsecMode = usePhantomStore((s) => s.opsecMode);
  const setOpsecMode = usePhantomStore((s) => s.setOpsecMode);
  const proxyRotation = usePhantomStore((s) => s.proxyRotation);
  const setProxyRotation = usePhantomStore((s) => s.setProxyRotation);
  const fingerprintRandomization = usePhantomStore((s) => s.fingerprintRandomization);
  const setFingerprintRandomization = usePhantomStore((s) => s.setFingerprintRandomization);

  // Session timer
  const [sessionSeconds, setSessionSeconds] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setSessionSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Confirmation dialog for switching to active mode
  const [confirmActiveOpen, setConfirmActiveOpen] = useState(false);

  const handleModeToggle = useCallback(() => {
    if (opsecMode === 'passive') {
      setConfirmActiveOpen(true);
    } else {
      setOpsecMode('passive');
    }
  }, [opsecMode, setOpsecMode]);

  const confirmSwitchToActive = useCallback(() => {
    setOpsecMode('active');
    setConfirmActiveOpen(false);
  }, [setOpsecMode]);

  const riskLevel = getRiskLevel(opsecMode, proxyRotation, fingerprintRandomization);
  const warnings = getRiskWarnings(opsecMode, proxyRotation, fingerprintRandomization);

  // Risk indicator colors
  const riskColors: Record<RiskLevel, { bg: string; text: string; border: string; dot: string }> = {
    green: {
      bg: 'bg-emerald-950/60',
      text: 'text-emerald-400',
      border: 'border-emerald-800/50',
      dot: 'bg-emerald-400',
    },
    amber: {
      bg: 'bg-amber-950/60',
      text: 'text-amber-400',
      border: 'border-amber-800/50',
      dot: 'bg-amber-400',
    },
    red: {
      bg: 'bg-red-950/60',
      text: 'text-red-400',
      border: 'border-red-800/50',
      dot: 'bg-red-400',
    },
  };

  const rc = riskColors[riskLevel];

  // Shield icon based on risk
  const ShieldIcon = riskLevel === 'red' ? ShieldOff : riskLevel === 'amber' ? ShieldAlert : Shield;

  return (
    <>
      {/* OPSEC Status Bar */}
      <div
        className="h-7 shrink-0 flex items-center justify-between px-3 bg-card/60 backdrop-blur-md border-t border-cyan-500/15 select-none"
        role="status"
        aria-label="OPSEC Status Bar"
      >
        {/* Left section: Collection mode */}
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleModeToggle}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                  opsecMode === 'passive'
                    ? 'bg-emerald-950/80 text-emerald-400 hover:bg-emerald-900/80 border border-emerald-800/50'
                    : 'bg-amber-950/80 text-amber-400 hover:bg-amber-900/80 border border-amber-800/50'
                }`}
              >
                {opsecMode === 'passive' ? (
                  <Eye className="size-3" />
                ) : (
                  <EyeOff className="size-3" />
                )}
                {opsecMode === 'passive' ? 'Passive Mode' : 'Active Mode'}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {opsecMode === 'passive'
                ? 'Click to switch to Active Mode (higher risk - direct target interaction)'
                : 'Click to return to Passive Mode (safe - no direct interaction)'}
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Center section: OPSEC measures + timer */}
        <div className="flex items-center gap-4">
          {/* Proxy rotation */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setProxyRotation(!proxyRotation)}
                className={`flex items-center gap-1 text-[10px] font-medium transition-colors cursor-pointer ${
                  proxyRotation ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {proxyRotation ? (
                  <Wifi className="size-3" />
                ) : (
                  <WifiOff className="size-3" />
                )}
                <span className="hidden sm:inline">
                  {proxyRotation ? 'Proxy Rotation: Active' : 'Proxy Rotation: OFF'}
                </span>
                <span className="sm:hidden">
                  {proxyRotation ? 'Proxy: ON' : 'Proxy: OFF'}
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {proxyRotation
                ? 'Proxy rotation is active - Click to disable'
                : 'WARNING: Proxy rotation is disabled - Click to enable'}
            </TooltipContent>
          </Tooltip>

          {/* Separator */}
          <span className="text-cyan-500/20">|</span>

          {/* Fingerprint randomization */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setFingerprintRandomization(!fingerprintRandomization)}
                className={`flex items-center gap-1 text-[10px] font-medium transition-colors cursor-pointer ${
                  fingerprintRandomization ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {fingerprintRandomization ? (
                  <Shield className="size-3" />
                ) : (
                  <ShieldOff className="size-3" />
                )}
                <span className="hidden sm:inline">
                  {fingerprintRandomization ? 'Fingerprint Randomized' : 'Fingerprint: EXPOSED'}
                </span>
                <span className="sm:hidden">
                  {fingerprintRandomization ? 'FP: Safe' : 'FP: EXPOSED'}
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {fingerprintRandomization
                ? 'Browser fingerprint is randomized - Click to disable'
                : 'WARNING: Browser fingerprint is exposed - Click to enable'}
            </TooltipContent>
          </Tooltip>

          {/* Separator */}
          <span className="text-cyan-500/20">|</span>

          {/* Session timer */}
          <div className="flex items-center gap-1 text-[10px] text-cyan-400/60 font-mono">
            <Timer className="size-3" />
            <span>{formatDuration(sessionSeconds)}</span>
          </div>
        </div>

        {/* Right section: Risk assessment */}
        <div className="flex items-center gap-2">
          {/* Risk indicator */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${rc.bg} ${rc.text} border ${rc.border}`}>
                <ShieldIcon className="size-3" />
                <span className="hidden sm:inline">
                  {riskLevel === 'green' ? 'Secure' : riskLevel === 'amber' ? 'Caution' : 'Critical'}
                </span>
                <span className="sm:hidden">
                  {riskLevel === 'green' ? 'OK' : riskLevel === 'amber' ? 'WARN' : 'CRIT'}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {warnings.length === 0
                ? 'All OPSEC measures active - You are secure'
                : warnings.join(' • ')}
            </TooltipContent>
          </Tooltip>

          {/* Warning text when risk is elevated */}
          {warnings.length > 0 && (
            <span className={`text-[10px] font-medium ${rc.text} hidden md:inline max-w-[260px] truncate`}>
              ⚠ {warnings[0]}
              {warnings.length > 1 ? ` +${warnings.length - 1}` : ''}
            </span>
          )}
        </div>
      </div>

      {/* Confirmation dialog for switching to Active Mode */}
      <AlertDialog open={confirmActiveOpen} onOpenChange={setConfirmActiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-500">
              <ShieldAlert className="size-5" />
              Switch to Active Mode?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Active mode involves direct interaction with target profiles and resources.
              This significantly increases the risk of detection and exposure.
              <br /><br />
              <strong>Only proceed if you understand the operational risks.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmSwitchToActive}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              Switch to Active Mode
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
