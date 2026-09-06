# Gravity Dawn — Scientific minimalism

The player interface uses semantic HTML over a Canvas simulation. `src/css/style.css` owns the full visual system; `src/ui-diagrams.js` contains decorative SVG diagrams. No bitmap artwork or remote font dependency is needed.

- Paper `#f4f3ed`, graphite `#252b2a`, muted text `#6d7470`, rules `#d8dad2`.
- Burn orange `#cc5737` marks trajectories and key actions. Green indicates completion / readiness.
- Flight view: graphite green `#171e1b`, muted sage bodies, ivory probes, amber objectives.
- System sans for content, system monospace for measured values and labels, serif italic for the landing headline.
- Thin rules, square buttons, restrained motion, generous spacing. No glow effects or glass panels.
- Start: editorial headline + transfer diagram + controls / mission overview.
- Archive: chapter navigation, progress, numbered mission cards. All missions are playable; recommended order follows chapter and mission numbering.
- HUD: objective / thresholds, probes, score, remaining targets, pause, retry, recenter, guidance, contextual probe telemetry and simulation time.
- Results: measured score, remaining probes and targets, three-star rating, retry / continue.
- Briefings: two-column scientific diagram and transmission, typed dialogue, progress segments, explicit continue / skip.

Responsive breakpoints are 1050px and 700px. Menus scroll naturally; the physics canvas keeps a 1200 × 800 logical space and fits the viewport. Input converts CSS coordinates into that logical space. Reduced motion removes diagram animation and shows briefing text immediately. Native buttons have keyboard focus indicators. The controls assume mouse / trackpad and keyboard; mobile layouts are readable but touch firing is not implemented.

界面与无障碍标签统一使用中文，只保留 Δv、公式、单位和必要按键记号。关卡卡片使用 `missionDiagram(LevelManager.load(level))` 展示真实初始布局；主菜单与简报中的转移轨道为装饰性示意图。
