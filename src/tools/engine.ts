/**
 * Engine Tools
 * - get_engine_info
 * - get_project_settings
 * - get_available_classes
 * - get_renderer_info
 */

import { exec } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join, basename } from 'path';

const CONFIG = {
  godotPath: process.env.GODOT_PATH || 'G:\\Godot-AI\\Godot_v4.6.1-stable_win64.exe',
};

function execAsync(cmd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve(stdout);
      }
    });
  });
}

export async function getEngineInfo(): Promise<any> {
  try {
    const versionOutput = await execAsync(`"${CONFIG.godotPath}" --version`);
    const verboseOutput = await execAsync(`"${CONFIG.godotPath}" --version --verbose`);
    
    // Parse version info
    const version = versionOutput.trim();
    
    // Extract additional info from verbose output
    const lines = verboseOutput.split('\n');
    const info: any = {
      version,
      executable: CONFIG.godotPath,
      platform: process.platform,
    };
    
    // Try to detect features
    info.features = [];
    if (verboseOutput.includes('Vulkan')) info.features.push('vulkan');
    if (verboseOutput.includes('OpenGL')) info.features.push('opengl');
    if (verboseOutput.includes('D3D12')) info.features.push('d3d12');
    if (verboseOutput.includes('Mobile')) info.features.push('mobile');
    if (verboseOutput.includes('WEB')) info.features.push('web');
    
    return { success: true, ...info };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function getProjectSettings(projectPath: string): Promise<any> {
  try {
    const settingsFile = join(projectPath, 'project.godot');
    
    if (!existsSync(settingsFile)) {
      return { success: false, error: 'project.godot not found' };
    }
    
    const content = readFileSync(settingsFile, 'utf-8');
    
    // Parse project.godot (simple parsing)
    const settings: any = {};
    let currentSection = '';
    
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        currentSection = trimmed.slice(1, -1);
        settings[currentSection] = {};
      } else if (currentSection && trimmed.includes('=')) {
        const [key, ...valueParts] = trimmed.split('=');
        settings[currentSection][key.trim()] = valueParts.join('=').trim();
      }
    }
    
    return { success: true, settings };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function getAvailableClasses(): Promise<any> {
  // This would require running Godot with a special script to dump classes
  // For now, return a placeholder
  return {
    success: true,
    message: 'Class enumeration not implemented yet',
    classes: [
      'Node', 'Node2D', 'Node3D', 'Control', 'CanvasItem',
      'Sprite2D', 'Sprite3D', 'MeshInstance3D', 'Camera3D',
      'RigidBody3D', 'CharacterBody3D', 'Area3D',
      'Label', 'Button', 'LineEdit', 'TextEdit',
      'AudioStreamPlayer', 'AnimationPlayer'
      // Full list would be dynamically loaded
    ]
  };
}

export async function getRendererInfo(): Promise<any> {
  return {
    success: true,
    available: [
      { name: 'forward_plus', display: 'Forward+ (Vulkan)', requires: 'vulkan' },
      { name: 'mobile', display: 'Mobile (Vulkan)', requires: 'vulkan' },
      { name: 'gl_compatibility', display: 'Compatibility (OpenGL ES 3)', requires: 'opengl' },
      { name: 'd3d12', display: 'D3D12 (DirectX 12)', requires: 'd3d12' }
    ],
    current: 'forward_plus', // Would need to check project settings
    note: 'Renderer depends on project settings and GPU support'
  };
}
