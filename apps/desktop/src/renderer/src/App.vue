<script setup lang="ts">
import { defineAsyncComponent } from "vue";
import MobileAppBar from "./components/MobileAppBar.vue";

const WorkspaceShell = defineAsyncComponent(
  () => import("./WorkspaceShell.vue")
);
</script>

<template>
  <!-- 手机端顶栏：只在 :root[data-mobile] 下可见，桌面端渲染为空。 -->
  <MobileAppBar />
  <WorkspaceShell />
</template>
