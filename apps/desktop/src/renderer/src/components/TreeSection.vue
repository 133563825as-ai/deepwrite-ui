<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import type {
  BookResourceDialogMode,
  CatalogResourceNodeActionPayload,
  CatalogLibraryEntryDragPayload,
  CreationBookDragPayload,
  IconName,
  LongBookResourceNodeActionPayload,
  LongTreeItemAction,
  ResourceSectionAction,
  ResourceSectionActionPayload,
  ResourceTreeNode,
  ResourceTreeSection
} from "../types/workspace";
import AppIcon from "./AppIcon.vue";
import TreeNodeItem from "./TreeNodeItem.vue";
import { useCreationBookDrag } from "../composables/useCreationBookDrag";
import { useMobileShellStore } from "../stores/mobileShellStore";
import {
  resolveMenuPlacement,
  type MenuPlacement
} from "../utils/anchoredMenuPlacement";

const mobileShell = useMobileShellStore();

const props = defineProps<{
  section: ResourceTreeSection;
  selectedId: string;
  pinnedIds?: string[];
  libraryEntryClipboardDomain?: "skill" | "material" | undefined;
  longTreeActionsDisabled?: boolean;
}>();

const emit = defineEmits<{
  select: [node: ResourceTreeNode];
  togglePin: [node: ResourceTreeNode];
  bookAction: [mode: BookResourceDialogMode, node: ResourceTreeNode];
  exportBook: [node: ResourceTreeNode];
  longBookAction: [payload: LongBookResourceNodeActionPayload];
  resourceAction: [payload: ResourceSectionActionPayload];
  resourceNodeAction: [payload: CatalogResourceNodeActionPayload];
  moveLibraryEntry: [payload: CatalogLibraryEntryDragPayload];
  reorderCreationBook: [payload: CreationBookDragPayload];
  createExpertSection: [node: ResourceTreeNode];
  createLongDraftSection: [node: ResourceTreeNode];
  longDraftSectionAction: [
    action: "move-up" | "move-down" | "delete",
    node: ResourceTreeNode
  ];
  createLongTreeItem: [node: ResourceTreeNode];
  longTreeItemAction: [action: LongTreeItemAction, node: ResourceTreeNode];
  deleteLongLedgerCommit: [node: ResourceTreeNode];
  removeExpertSection: [node: ResourceTreeNode];
  expertSectionAction: [
    action: "move-up" | "move-down",
    node: ResourceTreeNode
  ];
  createCharacterItem: [node: ResourceTreeNode];
  characterItemAction: [
    action: "rename" | "move-up" | "move-down" | "delete",
    node: ResourceTreeNode
  ];
}>();

const collapsed = ref(false);
const actionMenuOpen = ref(false);
const actionArea = ref<HTMLElement | null>(null);
const actionButton = ref<HTMLElement | null>(null);
const actionMenu = ref<HTMLElement | null>(null);
/** 手机端的浮层落点；桌面端保持原来的 absolute 定位，这个值不会被用到。 */
const menuPlacement = ref<MenuPlacement | null>(null);

/*
 * 手机端这条菜单为什么要「测量 + 脱离滚动容器」：
 *
 * 它原先靠 CSS 静态启发式（mobile-shell.css 里 `.resource-section:nth-last-child(-n+2)`
 * → 最后两个区块改成朝上弹）决定方向，而它的祖先是
 * `.sidebar-scroll { overflow-y: auto }` —— 绝对定位的子元素照样被裁。
 * 用户把「更多功能」收起、下面区块整体上移之后，朝上弹的菜单就撞到容器顶边，
 * 表现是「打开的弹窗会被遮挡一部分」。
 *
 * 现在：落点由 resolveMenuPlacement 按真实可用空间算（优先向下，放不下才向上，
 * 再放不下就自己滚），并且 Teleport 到 body —— 任何祖先的 overflow 都裁不到。
 * 桌面端不改：Teleport 被 disabled，样式仍是原来那套。
 */
const floatingStyle = computed(() => {
  const placement = menuPlacement.value;
  if (!mobileShell.isMobile || !placement) {
    return undefined;
  }
  return {
    position: "fixed",
    top: `${placement.top}px`,
    left: `${placement.left}px`,
    right: "auto",
    maxHeight: `${placement.maxHeight}px`,
    overflowY: "auto"
  };
});

