/**
 * OneDrive for Business service adapter.
 *
 * Wraps the auto-generated OneDriveforBusinessService to expose a clean
 * read/write API for the rest of the app. Never import the generated
 * service directly — use this module instead.
 */

import { OneDriveforBusinessService } from '@/generated/services/OneDriveforBusinessService';
import type { BlobMetadata, SharingLink } from '@/generated/models/OneDriveforBusinessModel';

/** Unwrap the IOperationResult — throw on failure. */
function unwrap<T>(result: { data?: T; error?: unknown }): T {
  if (result.error) {
    throw new Error(
      typeof result.error === 'string'
        ? result.error
        : JSON.stringify(result.error),
    );
  }
  return result.data as T;
}

// ── Public API ───────────────────────────────────────────────────────

export interface OneDriveFile {
  id: string;
  name: string;
  path: string;
  size: number;
  mediaType: string;
  lastModified: string;
  webUrl?: string;
}

function toBizModel(b: BlobMetadata): OneDriveFile {
  return {
    id: b.Id ?? '',
    name: b.Name ?? '',
    path: b.Path ?? '',
    size: b.Size ?? 0,
    mediaType: b.MediaType ?? '',
    lastModified: b.LastModified ?? '',
  };
}

/** The default folder where VendIQ stores generated files. */
const VENDIQ_FOLDER = '/VendIQ';

export const oneDriveService = {
  /**
   * Create (upload) a file to the user's OneDrive.
   * Returns metadata including the file ID.
   */
  async createFile(
    name: string,
    content: string,
    folderPath = VENDIQ_FOLDER,
  ): Promise<OneDriveFile> {
    const result = await OneDriveforBusinessService.CreateFile(folderPath, name, content);
    return toBizModel(unwrap(result));
  },

  /**
   * Read a file's content by its ID.
   */
  async getFileContent(id: string): Promise<string> {
    const result = await OneDriveforBusinessService.GetFileContent(id);
    return unwrap(result);
  },

  /**
   * Read a file's content by path.
   */
  async getFileContentByPath(path: string): Promise<string> {
    const result = await OneDriveforBusinessService.GetFileContentByPath(path);
    return unwrap(result);
  },

  /**
   * Get file metadata by ID.
   */
  async getFileMetadata(id: string): Promise<OneDriveFile> {
    const result = await OneDriveforBusinessService.GetFileMetadata(id);
    return toBizModel(unwrap(result));
  },

  /**
   * Get file metadata by path.
   */
  async getFileMetadataByPath(path: string): Promise<OneDriveFile> {
    const result = await OneDriveforBusinessService.GetFileMetadataByPath(path);
    return toBizModel(unwrap(result));
  },

  /**
   * Update (overwrite) an existing file's content.
   */
  async updateFile(id: string, content: string): Promise<OneDriveFile> {
    const result = await OneDriveforBusinessService.UpdateFile(id, content);
    return toBizModel(unwrap(result));
  },

  /**
   * Delete a file by ID.
   */
  async deleteFile(id: string): Promise<void> {
    const result = await OneDriveforBusinessService.DeleteFile(id);
    unwrap(result);
  },

  /**
   * Create a sharing link for a file.
   * @param type  "view" | "edit"
   * @param scope "anonymous" | "organization"
   */
  async createShareLink(
    id: string,
    type: 'view' | 'edit' = 'view',
    scope: 'anonymous' | 'organization' = 'organization',
  ): Promise<string> {
    const result = await OneDriveforBusinessService.CreateShareLinkV2(id, type, scope);
    const link: SharingLink = unwrap(result);
    return link.WebUrl ?? '';
  },

  /**
   * List files in a folder.
   */
  async listFolder(folderId: string): Promise<OneDriveFile[]> {
    const result = await OneDriveforBusinessService.ListFolder(folderId);
    const items = unwrap(result);
    return (items ?? []).map(toBizModel);
  },

  /**
   * Convert a file to a different format (e.g. PDF).
   * @param type Target format: "pdf", "html", etc.
   * @returns The converted file content.
   */
  async convertFile(id: string, type = 'pdf'): Promise<string> {
    const result = await OneDriveforBusinessService.ConvertFile(id, type);
    return unwrap(result);
  },
} as const;
