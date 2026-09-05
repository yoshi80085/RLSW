import { useState } from "react";
import { Game } from "../rlsw-simulator-v3_8_1.jsx";
import { mobileColorStyle, GameErrorBoundary } from "../ui/GameErrorBoundary.jsx";
import { Lobby } from "../ui/Lobby.jsx";
import TitleMenu from "../ui/TitleMenu.jsx";
import RiffMenu from "../ui/RiffMenu.jsx";
import { RiffPractice } from "../ui/RiffPractice.jsx";
import { FretboardRecon } from "../ui/FretboardRecon.jsx";
import { ListenNeck } from "../ui/ListenNeck.jsx";
import { DiscordCoach } from "../ui/DiscordCoach.jsx";
import { LegendLessons } from "../ui/LegendLessons.jsx";
import OpeningMovie from "../ui/OpeningMovie.jsx";
import HintScreen from "../ui/HintScreen.jsx";
import { buildTestingGroundsConfig } from "../data/matchSetup.js";

export default function RLSWSimulator() {
  const [gameState, setGameState] = useState(null);
  const [practiceMode, setPracticeMode] = useState(null); // null | { mode: 'riff'|'fretboard'|'discord', diff? }
  const [introDone, setIntroDone] = useState(false);
  // 🏝️ TITLE MENU — the Zelda-style front door. Everything hangs off it:
  //   null    → the title menu itself
  //   'normal'→ the match lobby (player count, Spirit select, settings)
  //   'riff'  → the Riff Mode submenu (practice modes live in there)
  // Testing Grounds launches straight from the menu without a branch.
  const [menuRoute, setMenuRoute] = useState(null);
  // 💡 HINT SCREEN — an intentional ~5s beat between Lobby and Game so a
  // random gameplay hint can be read. Reset on return-to-lobby so every match
  // start gets a fresh hint.
  const [hintDone, setHintDone] = useState(false);
  const isMobile = /Mobi|Android/i.test(navigator.userAgent);

  // 🎬 Opening movie — plays on every launch, any input skips (attract style).
  if (!introDone) {
    return <div style={isMobile ? mobileColorStyle : {}}><OpeningMovie onDone={() => setIntroDone(true)} /></div>;
  }
  if (practiceMode) {
    const pm = practiceMode;
    // Backing out of a trainer returns to the Riff Mode menu it was launched
    // from, not all the way to the title screen — you almost always want another go.
    const back = () => setPracticeMode(null);
    if (pm.mode === 'fretboard') return <div style={isMobile ? mobileColorStyle : {}}><FretboardRecon onBack={back} /></div>;
    if (pm.mode === 'discord')   return <div style={isMobile ? mobileColorStyle : {}}><DiscordCoach onBack={back} /></div>;
    if (pm.mode === 'listen')    return <div style={isMobile ? mobileColorStyle : {}}><ListenNeck onBack={back} /></div>;
    if (pm.mode === 'legend')    return <div style={isMobile ? mobileColorStyle : {}}><LegendLessons onBack={back} /></div>;
    return <div style={isMobile ? mobileColorStyle : {}}><RiffPractice initialDiff={pm.diff || pm} onBack={back} /></div>;
  }
  // 🏝️ Title menu — shown whenever no match is running and no route is chosen.
  if (!gameState && menuRoute === null) {
    return <div style={isMobile ? mobileColorStyle : {}}><TitleMenu
      onNormal={() => setMenuRoute('normal')}
      onRiff={() => setMenuRoute('riff')}
      onTestingGrounds={() => setGameState(buildTestingGroundsConfig())}
    /></div>;
  }
  if (!gameState && menuRoute === 'riff') {
    return <div style={isMobile ? mobileColorStyle : {}}><RiffMenu
      onPractice={p => setPracticeMode(p)}
      onBack={() => setMenuRoute(null)}
    /></div>;
  }
  if (!gameState) {
    return <div style={isMobile ? mobileColorStyle : {}}><Lobby
      onStart={gs => setGameState(gs)}
      onPractice={p => setPracticeMode(p)}
      onBackToMenu={() => setMenuRoute(null)}
    /></div>;
  }
  // 💡 Match is starting — hold on the hint screen for ~5s before the board mounts.
  if (!hintDone) {
    return <div style={isMobile ? mobileColorStyle : {}}><HintScreen onDone={() => setHintDone(true)} /></div>;
  }
  // Netcode: leaving the Game must CLOSE the socket (keeping the saved session),
  // or the old connection keeps holding the seat and the Lobby's auto-rejoin
  // falls through to spectator-of-a-dead-game. `resetRoom` also flips the room
  // back to phase:lobby server-side so everyone can start a fresh match.
  // Error-boundary resets DON'T reset the room — rejoining a live game via
  // CATCH_UP is the correct recovery there.
  const returnToLobby = ({ resetRoom = true } = {}) => {
    const net = gameState.net;
    if (net?.client) {
      if (resetRoom && !net.spectator) net.client.send({ t: "RETURN_TO_LOBBY" });
      net.client.close(); // keeps rlsw.net.session — Lobby auto-rejoin reclaims the seat
    }
    setGameState(null);
    setHintDone(false); // 💡 next match start shows a fresh hint
  };
  return (
    <GameErrorBoundary onReset={() => returnToLobby({ resetRoom: false })}>
      <div style={isMobile ? mobileColorStyle : {}}><Game key={JSON.stringify(gameState.spirits.map(s=>s.num))} gameState={gameState} onReturnToLobby={returnToLobby} /></div>
    </GameErrorBoundary>
  );
}
