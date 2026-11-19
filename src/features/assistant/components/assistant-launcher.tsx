"use client";

import { SparklesIcon, XIcon } from "lucide-react";
import { type PointerEvent, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { cn } from "@/lib/utils";

import { AssistantPanel } from "./assistant-panel";
import { useAssistant } from "./assistant-provider";

/** 按钮尺寸、与视口边缘的最小距离、对话框与按钮的间距（px） */
const SIZE = 48;
const MARGIN = 16;
const GAP = 12;
const PANEL_WIDTH = 380;
const PANEL_MAX_HEIGHT = 560;
/** 指针移动超过该距离才算拖动，否则视为点击 */
const DRAG_THRESHOLD = 4;

/** 按钮位置：距视口右边、下边的距离，窗口缩放时按钮仍贴近右下角 */
type Offset = { right: number; bottom: number };

const DEFAULT_OFFSET: Offset = { right: 24, bottom: 24 };
const STORAGE_KEY = "nowx.assistant.offset";

// ---------------------------------------------------------------- 外部状态订阅

function subscribeViewport(onChange: () => void) {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
}

/** 视口尺寸，序列化为字符串保证快照稳定；服务端渲染时为 null，按钮只在客户端出现 */
function useViewport() {
  const snapshot = useSyncExternalStore(
    subscribeViewport,
    () => `${window.innerWidth}x${window.innerHeight}`,
    () => null,
  );
  if (!snapshot) return null;
  const [width, height] = snapshot.split("x").map(Number);
  return { width, height };
}

function readSavedOffset(): Offset {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (typeof saved?.right === "number" && typeof saved?.bottom === "number") return saved;
  } catch {
    // 存储内容损坏时使用默认位置
  }
  return DEFAULT_OFFSET;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));

/** 把按钮限制在视口内 */
function clampOffset(offset: Offset, viewport: { width: number; height: number }): Offset {
  return {
    right: clamp(offset.right, MARGIN, viewport.width - SIZE - MARGIN),
    bottom: clamp(offset.bottom, MARGIN, viewport.height - SIZE - MARGIN),
  };
}

/**
 * 对话框位置：优先放在按钮上方，上方放不下且下方更宽裕时放在下方；
 * 按钮在屏幕右半边时右对齐，左半边时左对齐。
 */
function panelPlacement(offset: Offset, viewport: { width: number; height: number }) {
  const buttonLeft = viewport.width - offset.right - SIZE;
  const buttonTop = viewport.height - offset.bottom - SIZE;
  const width = Math.min(PANEL_WIDTH, viewport.width - MARGIN * 2);

  const spaceAbove = buttonTop - GAP - MARGIN;
  const spaceBelow = viewport.height - buttonTop - SIZE - GAP - MARGIN;
  const above = spaceAbove >= PANEL_MAX_HEIGHT || spaceAbove >= spaceBelow;
  const height = Math.min(PANEL_MAX_HEIGHT, above ? spaceAbove : spaceBelow);

  const alignRight = buttonLeft + SIZE / 2 > viewport.width / 2;
  const left = clamp(alignRight ? buttonLeft + SIZE - width : buttonLeft, MARGIN, viewport.width - width - MARGIN);
  const top = above ? buttonTop - GAP - height : buttonTop + SIZE + GAP;
  return { left, top, width, height };
}

// ---------------------------------------------------------------- 组件

/** 可拖动的悬浮助手入口，点击后在按钮旁弹出对话框 */
export function AssistantLauncher() {
  const { open, setOpen } = useAssistant();
  const viewport = useViewport();
  const [saved, setSaved] = useState<Offset | null>(null);
  /** 拖动中的起点；moved 用于区分拖动与点击 */
  const drag = useRef<{ x: number; y: number; origin: Offset; moved: boolean } | null>(null);

  // Esc 关闭对话框
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, setOpen]);

  if (!viewport) return null;
  const offset = clampOffset(saved ?? readSavedOffset(), viewport);

  function onPointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, origin: offset, moved: false };
  }

  function onPointerMove(event: PointerEvent<HTMLButtonElement>) {
    const state = drag.current;
    if (!state || !viewport) return;
    const dx = event.clientX - state.x;
    const dy = event.clientY - state.y;
    if (!state.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    state.moved = true;
    setSaved(clampOffset({ right: state.origin.right - dx, bottom: state.origin.bottom - dy }, viewport));
  }

  function onPointerUp() {
    if (drag.current?.moved) localStorage.setItem(STORAGE_KEY, JSON.stringify(offset));
  }

  function onClick() {
    // 拖动结束时浏览器同样会触发 click，此时不切换对话框
    const moved = drag.current?.moved;
    drag.current = null;
    if (!moved) setOpen(!open);
  }

  const placement = panelPlacement(offset, viewport);

  return (
    <>
      {open && <AssistantPanel style={placement} />}
      <button
        type="button"
        aria-label={open ? "收起项目助手" : "打开项目助手"}
        aria-expanded={open}
        title="项目助手（可拖动）"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={onClick}
        style={{ right: offset.right, bottom: offset.bottom, width: SIZE, height: SIZE }}
        className={cn(
          "bg-primary text-primary-foreground fixed z-50 flex cursor-grab touch-none items-center justify-center rounded-full shadow-lg select-none",
          "transition-[box-shadow,scale] hover:shadow-xl active:scale-95 active:cursor-grabbing",
          "focus-visible:ring-ring/50 focus-visible:ring-3 focus-visible:outline-none",
        )}
      >
        {open ? <XIcon className="size-5" /> : <SparklesIcon className="size-5" />}
      </button>
    </>
  );
}
