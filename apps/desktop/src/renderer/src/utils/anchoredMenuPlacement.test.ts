import { describe, expect, it } from "vitest";
import {
  resolveMenuPlacement,
  type AnchorRect,
  type MenuSize
} from "./anchoredMenuPlacement";

function rect(
  top: number,
  left: number,
  width: number,
  height: number
): AnchorRect {
  return {
    top,
    left,
    right: left + width,
    bottom: top + height,
    width,
    height
  };
}

/** 手机抽屉：整屏高、宽 78vw（430px 视口 → 340px）。 */
const drawer = rect(0, 0, 340, 800);
const menu: MenuSize = { width: 207, height: 190 };

describe("resolveMenuPlacement", () => {
  it("下方放得下时向下弹，且右对齐按钮", () => {
    // 抽屉右边缘 340、margin 8 → 安全线 332；右对齐按钮右边缘 273 用不到它
    const anchor = rect(300, 245, 28, 28);
    const placement = resolveMenuPlacement({ anchor, menu, container: drawer });
    expect(placement.openUp).toBe(false);
    expect(placement.top).toBe(300 + 28 + 4);
    expect(placement.left).toBe(anchor.right - menu.width);
    expect(placement.maxHeight).toBe(menu.height);
  });

  it("下方放不下、上方更宽裕时向上弹", () => {
    const anchor = rect(700, 245, 28, 28);
    const placement = resolveMenuPlacement({ anchor, menu, container: drawer });
    expect(placement.openUp).toBe(true);
    // 菜单底边贴在按钮上方 gap 处
    expect(placement.top + placement.maxHeight).toBe(700 - 4);
  });

  it("上下都不够时选空间更大的一侧，并给菜单自己的滚动高度", () => {
    // 容器只有 200 高，菜单要 190：上下各 ~100，取较大的一侧
    const short = rect(0, 0, 280, 200);
    const anchor = rect(90, 60, 28, 28);
    const placement = resolveMenuPlacement({
      anchor,
      menu,
      container: short
    });
    const spaceAbove = anchor.top - 4 - 8;
    const spaceBelow = short.bottom - 8 - (anchor.bottom + 4);
    expect(placement.openUp).toBe(spaceAbove > spaceBelow);
    expect(placement.maxHeight).toBeLessThan(menu.height);
    expect(placement.maxHeight).toBeGreaterThan(0);
  });

  it("贴着容器右边时被夹回安全距离", () => {
    const anchor = rect(300, 340 - 28, 28, 28); // 按钮右边缘 = 容器右边缘
    const placement = resolveMenuPlacement({ anchor, menu, container: drawer });
    expect(placement.left + menu.width).toBe(340 - 8);
  });

  it("菜单比容器还宽时退到左侧安全距离，不出现负坐标", () => {
    const narrow = rect(0, 0, 120, 800);
    const placement = resolveMenuPlacement({
      anchor: rect(300, 92, 28, 28),
      menu,
      container: narrow
    });
    expect(placement.left).toBe(8);
  });

  it("空间极端不足也不回 0 高度（否则菜单会「打开了但看不见」）", () => {
    const tiny = rect(0, 0, 280, 40);
    const placement = resolveMenuPlacement({
      anchor: rect(6, 60, 28, 28),
      menu,
      container: tiny
    });
    expect(placement.maxHeight).toBeGreaterThanOrEqual(96);
  });
});
