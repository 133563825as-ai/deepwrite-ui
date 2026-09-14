import { computed, type Ref } from "vue";
import type { ComposerPickerContext } from "./composerPickerContext";
import type {
  ComposerBookPickerModel,
  ComposerStagePickerModel
} from "../types/composerPicker";
import type {
  ResourceTreeNode,
  ResourceTreeSection,
  WorkspaceDocument
} from "../types/workspace";
import {
  composerBookEntries,
  isComposerPickerNodeAvailable,
  toComposerPickerEntry
} from "../utils/composerPickerEntries";

export interface ComposerPickerOptions {
  /** 当前输入框绑定的文档，决定面板里给哪本书的阶段、以及当前在哪本书。 */
  document: Readonly<Ref<WorkspaceDocument>>;
  /** 左侧栏最终可见的资源树，两个面板都直接复用它，不另读作品文件。 */
  sections: Readonly<Ref<readonly ResourceTreeSection[]>>;
  resourceIdForDocumentId(documentId: string): string | undefined;
  select(node: ResourceTreeNode): Promise<unknown>;
  /** 切到另一本书；与新建作品后自动打开走同一条链路。 */
  selectBook(bookId: string): Promise<boolean>;
}

/** 只有一本书时「切换」没有意义，卡片那半边保持纯展示，不渲染空按钮。 */
const MINIMUM_BOOK_SWITCH_TARGETS = 2;

function findBookNode(
  sections: readonly ResourceTreeSection[],
  workspaceId: string
): ResourceTreeNode | undefined {
  const stack = sections.flatMap((section) => section.nodes);
  while (stack.length) {
    const node = stack.pop()!;
    if (node.id === workspaceId && node.catalogNodeType === "book") return node;
    if (node.children?.length) stack.push(...node.children);
  }
  return undefined;
}

/**
 * 把左侧栏那棵树整理成输入框卡片两个面板的数据：
 * 右半边「阶段」看当前这本书的下一层（短篇 / 剧本只有人物 / 剧情 / 正文一层），
 * 左半边「书籍」看创作空间的全部作品。
 * 两边的选择动作都交回 WorkspaceShell，不新增契约、不直接读写作品文件。
 */
export function useComposerPicker(
  options: ComposerPickerOptions
): ComposerPickerContext {
  /** 长篇、素材库、技能库和未打开书籍都没有阶段树，也谈不上切换作品。 */
  function currentWorkspaceId(): string | undefined {
    const document = options.document.value;
    if (!document.workspaceId || !document.workspaceType) return undefined;
    return document.workspaceId;
  }

  const stagePicker = computed<ComposerStagePickerModel | undefined>(() => {
    const workspaceId = currentWorkspaceId();
    if (!workspaceId) return undefined;
    const document = options.document.value;
    const bookNode = findBookNode(options.sections.value, workspaceId);
    const entries = (bookNode?.children ?? [])
      .filter(isComposerPickerNodeAvailable)
      .map(toComposerPickerEntry);
    if (!entries.length) return undefined;
    return {
      bookTitle: bookNode?.label ?? document.workspaceTitle ?? "",
      currentId: options.resourceIdForDocumentId(document.id) ?? document.id,
      entries
    };
  });

  const bookPicker = computed<ComposerBookPickerModel | undefined>(() => {
    const workspaceId = currentWorkspaceId();
    if (!workspaceId) return undefined;
    const entries = composerBookEntries(options.sections.value);
    if (entries.length < MINIMUM_BOOK_SWITCH_TARGETS) return undefined;
    return { currentBookId: workspaceId, entries };
  });

  async function run(action: () => Promise<unknown>): Promise<boolean> {
    try {
      await action();
      return true;
    } catch {
      return false;
    }
  }

  return {
    stagePicker,
    bookPicker,
    selectStage: (node) => run(() => options.select(node)),
    selectBook: (node) => run(() => options.selectBook(node.id))
  };
}
