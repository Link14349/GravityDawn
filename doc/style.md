# Gravity Dawn — Scientific minimalism

The player interface uses semantic HTML over a Canvas simulation. `src/css/style.css` owns the full visual system; `src/ui-diagrams.js` contains decorative SVG diagrams. The main-menu logo is a transparent PNG at `img/gravity-dawn-mark.png`, generated with the built-in imagegen tool and bundled through the UI module. There is no remote font dependency.

- Paper `#f4f3ed`, graphite `#252b2a`, muted text `#6d7470`, rules `#d8dad2`.
- Burn orange `#cc5737` marks trajectories and key actions. Green indicates completion / readiness.
- Flight view: graphite green `#171e1b`, muted sage bodies, probes colored by ammunition type, amber objectives. Probe fills and outer rings retain their type color before and after launch and while hovered: normal red `#ff4444`, explosive coral pink `#ff8fb4`, kinetic dark red `#a82020`, agile yellow `#ffdd44`, cluster cyan `#44ddee`, gravity purple `#cc88ff`, incendiary orange `#ff9944`. The bright coral pink keeps explosive probes visible against the dark background. Kinetic probes have twice the default radius of normal probes (16 vs. 8). A thin light outline around each filled probe keeps dark ammunition visible. Explicit probe colors override these defaults; cluster children inherit their parent's color. White ready outlines and hover rings still indicate interaction state.
- System sans for content and the game title, system monospace for measured values and labels.
- Thin rules, square buttons, restrained motion, generous spacing. No glow effects or glass panels.
- Start: a large 「引力破晓」 title with a minimal planet / orbit / dawn logo, transfer diagram, enlarged play / mission buttons and mission overview. There is no top navigation bar; the main area fills the viewport above the footer. The previous headline, supporting slogan and three-column principles section are removed. The two main buttons use 16–21px labels and 64–84px height, with a 54px minimum in short landscape windows.
- Archive: chapter navigation, progress, numbered mission cards. All missions are playable; recommended order follows chapter and mission numbering.
- HUD: objective / thresholds, probes, score, remaining targets, pause, time acceleration (1×–10×), retry, recenter, guidance, contextual probe telemetry and simulation time. The speed button sits below pause in the flight controls; each click adds 1× and wraps from 10× to 1×.
- Results: measured score, remaining probes and targets, three-star rating, retry / continue.
- Briefings: two-column scientific diagram and transmission, typed dialogue, progress segments, explicit continue / skip.

Responsive width breakpoints are 1050px and 700px, with compact layouts below 720px and 480px in height. The game shell occupies exactly `100dvh`; the document never scrolls. The start screen fits its logo, title, controls and overview within the available height. Secondary text is hidden on short screens, and decorative diagrams are hidden on narrow screens. The archive keeps its header, chapter heading, progress and footer in place while the chapter navigation and mission grid scroll independently. Compact layouts reduce those labels to preserve list space. Results, briefing content and the flight manual scroll inside their own bounded panels, with scroll chaining disabled. The physics canvas keeps a 1200 × 800 logical space and fits the viewport. Input converts CSS coordinates into that logical space. Reduced motion removes diagram animation and shows briefing text immediately. Native buttons have keyboard focus indicators. The controls assume mouse / trackpad and keyboard; mobile layouts are readable but touch firing is not implemented.

<details>
<summary>Main-menu logo generation prompt (built-in imagegen)</summary>

Asset: `img/gravity-dawn-mark.png` (1254 × 1254, transparent PNG).

```text
Use case: logo-brand. Asset type: final standalone icon for the main menu of the orbital-physics game 引力破晓 (Gravity Dawn). Create one elegant, ultra-simple flat geometric logo: a dark graphite circular planet intersected by one clean tilted elliptical orbit; a small burnt-orange rising sun or dawn crescent integrated at its upper edge. Strong, distinctive silhouette and optically balanced geometry. Palette only graphite #252b2a and burnt orange #cc5737. Crisp vector-like shapes, medium-weight strokes, no gradients, no glow, no texture, no shadows, no 3D. No letters, no Chinese characters, no words, no frame, no mockup. Center the icon in a square canvas with roughly 8% clear padding. Transparent background with actual alpha, no checkerboard painted into the image. The logo must be readable at 96 to 160 CSS pixels on a warm ivory #f4f3ed UI.
```

</details>

界面与无障碍标签统一使用中文，只保留 Δv、公式、单位和必要按键记号。关卡卡片使用 `missionDiagram(LevelManager.load(level))` 展示真实初始布局；主菜单与简报中的转移轨道为装饰性示意图。

堡垒战役的真实桁架显示为双层三角网格；方框标识固定锚点，琥珀色圆环标识内部控制单元。建筑上方显示中文名称，移动堡垒显示参考轨道。瞄准时用低透明度琥珀色虚线圈显示预计内舱清除范围，弹体面板显示点火后的燃料。
