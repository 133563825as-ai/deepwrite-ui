/**
 * 浮层菜单的落点计算（纯函数，不碰 DOM）。
 *
 * 起因：抽屉里区块的「+」菜单原先是 `position: absolute`，靠一条 CSS 静态启发式
 * （`nth-last-child(-n + 2)` → 最后两个区块改成朝上弹）来决定方向。两个毛病：
 *
 * 1. **会被滚动容器裁掉。** `.section-action-menu` 的祖先是
 *    `.sidebar-scroll { overflow-y: auto }`，绝对定位的子元素照样被裁。
 *    用户把「更多功能」收起、下面区块整体上移之后，朝上弹的菜单就撞到容器顶边，
 *    用户原话：「打开的弹窗会被遮挡一部分」。
 * 2. **方向是写死的，不看当时有没有空间。** 同一个区块在不同展开状态下高度差很多，
 *    静态规则必然在某些组合下是错的。
 *
 * 所以这里把「在哪儿弹」变成一次真实测量：给定按钮矩形、菜单尺寸和允许占用的区域，
 * 算出 `position: fixed` 的落点。配合 Teleport，任何祖先的 overflow 都裁不到它。
 */

export interface AnchorRect {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface MenuSize {
  width: number;
  height: number;
}

export interface MenuPlacement {
  /** 向上弹还是向下弹（落点已经算好了，这个字段主要用于测试与调试）。 */
  openUp: boolean;
  top: number;
  left: number;
  /** 放不下时的最大高度，菜单内部自己滚；永远不为 0，否则菜单会「打开但看不见」。 */
  maxHeight: number;
}

export interface MenuPlacementInput {
  /** 触发按钮（区块右侧那个「+」）的视口矩形。 */
  anchor: AnchorRect;
  /** 菜单本体的尺寸。 */
  menu: MenuSize;
  /** 允许占用的区域 —— 手机上给抽屉（`.left-sidebar`）的矩形，桌面端通常给视口。 */
  container: AnchorRect;
  /** 与按钮之间的间距，默认 4（和原 CSS 的 calc(100% + 4px) 对齐）。 */
  gap?: number;
  /** 与容器边缘的安全距离，默认 8。 */
  margin?: number;
  /** 即使空间不够也不让 maxHeight 低于这个值，默认 96。 */
  minVisibleHeight?: number;
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

export function resolveMenuPlacement(input: MenuPlacementInput): MenuPlacement {
  const gap = input.gap ?? 4;
  const margin = input.margin ?? 8;
  const minVisibleHeight = input.minVisibleHeight ?? 96;
  const { anchor, menu, container } = input;

  // 水平：优先右对齐按钮右边缘（原 CSS 是 right: 0），再夹回容器内。
  const minLeft = container.left + margin;
  const maxLeft = container.right - margin - menu.width;
  const left = clamp(anchor.right - menu.width, minLeft, maxLeft);

  // 垂直：优先向下弹（和桌面端一致，也不会盖住按钮上方的列表）。
  const spaceBelow = container.bottom - margin - (anchor.bottom + gap);
  const spaceAbove = anchor.top - gap - (container.top + margin);
  const openUp = menu.height > spaceBelow && spaceAbove > spaceBelow;

  const available = openUp ? spaceAbove : spaceBelow;
  const maxHeight = Math.max(
    minVisibleHeight,
    Math.min(menu.height, Math.max(available, 0))
  );
  const top = openUp ? anchor.top - gap - maxHeight : anchor.bottom + gap;

  return { openUp, top, left, maxHeight };
}
