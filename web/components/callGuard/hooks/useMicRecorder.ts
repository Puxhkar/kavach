import { useCallback, useEffect, useRef, useState } from "react";

import { recordingToWav } from "../utils/wav";

export type MicState = "idle" | "recording" | "processing";

/** A recording too short to hold any speech (the tap was a mis-tap). */
export class TooShortError extends Error {}

function micErrorMessage(error: unknown): string {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError")
    return "Microphone access is blocked. Allow it from the icon in the address bar, then try again.";
  if (name === "NotFoundError" || name === "OverconstrainedError")
    return "No microphone found. Plug one in and try again.";
  if (name === "NotReadableError") return "The microphone is in use by another app. Close it and try again.";
  return "Couldn't start the microphone. Try again.";
}

/** Tap-to-start / tap-to-stop recording that hands back a 16 kHz mono WAV per turn. */
export function useMicRecorder() {
  const [state, setState] = useState<MicState>("idle");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);

  const releaseMic = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(
    () => () => {
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") recorder.stop();
      releaseMic();
    },
    [releaseMic],
  );

  /** Throws an Error with a user-facing message when the mic can't be opened. */
  const start = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      throw new Error("This browser can't record audio here. Use Chrome or Safari on https or localhost.");
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      throw new Error(micErrorMessage(error));
    }
    streamRef.current = stream;
    chunksRef.current = [];
    const recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorderRef.current = recorder;
    startedAtRef.current = Date.now();
    recorder.start();
    setState("recording");
  }, []);

  /** Stops recording and resolves with the WAV. Rejects with TooShortError for a mis-tap. */
  const stop = useCallback(async (): Promise<Blob> => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") throw new TooShortError("Not recording.");
    setState("processing");
    const stopped = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });
    recorder.stop();
    await stopped;
    releaseMic();
    recorderRef.current = null;
    try {
      const recording = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
      if (!recording.size || Date.now() - startedAtRef.current < 400) throw new TooShortError("Too short.");
      return await recordingToWav(recording);
    } catch (error) {
      if (error instanceof TooShortError) throw error;
      throw new Error("Couldn't read the recording. Try again.");
    } finally {
      setState("idle");
    }
  }, [releaseMic]);

  /** Drops the current recording without sending it (hang up mid-sentence). */
  const cancel = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      recorder.stop();
    }
    recorderRef.current = null;
    releaseMic();
    setState("idle");
  }, [releaseMic]);

  return { state, start, stop, cancel };
}
