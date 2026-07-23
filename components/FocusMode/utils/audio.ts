export function playTimerAlarm() {
  const AudioContextClass =
    window.AudioContext ||
    (
      window as typeof window & {
        webkitAudioContext?: typeof AudioContext;
      }
    ).webkitAudioContext;

  if (!AudioContextClass) {
    return;
  }

  const audioContext = new AudioContextClass();

  function beep(
    startTime: number,
    frequency: number,
    duration: number,
  ) {
    const oscillator =
      audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(
      frequency,
      startTime,
    );

    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(
      0.18,
      startTime + 0.01,
    );
    gainNode.gain.linearRampToValueAtTime(
      0,
      startTime + duration,
    );

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.start(startTime);
    oscillator.stop(startTime + duration);
  }

  const now = audioContext.currentTime;

  beep(now, 880, 0.13);
  beep(now + 0.18, 1100, 0.16);

  window.setTimeout(() => {
    void audioContext.close();
  }, 700);
}
