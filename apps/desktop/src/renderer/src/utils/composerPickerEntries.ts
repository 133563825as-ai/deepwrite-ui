import type {
  ComposerPickerEntry,
  ComposerPickerItem
} from "../types/composerPicker";
import type { ResourceTreeNode, ResourceTreeSection } from "../types/workspace";

/**
 * 左侧栏那棵资源树到选择面板数据的纯投影。
 * 抽出来是因为「阶段」和「书籍」两个面板看的是同一棵树，用的也必须是同一套
 * 可用性判定，免得出现「侧栏能选、面板里没有」这种对不上的情况。
 */

/** 缺失或不可用的节点不进面板，也不参与「有没有子项」的判定。 */
export function isComposerPickerNodeAvailable(node: ResourceTreeNode): boolean {
  return node.unavailable !== true && node.missing !== true;
}

export function toComposerPickerItem(
  node: ResourceTreeNode
): ComposerPickerItem {
  return { id: node.id, label: node.label, node };
}

export function toComposerPickerEntry(
  node: ResourceTreeNode
): ComposerPickerEntry {
  const children = (node.children ?? []).filter(isComposerPickerNodeAvailable);
  return {
    id: node.id,
    label: node.label,
    node,
    // 分组行只在左侧栏允许整组选中时才可选，否则点击只负责展开。
    selectable: children.length === 0 || node.selectableBranch === true,
    items: children.map(toComposerPickerItem)
  };
}

/**
 * 可作为切换目标的作品列表：创作空间里的顶层作品节点，顺序与左侧栏一致。
 * 素材库 / 技能库不是作品，不在此列。
 *
 * ⚠️ 长篇（`catalogNodeType === "long-book"`）**必须算作品**。
 * 早先这里只收 `"book"`，于是创作空间里只要有长篇，用户就会看到
 * 「加了几本书也没用、左边那个书名点不动」——「书籍」面板里一部作品都没有，
 * 卡片左半边直接退化成不可点的展示位（2026-09-15 真机反馈）。
 */
const COMPOSER_BOOK_NODE_TYPES = ["book", "long-book"] as const;

export function composerBookEntries(
  sections: readonly ResourceTreeSection[]
): ComposerPickerEntry[] {
  const creation = sections.find((section) => section.id === "creation");
  return (creation?.nodes ?? [])
    .filter(
      (node) =>
        node.catalogNodeType !== undefined &&
        COMPOSER_BOOK_NODE_TYPES.includes(
          node.catalogNodeType as (typeof COMPOSER_BOOK_NODE_TYPES)[number]
        ) &&
        isComposerPickerNodeAvailable(node)
    )
    .map(toComposerBookEntry);
}

/**
 * 创作空间里的作品节点 → 选择面板里的一行。
 *
 * ⚠️ **平铺一行，不带子项**。曾经把作品下面的阶段 / 章节挂成可展开子项，
 * 结果是「书籍」面板里塞进了每一本的阶段，而右边「阶段」面板反而空了 ——
 * 用户的原话是「你把这两个功能合二为一了，全部集中在这里」。
 * 左边只管「换哪本书」，右边只管「这本书的哪个阶段」，两边不要互相渗透。
 */
export function toComposerBookEntry(
  node: ResourceTreeNode
): ComposerPickerEntry {
  return {
    id: node.id,
    label: node.label,
    node,
    selectable: true,
    items: [],
    ...(node.badge ? { badge: node.badge } : {})
  };
}
