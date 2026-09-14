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
 * 可作为切换目标的作品列表：创作空间里的顶层书籍节点，顺序与左侧栏一致。
 * 长篇（`long-book`）有自己的导航，素材库 / 技能库不是作品，都不在此列。
 */
export function composerBookEntries(
  sections: readonly ResourceTreeSection[]
): ComposerPickerEntry[] {
  const creation = sections.find((section) => section.id === "creation");
  return (creation?.nodes ?? [])
    .filter(
      (node) =>
        node.catalogNodeType === "book" && isComposerPickerNodeAvailable(node)
    )
    .map((node) => ({
      id: node.id,
      label: node.label,
      node,
      selectable: true,
      items: [],
      ...(node.badge ? { badge: node.badge } : {})
    }));
}
