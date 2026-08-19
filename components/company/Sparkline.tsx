"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";

/**
 * Single-series event-frequency sparkline. Per dataviz guidance: one hue, thin
 * 2px line, no legend (the surrounding label names it), no axes/gridlines — a
 * sparkline is a trend glyph, not a full chart. A light gradient fill grounds it
 * to the baseline. Hue defaults to brand purple (chrome accent, not a signal).
 */
export function Sparkline({
  data,
  color = "#8B78FF",
  height = 44,
}: {
  data: { day: string; count: number }[];
  color?: string;
  height?: number;
}) {
  const id = `spark-${color.replace("#", "")}`;
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 2, bottom: 0, left: 2 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis hide domain={[0, "dataMax + 1"]} />
          <Tooltip
            cursor={{ stroke: color, strokeWidth: 1, strokeOpacity: 0.4 }}
            contentStyle={{
              background: "#FFFFFF",
              border: "1px solid #E4E6EE",
              borderRadius: 8,
              fontSize: 12,
              color: "#1B1C22",
              padding: "4px 8px",
              boxShadow: "0 8px 24px -12px rgba(17,24,39,0.25)",
            }}
            labelStyle={{ color: "#6A6C79" }}
            formatter={(v) => [`${v} signal${Number(v) === 1 ? "" : "s"}`, ""]}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke={color}
            strokeWidth={2}
            fill={`url(#${id})`}
            dot={false}
            activeDot={{ r: 3, fill: color }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
