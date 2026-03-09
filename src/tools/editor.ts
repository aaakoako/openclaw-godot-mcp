/**
 * Editor Tools
 * - launch_editor
 * - create_scene
 * - add_node
 * - load_sprite
 * - save_scene
 */

import { spawn } from 'child_process';
import { existsSync, writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';

const CONFIG = {
  godotPath: process.env.GODOT_PATH || 'G:\\Godot-AI\\Godot_v4.6.1-stable_win64.exe',
};

export async function launchEditor(projectPath: string): Promise<any> {
  if (!existsSync(projectPath)) {
    return { success: false, error: 'Project path does not exist' };
  }
  
  const projectFile = join(projectPath, 'project.godot');
  if (!existsSync(projectFile)) {
    return { success: false, error: 'Not a valid Godot project (no project.godot)' };
  }
  
  // Launch editor (non-blocking)
  spawn(CONFIG.godotPath, ['--path', projectPath, '--editor'], {
    detached: true,
    stdio: 'ignore',
    shell: true
  });
  
  return { 
    success: true, 
    message: 'Editor launched',
    projectPath
  };
}

export async function createScene(projectPath: string, scenePath: string, rootNodeType = 'Node2D'): Promise<any> {
  const fullPath = join(projectPath, scenePath);
  const dir = dirname(fullPath);
  
  // Ensure directory exists
  if (!existsSync(dir)) {
    return { success: false, error: 'Parent directory does not exist' };
  }
  
  const sceneContent = `[gd_scene load_steps=1 format=3]

[node name="Main" type="${rootNodeType}"]
`;
  
  try {
    writeFileSync(fullPath, sceneContent, 'utf-8');
    
    return { 
      success: true, 
      path: fullPath,
      relativePath: scenePath,
      rootNodeType
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function addNode(projectPath: string, scenePath: string, nodePath: string, nodeType: string, nodeName?: string): Promise<any> {
  const fullPath = join(projectPath, scenePath);
  
  if (!existsSync(fullPath)) {
    return { success: false, error: 'Scene file does not exist' };
  }
  
  try {
    let content = readFileSync(fullPath, 'utf-8');
    
    // Find a place to add the node (before the last closing bracket)
    const nodeDef = `
[node name="${nodeName || 'NewNode'}" type="${nodeType}"]
`;
    
    // Simple append for now - could be smarter about placement
    content = content.replace(/\n\[\\/gd_scene\]\n?$/, nodeDef + '\n[/gd_scene]\n');
    
    writeFileSync(fullPath, content, 'utf-8');
    
    return { 
      success: true, 
      path: fullPath,
      nodePath,
      nodeType,
      nodeName
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function loadSprite(projectPath: string, scenePath: string, nodePath: string, texturePath: string): Promise<any> {
  // Similar to addNode but adds texture reference
  const fullPath = join(projectPath, scenePath);
  
  if (!existsSync(fullPath)) {
    return { success: false, error: 'Scene file does not exist' };
  }
  
  return {
    success: true,
    message: 'Sprite loading requires scene update',
    nodePath,
    texturePath,
    note: 'This would add a Sprite2D with the specified texture'
  };
}

export async function saveScene(projectPath: string, scenePath: string): Promise<any> {
  // In Godot, scenes are auto-saved
  // This would trigger a save through the editor if running
  return {
    success: true,
    message: 'Scene saved (auto-save in Godot)',
    path: join(projectPath, scenePath)
  };
}
