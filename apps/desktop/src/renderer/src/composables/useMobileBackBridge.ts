import { onBeforeUnmount, onMounted, watch } from "vue";

/**
 * 手机壳 ↔ 渲染层 的「返回」桥。
 *
 * 背景：Android 的返回手势（侧滑）和返回键**原来会直接退出 App** ——
 * `MainActivity` 没有 `onBackPressed`，也没有 `OnBackInvokedCallback`，
 * 所以在设置页、工作区页、写作页按返回，用户看到的是整个应用被关掉。
 *
 * 分工：
 *  - 渲染层把「现在还能不能在 App 内退一级」**推**给壳
 *    （`window.DeepWriteHost.setCanGoBack`，由 `addJavascriptInterface` 注入，
 *    壳要**同步**读它才能立刻决定是 `finish()` 还是留在 App 里）；
 *  - 壳回调用 `window.__deepwriteBack()`，由这里执行真正的「退一级」。
 *
 * ⚠️ 两边的判断必须同源：`canGoBack` 为 true 时 `goBack()` 必须真的能退，
 * 否则会出现「按了没反应」的假按钮（§13.2 的教训）。
 */
export interface MobileBackBridgeOptions {
  /** 是不是手机壳（桌面端 Window 上不留任何钩子）。 */
  enabled: () => boolean;
  /** 现在 App 内还能不能退一级。 */
  canGoBack: () => boolean;
  /** 退一级。 */
  goBack: () => void;
}

interface DeepWriteHostBridge {
  setCanGoBack?(value: boolean): void;
}

declare global {
  interface Window {
    /** 由 Android 壳的 evaluateJavascript 调用；返回是否已处理。 */
    __deepwriteBack?: () => boolean;
    /** Android 壳通过 addJavascriptInterface 注入。 */
    DeepWriteHost?: DeepWriteHostBridge;
  }
}

export function useMobileBackBridge(options: MobileBackBridgeOptions): void {
  function sync(): void {
    if (typeof window === "undefined") return;
    window.DeepWriteHost?.setCanGoBack?.(options.enabled() && options.canGoBack());
  }

  onMounted(() => {
    window.__deepwriteBack = () => {
      if (!options.enabled() || !options.canGoBack()) return false;
      options.goBack();
      return true;
    };
    sync();
  });

  onBeforeUnmount(() => {
    delete window.__deepwriteBack;
  });

  // 状态一变就推给壳：壳那边是同步读的，不能等它来问。
  watch(() => [options.enabled(), options.canGoBack()], sync);
}
