// ⚠️ Lowercase `v`. The file on disk and in git is `rlsw-simulator-v3_8_1.jsx`;
// this import said `V3_8_1` and had done for a long time. Windows resolves it
// anyway because NTFS is case-insensitive, so it never surfaced locally — but
// Render builds on Linux, where the same import cannot resolve at all. Latent
// deploy break, found by `node src/engine/importcheck.mjs`.
import RLSWSimulator from "./rlsw-simulator-v3_8_1";
export default function App() {
  return <RLSWSimulator />;
}