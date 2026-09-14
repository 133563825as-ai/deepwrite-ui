export type AppView = "workspace" | "settings";

export type WorkspaceMainView =
  | "conversation"
  | "directory"
  | "models"
  | "imitation"
  | "long-book-analysis"
  | "style-comparison"
  | "agent-team"
  | "marketplace"
  | "cloud-backup"
  | "device-sync"
  | "zhuque-detection";

export type PrimaryFeature =
  | "directory"
  | "models"
  | "imitation"
  | "long-book-analysis"
  | "style-comparison"
  | "chat-assistant"
  | "agent-teams"
  | "skill-marketplace"
  | "cloud-backup"
  | "device-sync"
  | "zhuque-detection";

export function primaryFeatureForView(
  view: WorkspaceMainView
): PrimaryFeature | undefined {
  switch (view) {
    case "agent-team":
      return "agent-teams";
    case "marketplace":
      return "skill-marketplace";
    case "device-sync":
    case "cloud-backup":
    case "zhuque-detection":
    case "directory":
    case "models":
    case "imitation":
    case "long-book-analysis":
    case "style-comparison":
      return view;
    default:
      return undefined;
  }
}

/**
 * 功能页在手机端详情顶栏上的标题。
 *
 * 文案与 LeftSidebar 的导航项保持一致 —— 那是在抽屉里点进去时看到的名字，
 * 顶栏换个说法用户会对不上号。
 */
const WORKSPACE_FEATURE_TITLES: Record<
  Exclude<WorkspaceMainView, "conversation">,
  string
> = {
  directory: "工作目录",
  models: "自定义模型配置",
  imitation: "短篇学习仿写",
  "long-book-analysis": "长篇拆书分析",
  "style-comparison": "文风比对",
  "agent-team": "智能体团队",
  marketplace: "技能广场",
  "cloud-backup": "云端备份",
  "device-sync": "双端同步",
  "zhuque-detection": "朱雀检测"
};

/**
 * 工作区功能页的标题；对话页返回空串（那说明不是详情页，顶栏该显示聊天/写作 tab）。
 */
export function workspaceFeatureTitle(view: WorkspaceMainView): string {
  return view === "conversation" ? "" : WORKSPACE_FEATURE_TITLES[view];
}
