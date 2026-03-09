/**
 * Visual Tools
 * - capture_screenshot
 * - capture_video
 */

import { spawn } from 'child_process';
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

export async function captureScreenshot(projectPath: string, outputPath?: string): Promise<any> {
  ensureDir(CONFIG.screenshotDir);
  
  const output = outputPath || join(CONFIG.screenshotDir, `screenshot_${Date.now()}.png`);
  
  // Run Godot with screenshot mode
  const args = [
    '--path', projectPath,
    '--headless',
    '--write-movie', output,
    '--quit-after', '1',
    '--fixed-fps', '1'
  ];

  return new Promise((resolve) => {
    const proc = spawn(CONFIG.godotPath, args, { shell: true });
    
    proc.on('close', (code) => {
      if (existsSync(output)) {
        resolve({ 
          success: true, 
          path: output,
          filename: basename(output)
        });
      } else {
        resolve({ 
          success: false, 
          error: 'Screenshot file not created' 
        });
      }
    });
  });
}

export async function captureVideo(projectPath: string, outputPath?: string, frames = 300): Promise<any> {
  ensureDir(CONFIG.screenshotDir);
  
  const output = outputPath || join(CONFIG.screenshotDir, `video_${Date.now()}.avi`);
  
  const args = [
    '--path', projectPath,
    '--headless',
    '--write-movie', output,
    '--quit-after', frames.toString(),
    '--fixed-fps', '30'
  ];

  return new Promise((resolve) => {
    const proc = spawn(CONFIG.godotPath, args, { shell: true });
    
    proc.on('close', (code) => {
      if (existsSync(output)) {
        resolve({ 
          success: true, 
          path: output,
          filename: basename(output),
          frames
        });
      } else {
        resolve({ 
          success: false, 
          error: 'Video file not created' 
        });
      }
    });
  });
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
