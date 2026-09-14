import {
  WorkspaceFileBinarySchema,
  WorkspaceFileListingSchema,
  WorkspaceFilePathResultSchema,
  WorkspaceFileTextSchema,
  type CommandEnvelope,
  type CommandResult
} from "@deepwrite/contracts";
import { safeErrorDetails } from "./errors";
import { WorkspaceFilesError } from "../workspace-files-paths";
import { WorkspaceFilesService } from "../workspace-files-service";

/**
 * 手机端「工作区」页的文件命令。
 *
 * 依赖收成一个函数（照 `handleLongBookAnalysisCommands` 的写法）：根目录每次现取，
 * 用户在页内切换工作目录之后立刻生效，不需要重启或重连。
 */
export interface WorkspaceFileCommandDeps {
  getWorkspaceDirectory: () => Promise<string | null>;
}

function accepted(command: CommandEnvelope, payload: unknown): CommandResult {
  return { status: "accepted", requestId: command.id, payload };
}

function rejected(command: CommandEnvelope, error: unknown): CommandResult {
  const known = error instanceof WorkspaceFilesError;
  return {
    status: "rejected",
    requestId: command.id,
    error: {
      code: known ? error.code : "workspace_files.failed",
      message:
        error instanceof Error && error.message
          ? error.message
          : "工作区文件操作失败。",
      details: safeErrorDetails(error)
    }
  };
}

export async function handleWorkspaceFileCommands(
  deps: WorkspaceFileCommandDeps,
  command: CommandEnvelope
): Promise<CommandResult | undefined> {
  if (!command.type.startsWith("workspaceFiles.")) {
    return undefined;
  }
  try {
    const root = (await deps.getWorkspaceDirectory()) ?? "";
    const service = new WorkspaceFilesService(root);
    switch (command.type) {
      case "workspaceFiles.list":
        return accepted(
          command,
          WorkspaceFileListingSchema.parse(
            await service.list(command.payload.path)
          )
        );
      case "workspaceFiles.readText":
        return accepted(
          command,
          WorkspaceFileTextSchema.parse(
            await service.readText(command.payload.path)
          )
        );
      case "workspaceFiles.readBinary":
        return accepted(
          command,
          WorkspaceFileBinarySchema.parse(
            await service.readBinary(command.payload.path)
          )
        );
      case "workspaceFiles.writeText":
        return accepted(
          command,
          WorkspaceFilePathResultSchema.parse(
            await service.writeText(
              command.payload.path,
              command.payload.content
            )
          )
        );
      case "workspaceFiles.create":
        return accepted(
          command,
          WorkspaceFilePathResultSchema.parse(
            await service.create(
              command.payload.parentPath,
              command.payload.name,
              command.payload.kind
            )
          )
        );
      case "workspaceFiles.rename":
        return accepted(
          command,
          WorkspaceFilePathResultSchema.parse(
            await service.rename(command.payload.path, command.payload.nextName)
          )
        );
      case "workspaceFiles.remove":
        return accepted(
          command,
          WorkspaceFilePathResultSchema.parse(
            await service.remove(command.payload.path)
          )
        );
      default:
        return undefined;
    }
  } catch (error: unknown) {
    return rejected(command, error);
  }
}
