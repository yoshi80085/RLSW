import { useEffect, useState } from "react";
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
  const isMobile = /Mobi|Android/i.test(navigator.userAgent);

  // 📱 THE PHONE COLOUR TINT GOES ON THE PAGE ROOT, NOT ON A WRAPPER DIV.
  // ⚠️ It used to be `style={mobileColorStyle}` on a div round every screen. A CSS
  // `filter` makes its element the containing block for every `position:fixed`
  // descendant — and every screen here (title, lobby, match) is a full-screen
  // fixed layer inside a wrapper with no height. On any phone the whole game
  // collapsed to a 0-px strip: a white screen, and taps landing on nothing.
  // Found 2026-09-29 by rendering the game with an iPhone user agent. The root
  // element is the one place the spec exempts from that rule.
  useEffect(() => {
    if (!isMobile) return undefined;
    const root = document.documentElement, before = root.style.filter;
    root.style.filter = mobileColorStyle.filter;
    return () => { root.style.filter = before; };
  }, [isMobile]);

  // 🎬 Opening movie — plays on every launch, any input skips (attract style).
  if (!introDone) {
    return <div><OpeningMovie onDone={() => setIntroDone(true)} /></div>;
  }
  if (practiceMode) {
    const pm = practiceMode;
    // Backing out of a trainer returns to the Riff Mode menu it was launched
    // from, not all the way to the title screen — you almost always want another go.
    const back = () => setPracticeMode(null);
    if (pm.mode === 'fretboard') return <div><FretboardRecon onBack={back} /></div>;
    if (pm.mode === 'discord')   return <div><DiscordCoach onBack={back} /></div>;
    if (pm.mode === 'listen')    return <div><ListenNeck onBack={back} /></div>;
    if (pm.mode === 'legend')    return <div><LegendLessons onBack={back} /></div>;
    return <div><RiffPractice initialDiff={pm.diff || pm} onBack={back} /></div>;
  }
  // 🏝️ Title menu — shown whenever no match is running and no route is chosen.
  if (!gameState && menuRoute === null) {
    return <div><TitleMenu
      onNormal={() => setMenuRoute('normal')}
      onRiff={() => setMenuRoute('riff')}
      onTestingGrounds={() => setGameState(buildTestingGroundsConfig({ freePlay: true }))}
    /></div>;
  }
  if (!gameState && menuRoute === 'riff') {
    return <div><RiffMenu
      onPractice={p => setPracticeMode(p)}
      onBack={() => setMenuRoute(null)}
    /></div>;
  }
  if (!gameState) {
    return <div><Lobby
      onStart={gs => setGameState(gs)}
      onPractice={p => setPracticeMode(p)}
      onBackToMenu={() => setMenuRoute(null)}
    /></div>;
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
  };
  return (
    <GameErrorBoundary onReset={() => returnToLobby({ resetRoom: false })}>
      <div><Game key={JSON.stringify(gameState.spirits.map(s=>s.num))} gameState={gameState} onReturnToLobby={returnToLobby} /></div>
    </GameErrorBoundary>
  );
}
