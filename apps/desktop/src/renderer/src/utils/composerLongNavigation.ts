import type { ComposerContextNavigation } from "../composables/composerContextNavigationContext";
import type { ComposerPickerEntry } from "../types/composerPicker";
import type { ResourceTreeNode, ResourceTreeSection } from "../types/workspace";

/**
 * 长篇的「书籍 / 阶段」数据。
 *
 * ⚠️ 长篇节点 id 是 **`long-book:<bookId>`**（书籍）与 **`long-book:<bookId>:<key>`**
 * （阶段 / 章节）—— 是 `long-book` 带连字符，**不是 `longbook`**。
 * 这里第一版自己拼了 `longbook:` 前缀，结果长篇的标题、阶段筛选、当前书高亮
 * 全部对不上，界面表现是「右边说没有打开作品、左边把阶段全混进书里」
 * （2026-09-15 真机反馈：「你把这两个功能合二为一了」）。
 *
 * 教训 → **不要在任何地方重新拼这套 id**：书籍节点直接从资源树里取，
 * 阶段的归属用「书籍节点 id + `:`」做前缀比较，绝不自己解析/构造 id 字符串。
 *
 * 数据不新造链路：复用上游右键菜单已经在用的 `ComposerContextNavigation`
 * （`createWorkspaceComposerContextNavigation` 从同一棵资源树算出 books / stages）。
 */

function findNodeById(
  sections: readonly ResourceTreeSection[],
  nodeId: string
): ResourceTreeNode | undefined {
  const stack = sections.flatMap((section) => section.nodes);
  while (stack.length) {
    const node = stack.pop()!;
    if (node.id === nodeId) return node;
    if (node.children?.length) stack.push(...node.children);
  }
  return undefined;
}

function findNode(
  sections: readonly ResourceTreeSection[],
  predicate: (node: ResourceTreeNode) => boolean
): ResourceTreeNode | undefined {
  const stack = sections.flatMap((section) => section.nodes);
  while (stack.length) {
    const node = stack.pop()!;
    if (predicate(node)) return node;
    if (node.children?.length) stack.push(...node.children);
  }
  return undefined;
}

/**
 * 当前**打开**的长篇书籍节点。
 *
 * 资源树里可能同时挂着好几本长篇，所以顺序很重要：
 *   1. 调用方给的「当前长篇资源 id」（WorkspaceShell 的 `activeLongBookId` 是权威）；
 *   2. 长篇导航里 `current` 的那一项；
 *   3. 兜底：树上第一本长篇。
 * 三者都不用自己拼 id —— 前两个来自上游，第三个直接是树节点的 id。
 */
export function findOpenLongBook(
  sections: readonly ResourceTreeSection[],
  preferredResourceId?: string
): ResourceTreeNode | undefined {
  if (preferredResourceId) {
    const preferred = findNodeById(sections, preferredResourceId);
    if (preferred) return preferred;
  }
  return findNode(sections, (node) => node.catalogNodeType === "long-book");
}

/** 长篇导航里「当前那本书」的资源 id（`books[].current`）。 */
export function currentLongBookResourceId(
  navigation: ComposerContextNavigation | null
): string | undefined {
  return navigation?.books.find((book) => book.current)?.id;
}

/** 面板里打勾高亮用：直接问导航「哪一项是当前项」，别自己比对 id。 */
export function currentLongNavigationId(
  navigation: ComposerContextNavigation | null
): string | undefined {
  return navigation?.stages.find((stage) => stage.current)?.id;
}

/**
 * 这本书的阶段 / 章节行。
 *
 * 行的**节点从资源树里取真节点**：`selectResource` 需要真实节点
 * （`longWorkspaceSelection`、`longTreeItem` 等字段），拿导航里那条只有
 * id/label/icon 的合成记录去选会静默失败。
 */
export function longNavigationEntries(
  sections: readonly ResourceTreeSection[],
  navigation: ComposerContextNavigation | null,
  bookNode: ResourceTreeNode | undefined
): ComposerPickerEntry[] {
  if (!navigation || !bookNode) return [];
  const prefix = `${bookNode.id}:`;
  const entries: ComposerPickerEntry[] = [];
  for (const stage of navigation.stages) {
    // 只要这本书下面的项（`<书籍节点 id>:<key>`），别的长篇不混进来。
    if (!stage.id.startsWith(prefix)) continue;
    const node = findNodeById(sections, stage.id);
    if (!node) continue;
    entries.push({
      id: stage.id,
      label: stage.label,
      node,
      selectable: !stage.disabled,
      items: []
    });
  }
  return entries;
}
