# Mission transmissions

`CutsceneManager(canvas, cutsceneData, onComplete)` renders a semantic HTML scientific briefing over the game. The interface intentionally replaces character portraits and painted backdrops with orbital diagrams; legacy `assets`, `bg`, `left`, and `right` fields remain readable data but are not rendered.

## Data

```js
{
  title: 'First principles',
  kicker: 'SECTOR 01 / CALIBRATION',
  equation: 'Δv = vₑ ln(m₀ / m₁)',
  scenes: [
    { title: 'An empty field.', dialogue: { speaker: 'MISSION CONTROL', text: 'Learn one burn at a time.' } },
    { title: 'Make your first move.', dialogue: { speaker: 'FLIGHT DIRECTOR', text: 'Hover, pull back, and release.' } }
  ]
}
```

Scenes may override `equation`. The legacy `dialogue.speaker` / `dialogue.text` format remains supported. Empty scene arrays complete immediately.

## API and lifecycle

- `start()`: creates the overlay, focuses Continue, starts a real-time typewriter loop.
- `advance()`: reveals the current text; if already revealed, advances the scene.
- `skip()`: idempotent completion, cancels animation and removes the overlay before the callback.
- `onKeyDown(event)`: Enter / Space continues; Escape skips; repeated keydown is ignored.
- `onClick()` / `onMouseMove()` remain compatibility adapters; the overlay buttons provide normal interaction.

Text runs at 65 characters per real second. Reduced motion displays the full sentence immediately. Chapter briefings appear before flight; retry skips them. Main disables flight input and camera controls during briefing and restores them in the completion callback. All player-provided titles and dialogue are escaped before insertion. CSS is shared with the main interface.

The briefing overlay is fixed to the viewport and does not scroll as a whole. Its header and continue / skip footer remain visible; only `.briefing-main` scrolls when the content exceeds the available height. Narrow screens hide the decorative diagram so the dialogue has room, and short windows use compact header / footer spacing.

新战役 6 个章节首关各配置 2 页中文简报，标题、说话人、说明和按钮全部中文。旧版关卡沿用原对白并使用新的科学示意版式。
