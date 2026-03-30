/**
 * useAudioRecorder — Web Speech API real-time transcription.
 *
 * Uses the browser's built-in SpeechRecognition (Chrome/Edge) for free,
 * zero-latency, no-API-key live transcription. Sends recognised text
 * segments to the backend over WebSocket (text, not audio binary).
 *
 * Fallback: if Web Speech API is unavailable, user is directed to the
 * manual text input tab.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import type { TranscriptSegment, RecordingState } from '../types';
import api from '../services/api';

// webkitSpeechRecognition is not in the standard DOM lib types
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    webkitSpeechRecognition: any;
  }
}

interface UseAudioRecorderOptions {
  encounterId: string;
  language?: string; // BCP-47 e.g. 'en-US', 'fr-FR'
  onTranscriptSegment?: (segment: TranscriptSegment) => void;
  onError?: (error: string) => void;
}

interface UseAudioRecorderReturn {
  state: RecordingState;
  segments: TranscriptSegment[];
  isSupported: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
}

export function useAudioRecorder({
  encounterId,
  language = 'en-US',
  onTranscriptSegment,
  onError,
}: UseAudioRecorderOptions): UseAudioRecorderReturn {
  const [state, setState] = useState<RecordingState>({
    isRecording: false,
    isPaused: false,
    elapsedSeconds: 0,
    isConnected: false,
  });
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const segCountRef = useRef(0);
  const isPausedRef = useRef(false);

  const isSupported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const startTimer = useCallback(() => {
    if (timerRef.current) return;
    timerRef.current = setInterval(() => {
      setState((prev) => ({ ...prev, elapsedSeconds: prev.elapsedSeconds + 1 }));
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopTimer();
      recognitionRef.current?.stop();
      if (wsRef.current) wsRef.current.close();
    };
  }, [stopTimer]);

  const sendSegment = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      segCountRef.current += 1;
      const segment: TranscriptSegment = {
        sequence: segCountRef.current,
        speaker: 'physician',
        content: text.trim(),
        timestamp_start: 0,
        timestamp_end: 0,
        language: language.split('-')[0],
        confidence: 1.0,
      };
      setSegments((prev) => [...prev, segment]);
      onTranscriptSegment?.(segment);

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'transcript_text',
            text: text.trim(),
            speaker: 'physician',
            language: language.split('-')[0],
            confidence: 1.0,
          })
        );
      }
    },
    [language, onTranscriptSegment]
  );

  const startRecording = useCallback(async () => {
    if (!isSupported) {
      onError?.(
        'Live recording requires Chrome or Edge. Please use the manual text input tab instead.'
      );
      return;
    }

    try {
      const wsUrl = api.getWsUrl(encounterId);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setState((prev) => ({ ...prev, isConnected: true }));
        ws.send(JSON.stringify({ type: 'config', mode: 'web_speech' }));
      };
      ws.onerror = () => onError?.('WebSocket connection error.');
      ws.onclose = () => setState((prev) => ({ ...prev, isConnected: false }));

      const SpeechRecognitionCtor =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognitionCtor();
      recognitionRef.current = recognition;

      recognition.lang = language;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        if (isPausedRef.current) return;
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            sendSegment(event.results[i][0].transcript);
          }
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (event.error === 'no-speech' || event.error === 'aborted') return;
        onError?.(`Microphone error: ${event.error}. Check permissions and try again.`);
      };

      // Auto-restart after silence (browser stops ~60s after no speech)
      recognition.onend = () => {
        if (!isPausedRef.current && recognitionRef.current === recognition) {
          try { recognition.start(); } catch { /* already started */ }
        }
      };

      recognition.start();

      setState({ isRecording: true, isPaused: false, elapsedSeconds: 0, isConnected: true });
      isPausedRef.current = false;
      startTimer();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Failed to start recording');
    }
  }, [encounterId, isSupported, language, onError, sendSegment, startTimer]);

  const stopRecording = useCallback(() => {
    isPausedRef.current = false;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'stop' }));
      setTimeout(() => wsRef.current?.close(), 500);
    }
    stopTimer();
    setState((prev) => ({ ...prev, isRecording: false, isPaused: false, isConnected: false }));
  }, [stopTimer]);

  const pauseRecording = useCallback(() => {
    isPausedRef.current = true;
    recognitionRef.current?.stop();
    stopTimer();
    setState((prev) => ({ ...prev, isPaused: true }));
  }, [stopTimer]);

  const resumeRecording = useCallback(() => {
    isPausedRef.current = false;
    try { recognitionRef.current?.start(); } catch { /* ok */ }
    startTimer();
    setState((prev) => ({ ...prev, isPaused: false }));
  }, [startTimer]);

  return { state, segments, isSupported, startRecording, stopRecording, pauseRecording, resumeRecording };
}
