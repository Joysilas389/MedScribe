/**
 * useAudioRecorder — Browser audio capture and WebSocket streaming.
 *
 * Handles:
 * - Microphone access via MediaRecorder API
 * - Audio chunk streaming over WebSocket
 * - Start/stop/pause/resume controls
 * - Elapsed time tracking
 * - Connection state management
 * - Transcript segment reception
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import type { TranscriptSegment, RecordingState } from '../types';
import api from '../services/api';

interface UseAudioRecorderOptions {
  encounterId: string;
  onTranscriptSegment?: (segment: TranscriptSegment) => void;
  onError?: (error: string) => void;
}

interface UseAudioRecorderReturn {
  state: RecordingState;
  segments: TranscriptSegment[];
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
}

export function useAudioRecorder({
  encounterId,
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

  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const segCountRef = useRef(0);

  // Timer management
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTimer();
      if (wsRef.current) wsRef.current.close();
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, [stopTimer]);

  const startRecording = useCallback(async () => {
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      });
      streamRef.current = stream;

      // Connect WebSocket
      const wsUrl = api.getWsUrl(encounterId);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setState((prev) => ({ ...prev, isConnected: true }));
        // Send audio format config
        ws.send(JSON.stringify({ type: 'config', format: 'audio/webm' }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'transcript') {
            segCountRef.current += 1;
            const segment: TranscriptSegment = {
              sequence: segCountRef.current,
              speaker: msg.speaker || 'unknown',
              content: msg.text,
              timestamp_start: 0,
              timestamp_end: 0,
              language: msg.language || 'en',
              confidence: msg.confidence || 0,
            };
            setSegments((prev) => [...prev, segment]);
            onTranscriptSegment?.(segment);
          } else if (msg.type === 'error') {
            onError?.(msg.message);
          }
        } catch {
          // ignore non-JSON messages
        }
      };

      ws.onerror = () => {
        onError?.('WebSocket connection error. Please check your connection.');
      };

      ws.onclose = () => {
        setState((prev) => ({ ...prev, isConnected: false }));
      };

      // Wait for connection
      await new Promise<void>((resolve, reject) => {
        ws.addEventListener('open', () => resolve(), { once: true });
        ws.addEventListener('error', () => reject(new Error('Connection failed')), { once: true });
      });

      // Start MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const recorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 64000,
      });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
          ws.send(event.data);
        }
      };

      recorder.start(2000); // Send chunks every 2 seconds

      setState({
        isRecording: true,
        isPaused: false,
        elapsedSeconds: 0,
        isConnected: true,
      });
      startTimer();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start recording';
      onError?.(msg);
    }
  }, [encounterId, onTranscriptSegment, onError, startTimer]);

  const stopRecording = useCallback(() => {
    // Stop MediaRecorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    // Stop microphone
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    // Send stop command and close WebSocket
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'stop' }));
      setTimeout(() => wsRef.current?.close(), 1000);
    }
    stopTimer();
    setState((prev) => ({
      ...prev,
      isRecording: false,
      isPaused: false,
      isConnected: false,
    }));
  }, [stopTimer]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
    }
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'pause' }));
    }
    stopTimer();
    setState((prev) => ({ ...prev, isPaused: true }));
  }, [stopTimer]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
    }
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'resume' }));
    }
    startTimer();
    setState((prev) => ({ ...prev, isPaused: false }));
  }, [startTimer]);

  return {
    state,
    segments,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
  };
}
