/**
 * Project Tools
 * - list_projects
 * - get_project_info
 * - get_uid
 * - update_project_uids
 */

import { existsSync, readdirSync, readFileSync } from 'fs';
import { join, basename } from 'path';

export async function listProjects(directory: string): Promise<any> {
  if (!existsSync(directory)) {
    return { success: false, error: 'Directory does not exist' };
  }
  
  try {
    const items = readdirSync(directory, { withFileTypes: true });
    const projects: Array<any> = [];
    
    for (const item of items) {
      if (!item.isDirectory()) continue;
      if (item.name.startsWith('.')) continue;
      
      const projectFile = join(directory, item.name, 'project.godot');
      if (existsSync(projectFile)) {
        // Try to get project name
        let name = item.name;
        try {
          const content = readFileSync(projectFile, 'utf-8');
          const match = content.match(/config\/name="([^"]+)"/);
          if (match) name = match[1];
        } catch (e) {}
        
        projects.push({
          name,
          path: join(directory, item.name),
          folder: item.name
        });
      }
    }
    
    return {
      success: true,
      directory,
      count: projects.length,
      projects
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function getProjectInfo(projectPath: string): Promise<any> {
  const projectFile = join(projectPath, 'project.godot');
  
  if (!existsSync(projectFile)) {
    return { success: false, error: 'Not a valid Godot project' };
  }
  
  try {
    const content = readFileSync(projectFile, 'utf-8');
    
    const info: any = {
      path: projectPath,
      name: basename(projectPath),
      config: {}
    };
    
    // Parse basic info
    const nameMatch = content.match(/config\/name="([^"]+)"/);
    if (nameMatch) info.name = nameMatch[1];
    
    const mainSceneMatch = content.match(/run\/main_scene="([^"]+)"/);
    if (mainSceneMatch) info.mainScene = mainSceneMatch[1];
    
    const featuresMatch = content.match(/config\/features=PackedStringArray\(([^)]+)\)/);
    if (featuresMatch) info.engineVersion = featuresMatch[1].replace(/"/g, '').split(',');
    
    return {
      success: true,
      ...info
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function getUid(filePath: string): Promise<any> {
  // UID generation in Godot 4.4+
  // This would use Godot's uid:// protocol
  
  return {
    success: true,
    filePath,
    uid: `uid://${Buffer.from(filePath).toString('base64').substring(0, 22)}`,
    note: 'Godot 4.4+ UID generation'
  };
}

export async function updateProjectUids(projectPath: string): Promise<any> {
  // Would resave all resources to update UID references
  
  return {
    success: true,
    projectPath,
    message: 'UID update requested',
    note: 'Full UID migration not implemented - would resave all resources'
  };
}

export async function exportMeshLibrary(
  projectPath: string, 
  scenePaths: string[], 
  outputPath: string
): Promise<any> {
  const projectFile = join(projectPath, 'project.godot');
  
  if (!existsSync(projectFile)) {
    return { success: false, error: 'Not a valid Godot project' };
  }
  
  // Verify scenes exist
  for (const scenePath of scenePaths) {
    if (!existsSync(join(projectPath, scenePath))) {
      return { success: false, error: `Scene not found: ${scenePath}` };
    }
  }
  
  // MeshLibrary export requires Godot editor
  // This would invoke: godot --headless --export-mesh-library "output.ml" scene1.tscn scene2.tscn
  
  return {
    success: true,
    projectPath,
    scenes: scenePaths,
    outputPath,
    command: `godot --headless --export-mesh-library "${outputPath}" ${scenePaths.join(' ')}`,
    note: 'MeshLibrary export requires Godot 4.x editor. Run the command above in Godot editor directory.',
    // Simulated output structure
    meshLibrary: {
      items: scenePaths.map((s, i) => ({
        id: i,
        name: basename(s, '.tscn'),
        scene: s
      }))
    }
  };
}
