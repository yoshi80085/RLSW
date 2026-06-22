import { useRef, useState } from "react";

// ─── BGM ─────────────────────────────────────────────────────────────────────
// Background-music state slice: the <audio> element ref, the current-track index
// ref, and the mute / volume / track-number state. The playback effects that use
// these still live in Game. Pure slice — no behavior change.
export function useBgmState() {
  const audioRef           = useRef(null);
  const currentTrackIdxRef = useRef(-1);
  const [bgmMuted, setBgmMuted]       = useState(false);
  const [bgmVolume, setBgmVolume]     = useState(0.4);
  const [bgmTrackNum, setBgmTrackNum] = useState(0);

  return {
    audioRef, currentTrackIdxRef,
    bgmMuted, setBgmMuted,
    bgmVolume, setBgmVolume,
    bgmTrackNum, setBgmTrackNum,
  };
}
