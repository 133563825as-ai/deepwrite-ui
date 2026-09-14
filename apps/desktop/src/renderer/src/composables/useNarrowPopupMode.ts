import { onBeforeUnmount, onMounted, ref, type Ref } from "vue";

/**
 * 「这个控件现在是不是窄容器模式」—— 由 JS 复算 CSS 容器查询的同一个阈值。
 *
 * 为什么需要它：窄容器下控件要把浮层 **Teleport 到 body**，否则会被祖先的
 * `overflow` 裁掉（`.composer-toolbar` 在手机端是 `overflow-x: auto`，
 * 绝对定位的浮层照样被裁 —— 表现就是「点了没反应」，见交接文档 §20.3 同款病根）。
 *
 * 但 Teleport 之后元素**就不在容器里了**，CSS 的 `@container` 规则随之失效，
 * 所以浮层自己的样式不能再依赖容器查询；「是不是浮层模式」必须由 JS 判断，
 * 并且与 CSS 用**同一套阈值**，两边各写一份迟早会漂。
 *
 * 阈值 = `min(32rem, 560px)`，对应 `styles.css` / 组件里那条
 * `@container composer (max-width: min(32rem, 560px))`。
 */
export interface NarrowPopupModeOptions {
  /** 触发控件（用来找它所在的查询容器）。 */
  anchor: Ref<HTMLElement | null>;
  /** 查询容器的选择器，默认 `.composer-wrap`（`container: composer / inline-size`）。 */
  containerSelector?: string;
  /** 阈值里的 rem 部分，默认 32。 */
  limitRem?: number;
  /** 阈值上限 px，默认 560。 */
  limitPx?: number;
}

export function useNarrowPopupMode(options: NarrowPopupModeOptions): {
  narrow: Ref<boolean>;
} {
  const {
    anchor,
    containerSelector = ".composer-wrap",
    limitRem = 32,
    limitPx = 560
  } = options;

  const narrow = ref(false);
  let observer: ResizeObserver | undefined;
  let container: HTMLElement | null = null;

  /**
   * 量的是**内容盒**宽度：`container-type: inline-size` 的查询容器按内容盒比较，
   * 而 `clientWidth` 是内边距盒（含 padding），不减内边距会在边界上偏宽。
   */
  function measure(): void {
    if (!container) return;
    const style = getComputedStyle(container);
    const padding =
      (parseFloat(style.paddingLeft) || 0) +
      (parseFloat(style.paddingRight) || 0);
    const rootFontSize =
      parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const limit = Math.min(limitRem * rootFontSize, limitPx);
    narrow.value = container.clientWidth - padding <= limit;
  }

  onMounted(() => {
    container = anchor.value?.closest(containerSelector) ?? null;
    if (!container) return;
    measure();
    if (typeof ResizeObserver === "undefined") return;
    observer = new ResizeObserver(measure);
    observer.observe(container);
  });

  onBeforeUnmount(() => {
    observer?.disconnect();
    observer = undefined;
  });

  return { narrow };
}
