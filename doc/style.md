# Gravity Dawn — Scientific minimalism

The player interface uses semantic HTML over a Canvas simulation. `src/css/style.css` owns the full visual system; `src/ui-diagrams.js` contains decorative SVG diagrams. No bitmap artwork or remote font dependency is needed.

- Paper `#f4f3ed`, graphite `#252b2a`, muted text `#6d7470`, rules `#d8dad2`.
- Burn orange `#cc5737` marks trajectories and key actions. Green indicates completion / readiness.
- Flight view: graphite green `#171e1b`, muted sage bodies, probes colored by ammunition type, amber objectives. Probe fills and outer rings retain their type color before and after launch and while hovered: normal red `#ff4444`, explosive blue `#4488ff`, kinetic cyan `#44ddee`, agile yellow `#ffdd44`, cluster green `#44ff88`, gravity purple `#cc88ff`, incendiary orange `#ff9944`. Explicit probe colors override these defaults; white ready outlines and hover rings still indicate interaction state.
- System sans for content, system monospace for measured values and labels, serif italic for the landing headline.
- Thin rules, square buttons, restrained motion, generous spacing. No glow effects or glass panels.
- Start: editorial headline + transfer diagram + controls / mission overview.
- Archive: chapter navigation, progress, numbered mission cards. All missions are playable; recommended order follows chapter and mission numbering.
- HUD: objective / thresholds, probes, score, remaining targets, pause, time acceleration (1×–10×), retry, recenter, guidance, contextual probe telemetry and simulation time. The speed button sits below pause in the flight controls; each click adds 1× and wraps from 10× to 1×.
- Results: measured score, remaining probes and targets, three-star rating, retry / continue.
- Briefings: two-column scientific diagram and transmission, typed dialogue, progress segments, explicit continue / skip.

Responsive breakpoints are 1050px and 700px. Menus scroll naturally; the physics canvas keeps a 1200 × 800 logical space and fits the viewport. Input converts CSS coordinates into that logical space. Reduced motion removes diagram animation and shows briefing text immediately. Native buttons have keyboard focus indicators. The controls assume mouse / trackpad and keyboard; mobile layouts are readable but touch firing is not implemented.

界面与无障碍标签统一使用中文，只保留 Δv、公式、单位和必要按键记号。关卡卡片使用 `missionDiagram(LevelManager.load(level))` 展示真实初始布局；主菜单与简报中的转移轨道为装饰性示意图。

堡垒战役的真实桁架显示为双层三角网格；方框标识固定锚点，琥珀色圆环标识内部控制单元。建筑上方显示中文名称，移动堡垒显示参考轨道。瞄准时用低透明度琥珀色虚线圈显示预计内舱清除范围，弹体面板显示点火后的燃料。
