<script setup lang="ts">
import { computed, ref } from "vue";
import {
  type AppLanguage,
  type CreativePlotStage,
  type GeneralPermissionMode,
  type LearningImitationSettings,
  type LearningImitationSettingsInput,
  type LearningImitationStageId,
  type LibraryAgentDomain,
  type LibraryAgentSettings,
  type LibraryAgentSettingsInput,
  type LongAgentSettings,
  type LongAgentSettingsInput,
  type ModelConfigInput,
  type ModelSettings,
  type ModelSettingsInput,
  type ModelUsageDashboard,
  type ModelUsageQueryInput,
  type OfficialModelBalance,
  type SiteOfficialQuota,
  type TextViewMode,
  type WorkspacePaneLayout,
  type WorkspaceAgentSettings,
  type WorkspaceAgentSettingsInput
} from "@deepwrite/contracts";
import AppIcon from "./AppIcon.vue";
import AppearanceSettingsPanel from "./AppearanceSettingsPanel.vue";
import FreeModelsPanel from "./FreeModelsPanel.vue";
import GeneralSettingsPanel from "./GeneralSettingsPanel.vue";
import LearningImitationSettingsPanel from "./LearningImitationSettingsPanel.vue";
import LibraryAgentSettingsPanel from "./LibraryAgentSettingsPanel.vue";
import ModelSettingsFeature from "./ModelSettingsFeature.vue";
import ModelUsagePanel from "./ModelUsagePanel.vue";
import OfficialModelsPanel from "./OfficialModelsPanel.vue";
import ShortAgentSettingsPanel from "./ShortAgentSettingsPanel.vue";
import SiteOfficialModelsPanel from "./SiteOfficialModelsPanel.vue";
import SettingsGroupedList from "./SettingsGroupedList.vue";
import type { SettingsSection } from "../types/settings";
import { useMobileShellStore } from "../stores/mobileShellStore";
import { useLayoutStore } from "../stores/layoutStore";

const props = defineProps<{
  initialCategory?: string;
  permissionMode: GeneralPermissionMode;
  autoApproveCrossStageOperations: boolean;
  autoSaveEnabled: boolean;
  language: AppLanguage;
  showContextUsage: boolean;
  showInMenuBar: boolean;
  useNetworkProxy: boolean;
  workspacePaneLayout: WorkspacePaneLayout;
  defaultTextViewMode: TextViewMode;
  workspaceAgentSettings: readonly WorkspaceAgentSettings[];
  creativePlotStages: readonly CreativePlotStage[];
  longAgentSettings: LongAgentSettings | null;
  workspaceAgentLoading: boolean;
  workspaceAgentSaving: boolean;
  longAgentLoading: boolean;
  longAgentSaving: boolean;
  longAgentError: string | null;
  learningImitationSettings: LearningImitationSettings | null;
  learningImitationLoading: boolean;
  learningImitationSaving: boolean;
  modelUsageDashboard: ModelUsageDashboard | null;
  modelUsageLoading: boolean;
  modelSettings: ModelSettings | null;
  modelLoading: boolean;
  modelSaving: boolean;
  freeModelsRefreshing: boolean;
  freeModelsSaving: boolean;
  siteOfficialModelsRefreshing: boolean;
  siteOfficialModelsSaving: boolean;
  siteOfficialQuota: SiteOfficialQuota | null;
  modelError: string | null;
  modelTestMessage: string | null;
  testingModelId: string | null;
  officialModelUsageDashboard: ModelUsageDashboard | null;
  officialModelBalance: OfficialModelBalance | null;
  officialModelsLoading: boolean;
  officialModelsSaving: boolean;
  libraryAgentSettings: LibraryAgentSettings | null;
  libraryAgentLoading: boolean;
  libraryAgentSaving: boolean;
  runtimeAvailable: boolean;
}>();

