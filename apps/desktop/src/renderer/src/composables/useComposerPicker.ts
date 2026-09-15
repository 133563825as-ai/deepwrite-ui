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
import type { ComposerContextNavigation } from "./composerContextNavigationContext";
import {
  currentLongNavigationKey,
  findLongBookIdForDocument,
  longNavigationEntries
} from "../utils/composerLongNavigation";

export interface ComposerPickerOptions {
  /** 当前输入框绑定的文档，决定面板里给哪本书的阶段、以及当前在哪本书。 */
  document: Readonly<Ref<WorkspaceDocument>>;
  /** 左侧栏最终可见的资源树，两个面板都直接复用它，不另读作品文件。 */
  sections: Readonly<Ref<readonly ResourceTreeSection[]>>;
  /**
   * 长篇导航（右键菜单那份）。长篇的「阶段」就是 `<书籍 id>:<选中项 key>`
   * 的那些节点，短篇那棵树里没有它们。
   */
  longNavigation?: Readonly<Ref<ComposerContextNavigation | null>>;
  /**
   * 按需加载长篇导航。卡片**不主动调**（那是右键菜单的行为，避免为了显示一行字
   * 去多拉一次数据）；只有已经加载过、`longNavigation` 有值时才会用到它。
   */
  loadLongNavigation?: () => Promise<ComposerContextNavigation | null>;
  resourceIdForDocumentId(documentId: string): string | undefined;
  select(node: ResourceTreeNode): Promise<unknown>;
  /** 切到另一本书；与新建作品后自动打开走同一条链路。 */
  selectBook(bookId: string): Promise<boolean>;
}

function findLongBookLabel(
  sections: readonly ResourceTreeSection[],
  longBookId: string | undefined
): string | undefined {
  if (!longBookId) return undefined;
  const stack = sections.flatMap((section) => section.nodes);
  while (stack.length) {
    const node = stack.pop()!;
    if (node.id === longBookId) return node.label;
    if (node.children?.length) stack.push(...node.children);
  }
  return undefined;
}

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
 *
 * ⚠️ 两个面板**永远给数据**，哪怕列表是空的。
 * 早先「没打开书籍 / 只有一本书 / 这本书没有阶段」时这里返回 undefined，卡片那半边
 * 就退化成一个**不可点的展示位** —— 用户看到「尚未打开书籍 / 未选择阶段」却点不动，
 * 也完全不知道为什么（2026-09-15 真机反馈：「书籍和正文那里不能选择切换了」）。
 * 现在空列表由面板自己解释（见 ComposerPickerSheet 的 emptyHint）。
 */
export function useComposerPicker(
  options: ComposerPickerOptions
): ComposerPickerContext {
  /** 短篇 / 剧本当前打开的作品 id（长篇没有它，见下）。 */
  function currentShortWorkspaceId(): string | undefined {
    const document = options.document.value;
    if (!document.workspaceId || !document.workspaceType) return undefined;
    return document.workspaceId;
  }

  const stagePicker = computed<ComposerStagePickerModel>(() => {
    const document = options.document.value;
    const workspaceId = currentShortWorkspaceId();
    const bookNode = workspaceId
      ? findBookNode(options.sections.value, workspaceId)
      : undefined;
    if (bookNode) {
      return {
        bookTitle: bookNode.label,
        currentId:
          options.resourceIdForDocumentId(document.id) ?? document.id,
        entries: (bookNode.children ?? [])
          .filter(isComposerPickerNodeAvailable)
          .map(toComposerPickerEntry)
      };
    }
    // 长篇：章节不在短篇那棵子树里，走长篇导航的可选项。
    const navigation = options.longNavigation?.value ?? null;
    const longBookResourceId = findLongBookIdForDocument(options.sections.value);
    const bookTitle =
      findLongBookLabel(options.sections.value, longBookResourceId) ??
      document.workspaceTitle ??
      "";
    return {
      bookTitle,
      currentId:
        currentLongNavigationKey(document.id, navigation) ?? document.id,
      entries: longNavigationEntries(navigation, longBookResourceId)
    };
  });

  const bookPicker = computed<ComposerBookPickerModel>(() => {
    const workspaceId =
      currentShortWorkspaceId() ??
      findLongBookIdForDocument(options.sections.value);
    return {
      ...(workspaceId ? { currentBookId: workspaceId } : {}),
      entries: composerBookEntries(options.sections.value)
    };
  });

  async function loadLongNavigation(): Promise<void> {
    if (!options.loadLongNavigation) return;
    try {
      await options.loadLongNavigation();
    } catch {
      // 加载失败不阻塞面板：拿不到长篇导航时右半边给空态说明。
    }
  }

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
    /** 打开某一边之前把长篇导航准备好，长篇的「阶段」就来自它。 */
    ensureStageData: async () => {
      await loadLongNavigation();
    },
    selectStage: (node) => run(() => options.select(node)),
    selectBook: (node) => run(() => options.selectBook(node.id))
  };
}
