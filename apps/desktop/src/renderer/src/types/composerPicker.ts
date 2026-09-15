import type { ResourceTreeNode } from "./workspace";

/**
 * 选择面板里的一行，**可递归**。
 *
 * `items` 非空 = 还能往下钻（世界观 / 人物设计 / 正文 → 分卷 → 章卡…）；
 * 为空 = 叶子行，点它就是选中。
 * 结构与左侧栏那棵树 1:1，长得跟官方端一致（分组 + 行尾数量 + 当前项打勾）。
 */
export interface ComposerPickerItem {
  id: string;
  label: string;
  node: ResourceTreeNode;
  /** 该行本身能否作为阶段被选中（对应左侧栏的 selectableBranch）。 */
  selectable: boolean;
  items: ComposerPickerItem[];
  /** 行尾的次要标记，书籍行显示「短篇 / 剧本 / 长篇」。 */
  badge?: string;
}

/** 面板顶层的一行；与 `ComposerPickerItem` 同构，单独取名只为读起来清楚。 */
export type ComposerPickerEntry = ComposerPickerItem;

/** 输入框卡片右半边「阶段」的底部面板数据。 */
export interface ComposerStagePickerModel {
  bookTitle: string;
  /** 当前选中的资源 id，用于在面板里打勾高亮。 */
  currentId?: string;
  entries: ComposerPickerEntry[];
}

/** 输入框卡片左半边「书籍」的底部面板数据。 */
export interface ComposerBookPickerModel {
  /** 当前书籍的资源 id，用于在面板里打勾高亮。 */
  currentBookId?: string;
  entries: ComposerPickerEntry[];
}
