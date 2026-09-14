import { describe, expect, it } from "vitest";
import { CommandEnvelopeSchema } from "./system";

/**
 * 手机端「工作区」页的命令契约。
 *
 * 这里只验协议层（schema），真正的落盘与沙箱由
 * `apps/desktop/src/main/workspace-files-service.ts` 负责 —— 那边有能在容器里
 * 直接跑的真实读写断言（见交接文档 §14.5 的跑法）。
 */
function envelope(type: string, payload: unknown): unknown {
  return {
    protocolVersion: 1,
    id: "cmd_workspace_files_1",
    type,
    timestamp: new Date().toISOString(),
    context: { correlationId: "cmd_workspace_files_1" },
    payload
  };
}

describe("workspaceFiles 命令契约", () => {
  it("接受六条合法命令", () => {
    const cases: Array<[string, unknown]> = [
      ["workspaceFiles.list", { path: "" }],
      ["workspaceFiles.readText", { path: "books/正文.md" }],
      [
        "workspaceFiles.writeText",
        { path: "books/正文.md", content: "# 你好" }
      ],
      [
        "workspaceFiles.create",
        { parentPath: "books", name: "设定.md", kind: "file" }
      ],
      [
        "workspaceFiles.rename",
        { path: "books/设定.md", nextName: "世界观.md" }
      ],
      ["workspaceFiles.remove", { path: "books/设定.md" }]
    ];
    for (const [type, payload] of cases) {
      expect(CommandEnvelopeSchema.parse(envelope(type, payload)).type).toBe(
        type
      );
    }
  });

  it("拒绝未知类型与缺字段的载荷", () => {
    expect(() =>
      CommandEnvelopeSchema.parse(envelope("workspaceFiles.nuke", {}))
    ).toThrow();
    expect(() =>
      CommandEnvelopeSchema.parse(envelope("workspaceFiles.list", {}))
    ).toThrow();
    expect(() =>
      CommandEnvelopeSchema.parse(
        envelope("workspaceFiles.create", { parentPath: "", name: "x.md" })
      )
    ).toThrow();
  });

  it("拒绝空名字与超长名字", () => {
    expect(() =>
      CommandEnvelopeSchema.parse(
        envelope("workspaceFiles.create", {
          parentPath: "",
          name: "   ",
          kind: "file"
        })
      )
    ).toThrow();
    expect(() =>
      CommandEnvelopeSchema.parse(
        envelope("workspaceFiles.rename", {
          path: "a.md",
          nextName: "x".repeat(201)
        })
      )
    ).toThrow();
  });

  it("writeText 的内容有大小上限", () => {
    expect(() =>
      CommandEnvelopeSchema.parse(
        envelope("workspaceFiles.writeText", {
          path: "a.md",
          content: "x".repeat(1_048_577)
        })
      )
    ).toThrow();
  });

  it("kind 只认 file / directory", () => {
    expect(() =>
      CommandEnvelopeSchema.parse(
        envelope("workspaceFiles.create", {
          parentPath: "",
          name: "a",
          kind: "symlink"
        })
      )
    ).toThrow();
  });
});
