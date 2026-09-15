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
  findComposerTreeNode,
  isComposerPickerNodeAvailable,
  toComposerPickerEntry
} from "../utils/composerPickerEntries";

export interface ComposerPickerOptions {
  /** 当前输入框绑定的文档，决定面板里给哪本书的阶段、以及当前在哪本书。 */
  document: Readonly<Ref<WorkspaceDocument>>;
  /** 左侧栏最终可见的资源树，两个面板都直接复用它，不另读作品文件。 */
  sections: Readonly<Ref<readonly ResourceTreeSection[]>>;
  /** 左侧栏当前选中的资源 id：面板据此打勾，并自动展开到它。 */
  activeResourceId?: Readonly<Ref<string | undefined>>;
  /**
   * 当前打开的长篇作品资源 id（`longBookResourceId(activeLongBookId)`）。
   * 资源树里可能同时挂着好几本长篇，没有它就只能是猜。
   */
  activeLongBookResourceId?: Readonly<Ref<string | undefined>>;
  resourceIdForDocumentId(documentId: string): string | undefined;
  select(node: ResourceTreeNode): Promise<unknown>;
  /** 切到另一本书；与新建作品后自动打开走同一条链路。 */
  selectBook(bookId: string): Promise<boolean>;
}

/**
 * 把左侧栏那棵树整理成输入框卡片两个面板的数据：
 * 右半边「阶段」= 当前作品的下一层往下（与左侧栏**同一棵树、同一套可用性判定**，
 * 所以是 `正文 → 第一卷 → 第一章` 这种可展开的层级），
 * 左半边「书籍」= 创作空间的全部作品（平铺一行）。
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
  /** 短篇 / 剧本从输入框绑定文档拿当前作品 id（长篇没有它，见下）。 */
  function currentShortWorkspaceId(): string | undefined {
    const document = options.document.value;
    if (!document.workspaceId || !document.workspaceType) return undefined;
    return document.workspaceId;
  }

  /**
   * 当前打开的作品在资源树里的节点 id。
   * 短篇 / 剧本 = 文档上的 workspaceId；长篇 = `activeLongBookResourceId`
   * （长篇文档没有 workspaceId，而树上可能挂着好几本长篇，必须由调用方指明）。
   */
  function currentBookResourceId(): string | undefined {
    const short = currentShortWorkspaceId();
    if (short) return short;
    const active = options.activeLongBookResourceId?.value;
    if (active) return active;
    if (options.document.value.workspaceType !== "long") return undefined;
    // 兜底：树上第一本长篇（调用方没传当前长篇 id 时）。
    return composerBookEntries(options.sections.value).find((entry) =>
      entry.id.includes("long-book")
    )?.id;
  }

  /** 面板里打勾的 id：优先用左侧栏当前选中项，其次由文档反查。 */
  function currentPickerId(): string | undefined {
    const active = options.activeResourceId?.value;
    if (active) return active;
    const document = options.document.value;
    return options.resourceIdForDocumentId(document.id) ?? document.id;
  }

  const stagePicker = computed<ComposerStagePickerModel>(() => {
    const document = options.document.value;
    const bookId = currentBookResourceId();
    const bookNode = bookId
      ? findComposerTreeNode(options.sections.value, bookId)
      : undefined;
    const currentId = currentPickerId();
    return {
      bookTitle: bookNode?.label ?? document.workspaceTitle ?? "",
      ...(currentId ? { currentId } : {}),
      entries: (bookNode?.children ?? [])
        .filter(isComposerPickerNodeAvailable)
        .map(toComposerPickerEntry)
    };
  });

  const bookPicker = computed<ComposerBookPickerModel>(() => {
    const workspaceId = currentBookResourceId();
    return {
      ...(workspaceId ? { currentBookId: workspaceId } : {}),
      entries: composerBookEntries(options.sections.value)
    };
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
