/**
 * Async file operations utility
 */

import { promises as fs } from "fs";
import * as path from "path";
import {
  FileNotFoundError,
  FileReadError,
  FileWriteError,
} from "../errors/index.js";

/**
 * Check if a file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensure a directory exists, create if it doesn't
 */
export async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    throw new FileWriteError(
      dirPath,
      error instanceof Error ? error : new Error(String(error)),
    );
  }
}

/**
 * Read a file as string
 */
export async function readFile(filePath: string): Promise<string> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return content;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new FileNotFoundError(filePath);
    }
    throw new FileReadError(
      filePath,
      error instanceof Error ? error : new Error(String(error)),
    );
  }
}

/**
 * Read a file as JSON
 */
export async function readJsonFile<T>(filePath: string): Promise<T> {
  const content = await readFile(filePath);
  try {
    return JSON.parse(content) as T;
  } catch (error) {
    throw new FileReadError(
      filePath,
      error instanceof Error ? error : new Error(String(error)),
    );
  }
}

/**
 * Write string to a file
 */
export async function writeFile(
  filePath: string,
  content: string,
): Promise<void> {
  try {
    // Ensure parent directory exists
    const dir = path.dirname(filePath);
    await ensureDir(dir);
    await fs.writeFile(filePath, content, "utf-8");
  } catch (error) {
    if (error instanceof FileNotFoundError || error instanceof FileWriteError) {
      throw error;
    }
    throw new FileWriteError(
      filePath,
      error instanceof Error ? error : new Error(String(error)),
    );
  }
}

/**
 * Write object as JSON to a file
 */
export async function writeJsonFile<T>(
  filePath: string,
  data: T,
  pretty: boolean = true,
): Promise<void> {
  const content = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
  await writeFile(filePath, content);
}

/**
 * Delete a file
 */
export async function deleteFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new FileNotFoundError(filePath);
    }
    throw new FileWriteError(
      filePath,
      error instanceof Error ? error : new Error(String(error)),
    );
  }
}

/**
 * Get file stats
 */
export async function getFileStats(filePath: string): Promise<{
  size: number;
  createdAt: Date;
  modifiedAt: Date;
}> {
  try {
    const stats = await fs.stat(filePath);
    return {
      size: stats.size,
      createdAt: stats.birthtime,
      modifiedAt: stats.mtime,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new FileNotFoundError(filePath);
    }
    throw new FileReadError(
      filePath,
      error instanceof Error ? error : new Error(String(error)),
    );
  }
}