function placeActionMenu(): void {
  if (!mobileShell.isMobile) {
    return;
  }
  const button = actionButton.value;
  const menu = actionMenu.value;
  const drawer = button?.closest(".left-sidebar");
  if (!button || !menu || !drawer) {
    return;
  }
  menuPlacement.value = resolveMenuPlacement({
    anchor: button.getBoundingClientRect(),
    menu: { width: menu.offsetWidth, height: menu.offsetHeight },
    container: drawer.getBoundingClientRect()
  });
}

function closeActionMenu(): void {
  actionMenuOpen.value = false;
  menuPlacement.value = null;
}

function toggleActionMenu(): void {
  if (actionMenuOpen.value) {
    closeActionMenu();
    return;
  }
  actionMenuOpen.value = true;
  // 先渲染出菜单才能量到它的尺寸，所以落点放在下一帧算。
  void nextTick(() => placeActionMenu());
}

const creationBookDrag = useCreationBookDrag(
  () => props.section.id,
  (payload) => emit("reorderCreationBook", payload)
);

const actionItems = computed<
  Array<{
    id: ResourceSectionAction;
    label: string;
    icon: IconName;
  }>
>(() => {
  const resourceName =
    props.section.id === "creation"
      ? "书籍"
      : props.section.id === "skill"
        ? "技能库"
        : "素材库";
  return [
    {
      id: "create",
      label:
        props.section.id === "creation" ? "新建作品" : `新建${resourceName}`,
      icon: "plus"
    },
    ...(props.section.id === "creation"
      ? []
      : ([{ id: "create-group", label: "新建分组", icon: "folder" }] as const)),
    {
      id: props.section.id === "creation" ? "choose-open-book" : "import",
      label:
        props.section.id === "creation"
          ? "打开已有作品"
          : `打开已存在${resourceName}`,
      icon: "folder"
    },
    ...(props.section.id === "creation"
      ? ([
          {
            id: "choose-import-book",
            label: "导入已有作品",
            icon: "archive"
          },
          {
            id: "refresh-long-books",
            label: "刷新长篇列表",
            icon: "history"
          }
        ] as const)
      : []),
    ...(props.section.id === "creation"
      ? []
      : ([
          {
            id: "import-legacy-library",
            label: `导入旧版${resourceName}`,
            icon: "archive"
          },
          {
            id: "import-external-library",
            label: `从文件或文件夹导入${
              props.section.id === "skill" ? "技能" : "素材"
            }`,
            icon: "download"
          }
        ] as const))
  ];
});

function activateResourceAction(action: ResourceSectionAction): void {
  closeActionMenu();
  emit("resourceAction", { domain: props.section.id, action });
}

/*
 * ⚠️ 菜单在手机端被 Teleport 到 body，已经不在 actionArea 里了。
 * 判定里必须带上 actionMenu，否则「按下去 → 误判为点了外面 → 菜单被卸载 →
 * click 永远不触发」，表现就是菜单项点不动。
 */
function isInsideActionMenu(target: Node | null): boolean {
  if (!target) {
    return false;
  }
  return (
    (actionArea.value?.contains(target) ?? false) ||
    (actionMenu.value?.contains(target) ?? false)
  );
}

function handleDocumentPointerDown(event: PointerEvent): void {
  if (isInsideActionMenu(event.target as Node)) {
    return;
  }
  closeActionMenu();
}

function handleDocumentKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    closeActionMenu();
  }
}

/** 菜单是 fixed 落点，滚动/改尺寸后坐标就失效了；关掉比错位便宜。 */
function handleLayoutShift(): void {
  if (actionMenuOpen.value) {
    closeActionMenu();
  }
}

onMounted(() => {
  document.addEventListener("pointerdown", handleDocumentPointerDown);
  document.addEventListener("keydown", handleDocumentKeydown);
  // capture：普通的 addEventListener("scroll") 收不到内层容器的滚动
  document.addEventListener("scroll", handleLayoutShift, {
    capture: true,
    passive: true
  });
  window.addEventListener("resize", handleLayoutShift);
});

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", handleDocumentPointerDown);
  document.removeEventListener("keydown", handleDocumentKeydown);
  document.removeEventListener("scroll", handleLayoutShift, true);
  window.removeEventListener("resize", handleLayoutShift);
});
</script>

