/**
 * 腾讯朱雀 AI 检测的入口地址。
 *
 * 两个消费方共用这一个常量，避免写死两处、改的时候漏掉一处：
 *
 * - **桌面端**：`ZhuqueDetectionPage.vue` 用 Electron 的 `<webview>` 把它内嵌在应用里。
 * - **手机端**：没有 Electron 的 `<webview>`。它在普通 Android WebView 里只是个未知
 *   元素，打开必然空白，而且 `did-finish-load` 永远不触发，连「正在加载」都退不掉
 *   （这正是 3.3.5 把入口在手机端隐藏掉的原因）。现在改成**把地址交给系统浏览器**，
 *   由外壳的 `WebViewClient` 拦截非回环链接 —— 见 `dwdroid/src/.../MainActivity.java`
 *   的 `openExternallyIfNeeded`。
 */
export const ZHUQUE_DETECTION_URL = "https://matrix.tencent.com/ai-detect/";
