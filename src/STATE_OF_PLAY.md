# 🧭 STATE OF PLAY — the whole game, current truth only

> **READ THIS FIRST. It is the entry point for every session.**
>
> ⚠️ **CURRENT TRUTH ONLY — NO HISTORY, NO REASONING.** Why a thing is the way it
> is lives in its own design doc; what it *taught us* lives in `SEQUENCING.md` §B.
> **This file answers one question: what is true right now?**
>
> 📌 **Written 2026-09-04**, last updated **2026-09-04e**, when the design set
> reached 37 files and 222,000
> words and no single view of the game existed. Keep it short or it stops being
> read — if a section needs a paragraph, it belongs in its own doc with a link
> from here.

---

## 1. 🎸 WHAT THE GAME IS

A **music-battle board game**. Spirits move on a hex stage, attack, pick up notes,
and **commit melody lines** that pay a crowd. Fame decides the winner. The
audience is *"the ultimate beginner"* — someone who does not read music.

**Four pillars**, and each Spirit is meant to own one and bend a rule of it:
**Movement · Combat · Melody Line/space · The crowd.**

---

## 2. 🎭 THE ROSTER — 4 Spirits, and only 2 are settled

| Spirit | archetype | state |
|---|---|---|
| 🗡️ **Shredding Ronin** | Burst / virtuoso | ⚠️ **kit respecced 2026-09-04, NOTHING BUILT.** §3 |
| 🌀 **Intergalactic 0** | Control / zoner | ✅ **Done and shipped.** 5 abilities, all priced and cooled |
| 👹 **Metalness Monster** | Bruiser | ⏸️ **ON HOLD pending redesign.** ⛔ His 4 abilities have **no cooldowns at all** |
| 🎀 **Glamarchy** | Star | 🪦 **BEING CUT.** 🐀 Riff Rat proposed as her replacement — ⁉️ **never formally decided** |

⛔ **THE ROSTER IS AN OPEN QUESTION AND EVERY BALANCE SHEET DEPENDS ON IT.**
`RIFF_RAT_DESIGN.md` §0 *proposes* the swap and implements nothing;
`MELODY_IDENTITY_DESIGN.md` already assumes Rat is in and Glamarchy is out.
**Make it a decision or those docs are built on a roster the game does not have.**

---

## 3. 🗡️ THE RONIN'S KIT — respecced 2026-09-04, none of it built

Spec: `RONIN_ABILITY_DESIGN.md` §2. Build order: its §8.1.

| ability | verb | state |
|---|---|---|
| 🌀 **Shukuchi Arpeggio** | a step that leaps **2 hexes** and clears everything between, **up to 3 per turn, 1 AP each**, any direction; every landing picks up | ✅ **DONE — HEADLESS *AND* IN THE CLIENT, 2026-09-04e.** `test:shukuchi` 68 · `test:shukuchiui` 80. Button, ring-2 targeting, arcs, hover ghost, budget rail. 🎯 **Out of `BOT_CLIENT_GAPS`** — the bench and the played game agree about it again |
| 🗡️ **Psycho Bushido** | charge a rival **3–5 hexes** directly in front, ⭐ **+2 / +3 / +4 Drive across the window** | ⚠️ ships with a *different* payout model (scaling by distance). ⬅️ **NEXT — step (c)**, a pure number edit, ✅ **and no longer blocked** |
| 👤 **Shadow Illusion** | body double, 2 turns, drinks Sustain | ⚠️ ships with different numbers |
| 🎸 **Cursed Shamisen** | ⭐ **SIPHON** — Swing-area, pick a rival's ability; if recharging, they are pushed **+1** and Ronin's cooldowns drop by **N** = turns it had left | 🚨 **a different ability entirely from what ships** |
| 🎵 ~~Wa no Koe~~ | — | 🪦 **CUT, AND DELETED 2026-09-04.** Gone from kernel, client, data, bot and 3 suites. `melodyCommitCheck` §13 is now the revival guard. The **12 Db mastery slot is empty** |

⛔ **The siphon cannot ship before cooldowns are universal** (§4), or it does
nothing against Metalness. That is the one hard ordering constraint in the kit.

---

