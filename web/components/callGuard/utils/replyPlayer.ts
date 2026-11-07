import { encodeWav } from "./wav";

const toBase64 = (buffer: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buffer)));

/**
 * Plays the AI's spoken replies through one reused <audio> element. `unlock()` must run inside
 * the click that starts the call: it plays 0.1 s of silence so later, async replies may
 * autoplay (iOS Safari only allows play() on an element first played from a gesture).
 */
export class ReplyPlayer {
  private audio: HTMLAudioElement | null = null;
  private finish: (() => void) | null = null;

  private element(): HTMLAudioElement {
    this.audio ??= new Audio();
    return this.audio;
  }

  unlock() {
    const audio = this.element();
    audio.src = `data:audio/wav;base64,${toBase64(encodeWav(new Float32Array(1600)))}`;
    audio.play().catch(() => undefined);
  }

  /** Resolves when the reply finishes, fails to play, or `stop()` is called. */
  play(audioBase64: string): Promise<void> {
    this.stop();
    const audio = this.element();
    return new Promise((resolve) => {
      const done = () => {
        if (this.finish !== done) return;
        this.finish = null;
        audio.onended = null;
        audio.onerror = null;
        resolve();
      };
      this.finish = done;
      audio.onended = done;
      audio.onerror = done;
      audio.src = `data:audio/wav;base64,${audioBase64}`;
      // If the browser refuses to play, the line is still on screen; carry on.
      audio.play().catch(done);
    });
  }

  stop() {
    this.audio?.pause();
    this.finish?.();
  }
}
