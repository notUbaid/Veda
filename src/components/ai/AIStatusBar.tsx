import React from 'react';
import { Wifi, WifiOff, RefreshCw, Bot } from 'lucide-react';
import type { OllamaStatus } from '../../hooks/useOllama';

interface Props {
  status: OllamaStatus;
  activeModel: string;
  error?: string;
  onRetry?: () => void;
  size?: 'sm' | 'md';
}

export function AIStatusBar({ status, activeModel, error, onRetry, size = 'sm' }: Props) {
  const textSize = size === 'sm' ? 'text-[10px]' : 'text-xs';
  const iconSize = size === 'sm' ? 10 : 12;

  if (status === 'checking') return (
    <span className={`inline-flex items-center gap-1.5 ${textSize} text-slate-500 font-bold`}>
      <RefreshCw size={iconSize} className="animate-spin" /> Connecting…
    </span>
  );

  if (status === 'online') return (
    <span className={`inline-flex items-center gap-1.5 ${textSize} text-emerald-400 font-bold`}>
      <Wifi size={iconSize} /><Bot size={iconSize} />{activeModel}
    </span>
  );

  return (
    <span className={`inline-flex items-center gap-1.5 ${textSize} text-red-400 font-bold`}>
      <WifiOff size={iconSize} /> Ollama offline
      {onRetry && (
        <button onClick={onRetry} className="underline hover:text-red-300 ml-0.5">retry</button>
      )}
    </span>
  );
}