## 4. ⚙️ RULES IN FLIGHT — decided, not yet true in the code

| rule | decided | built? |
|---|---|---|
| Every ability costs **≥1 Db per use** | 2026-08-22 | ✅ 7 of 13 |
| Every ability has a **cooldown** | 2026-08-22 | ✅ 7 of 13 |
| ⭐ **Every Spirit gets a cooldown; most land at 3–4 turns** | 2026-09-04 | ⛔ **not built — and the siphon depends on it** |
| ⭐ 🌀 **Shukuchi's hops jump OVER everything** — units, hazards, walls, slime | 2026-09-04 | ✅ **BUILT.** ⚠️ Knowingly a hard counter to area denial; the accepted brake is the **AP bill**, not a hazard exception |
| ⭐ 🌀 **A hop costs 1 AP, like a step** — 3 hops = 3 of his steps | 2026-09-04 | ✅ **BUILT.** 🎯 This one line is the whole balance of the ability — it replaced *"it IS the movement turn"* |
| ⭐ **Shukuchi's 1 Db is charged PER ACTIVATION** — hop 1 pays the Db and starts the clock; hops 2–3 are free | 2026-09-04 | ✅ **BUILT — and now decided, not merely shipped.** §2.5.0a is closed |
| ⭐ **A hop is TARGETED, one click per hop** — not a mode you toggle; walking may be interleaved | 2026-09-04 | ✅ **BUILT 2026-09-04e.** The rail arms it, ring 2 lights, and it stays armed between hops |
| ⭐ 🗡️ **Bushido pays +2 / +3 / +4 across its 3–5 window** — the window is the legality rule, the ladder is the payout | 2026-09-04e | ⛔ not built — it is step (c), and it is a constants edit |
| ⭐ **Every base ability costs the SAME to unlock** | 2026-09-04 | ⛔ not built |
| ⭐ **Every seat starts with ONE ability already active** | 2026-09-04 | ⛔ not built |
| ⭐ **Upgrade prices rise per ability** (depth costs more) | 2026-09-04 | ⛔ not built |
| Innate passives are **out of scope** for both rules | 2026-08-22 | ✅ n/a |
| ⁉️ Is 🌀 Blaster of Ra an ability at all? | — | ⛔ **OPEN — Alex's call.** It *replaces* the Smash, so pricing it leaves a Spirit with no basic attack |

🧊 **BALANCE IS DELIBERATELY DEFERRED while the kit is in flux** (Alex,
2026-09-04). Record imbalance, do not act on it. **Exception:** anything that
makes a thing *impossible* rather than weak is a bug, not balance.

---

## 5. 🏗️ SYSTEMS — what actually runs

**✅ BUILT AND UNDER TEST**

- The engine kernel, board, combat, turn flow, economy — `test:all`, **25 suites**
- 🕒 **The cooldown system** (`cooldowns.js`) — one map, one tick, one gate
- 🌀 **Shukuchi Arpeggio** — `shukuchi.js` + `ui/ShukuchiOverlay.jsx`. ✅ **Played, not just simulated.** `test:shukuchi` (the rule) and `test:shukuchiui` (the picture, an SSR diff against the preview). ⚠️ **Ronin bench numbers from 2026-09-04c/d were read against a client that could not take the hops the searcher planned** — they are not comparable with anything measured after this, and only a re-bench closes that
- 🏆 **Win conditions** — Legend Run + Battle of the Bands, headless, playable from `runMatch`. ⛔ **No menu, no HUD**
- 🎼 **Theory off the tree** — pardon ladder universal and free; stack seats 4–6 found on the board
- 🔦 **The hunt marker** — the hex holding your next seat lights up

**⛔ DESIGNED, NOT BUILT** *(8 docs say "design only")*

| what | doc | note |
|---|---|---|
| 💰 **The Db sink / upgrade shop** | `UPGRADE_SHOP_DESIGN.md` | ⚠️ **premise changed 2026-09-04** — R2 and R3 superseded, §3.1 prices void |
| 🎼 **Melody identity** (4 verbs) | `MELODY_IDENTITY_DESIGN.md` | blocked on the Db sink |
| ⭐ **Fame track redesign** | `FAME_TRACK_REDESIGN.md` | visual — **preview page first** |
| 👹 **Metalness rework** | `METALNESS_REWORK_DESIGN.md` | ⏸️ on hold — but now on the Ronin's critical path |
| 🐀 **Riff Rat** | `RIFF_RAT_DESIGN.md` | least resolved of any doc |

