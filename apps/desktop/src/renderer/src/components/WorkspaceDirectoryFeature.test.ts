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
    // 卡片显示的目录以子组件实测到的根为准（`update:root`）——
    // 顺手修掉一条早就失效的断言：原来这里查的是 `workspace-files`，
    // 而本文件里从来没有过这个字符串（真正带它的 class 在子组件里）。
    expect(source).toContain('@update:root="browserRoot = $event"');
    expect(source).not.toContain("workspaceFiles.list");
    expect(source).not.toContain("WorkspaceFileEditor");
  });
});
