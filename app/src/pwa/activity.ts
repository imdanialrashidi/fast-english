// app/src/pwa/activity.ts
// Cross-module activity flag: the PWA update prompt defers while audio is
// playing so a confirmed reload can never interrupt playback. The AudioPlayer
// flips this flag on play/pause/ended/source-change.
let audioBusy = false;

export function setAudioBusy(busy: boolean): void {
  audioBusy = busy;
}

export function isAudioBusy(): boolean {
  return audioBusy;
}
