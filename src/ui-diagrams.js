/** Decorative, code-native scientific illustrations; no simulation logic. */
export function orbitDiagram(variant = 'hero', index = 0) {
  const mini = variant === 'mini';
  return `<svg class="orbit-diagram ${mini ? 'mini-diagram' : ''}" viewBox="0 0 560 500" fill="none" aria-hidden="true">
    <defs><pattern id="grid-${variant}-${index}" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M 28 0 L 0 0 0 28" stroke="currentColor" stroke-opacity=".065"/></pattern></defs>
    <rect width="560" height="500" fill="url(#grid-${variant}-${index})"/>
    <g stroke="currentColor" stroke-width="1"><path d="M280 28V472M24 250H536" opacity=".18"/><circle cx="280" cy="250" r="180" opacity=".18"/><circle cx="280" cy="250" r="122" opacity=".18" stroke-dasharray="3 6"/><ellipse cx="280" cy="250" rx="234" ry="104" transform="rotate(-35 280 250)" opacity=".36"/><circle cx="280" cy="250" r="54" opacity=".4"/><path d="M271 250H289M280 241V259" opacity=".5"/>
    <path d="M70 70h16m-8-8v16M474 430h16m-8-8v16" opacity=".4"/></g>
    <circle cx="280" cy="250" r="42" fill="var(--ink)"/><path d="M254 242c20-32 49-17 57 7" stroke="var(--paper)" stroke-opacity=".3"/>
    <path d="M107 364C168 425 419 372 449 162C463 65 363 59 309 132" stroke="var(--accent)" stroke-width="2" stroke-dasharray="5 5" class="transfer-path"/>
    <circle cx="107" cy="364" r="7" fill="var(--accent)"/><circle cx="107" cy="364" r="16" stroke="var(--accent)" opacity=".35"/>
    <circle cx="449" cy="162" r="11" fill="var(--paper)" stroke="var(--ink)"/><path d="M449 143v-8m0 46v8m-19-27h-8m46 0h8" stroke="var(--ink)"/>
    <circle cx="187" cy="101" r="5" fill="var(--ink)"/>
    ${mini ? '' : '<g fill="currentColor" font-family="monospace" font-size="10"><text x="295" y="35">Y / 位置</text><text x="432" y="269">X / 位置</text><text x="43" y="402">01 / 入轨点</text><text x="395" y="123">02 / 拦截点</text><text x="315" y="301">中心天体</text><text x="304" y="319" opacity=".5">r = 1.00 AU</text><text x="36" y="48" opacity=".5">+ 0.00</text><text x="36" y="465" opacity=".5">矢量场 / 示意</text></g>'}
  </svg>`;
}

/** A true initial scene preview, through the existing level loader. */
export function missionDiagram(scene) {
  const pts = [...scene.allBodies.map(b => b.getPosition()), ...scene.bullets, ...scene.buildings.flatMap(b => b.points)];
  const minX = Math.min(...pts.map(p => p.x)) - 70, minY = Math.min(...pts.map(p => p.y)) - 80;
  const width = Math.max(360, Math.max(...pts.map(p => p.x)) - minX + 70);
  const height = Math.max(240, Math.max(...pts.map(p => p.y)) - minY + 80);
  return `<svg class="mission-diagram" viewBox="${minX} ${minY} ${width} ${height}" aria-hidden="true" fill="none">
    <path d="M${minX} ${minY + height / 2}h${width}" stroke="currentColor" opacity=".1" stroke-dasharray="3 8"/>
    ${scene.allBodies.map(b => { const p = b.getPosition(); return `<circle cx="${p.x}" cy="${p.y}" r="${b.radius}" stroke="currentColor" fill="var(--line)"/><circle cx="${p.x}" cy="${p.y}" r="${b.radius + 14}" stroke="currentColor" opacity=".15"/>`; }).join('')}
    ${scene.bullets.map(b => `<circle cx="${b.x}" cy="${b.y}" r="9" fill="var(--green)"/>`).join('')}
    ${scene.buildings.map(b => b.springs.map(s => `<path d="M${s.a.x} ${s.a.y}L${s.b.x} ${s.b.y}" stroke="currentColor" stroke-width="2" opacity=".5"/>`).join('') + b.points.map(p => `<circle cx="${p.x}" cy="${p.y}" r="${p.important ? Math.max(11, p.radius) : 4}" stroke="${p.important ? 'var(--accent)' : 'currentColor'}" stroke-width="2"/>`).join('')).join('')}
  </svg>`;
}
