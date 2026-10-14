// ⚠️ Lowercase `v`. The file on disk and in git is `rlsw-simulator-v3_8_1.jsx`;
// this import said `V3_8_1` and had done for a long time. Windows resolves it
// anyway because NTFS is case-insensitive, so it never surfaced locally — but
// Render builds on Linux, where the same import cannot resolve at all. Latent
// deploy break, found by `node src/engine/importcheck.mjs`.
import RLSWSimulator from "./rlsw-simulator-v3_8_1";
import GlobalCursor from "./ui/GlobalCursor.jsx";
import { useEffect } from "react";
import { mountGamepad } from "./input/gamepad.js";
export default function App() {
  // 🎮 The controller, for the whole app (title, lobby, match): input/gamepad.js.
  useEffect(() => mountGamepad(), []);
  return <><GlobalCursor /><RLSWSimulator /></>;
}