const emit = defineEmits<{
  back: [];
  updatePermissionMode: [mode: GeneralPermissionMode];
  updateAutoApproveCrossStageOperations: [enabled: boolean];
  updateAutoSave: [enabled: boolean];
  updateLanguage: [language: AppLanguage];
  updateShowContextUsage: [enabled: boolean];
  updateShowInMenuBar: [enabled: boolean];
  updateUseNetworkProxy: [enabled: boolean];
  updateWorkspacePaneLayout: [layout: WorkspacePaneLayout];
  updateDefaultTextViewMode: [mode: TextViewMode];
  saveWorkspaceAgents: [settings: WorkspaceAgentSettingsInput];
  retryLongAgents: [];
  saveLongAgents: [settings: LongAgentSettingsInput];
  saveLearningImitation: [settings: LearningImitationSettingsInput];
  resetLearningImitation: [stageId: LearningImitationStageId];
  saveLibraryAgents: [settings: LibraryAgentSettingsInput];
  resetLibraryAgent: [domain: LibraryAgentDomain];
  loadModelUsage: [input?: ModelUsageQueryInput];
  loadModels: [];
  saveModels: [settings: ModelSettingsInput];
  testModel: [model: ModelConfigInput];
  loadOfficialModels: [];
  loadSiteOfficialModels: [];
  saveOfficialToken: [apiKey: string];
  clearOfficialToken: [];
  saveSiteOfficialToken: [apiKey: string];
  clearSiteOfficialToken: [];
  refreshSiteOfficialModels: [];
  setSiteOfficialModelEnabled: [modelId: string, enabled: boolean];
  setOfficialModelEnabled: [modelId: string, enabled: boolean];
  refreshFreeModels: [];
  setFreeModelEnabled: [modelId: string, enabled: boolean];
}>();
const activeCategory = ref(props.initialCategory ?? "general");
const searchQuery = ref("");
const shell = useMobileShellStore();
const layout = useLayoutStore();

/**
 * 手机端停在设置的根（分组列表）还是进了子页。
 *
 * 单一事实来源是 store 的 settingsSubPageTitle：顶栏返回键读同一个值，
 * 「点进去 / 按返回」才不会出现两份状态各说各话。桌面端恒为 false。
 */
const showMobileList = computed(
  () => shell.isMobile && !shell.settingsSubPageTitle
);

/**
 * 设置分类。
 *
 * 分组对齐官方手机端设置页（模型与用量 / 智能体 / 个人），并为我们独有的能力
 * 另开一组「创作」—— 官方没有「创作空间配置」「短篇学习仿写设置」这两个页面。
 * 未实现的分类标 desktopOnly，手机端分组列表会滤掉（见 SettingsGroupedList）。
 */
const sections: SettingsSection[] = [
  {
    id: "models-and-usage",
    label: "模型与用量",
    categories: [
      { id: "custom-models", label: "自定义模型配置", icon: "model" },
      { id: "free-models", label: "免费模型", icon: "model" },
      { id: "official-models", label: "旧官方小站模型", icon: "model" },
      {
        id: "site-official-models",
        label: "新官方小站模型",
        icon: "model"
      },
      { id: "usage", label: "用量", icon: "ledger" }
    ]
  },
  {
    id: "agents",
    label: "智能体",
    categories: [
      { id: "skill-library-agent", label: "技能库配置", icon: "wand" },
      { id: "material-library-agent", label: "素材库配置", icon: "archive" }
    ]
  },
  {
    id: "creation",
    label: "创作",
    categories: [
      { id: "short-agents", label: "创作空间配置", icon: "brain" },
      { id: "learning-imitation", label: "短篇学习仿写设置", icon: "sparkles" }
    ]
  },
  {
    id: "personal",
    label: "个人",
    categories: [
      { id: "general", label: "常规", icon: "settings" },
      { id: "appearance", label: "外观", icon: "sparkles" },
      { id: "profile", label: "个人资料", icon: "user", desktopOnly: true },
      { id: "voice", label: "语音", icon: "brain", desktopOnly: true },
      { id: "configuration", label: "配置", icon: "model", desktopOnly: true },
      {
        id: "personalization",
        label: "个性化",
        icon: "sparkles",
        desktopOnly: true
      },
      {
        id: "keyboard",
        label: "键盘快捷键",
        icon: "keyboard",
        desktopOnly: true
      }
    ]
  }
];

const visibleSections = computed(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase();
  if (!query) return sections;
  return sections
    .map((section) => ({
      ...section,
      categories: section.categories.filter((category) =>
        category.label.toLocaleLowerCase().includes(query)
      )
    }))
    .filter((section) => section.categories.length);
});

const activeLabel = computed(() => {
  for (const section of sections) {
    const found = section.categories.find(
      (category) => category.id === activeCategory.value
    );
    if (found) return found.label;
  }
  return "常规";
});

async function selectCategory(id: string): Promise<void> {
  if (id === "official-models") {
    emit("loadOfficialModels");
  }
  if (id === "custom-models") {
    emit("loadModels");
  }
  if (id === "site-official-models") {
    emit("loadSiteOfficialModels");
  }
  activeCategory.value = id;
  // 手机端：选中即进子页，顶栏标题随之变成分类名。桌面端这个值不参与渲染。
  if (shell.isMobile) {
    shell.setSettingsSubPage(labelOf(id));
  }
}

