import type { ComputedRef, InjectionKey } from "vue";
import type {
  ComposerBookPickerModel,
  ComposerStagePickerModel
} from "../types/composerPicker";
import type { ResourceTreeNode } from "../types/workspace";

/**
 * 输入框上方那张「书籍 / 阶段」卡片去拿两个底部面板的数据与切换动作的入口。
 * 与 agentActivityContext 一样由 WorkspaceShell 提供，避免多层组件透传。
 */
export interface ComposerPickerContext {
  /** 无法提供阶段树时（未打开书籍 / 素材库 / 技能库 / 长篇）为 undefined。 */
  stagePicker: ComputedRef<ComposerStagePickerModel | undefined>;
  /** 创作空间里没有第二本书可切时为 undefined，卡片那半边保持纯展示。 */
  bookPicker: ComputedRef<ComposerBookPickerModel | undefined>;
  /** 走与左侧栏完全相同的资源选择链路，返回是否切换成功。 */
  selectStage(node: ResourceTreeNode): Promise<boolean>;
  /** 走与新建作品后自动打开相同的链路，返回是否切换成功。 */
  selectBook(node: ResourceTreeNode): Promise<boolean>;
}

export const COMPOSER_PICKER_CONTEXT_KEY: InjectionKey<ComposerPickerContext> =
  Symbol("deepwrite-composer-picker");
