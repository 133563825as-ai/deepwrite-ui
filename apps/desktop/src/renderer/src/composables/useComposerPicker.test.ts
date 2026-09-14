import { ref } from "vue";
import { describe, expect, it, vi } from "vitest";
import type {
  ResourceTreeNode,
  ResourceTreeSection,
  WorkspaceDocument
} from "../types/workspace";
import { useComposerPicker } from "./useComposerPicker";

function bookNode(
  id: string,
  label: string,
  children: ResourceTreeNode[] = []
): ResourceTreeNode {
  return { id, label, icon: "book", catalogNodeType: "book", children };
}

function stageNode(
  id: string,
  label: string,
  extra: Partial<ResourceTreeNode> = {}
): ResourceTreeNode {
  return {
    id,
    label,
    icon: "file",
    catalogNodeType: "document",
    targetDocumentId: `doc-${id}`,
    ...extra
  };
}

function twoBookTree(): ResourceTreeSection[] {
  return [
    {
      id: "creation",
      label: "创作空间",
      icon: "book",
      nodes: [
        bookNode("b1", "雨夜列车", [
          stageNode("s1", "人设"),
          stageNode("s2", "剧情", {
            selectableBranch: true,
            children: [stageNode("s2a", "导语")]
          })
        ]),
        bookNode("b2", "长夜剧本", [stageNode("s4", "正文")])
      ]
    },
    {
      id: "skill",
      label: "技能库",
      icon: "library",
      nodes: [
        {
          id: "lib1",
          label: "某技能库",
          icon: "library",
          catalogNodeType: "library"
        }
      ]
    }
  ];
}

function shortDocument(
  overrides: Partial<WorkspaceDocument> = {}
): WorkspaceDocument {
  return {
    id: "doc-known",
    domain: "creation",
    title: "雨夜列车",
    eyebrow: "正文",
    path: ["雨夜列车", "正文"],
    content: "",
    workspaceId: "b1",
    workspaceType: "short",
    workspaceTitle: "雨夜列车",
    ...overrides
  };
}

function setup(
  options: {
    document?: WorkspaceDocument;
    sections?: ResourceTreeSection[];
    select?: (node: ResourceTreeNode) => Promise<unknown>;
    selectBook?: (bookId: string) => Promise<boolean>;
    resourceIdForDocumentId?: (documentId: string) => string | undefined;
  } = {}
) {
  const select = vi.fn(
    options.select ?? (async (_node: ResourceTreeNode) => undefined)
  );
  const selectBook = vi.fn(
    options.selectBook ?? (async (_bookId: string) => true)
  );
  const context = useComposerPicker({
    document: ref(options.document ?? shortDocument()),
    sections: ref(options.sections ?? twoBookTree()),
    resourceIdForDocumentId:
      options.resourceIdForDocumentId ??
      ((documentId) => (documentId === "doc-known" ? "res-known" : undefined)),
    select,
    selectBook
  });
  return { context, select, selectBook };
}

describe("useComposerPicker 面板开关条件", () => {
  it("未打开书籍时两个面板都不提供，卡片退化成纯展示", () => {
    const { context } = setup({
      document: {
        id: "d",
        domain: "material",
        title: "素材",
        eyebrow: "素材",
        path: ["素材"],
        content: ""
      }
    });
    expect(context.stagePicker.value).toBeUndefined();
    expect(context.bookPicker.value).toBeUndefined();
  });

  it("缺少 workspaceType 时不提供（长篇与库文档都没有）", () => {
    const { context } = setup({
      document: shortDocument({ workspaceType: undefined })
    });
    expect(context.stagePicker.value).toBeUndefined();
    expect(context.bookPicker.value).toBeUndefined();
  });

  it("阶段面板取当前书的下一层，currentId 走 resourceIdForDocumentId", () => {
    const { context } = setup();
    const picker = context.stagePicker.value;
    expect(picker?.bookTitle).toBe("雨夜列车");
    expect(picker?.currentId).toBe("res-known");
    expect(picker?.entries.map((entry) => entry.id)).toEqual(["s1", "s2"]);
  });

  it("currentId 解析不到时退回文档 id，避免高亮到别的行", () => {
    const { context } = setup({
      document: shortDocument({ id: "doc-unknown" })
    });
    expect(context.stagePicker.value?.currentId).toBe("doc-unknown");
  });

  it("当前书不在树里时不提供阶段面板，但书籍面板照常可用", () => {
    const { context } = setup({
      document: shortDocument({ workspaceId: "gone" })
    });
    expect(context.stagePicker.value).toBeUndefined();
    expect(context.bookPicker.value?.currentBookId).toBe("gone");
  });

  it("只有一本书时不提供书籍面板：没有可切的目标就不渲染按钮", () => {
    const sections = twoBookTree();
    const { context } = setup({
      sections: [
        { ...sections[0]!, nodes: [sections[0]!.nodes[0]!] },
        sections[1]!
      ]
    });
    expect(context.bookPicker.value).toBeUndefined();
    expect(context.stagePicker.value).not.toBeUndefined();
  });

  it("书籍面板列出创作空间的作品并标出当前那本", () => {
    const { context } = setup();
    expect(context.bookPicker.value?.currentBookId).toBe("b1");
    expect(context.bookPicker.value?.entries.map((entry) => entry.id)).toEqual([
      "b1",
      "b2"
    ]);
  });
});

describe("useComposerPicker 选择动作", () => {
  it("切换阶段把节点交给 select 并返回成功", async () => {
    const { context, select } = setup();
    const node = stageNode("s1", "人设");
    await expect(context.selectStage(node)).resolves.toBe(true);
    expect(select).toHaveBeenCalledWith(node);
  });

  it("切换作品把书籍 id 交给 selectBook 并返回成功", async () => {
    const { context, selectBook } = setup();
    await expect(context.selectBook(bookNode("b2", "长夜剧本"))).resolves.toBe(
      true
    );
    expect(selectBook).toHaveBeenCalledWith("b2");
  });

  it("底层抛错时返回 false，不把异常漏给界面", async () => {
    const { context } = setup({
      select: async () => {
        throw new Error("switch stage failed");
      },
      selectBook: async () => {
        throw new Error("switch book failed");
      }
    });
    await expect(context.selectStage(stageNode("s1", "人设"))).resolves.toBe(
      false
    );
    await expect(context.selectBook(bookNode("b2", "长夜剧本"))).resolves.toBe(
      false
    );
  });
});
