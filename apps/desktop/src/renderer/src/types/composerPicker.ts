import type { ResourceTreeNode } from "./workspace";

/** 选择面板里一个可选中的叶子行（一份阶段文档、一个正文小节或一本书）。 */
export interface ComposerPickerItem {
  id: string;
  label: string;
  node: ResourceTreeNode;
}

/**
 * 选择面板的一行。`items` 非空表示这是可展开的分组（剧情 / 正文 / 人物），
 * 为空表示这是一份可以直接选中的阶段文档或一本书。
 */
export interface ComposerPickerEntry {
  id: string;
  label: string;
  node: ResourceTreeNode;
  /** 该行本身能否作为阶段被选中（对应左侧栏的 selectableBranch）。 */
  selectable: boolean;
  items: ComposerPickerItem[];
  /** 行尾的次要标记，目前只用于书籍行显示「短篇 / 剧本」。 */
  badge?: string;
}

/** 输入框卡片右半边「阶段」的底部面板数据。 */
export interface ComposerStagePickerModel {
  bookTitle: string;
  /** 当前输入框绑定的资源 id，用于在面板里打勾高亮。 */
  currentId?: string;
  entries: ComposerPickerEntry[];
}

/** 输入框卡片左半边「书籍」的底部面板数据。 */
export interface ComposerBookPickerModel {
  /** 当前书籍 id，用于在面板里打勾高亮。 */
  currentBookId?: string;
  entries: ComposerPickerEntry[];
}