function labelOf(id: string): string {
  for (const section of sections) {
    const found = section.categories.find((category) => category.id === id);
    if (found) return found.label;
  }
  return "设置";
}

/**
 * 手机端分组列表顶部的「工作区」。
 *
 * ⚠️ 必须显式把 workspaceMainView 复位成 "conversation"：宿主处理 back 时调的
 * closeSettings() 只把 currentView 设回 "workspace"，**不动 workspaceMainView** ——
 * 用户上一站停在「工作目录」的话，点「工作区」会又落回工作目录页，等于没返回。
 */
/**
 * 手机端分组列表顶部的「工作目录」。
 *
 * ⚠️ 目的地是 workspaceMainView = "directory"（工作目录那一页），**不是**回首页：
 * 回首页等于把顶栏的「‹」又做了一遍，用户的原话是「打开工作区就是回到首页」，
 * 点了个寂寞。官方那张「DEEPWRITE / 工作目录」截图就是这个页面。
 *
 * 也不走宿主的 back 链路：closeSettings() 只把 currentView 设回 "workspace"，
 * 不复位 workspaceMainView。
 */
function openWorkspace(): void {
  shell.setSettingsSubPage("");
  layout.showWorkspaceFeature("directory");
}
</script>

<template>
  <div class="settings-page">
    <!--
      手机端两级导航：根是分组列表，点子项进子页（整页显示该面板，顶栏换成
      「‹ 分类名」，见 MobileAppBar.vue）。桌面端 showMobileList 恒为 false，
      下面的竖排侧栏 + 内容区照旧。
    -->
    <SettingsGroupedList
      v-if="showMobileList"
      :sections="sections"
      @select="selectCategory"
      @open-workspace="openWorkspace"
    />
    <!-- 竖排侧栏是桌面形态。手机端根列表用 SettingsGroupedList、子页只显示面板，
         所以侧栏在手机上任何状态都不渲染（原先靠 CSS 把它掰成横条的做法已废弃）。 -->
    <aside v-if="!shell.isMobile" class="settings-sidebar">
      <button class="settings-back" type="button" @click="emit('back')">
        <AppIcon name="chevron" :size="14" />
        <span>返回应用</span>
      </button>

      <div class="settings-search">
        <AppIcon name="search" :size="14" />
        <input v-model="searchQuery" type="search" placeholder="搜索设置..." />
      </div>

      <nav class="settings-nav" aria-label="设置分类">
        <div
          v-for="section in visibleSections"
          :key="section.id"
          class="settings-section"
        >
          <strong class="settings-section-label">{{ section.label }}</strong>
          <button
            v-for="category in section.categories"
            :key="category.id"
            class="settings-category"
            :class="{ 'is-active': activeCategory === category.id }"
            type="button"
            @click="selectCategory(category.id)"
          >
            <AppIcon v-if="category.icon" :name="category.icon" :size="15" />
            <span v-else class="settings-category-spacer" />
            <span>{{ category.label }}</span>
          </button>
        </div>
        <p v-if="!visibleSections.length" class="settings-search-empty">
          没有匹配的设置
        </p>
      </nav>
    </aside>

    <main v-if="!showMobileList" class="settings-content">
      <div class="settings-content-inner">
        <h1 class="settings-title">{{ activeLabel }}</h1>

        <ShortAgentSettingsPanel
          v-if="activeCategory === 'short-agents'"
          :settings="workspaceAgentSettings"
          :creative-plot-stages="creativePlotStages"
          :long-settings="longAgentSettings"
          :loading="workspaceAgentLoading"
          :saving="workspaceAgentSaving"
          :long-loading="longAgentLoading"
          :long-saving="longAgentSaving"
          :long-error-message="longAgentError"
          :runtime-available="runtimeAvailable"
          @save="emit('saveWorkspaceAgents', $event)"
          @retry-long="emit('retryLongAgents')"
          @save-long="emit('saveLongAgents', $event)"
        />

        <LearningImitationSettingsPanel
          v-else-if="activeCategory === 'learning-imitation'"
          :settings="learningImitationSettings"
          :loading="learningImitationLoading"
          :saving="learningImitationSaving"
          :runtime-available="runtimeAvailable"
          @save="emit('saveLearningImitation', $event)"
          @reset="emit('resetLearningImitation', $event)"
        />

        <LibraryAgentSettingsPanel
          v-else-if="activeCategory === 'skill-library-agent'"
          domain="skill"
          :settings="libraryAgentSettings"
          :loading="libraryAgentLoading"
          :saving="libraryAgentSaving"
          :runtime-available="runtimeAvailable"
          @save="emit('saveLibraryAgents', $event)"
          @reset="emit('resetLibraryAgent', $event)"
        />

        <LibraryAgentSettingsPanel
          v-else-if="activeCategory === 'material-library-agent'"
          domain="material"
          :settings="libraryAgentSettings"
          :loading="libraryAgentLoading"
          :saving="libraryAgentSaving"
          :runtime-available="runtimeAvailable"
          @save="emit('saveLibraryAgents', $event)"
          @reset="emit('resetLibraryAgent', $event)"
        />

        <ModelUsagePanel
          v-else-if="activeCategory === 'usage'"
          :dashboard="modelUsageDashboard"
          :loading="modelUsageLoading"
          @query="emit('loadModelUsage', $event)"
        />

        <FreeModelsPanel
          v-else-if="activeCategory === 'free-models'"
          :settings="modelSettings"
          :refreshing="freeModelsRefreshing"
          :saving="freeModelsSaving"
          :testing-model-id="testingModelId"
          @refresh="emit('refreshFreeModels')"
          @test="emit('testModel', $event)"
          @set-model-enabled="
            emit('setFreeModelEnabled', $event.modelId, $event.enabled)
          "
        />

        <ModelSettingsFeature
          v-else-if="activeCategory === 'custom-models'"
          model-scope="custom"
          embedded
          active
          :model-settings="modelSettings"
          :model-loading="modelLoading"
          :model-saving="modelSaving"
          :model-error="modelError"
          :model-test-message="modelTestMessage"
          :testing-model-id="testingModelId"
          :model-alert-messages="[]"
          @save-models="emit('saveModels', $event)"
          @test-model="emit('testModel', $event)"
        />

        <OfficialModelsPanel
          v-else-if="activeCategory === 'official-models'"
          :settings="modelSettings"
          :dashboard="officialModelUsageDashboard"
          :balance="officialModelBalance"
          :loading="officialModelsLoading"
          :saving="officialModelsSaving"
          @load="emit('loadOfficialModels')"
          @save-token="emit('saveOfficialToken', $event)"
          @clear-token="emit('clearOfficialToken')"
          @set-model-enabled="
            emit('setOfficialModelEnabled', $event.modelId, $event.enabled)
          "
        />

        <SiteOfficialModelsPanel
          v-else-if="activeCategory === 'site-official-models'"
          :settings="modelSettings"
          :saving="siteOfficialModelsSaving"
          :refreshing="siteOfficialModelsRefreshing"
          :quota="siteOfficialQuota"
          :testing-model-id="testingModelId"
          @test="emit('testModel', $event)"
          @save-token="emit('saveSiteOfficialToken', $event)"
          @clear-token="emit('clearSiteOfficialToken')"
          @refresh="emit('refreshSiteOfficialModels')"
          @set-model-enabled="
            emit('setSiteOfficialModelEnabled', $event.modelId, $event.enabled)
          "
        />

        <GeneralSettingsPanel
          v-else-if="activeCategory === 'general'"
          :permission-mode="permissionMode"
          :auto-approve-cross-stage-operations="autoApproveCrossStageOperations"
          :auto-save-enabled="autoSaveEnabled"
          :language="language"
          :show-context-usage="showContextUsage"
          :show-in-menu-bar="showInMenuBar"
          :use-network-proxy="useNetworkProxy"
          :workspace-pane-layout="workspacePaneLayout"
          :default-text-view-mode="defaultTextViewMode"
          @update-permission-mode="emit('updatePermissionMode', $event)"
          @update-auto-approve-cross-stage-operations="
            emit('updateAutoApproveCrossStageOperations', $event)
          "
          @update-auto-save="emit('updateAutoSave', $event)"
          @update-language="emit('updateLanguage', $event)"
          @update-show-context-usage="emit('updateShowContextUsage', $event)"
          @update-show-in-menu-bar="emit('updateShowInMenuBar', $event)"
          @update-use-network-proxy="emit('updateUseNetworkProxy', $event)"
          @update-workspace-pane-layout="
            emit('updateWorkspacePaneLayout', $event)
          "
          @update-default-text-view-mode="
            emit('updateDefaultTextViewMode', $event)
          "
        />

        <AppearanceSettingsPanel v-else-if="activeCategory === 'appearance'" />

        <section v-else class="settings-group">
          <div class="settings-card">
            <p class="settings-placeholder">
              「{{ activeLabel }}」设置项待配置。
            </p>
          </div>
        </section>
      </div>
    </main>
  </div>
</template>

<style scoped src="./settings-page.css"></style>