<template>
  <section class="resource-section" :class="{ 'is-collapsed': collapsed }">
    <div class="resource-section-heading">
      <button
        class="section-toggle"
        type="button"
        :aria-expanded="!collapsed"
        :aria-label="
          collapsed ? `展开${section.label}` : `折叠${section.label}`
        "
        @click="collapsed = !collapsed"
      >
        <AppIcon :name="section.icon" :size="15" />
        <span>{{ section.label }}</span>
        <AppIcon class="section-toggle-chevron" name="chevron" :size="13" />
      </button>
      <div ref="actionArea" class="section-action-area">
        <button
          ref="actionButton"
          class="section-action"
          :class="{ 'is-active': actionMenuOpen }"
          type="button"
          :aria-label="`${section.label}新建或导入`"
          :aria-expanded="actionMenuOpen"
          aria-haspopup="menu"
          @click="toggleActionMenu"
        >
          <AppIcon name="plus" :size="14" />
        </button>

        <!--
          手机端 Teleport 到 body：抽屉的滚动容器是 `overflow-y: auto`，
          菜单留在里面就一定会被裁（见 floatingStyle 上面的注释）。
          桌面端 disabled，DOM 与样式和以前完全一致。
        -->
        <Teleport to="body" :disabled="!mobileShell.isMobile">
          <div
            v-if="actionMenuOpen"
            ref="actionMenu"
            class="section-action-menu"
            :class="{ 'is-floating': mobileShell.isMobile }"
            :style="floatingStyle"
            role="menu"
          >
            <button
              v-for="item in actionItems"
              :key="item.id"
              class="section-action-menu-item"
              type="button"
              role="menuitem"
              :data-resource-action="`${section.id}-${item.id}`"
              @click="activateResourceAction(item.id)"
            >
              <AppIcon :name="item.icon" :size="17" />
              <span>{{ item.label }}</span>
            </button>
          </div>
        </Teleport>
      </div>
    </div>

    <!--
      空态。官方手机端这里给的是「还没有技能库 / 使用加号创建库或分组。」——
      以前区块没内容时这儿什么都不渲染，用户看到的就是「点进去什么都没有」。
    -->
    <p
      v-if="!collapsed && !section.nodes.length"
      class="resource-section-empty"
    >
      <strong>还没有{{ section.label }}</strong>
      <small>使用加号创建库或分组。</small>
    </p>

    <ul
      v-if="!collapsed"
      class="resource-tree"
      :aria-label="`${section.label}下的内容`"
    >
      <TreeNodeItem
        v-for="node in section.nodes"
        :key="node.id"
        :node="node"
        :depth="0"
        :selected-id="selectedId"
        :pinnable="
          !node.unavailable &&
          !node.missing &&
          (node.catalogNodeType === 'book' ||
            node.catalogNodeType === 'library')
        "
        :pinned="pinnedIds?.includes(node.id) ?? false"
        :pinned-ids="pinnedIds"
        :resource-domain="section.id"
        :library-entry-clipboard-domain="libraryEntryClipboardDomain"
        :long-tree-actions-disabled="longTreeActionsDisabled"
        :creation-book-draggable="creationBookDrag.canDrag(node)"
        :class="creationBookDrag.dropClass(node)"
        @dragstart="creationBookDrag.start($event, node)"
        @dragover="creationBookDrag.over($event, node)"
        @dragleave="creationBookDrag.leave($event, node)"
        @drop="creationBookDrag.drop($event, node)"
        @dragend="creationBookDrag.end"
        @select="emit('select', $event)"
        @toggle-pin="emit('togglePin', $event)"
        @book-action="(mode, book) => emit('bookAction', mode, book)"
        @export-book="emit('exportBook', $event)"
        @long-book-action="emit('longBookAction', $event)"
        @resource-node-action="emit('resourceNodeAction', $event)"
        @move-library-entry="emit('moveLibraryEntry', $event)"
        @create-expert-section="emit('createExpertSection', $event)"
        @create-long-draft-section="emit('createLongDraftSection', $event)"
        @long-draft-section-action="
          (action, sectionNode) =>
            emit('longDraftSectionAction', action, sectionNode)
        "
        @create-long-tree-item="emit('createLongTreeItem', $event)"
        @long-tree-item-action="
          (action, itemNode) => emit('longTreeItemAction', action, itemNode)
        "
        @delete-long-ledger-commit="emit('deleteLongLedgerCommit', $event)"
        @remove-expert-section="emit('removeExpertSection', $event)"
        @expert-section-action="
          (action, sectionNode) =>
            emit('expertSectionAction', action, sectionNode)
        "
        @create-character-item="emit('createCharacterItem', $event)"
        @character-item-action="
          (action, itemNode) => emit('characterItemAction', action, itemNode)
        "
      />
    </ul>
  </section>
</template>
