/**
 * useOllama — shared hook for Ollama status + model.
 * Checks once on mount; exposes retry() for manual recheck.
 */
import { useState, useEffect, useCallback } from 'react';
import { checkOllamaHealth, getActiveModel, setActiveModel } from '../services/aiService';

export type OllamaStatus = 'checking' | 'online' | 'offline';

export function useOllama() {
  const [status, setStatus]               = useState<OllamaStatus>('checking');
  const [models, setModels]               = useState<string[]>([]);
  const [activeModel, setActiveModelState] = useState(getActiveModel);
  const [error, setError]                 = useState('');

  const check = useCallback(async () => {
    setStatus('checking');
    setError('');
    const res = await checkOllamaHealth();
    if (res.ok) {
      setStatus('online');
      setModels(res.models);
    } else {
      setStatus('offline');
      setError(res.error ?? 'Ollama not reachable');
    }
  }, []);

  useEffect(() => { check(); }, [check]);

  const changeModel = useCallback((m: string) => {
    setActiveModel(m);
    setActiveModelState(m);
  }, []);

  return { status, models, activeModel, changeModel, error, retry: check };
}
