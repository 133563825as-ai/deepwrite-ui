import { describe, expect, it } from "vitest";
import source from "./WorkspaceDirectoryFeature.vue?raw";

describe("WorkspaceDirectoryFeature", () => {
  it("owns only the lightweight workspace-directory UI", () => {
    expect(source).toContain("这里决定以后新建和导入项目的默认位置");
    expect(source).toContain("long-book-analysis-sources");
    expect(source).toContain(':disabled="loading"');
    expect(source).toContain("@click=\"emit('choose')\"");
    expect(source).not.toContain("ModelSettings");
    expect(source).not.toContain("modelEditor");
    expect(source).not.toContain("listRemote");
  });

  it("把文件浏览交给子组件，自己只做页面组装", () => {
    // 「工作区」页 = 工作目录卡片 + 文件浏览。文件浏览（列表/菜单/对话框/编辑器）
    // 全部在 WorkspaceFilesBrowser 里，这一层不许长出第二份实现 ——
    // 否则又是一个越改越大的上帝组件（AGENTS.md 的体量约束）。
    expect(source).toContain("<WorkspaceFilesBrowser");
    expect(source).toContain("workspace-files");
    expect(source).not.toContain("workspaceFiles.list");
    expect(source).not.toContain("WorkspaceFileEditor");
  });
});
