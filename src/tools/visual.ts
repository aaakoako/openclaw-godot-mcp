/**
 * Visual Tools
 * - capture_screenshot
 * - capture_video
 */

import { existsSync, mkdirSync, readdirSync } from 'fs';
import { join, basename } from 'path';

const CONFIG = {
  godotPath: process.env.GODOT_PATH || 'G:\\Godot-AI\\Godot_v4.6.1-stable_win64.exe',
  screenshotDir: process.env.SCREENSHOT_DIR || 'G:\\Godot-AI\\screenshots',
};

function ensureDir(path: string) {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
  }
}

/**
 * Capture a screenshot from Godot project
 * Note: Not supported in headless mode - requires display context
 */
export async function captureScreenshot(projectPath: string, outputPath?: string): Promise<any> {
  ensureDir(CONFIG.screenshotDir);
  
  const output = outputPath || join(CONFIG.screenshotDir, `screenshot_${Date.now()}.png`);
  
  return {
    success: false,
    error: 'Screenshot not supported in headless mode',
    note: 'Godot requires a display context to render. Options:',
    alternatives: [
      '1. Run with actual display (not headless)',
      '2. Use RDP to connect to the VM and capture manually',
      '3. Run Godot in a virtual framebuffer (Linux only)'
    ]
  };
}

/**
 * Capture a video from Godot project
 * Note: Not supported in headless mode - requires display context
 */
export async function captureVideo(projectPath: string, outputPath?: string, frames = 300): Promise<any> {
  ensureDir(CONFIG.screenshotDir);
  
  const output = outputPath || join(CONFIG.screenshotDir, `video_${Date.now()}.avi`);
  
  return {
    success: false,
    error: 'Video capture not supported in headless mode',
    note: 'Godot requires a display context to render videos',
    alternatives: [
      '1. Run with actual display (not headless)',
      '2. Use RDP to connect to the VM and capture manually'
    ]
  };
}

export async function listCaptures(): Promise<any> {
  ensureDir(CONFIG.screenshotDir);
  
  const files = readdirSync(CONFIG.screenshotDir)
    .filter(f => f.endsWith('.png') || f.endsWith('.avi'))
    .map(f => ({
      name: f,
      path: join(CONFIG.screenshotDir, f),
      type: f.endsWith('.png') ? 'screenshot' : 'video'
    }));
  
  return { success: true, files };
}
