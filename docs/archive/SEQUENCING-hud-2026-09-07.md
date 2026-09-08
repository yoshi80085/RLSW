## 7-immersive-hud. Structure complete; stop for Medium — 2026-09-07

Alex authorized the initial restructuring and asked to stop once remaining work
suits lower reasoning. The optional 3D view now fills the play area, with stable
Turn / Spirit / Rivals regions, a floating phase/AP summary and a separate board
preparation region. The original controls and SVG stay mounted across views.
No game rules or renderer input handlers were moved. Narrow screens put controls
below the board; tutorials disclose and scroll their original anchors into view.

**Next: use Medium for presentation refinement.** Read
`../docs/immersive-hud-handoff.md` for exact files, contracts, remaining visual
work and verification scope. The current panel internals retain their existing
appearance. No further visual polish, commit or deployment was done this pass.

Full `test:all` passed, including the extended immersive client journey and
actual WebGL fallback. Render check remains 8/8; architecture 8; Bushido overlay
331; existing rule/parity assertion counts did not drop. `check:bundle` has zero
warnings. Production build passes with its existing large-chunk advisory.
`lint:baseline` passes at 334 errors / 16 warnings, zero increased categories;
the executable arena test has a local Fast Refresh exception.

Actual browser checks covered drafting, drawer access, commit, legal movement
for one AP, camera controls without AP spend, state-preserving 2D recovery and
next-player controls. Widths checked: 1280, 800 and 390px. Phone action-state
layout had no horizontal overflow. Dedicated phone camera/touch polish remains.
The external Systems Map artifact tool is unavailable; repository docs are current.

Previous live handoffs are preserved in
`../docs/archive/SEQUENCING-before-immersive-hud-2026-09-07.md`.

---
