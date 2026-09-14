/**
 * 设置页的分类模型。
 *
 * 从 SettingsPage.vue 抽出来是因为现在有两个消费者：桌面/子页的侧栏导航，
 * 以及手机端的分组列表（SettingsGroupedList.vue）。放在组件里会让后者为了拿
 * 类型去反向依赖一个大组件。
 */
export type SettingsCategoryIcon =
  | "user"
  | "sparkles"
  | "keyboard"
  | "globe"
  | "model"
  | "ledger"
  | "brain"
  | "settings"
  | "wand"
  | "archive";

export interface SettingsCategory {
  id: string;
  label: string;
  icon?: SettingsCategoryIcon;
  /**
   * 只在桌面端出现。这些分类尚未实现（点进去是「设置项待配置」占位文案），
   * 手机上摆一排空条目看着像没做完 —— 手机端的分组列表会滤掉它们。
   */
  desktopOnly?: boolean;
}

export interface SettingsSection {
  id: string;
  label: string;
  categories: SettingsCategory[];
}