**⏸️ PARKED ON PURPOSE**

- 🤖 **The bot** — *"if I keep having to recalibrate how the bots think after every implementation, I'd be doubling my work"* (Alex). ⚠️ Every bench since 2026-09-02b reads a bot that does not know fans got better.

---

## 6. ⛔ THE BOTTLENECK, AND IT IS ONE THING

Almost everything open funnels through the same node:

```
   universal cooldowns  ──┐
                          ├──►  🎸 the siphon  ──►  the Ronin's kit
   👹 Metalness rework  ──┘                              │
                                                         ▼
   💰 the Db sink (upgrade shop)  ──►  🎼 melody identity  ──►  🤖 bot retune
```

🎯 **`METALNESS_REWORK_DESIGN.md` is parked and is now blocking the Ronin.** It
was a parallel arm until the siphon needed a rival with cooldowns to steal from.
**If the Shamisen is wanted before Metalness, that is a trade to make on purpose.**

💰 **The Db sink is the other node** — two docs name it a prerequisite. And it
just got easier: Alex's flat-cost rule removes the measured "bought in price
order, not value order" problem the shop existed to solve.

---

## 7. 🎯 THE SHORTEST USEFUL NEXT STEPS

1. 🗡️👤 **Respec Bushido and Shadow Illusion** ⬅️ **NEXT, AND UNBLOCKED.** Step (c): pure number edits on shipped abilities — the 3–5 window, the **+2 / +3 / +4** ladder Alex settled 2026-09-04e, and the new unlock/cooldown constants. ⚠️ It is a RULE, so it wants its suite in the same pass.
2. **Pick the flat unlock number.** The whole economy now turns on it, and §1 of `UPGRADE_SHOP_DESIGN.md` has the measured budget to set it with. ⛔ Three riders travel with it and are filed only as prose in that doc's §0⃣.3: is the free ability free later, what shape is the rising ladder, and do per-use costs flatten too.
3. **Decide the roster** — Glamarchy out, Riff Rat in? Two docs already assume yes.
4. 🤖 **Re-bench the Ronin.** ⚠️ Every Ronin number from 2026-09-04c and 2026-09-04d was measured while the client could not take the hops the searcher planned. That gap is closed now; the numbers taken during it are not.
5. 🚨 **Answer the Ronin ledger** — `CHARACTER_HANDOFF.md` → "THE RONIN LEDGER". Four passes made him weaker and each deferred the compensation to the next. ⚠️ **Shukuchi is now built, which does NOT close it** — it is a 6 Db mobility tool where a 12 Db payout used to be, and the 12 Db slot is still empty. 🧊 §B10 does not cover this: it is a slot question, not a balance tweak.
6. ~~🪦 Delete Wa no Koe properly.~~ ✅ **DONE 2026-09-04.** · ~~🌀 Build Shukuchi.~~ ✅ **DONE headless 2026-09-04.** · ~~🖥️ Port Shukuchi's overlay.~~ ✅ **DONE 2026-09-04e.**

---

## 8. 🗺️ WHERE EVERYTHING LIVES

| you want | read |
|---|---|
| **what is true right now** | 🧭 **this file** |
| what happened, and what it taught | `SEQUENCING.md` (§A live, §B findings, §C index) |
| the full history | `docs/archive/SEQUENCING-full-through-2026-09-04.md` |
| where code lives / "where do I change X?" | `ARCHITECTURE.md` — 🎯 the only machine-checked doc |
| the game explained from scratch | `GAME_BRIEF.md` |
| a Spirit's kit | `CHARACTER_HANDOFF.md`, then the per-character design doc |
| **a half-formed idea** | 💡 `IDEAS_INBOX.md` — put it there, not in whatever doc is open |

⚠️ **The design docs are not machine-checked and drift.** `ARCHITECTURE.md` is the
only one a suite verifies. Read the rest with suspicion, and when one is stale,
**say so plainly rather than editing around it.**
