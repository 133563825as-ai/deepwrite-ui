import { describe, expect, it } from "vitest";
import type { ResourceTreeNode, ResourceTreeSection } from "../types/workspace";
import {
  composerBookEntries,
  isComposerPickerNodeAvailable,
  toComposerPickerEntry
} from "./composerPickerEntries";

function bookNode(
  id: string,
  label: string,
  extra: Partial<ResourceTreeNode> = {}
): ResourceTreeNode {
  return { id, label, icon: "book", catalogNodeType: "book", ...extra };
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

function creationSection(nodes: ResourceTreeNode[]): ResourceTreeSection {
  return { id: "creation", label: "创作空间", icon: "book", nodes };
}

describe("composerBookEntries", () => {
  const sections: ResourceTreeSection[] = [
    creationSection([
      bookNode("b1", "雨夜列车", {
        badge: "短篇",
        children: [stageNode("s1", "人设"), stageNode("s2", "正文")]
      }),
      bookNode("b2", "长夜剧本", { badge: "剧本" }),
      {
        id: "lb",
        label: "某长篇",
        icon: "book",
        catalogNodeType: "long-book",
        longBookId: "L1"
      },
      bookNode("b3", "读不到的书", { unavailable: true }),
      {
        id: "lib1",
        label: "某技能库",
        icon: "library",
        catalogNodeType: "library"
      }
    ]),
    {
      id: "skill",
      label: "技能库",
      icon: "library",
      nodes: [
        {
          id: "lib2",
          label: "另一技能库",
          icon: "library",
          catalogNodeType: "library"
        }
      ]
    }
  ];

  it("只取创作空间的顶层书籍，顺序与左侧栏一致", () => {
    expect(composerBookEntries(sections).map((entry) => entry.id)).toEqual([
      "b1",
      "b2"
    ]);
  });

  it("排除长篇、读取失败的书与技能库", () => {
    const ids = composerBookEntries(sections).map((entry) => entry.id);
    expect(ids).not.toContain("lb");
    expect(ids).not.toContain("b3");
    expect(ids).not.toContain("lib1");
  });

  it("透传书籍类型角标", () => {
    expect(composerBookEntries(sections).map((entry) => entry.badge)).toEqual([
      "短篇",
      "剧本"
    ]);
  });

  it("书籍行恒为可选且没有子项，面板渲染成一排平铺的行", () => {
    for (const entry of composerBookEntries(sections)) {
      expect(entry.selectable).toBe(true);
      expect(entry.items).toEqual([]);
    }
  });

  it("没有创作空间段落时返回空数组而不是抛错", () => {
    expect(composerBookEntries([])).toEqual([]);
  });
});

describe("toComposerPickerEntry", () => {
  it("没有子节点时自身可选", () => {
    expect(toComposerPickerEntry(stageNode("s1", "导语")).selectable).toBe(
      true
    );
  });

  it("有子节点但没有 selectableBranch 时点击只负责展开", () => {
    const entry = toComposerPickerEntry({
      id: "plot",
      label: "剧情",
      children: [stageNode("a", "A")]
    });
    expect(entry.selectable).toBe(false);
    expect(entry.items.map((item) => item.id)).toEqual(["a"]);
  });

  it("有子节点且 selectableBranch 时整组可选，与左侧栏一致", () => {
    const entry = toComposerPickerEntry({
      id: "character",
      label: "人物",
      selectableBranch: true,
      children: [stageNode("a", "A")]
    });
    expect(entry.selectable).toBe(true);
  });

  it("缺失或不可用的子节点不进面板", () => {
    const entry = toComposerPickerEntry(
      bookNode("b1", "雨夜列车", {
        children: [
          stageNode("s1", "人设"),
          stageNode("s2", "剧情", { missing: true }),
          stageNode("s3", "正文", { unavailable: true })
        ]
      })
    );
    expect(entry.items.map((item) => item.id)).toEqual(["s1"]);
  });

  it("子节点全部不可用时退化成只负责展开的分组行", () => {
    const entry = toComposerPickerEntry({
      id: "plot",
      label: "剧情",
      selectableBranch: true,
      children: [stageNode("s2", "剧情", { missing: true })]
    });
    expect(entry.selectable).toBe(false);
    expect(entry.items).toEqual([]);
  });
});

describe("isComposerPickerNodeAvailable", () => {
  it("缺失与不可用都不算可用", () => {
    expect(isComposerPickerNodeAvailable(stageNode("s1", "人设"))).toBe(true);
    expect(
      isComposerPickerNodeAvailable({ id: "a", label: "A", missing: true })
    ).toBe(false);
    expect(
      isComposerPickerNodeAvailable({ id: "a", label: "A", unavailable: true })
    ).toBe(false);
  });
});
