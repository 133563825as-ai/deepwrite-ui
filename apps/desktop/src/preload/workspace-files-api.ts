import {
  WorkspaceFileListingSchema,
  WorkspaceFilePathResultSchema,
  WorkspaceFileTextSchema,
  createEnvelope,
  type WorkspaceEntryKind,
  type WorkspaceFileListing,
  type WorkspaceFilePathResult,
  type WorkspaceFileText
} from "@deepwrite/contracts";
import { browserId, invokeCommand } from "./invoke";

/** 手机端「工作区」页：列目录 / 读写文本 / 新建 / 重命名 / 删除。 */

export async function listWorkspaceFiles(input: {
  path: string;
}): Promise<WorkspaceFileListing> {
  const id = browserId("cmd_workspace_files_list");
  return WorkspaceFileListingSchema.parse(
    await invokeCommand<WorkspaceFileListing>(
      createEnvelope(
        "workspaceFiles.list",
        { path: input.path },
        {
          id,
          correlationId: id
        }
      )
    )
  );
}

export async function readWorkspaceFileText(input: {
  path: string;
}): Promise<WorkspaceFileText> {
  const id = browserId("cmd_workspace_files_read_text");
  return WorkspaceFileTextSchema.parse(
    await invokeCommand<WorkspaceFileText>(
      createEnvelope(
        "workspaceFiles.readText",
        { path: input.path },
        {
          id,
          correlationId: id
        }
      )
    )
  );
}

export async function writeWorkspaceFileText(input: {
  path: string;
  content: string;
}): Promise<WorkspaceFilePathResult> {
  const id = browserId("cmd_workspace_files_write_text");
  return WorkspaceFilePathResultSchema.parse(
    await invokeCommand<WorkspaceFilePathResult>(
      createEnvelope(
        "workspaceFiles.writeText",
        { path: input.path, content: input.content },
        { id, correlationId: id }
      )
    )
  );
}

export async function createWorkspaceFileEntry(input: {
  parentPath: string;
  name: string;
  kind: WorkspaceEntryKind;
}): Promise<WorkspaceFilePathResult> {
  const id = browserId("cmd_workspace_files_create");
  return WorkspaceFilePathResultSchema.parse(
    await invokeCommand<WorkspaceFilePathResult>(
      createEnvelope(
        "workspaceFiles.create",
        {
          parentPath: input.parentPath,
          name: input.name,
          kind: input.kind
        },
        { id, correlationId: id }
      )
    )
  );
}

export async function renameWorkspaceFileEntry(input: {
  path: string;
  nextName: string;
}): Promise<WorkspaceFilePathResult> {
  const id = browserId("cmd_workspace_files_rename");
  return WorkspaceFilePathResultSchema.parse(
    await invokeCommand<WorkspaceFilePathResult>(
      createEnvelope(
        "workspaceFiles.rename",
        { path: input.path, nextName: input.nextName },
        { id, correlationId: id }
      )
    )
  );
}

export async function removeWorkspaceFileEntry(input: {
  path: string;
}): Promise<WorkspaceFilePathResult> {
  const id = browserId("cmd_workspace_files_remove");
  return WorkspaceFilePathResultSchema.parse(
    await invokeCommand<WorkspaceFilePathResult>(
      createEnvelope(
        "workspaceFiles.remove",
        { path: input.path },
        {
          id,
          correlationId: id
        }
      )
    )
  );
}

export const workspaceFiles = {
  list: listWorkspaceFiles,
  readText: readWorkspaceFileText,
  writeText: writeWorkspaceFileText,
  create: createWorkspaceFileEntry,
  rename: renameWorkspaceFileEntry,
  remove: removeWorkspaceFileEntry
};
