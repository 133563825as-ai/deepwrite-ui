import { z } from "zod";
import { EnvelopeBaseSchema } from "./envelope";

/**
 * 工作区文件管理（手机端「工作区」页）。
 *
 * 边界：
 *  - 所有路径都是**相对工作目录**的 POSIX 风格相对路径（`books/某书/正文.md`），
 *    空串表示工作目录本身。绝对路径、`..`、指向外部的符号链接一律由 Main 侧拒绝。
 *  - 只有文本文件可以在应用内编辑；二进制只提供「用系统应用打开」。
 *  - 这里只定义协议与领域模型，落盘在 `apps/desktop/src/main/workspace-files-service.ts`。
 *
 * ⚠️ 电脑端不接入这个页面（用户明确：手机端为主，电脑端用原版），
 * 但命令仍然走正规契约层，不在宿主里另开一套平行协议。
 */

/** 单个文本文件的读写上限，超过就只给「打开/分享」。 */
export const WORKSPACE_TEXT_MAX_BYTES = 1_048_576;
/** 单次列目录返回的条目上限，防止在超大目录上把内存打满。 */
export const WORKSPACE_LIST_MAX_ENTRIES = 2_000;

export const WorkspaceEntryKindSchema = z.enum(["file", "directory"]);
export type WorkspaceEntryKind = z.infer<typeof WorkspaceEntryKindSchema>;

/** 相对工作目录的路径；空串 = 工作目录本身。 */
export const WorkspaceRelativePathSchema = z.string().max(4_096);
/** 新建/重命名时用到的文件名。 */
export const WorkspaceEntryNameSchema = z.string().trim().min(1).max(200);

export const WorkspaceFileEntrySchema = z.object({
  name: z.string().min(1),
  /** 相对工作目录的路径，面包屑与后续操作都用它。 */
  path: z.string(),
  kind: WorkspaceEntryKindSchema,
  /** 目录为 0。 */
  size: z.number().int().nonnegative(),
  /** 毫秒时间戳；读不到时为 null。 */
  modifiedAt: z.number().int().nonnegative().nullable(),
  /** 文本且不超上限 —— 只有这类才能在应用内打开编辑。 */
  editable: z.boolean()
});
export type WorkspaceFileEntry = z.infer<typeof WorkspaceFileEntrySchema>;

export const WorkspaceFileBreadcrumbSchema = z.object({
  name: z.string().min(1),
  path: z.string()
});
export type WorkspaceFileBreadcrumb = z.infer<
  typeof WorkspaceFileBreadcrumbSchema
>;

export const WorkspaceFileListingSchema = z.object({
  /** 工作目录的绝对路径（只用于展示）。 */
  root: z.string(),
  /** 当前目录的相对路径，空串 = 根。 */
  path: z.string(),
  breadcrumbs: z.array(WorkspaceFileBreadcrumbSchema),
  entries: z.array(WorkspaceFileEntrySchema),
  truncated: z.boolean()
});
export type WorkspaceFileListing = z.infer<typeof WorkspaceFileListingSchema>;

export const WorkspaceFileTextSchema = z.object({
  path: z.string(),
  content: z.string(),
  size: z.number().int().nonnegative()
});
export type WorkspaceFileText = z.infer<typeof WorkspaceFileTextSchema>;

export const WorkspaceFilePathResultSchema = z.object({
  path: z.string()
});
export type WorkspaceFilePathResult = z.infer<
  typeof WorkspaceFilePathResultSchema
>;

export const WorkspaceFilesListCommandEnvelopeSchema =
  EnvelopeBaseSchema.extend({
    type: z.literal("workspaceFiles.list"),
    payload: z.object({ path: WorkspaceRelativePathSchema })
  });

export const WorkspaceFilesReadTextCommandEnvelopeSchema =
  EnvelopeBaseSchema.extend({
    type: z.literal("workspaceFiles.readText"),
    payload: z.object({ path: WorkspaceRelativePathSchema })
  });

export const WorkspaceFilesWriteTextCommandEnvelopeSchema =
  EnvelopeBaseSchema.extend({
    type: z.literal("workspaceFiles.writeText"),
    payload: z.object({
      path: WorkspaceRelativePathSchema,
      content: z.string().max(WORKSPACE_TEXT_MAX_BYTES)
    })
  });

export const WorkspaceFilesCreateCommandEnvelopeSchema =
  EnvelopeBaseSchema.extend({
    type: z.literal("workspaceFiles.create"),
    payload: z.object({
      parentPath: WorkspaceRelativePathSchema,
      name: WorkspaceEntryNameSchema,
      kind: WorkspaceEntryKindSchema
    })
  });

export const WorkspaceFilesRenameCommandEnvelopeSchema =
  EnvelopeBaseSchema.extend({
    type: z.literal("workspaceFiles.rename"),
    payload: z.object({
      path: WorkspaceRelativePathSchema,
      nextName: WorkspaceEntryNameSchema
    })
  });

export const WorkspaceFilesRemoveCommandEnvelopeSchema =
  EnvelopeBaseSchema.extend({
    type: z.literal("workspaceFiles.remove"),
    payload: z.object({ path: WorkspaceRelativePathSchema })
  });

/**
 * ⚠️ `preload-api.ts` 里请用这些**具名类型**，不要写内联对象字面量。
 * 宿主生成 API 映射表的脚本（`dwbuild/gen-api-map.py`）按 `;` 与换行切分接口体，
 * 内联的 `{ path: string }` 会让它提前弹栈，后面几个成员会被整段丢掉。
 */
export interface WorkspaceFilesListInput {
  path: string;
}
export interface WorkspaceFilesReadTextInput {
  path: string;
}
export interface WorkspaceFilesWriteTextInput {
  path: string;
  content: string;
}
export interface WorkspaceFilesCreateInput {
  parentPath: string;
  name: string;
  kind: WorkspaceEntryKind;
}
export interface WorkspaceFilesRenameInput {
  path: string;
  nextName: string;
}
export interface WorkspaceFilesRemoveInput {
  path: string;
}

/** 供 `system.ts` 的命令联合展开，避免在那儿一条条列。 */
export const WorkspaceFilesCommandEnvelopeSchemas = [
  WorkspaceFilesListCommandEnvelopeSchema,
  WorkspaceFilesReadTextCommandEnvelopeSchema,
  WorkspaceFilesWriteTextCommandEnvelopeSchema,
  WorkspaceFilesCreateCommandEnvelopeSchema,
  WorkspaceFilesRenameCommandEnvelopeSchema,
  WorkspaceFilesRemoveCommandEnvelopeSchema
] as const;
