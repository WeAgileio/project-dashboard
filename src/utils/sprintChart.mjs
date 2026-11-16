const SERIES = [
  { key: "done", label: "完成", color: "#2783DE" },
  { key: "rate", label: "速率", color: "#D5803B" },
  { key: "plugin", label: "插件", color: "#46A171" },
  { key: "pluginAvg", label: "插件平均", color: "#7C5CBF" },
];

export function formatSprintNumber(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function finite(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function buildSprintChart(points, width) {
  const rows = Array.isArray(points) ? points : [];
  const safeWidth = Math.max(Number(width) || 0, 320);
  const height = safeWidth < 480 ? 620 : 400;
  const margin = { top: 16, right: 20, bottom: 36, left: 40 };
  const plotW = safeWidth - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const n = rows.length;
  const xFor = (i) => margin.left + (n <= 1 ? plotW / 2 : (plotW * i) / (n - 1));
  const numbers = [];
  for (const row of rows) {
    for (const series of SERIES) {
      const value = finite(row?.[series.key]);
      if (value != null) numbers.push(value);
    }
  }
  const niceMax = Math.max(50, Math.ceil((numbers.length ? Math.max(...numbers) : 0) / 50) * 50);
  const yTickCount = 5;
  const yStep = niceMax / yTickCount;
  const yFor = (value) => margin.top + plotH - (value / niceMax) * plotH;
  const parts = [`<svg viewBox="0 0 ${safeWidth} ${height}" role="img" width="100%">`];

  for (let tick = 0; tick <= yTickCount; tick += 1) {
    const val = yStep * tick;
    const y = yFor(val);
    parts.push(
      `<line class="${val === 0 ? "axis-line" : "grid-line"}" x1="${margin.left}" x2="${safeWidth - margin.right}" y1="${y}" y2="${y}"></line>`
    );
    parts.push(
      `<text class="tick-label" x="${margin.left - 8}" y="${y + 4}" text-anchor="end">${Math.round(val)}</text>`
    );
  }
  parts.push(`<text class="axis-title" x="12" y="${margin.top - 2}">數值</text>`);

  const maxTicks = safeWidth < 480 ? 7 : 13;
  const skip = Math.max(1, Math.ceil(n / maxTicks) || 1);
  for (let i = 0; i < n; i += skip) {
    const bits = String(rows[i].date || "").split("-");
    const label = bits.length === 3 ? `${bits[1]}/${bits[2]}` : String(rows[i].date || "");
    parts.push(
      `<text class="tick-label" x="${xFor(i)}" y="${height - margin.bottom + 18}" text-anchor="middle">${label}</text>`
    );
  }

  const marks = [];
  const series = SERIES.map((item) => {
    const plotted = rows.map((row, index) => {
      const value = finite(row?.[item.key]);
      if (value == null) return null;
      return { x: xFor(index), y: yFor(value), value };
    });
    let path = "";
    let drawing = false;
    for (const mark of plotted) {
      if (!mark) {
        drawing = false;
        continue;
      }
      path += `${drawing ? "L" : "M"}${mark.x},${mark.y} `;
      drawing = true;
    }
    if (path.trim()) {
      parts.push(
        `<path d="${path.trim()}" fill="none" stroke="${item.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"></path>`
      );
    }
    plotted.forEach((mark, index) => {
      if (!mark) return;
      const text = formatSprintNumber(mark.value);
      const label = `開啟 ${rows[index].date} 的 Notion 頁面`;
      parts.push(
        `<circle class="data-mark data-hit" data-index="${index}" cx="${mark.x}" cy="${mark.y}" r="11" fill="transparent" aria-label="${label}"></circle>`
      );
      parts.push(
        `<circle class="data-mark" data-index="${index}" cx="${mark.x}" cy="${mark.y}" r="3.5" fill="${item.color}" aria-label="${label}"></circle>`
      );
      marks.push({ x: mark.x, y: mark.y, text });
    });
    return { key: item.key, label: item.label, color: item.color, points: plotted };
  });

  const placed = [];
  const overlaps = (a, b) => a.l < b.r + 3 && a.r > b.l - 3 && a.t < b.b + 3 && a.b > b.t - 3;
  for (const mark of marks) {
    const w = mark.text.length * 6.6 + 4;
    const candidates = [];
    for (let radius = 0; radius < 240; radius += 16) {
      for (const dx of [0, -16, 16, -32, 32]) {
        for (const sign of [-1, 1]) {
          const x = Math.max(margin.left + w / 2, Math.min(safeWidth - 4 - w / 2, mark.x + dx));
          const y = mark.y + sign * (12 + radius);
          const box = { l: x - w / 2, r: x + w / 2, t: y - 10, b: y + 3 };
          if (box.t < margin.top || box.b > height - margin.bottom - 4) continue;
          const collisions = placed.filter((item) => overlaps(box, item)).length;
          const covering = marks.filter(
            (item) => item.x > box.l - 4 && item.x < box.r + 4 && item.y > box.t - 4 && item.y < box.b + 4
          ).length;
          candidates.push({
            x,
            y,
            box,
            score: collisions * 100000 + covering * 10000 + radius + Math.abs(dx),
          });
        }
      }
      if (candidates.some((item) => item.score < 10000)) break;
    }
    candidates.sort((a, b) => a.score - b.score);
    const target = candidates[0];
    if (!target) continue;
    placed.push(target.box);
    if (Math.abs(target.y - mark.y) > 16 || Math.abs(target.x - mark.x) > 4) {
      parts.push(
        `<line class="value-guide" x1="${mark.x}" y1="${mark.y}" x2="${target.x}" y2="${target.y - 3}"></line>`
      );
    }
    parts.push(
      `<text class="point-value" x="${target.x}" y="${target.y}" text-anchor="middle">${mark.text}</text>`
    );
  }

  parts.push("</svg>");
  const hits = rows.map((row, index) => ({
    date: row.date,
    url: typeof row.url === "string" && row.url.startsWith("https://") ? row.url : "",
    x: xFor(index),
    items: SERIES.flatMap((item) => {
      const value = finite(row?.[item.key]);
      if (value == null) return [];
      return [{ label: item.label, color: item.color, text: formatSprintNumber(value) }];
    }),
  }));
  return { svg: parts.join(""), width: safeWidth, height, hits, series };
}
