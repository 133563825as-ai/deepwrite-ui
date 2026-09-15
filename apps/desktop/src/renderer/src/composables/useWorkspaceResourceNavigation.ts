import { computed, provide, ref, type Ref } from "vue";
import {
  useWorkspaceResourceCoordinator,
  type WorkspaceResourceCoordinatorOptions
} from "./useWorkspaceResourceCoordinator";
import {
  COMPOSER_CONTEXT_NAVIGATION,
  type ComposerContextNavigation
} from "./composerContextNavigationContext";

/** Share existing workspace navigation; build picker choices only on demand. */
export function useWorkspaceResourceNavigation(
  options: WorkspaceResourceCoordinatorOptions
) {
  const resources = useWorkspaceResourceCoordinator(options);
  let navigation: Promise<ComposerContextNavigation | null> | undefined;
  /**
   * 已经加载出来的导航，给输入框卡片读长篇的「书籍 / 阶段」用。
   * 卡片**不主动加载**（那是右键菜单的按需行为）：有人打开过菜单或卡片，
   * 这里才有值，否则卡片对长篇只给空态说明。
   */
  const loadedNavigation: Ref<ComposerContextNavigation | null> = ref(null);
  async function load(): Promise<ComposerContextNavigation | null> {
    if (!navigation) {
      navigation = import("./composerContextNavigation")
        .then(({ createWorkspaceComposerContextNavigation }) =>
          createWorkspaceComposerContextNavigation(options, resources)
        )
        .then((created) => {
          loadedNavigation.value = created;
          return created;
        })
        .catch(() => {
          navigation = undefined;
          options.notifications.error("加载选择列表失败，请重试");
          return null;
        });
    }
    return await navigation;
  }
  provide(COMPOSER_CONTEXT_NAVIGATION, {
    available: computed(() =>
      options.tree.lookup.value.nodeById.has(
        options.state.selectedResourceId.value
      )
    ),
    load
  });
  return {
    ...resources,
    composerNavigation: loadedNavigation,
    loadComposerNavigation: load
  };
}
