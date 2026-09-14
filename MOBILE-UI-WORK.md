# 这是什么

**DeepWrite 的个人工作副本**，不是官方仓库。

上游：[swjybky/deepwrite](https://github.com/swjybky/deepwrite)（Apache-2.0），
基线提交 `9404f80d0b44df260166ca3aa9ef66b7638c291a`（"feat: complete DeepWrite 1.5.0 workspace updates"）。

这个副本里叠了**手机端 UI 的工作**：把手机端布局从「打包后注入 CSS + 往 body 上
appendChild 悬浮按钮」搬进渲染层，并逐屏对齐官方手机端。逐个改动见下面两张清单。

> 为什么单独开一个仓库：这些改动原先只存在于构建容器的 git 工作区里，
> 而那个工作区跟踪的是**上游仓库**（不该往上推），等于没有任何备份。

## 与上游的差异

### 新增文件（16 个）

```
apps/desktop/src/renderer/src/components/ComposerContextCard.vue
apps/desktop/src/renderer/src/components/ComposerPickerSheet.vue
apps/desktop/src/renderer/src/components/EditorCharacterCount.vue
apps/desktop/src/renderer/src/components/EditorLibraryTocButton.vue
apps/desktop/src/renderer/src/components/MobileAppBar.vue
apps/desktop/src/renderer/src/components/SettingsGroupedList.vue
apps/desktop/src/renderer/src/composables/composerPickerContext.ts
apps/desktop/src/renderer/src/composables/useComposerPicker.test.ts
apps/desktop/src/renderer/src/composables/useComposerPicker.ts
apps/desktop/src/renderer/src/extras/zhuque-detection/zhuqueDetection.ts
apps/desktop/src/renderer/src/stores/mobileShellStore.ts
apps/desktop/src/renderer/src/styles/mobile-shell.css
apps/desktop/src/renderer/src/types/composerPicker.ts
apps/desktop/src/renderer/src/types/settings.ts
apps/desktop/src/renderer/src/utils/composerPickerEntries.test.ts
apps/desktop/src/renderer/src/utils/composerPickerEntries.ts
```

### 修改文件（24 个）

```
apps/desktop/package.json
apps/desktop/src/renderer/src/App.vue
apps/desktop/src/renderer/src/WorkspaceShell.vue
apps/desktop/src/renderer/src/components/AgentConversation.vue
apps/desktop/src/renderer/src/components/AppIcon.vue
apps/desktop/src/renderer/src/components/ConversationComposer.vue
apps/desktop/src/renderer/src/components/LeftSidebar.test.ts
apps/desktop/src/renderer/src/components/LeftSidebar.vue
apps/desktop/src/renderer/src/components/RightEditorPane.vue
apps/desktop/src/renderer/src/components/SettingsPage.vue
apps/desktop/src/renderer/src/components/SidebarResourceList.vue
apps/desktop/src/renderer/src/components/TreeSection.vue
apps/desktop/src/renderer/src/composables/useShortConversationCoordinator.ts
apps/desktop/src/renderer/src/composables/useWorkspaceFeatureHostCoordinator.test.ts
apps/desktop/src/renderer/src/composables/useWorkspaceFeatureHostCoordinator.ts
apps/desktop/src/renderer/src/composables/workspaceFeatureHostTypes.ts
apps/desktop/src/renderer/src/extras/zhuque-detection/ZhuqueDetectionPage.test.ts
apps/desktop/src/renderer/src/extras/zhuque-detection/ZhuqueDetectionPage.vue
apps/desktop/src/renderer/src/stores/layoutFeatureNavigation.ts
apps/desktop/src/renderer/src/styles.css
apps/desktop/src/renderer/src/styles/right-editor.css
apps/desktop/src/renderer/src/types/workspace.ts
apps/desktop/src/utilities/conversation-storage/worker-entry.ts
pnpm-lock.yaml
```

## 未收录的东西

- `apps/desktop/out-web/`：渲染层构建产物（约 76 MB），跑一次构建就有
- `node_modules/`、`pnpm-lock.yaml` 之外的本地缓存
- `.gitignore` 里被刻意忽略的文件（含可能带私有部署信息的测试）

## 怎么构建

需要 pnpm 工作区 + 上游那套依赖：

```bash
pnpm install
pnpm --filter @deepwrite/desktop build      # 或上游 README 里的打包入口
```

Android 独立版的打包（APK）不在这个仓库里，见 `133563825as-ai/deepwrite-android`：
那个仓库只装外壳（Java）与打包脚本，渲染层产物由本仓库构建后收进去。

## 许可

本仓库内容基于上游 Apache-2.0 代码，许可证见 `LICENSE`；
DeepWrite 的版权归其官方原作者所有。
