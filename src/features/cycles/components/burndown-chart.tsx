"use client";

import { useState } from "react";

import { useElementWidth } from "@/hooks/use-element-width";
import { formatMonthDay } from "@/lib/dates";

import type { BurndownPoint } from "../stats";

const HEIGHT = 220;
const PAD = { left: 36, right: 16, top: 14, bottom: 28 };

/** 燃尽图：实际剩余任务（实线）与理想燃尽线（虚线），悬停显示当天数值 */
export function BurndownChart({ points, today }: { points: BurndownPoint[]; today: string }) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) return null;

  const total = points[0].ideal;
  const max = Math.max(4, Math.ceil(Math.max(total, ...points.map((p) => p.actual ?? 0)) / 4) * 4);
  const innerW = width - PAD.left - PAD.right;
  const x = (i: number) => PAD.left + (i * innerW) / (points.length - 1);
  const y = (v: number) => PAD.top + (1 - v / max) * (HEIGHT - PAD.top - PAD.bottom);

  const actual = points.map((p, i) => ({ ...p, i })).filter((p) => p.actual !== null);
  const path = actual.map((p, k) => `${k ? "L" : "M"}${x(p.i)},${y(p.actual!)}`).join(" ");
  const last = actual.at(-1);
  const todayIndex = points.findIndex((p) => p.date === today);
  const step = innerW / (points.length - 1);
  const hovered = hover !== null ? points[hover] : null;

  return (
    <div>
      <div ref={ref} className="relative" onMouseLeave={() => setHover(null)}>
        <svg width={width} height={HEIGHT} role="img" aria-label="燃尽图：每日剩余的未完成任务数">
          {[0, 0.25, 0.5, 0.75, 1].map((f) => {
            const v = Math.round(max * f);
            return (
              <g key={f}>
                <line x1={PAD.left} x2={width - PAD.right} y1={y(v)} y2={y(v)} className="stroke-border" />
                <text x={PAD.left - 8} y={y(v) + 4} textAnchor="end" className="fill-muted-foreground text-[11px]">
                  {v}
                </text>
              </g>
            );
          })}
          {[0, Math.floor((points.length - 1) / 2), points.length - 1].map((i) => (
            <text key={i} x={x(i)} y={HEIGHT - 8} textAnchor="middle" className="fill-muted-foreground text-[11px]">
              {formatMonthDay(points[i].date)}
            </text>
          ))}
          <line
            x1={x(0)}
            y1={y(total)}
            x2={x(points.length - 1)}
            y2={y(0)}
            className="stroke-muted-foreground"
            strokeWidth={1.5}
            strokeDasharray="4 4"
          />
          {todayIndex >= 0 && (
            <g>
              <line x1={x(todayIndex)} x2={x(todayIndex)} y1={PAD.top} y2={HEIGHT - PAD.bottom} className="stroke-primary" strokeDasharray="2 3" />
              <text x={x(todayIndex) + 4} y={PAD.top + 10} className="fill-accent-text text-[11px]">
                今天
              </text>
            </g>
          )}
          {hover !== null && (
            <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={HEIGHT - PAD.bottom} className="stroke-muted-foreground" />
          )}
          <path d={path} fill="none" className="stroke-status-doing" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {last && <circle cx={x(last.i)} cy={y(last.actual!)} r={4.5} className="fill-status-doing stroke-card" strokeWidth={2} />}
          {points.map((p, i) => (
            <rect
              key={p.date}
              x={x(i) - step / 2}
              y={PAD.top}
              width={step}
              height={HEIGHT - PAD.top - PAD.bottom}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
            />
          ))}
        </svg>
        {hovered && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md bg-foreground px-2.5 py-1.5 text-xs whitespace-nowrap text-background"
            style={{ left: x(hover!), top: PAD.top + 30 }}
          >
            {formatMonthDay(hovered.date)}
            <br />
            理想剩余 {hovered.ideal} 个
            {hovered.actual !== null && (
              <>
                <br />
                实际剩余 <b>{hovered.actual} 个</b>
              </>
            )}
          </div>
        )}
      </div>
      <div className="mt-1.5 flex gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <i className="h-0.5 w-3 bg-status-doing" />
          实际剩余任务
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="h-0.5 w-3 bg-[repeating-linear-gradient(90deg,var(--muted-foreground)_0_3px,transparent_3px_5px)]" />
          理想燃尽线
        </span>
      </div>
    </div>
  );
}
