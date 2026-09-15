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
  /**
   * 阶段面板的数据。未打开作品 / 长篇 / 素材库 / 技能库时 `entries` 为空数组，
   * 由面板给出空态说明，而不是让卡片那半边变成点不动的展示位。
   */
  stagePicker: ComputedRef<ComposerStagePickerModel>;
  /** 创作空间里的作品列表；一部都没有时 `entries` 为空数组，面板提示去新建。 */
  bookPicker: ComputedRef<ComposerBookPickerModel>;
  /** 走与左侧栏完全相同的资源选择链路，返回是否切换成功。 */
  selectStage(node: ResourceTreeNode): Promise<boolean>;
  /** 走与新建作品后自动打开相同的链路，返回是否切换成功。 */
  selectBook(node: ResourceTreeNode): Promise<boolean>;
}

export const COMPOSER_PICKER_CONTEXT_KEY: InjectionKey<ComposerPickerContext> =
  Symbol("deepwrite-composer-picker");