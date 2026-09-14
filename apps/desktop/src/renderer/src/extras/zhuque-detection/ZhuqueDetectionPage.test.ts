import { describe, expect, it } from "vitest";
import source from "./ZhuqueDetectionPage.vue?raw";
import { ZHUQUE_DETECTION_URL } from "./zhuqueDetection";

describe("ZhuqueDetectionPage", () => {
  it("embeds the Tencent detector in an isolated persistent webview", () => {
    expect(source).toContain('partition="persist:zhuque-detection"');
    expect(source).toContain("<webview");
  });

  it("从共享常量取地址，而不是自己再写死一份", () => {
    expect(source).toContain(
      'import { ZHUQUE_DETECTION_URL } from "./zhuqueDetection"'
    );
    expect(source).not.toContain("matrix.tencent.com");
  });
});

describe("zhuqueDetection URL", () => {
  it("手机端交给系统浏览器的就是同一个地址", () => {
    expect(ZHUQUE_DETECTION_URL).toBe("https://matrix.tencent.com/ai-detect/");
  });
});
