import type {
  ComposerContextNavigation,
  ComposerContextOption
} from "../composables/composerContextNavigationContext";
import type { ComposerPickerEntry } from "../types/composerPicker";
import type { ResourceTreeNode, ResourceTreeSection } from "../types/workspace";

/**
 * 长篇的「书籍 / 阶段」数据。
 *
 * 长篇走的是自己那套导航（`longWorkspaceSelection`），它的节点**不在**短篇那棵
 * 资源子树里 —— 所以只认短篇树的 `useComposerPicker` 在长篇下永远取不到东西，
 * 卡片两半就变成点不动的展示位（2026-09-15 真机反馈：「书籍和正文那里不能选择切换了」，
 * 当时开的是长篇，加多少本书都没用）。
 *
 * 这里不新造链路：数据直接复用上游右键菜单已经在用的
 * `ComposerContextNavigation`（`books` / `stages`，由
 * `createWorkspaceComposerContextNavigation` 从同一棵资源树算出）。
 */

/** `longBookResourceId(bookId)` 的形状；长篇节点 id 一律是 `<书籍资源 id>:<选中项 key>`。 */
const LONG_NODE_ID_SEPARATOR = ":";
const LONG_BOOK_RESOURCE_PREFIX = "longbook:";

/**
 * 当前打开的长篇书籍 id。
 *
 * 长篇文档没有 `workspaceId`，只能靠资源树里那个 `long-book` 节点的 id
 * （`longbook:<bookId>`）认。用户点进「世界观 / 人物 / 剧情」之后，当前选中的是
 * 它**子节点**，所以这里用 `longBookId` 字段做判断，子节点一样命中。
 */
export function findLongBookIdForDocument(
  sections: readonly ResourceTreeSection[]
): string | undefined {
  const stack = sections.flatMap((section) => section.nodes);
  while (stack.length) {
    const node = stack.pop()!;
    if (node.catalogNodeType === "long-book" && node.longBookId) {
      return `${LONG_BOOK_RESOURCE_PREFIX}${node.longBookId}`;
    }
    if (node.children?.length) stack.push(...node.children);
  }
  return undefined;
}

/** 当前长篇导航项在树上的节点 id（`<书籍资源 id>:<key>`），拿不到就 undefined。 */
export function currentLongNavigationKey(
  documentId: string,
  navigation: ComposerContextNavigation | null
): string | undefined {
  if (!navigation) return undefined;
  const current = navigation.stages.find((stage) => stage.current);
  if (!current) return undefined;
  // 只认属于当前文档那一项：右键菜单的 current 判定是「包含当前选中资源」，
  // 万一层级对不上，宁可给空态也不要切错地方。
  return current.id === documentId || current.id.endsWith(documentId)
    ? current.id
    : undefined;
}

/**
 * 把长篇导航的「可选阶段」整理成面板行：分组行（世界观 / 人物 / 剧情 / 正文…）
 * 可展开，叶子行可选中。节点本身来自导航，不在这里另建树。
 */
export function longNavigationEntries(
  navigation: ComposerContextNavigation | null,
  bookResourceId: string | undefined
): ComposerPickerEntry[] {
  if (!navigation || !bookResourceId) return [];
  return navigation.stages
    // 只收这部作品的项（`<书籍资源 id>:<key>`），别把别的长篇混进来。
    .filter(
      (stage) =>
        stage.id.startsWith(`${bookResourceId}${LONG_NODE_ID_SEPARATOR}`) ||
        stage.id === bookResourceId
    )
    .map((stage) => ({
      id: stage.id,
      label: stage.label,
      node: longNavigationNode(stage),
      selectable: !stage.disabled,
      items: []
    }));
}

function longNavigationNode(stage: ComposerContextOption): ResourceTreeNode {
  return {
    id: stage.id,
    label: stage.label,
    icon: stage.icon,
    workspaceType: "long",
    selectableBranch: true
  };
}
