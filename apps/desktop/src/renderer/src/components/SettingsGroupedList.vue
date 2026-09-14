<script setup lang="ts">
import { computed } from "vue";
import AppIcon from "./AppIcon.vue";
import type { SettingsSection } from "../types/settings";

/**
 * 手机端设置页的根：分组列表。
 *
 * 官方手机端设置就是这个形态 —— 小号灰字组标题 + 白卡，每行「图标 + 标题 + ›」，
 * 点一行进子页（顶栏换成「‹ 标题」）。桌面端仍是左侧竖排分类栏，不变。
 *
 * 未实现的分类（desktopOnly）在这里被滤掉：它们点进去只有「设置项待配置」占位，
 * 手机上一屏摆五条空条目很像没做完。
 */
const props = defineProps<{
  sections: SettingsSection[];
}>();

const emit = defineEmits<{
  select: [categoryId: string];
  /** 「工作区」那一行：直接回工作台（用户要「在设置里能直接进工作区」）。 */
  openWorkspace: [];
}>();

const groups = computed(() =>
  props.sections
    .map((section) => ({
      id: section.id,
      label: section.label,
      categories: section.categories.filter((category) => !category.desktopOnly)
    }))
    .filter((section) => section.categories.length > 0)
);
</script>

<template>
  <nav class="settings-grouped-list" aria-label="设置分类">
    <!--
      「工作目录」入口放最前。手机上进设置之后要回到工作区得先退出设置，
      用户明确要「在设置界面可以直接进入工作区」。目标就是工作目录那一页
      （官方抽屉里叫「工作目录」，这里用同一个名字免得对不上号）。
    -->
    <section class="settings-group settings-group-workspace">
      <div class="settings-group-card">
        <button
          class="settings-group-row"
          type="button"
          @click="emit('openWorkspace')"
        >
          <AppIcon name="directory" :size="18" />
          <span class="settings-group-row-label">工作目录</span>
          <AppIcon
            class="settings-group-row-chevron"
            name="chevron"
            :size="14"
          />
        </button>
      </div>
    </section>

    <section v-for="group in groups" :key="group.id" class="settings-group">
      <h2 class="settings-group-label">{{ group.label }}</h2>
      <div class="settings-group-card">
        <button
          v-for="category in group.categories"
          :key="category.id"
          class="settings-group-row"
          type="button"
          @click="emit('select', category.id)"
        >
          <AppIcon v-if="category.icon" :name="category.icon" :size="18" />
          <span class="settings-group-row-label">{{ category.label }}</span>
          <AppIcon
            class="settings-group-row-chevron"
            name="chevron"
            :size="14"
          />
        </button>
      </div>
    </section>
  </nav>
</template>
