/**
 * Retrieval Tools
 * - search_files
 * - search_code
 * - search_assets
 * - search_nodes
 * - find_script_by_class
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join, basename, extname } from 'path';

const DEFAULT_EXTENSIONS = {
  scripts: ['.gd', '.gdscript', '.cs'],
  scenes: ['.tscn', '.scn'],
  resources: ['.tres', '.res'],
  images: ['.png', '.jpg', '.jpeg', '.svg', '.webp'],
  audio: ['.wav', '.ogg', '.mp3'],
  models: ['.glb', '.gltf', '.obj', '.fbx']
};

function findFilesRecursive(dir: string, pattern: string, extensions?: string[]): string[] {
  const results: string[] = [];
  
  if (!existsSync(dir)) return results;
  
  try {
    const items = readdirSync(dir, { withFileTypes: true });
    
    for (const item of items) {
      const fullPath = join(dir, item.name);
      
      if (item.isDirectory()) {
        // Skip hidden and common ignore directories
        if (item.name.startsWith('.') || item.name === 'node_modules' || item.name === 'addons') {
          continue;
        }
        results.push(...findFilesRecursive(fullPath, pattern, extensions));
      } else if (item.isFile()) {
        const ext = extname(item.name).toLowerCase();
        
        // Filter by extension if specified
        if (extensions && extensions.length > 0) {
          if (!extensions.includes(ext)) continue;
        }
        
        // Filter by pattern
        if (pattern && !item.name.toLowerCase().includes(pattern.toLowerCase())) {
          continue;
        }
        
        results.push(fullPath);
      }
    }
  } catch (e) {
    // Permission denied or other errors
  }
  
  return results;
}

function searchInFiles(files: string[], searchPattern: string): Array<{ file: string; matches: number; lines: number[] }> {
  const results: Array<{ file: string; matches: number; lines: number[] }> = [];
  const pattern = searchPattern.toLowerCase();
  
  for (const file of files) {
    try {
      const content = readFileSync(file, 'utf-8');
      const lines = content.split('\n');
      const matchedLines: number[] = [];
      let matchCount = 0;
      
      lines.forEach((line, index) => {
        if (line.toLowerCase().includes(pattern)) {
          matchedLines.push(index + 1);
          matchCount++;
        }
      });
      
      if (matchCount > 0) {
        results.push({
          file,
          matches: matchCount,
          lines: matchedLines
        });
      }
    } catch (e) {
      // Skip files that can't be read
    }
  }
  
  return results;
}

export async function searchFiles(projectPath: string, pattern: string, recursive = true): Promise<any> {
  try {
    const files = recursive 
      ? findFilesRecursive(projectPath, pattern)
      : readdirSync(projectPath)
          .filter(f => f.toLowerCase().includes(pattern.toLowerCase()))
          .map(f => join(projectPath, f));
    
    return { 
      success: true, 
      pattern,
      count: files.length,
      files: files.map(f => ({
        path: f,
        name: basename(f),
        type: extname(f).slice(1) || 'file'
      }))
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function searchCode(projectPath: string, pattern: string, filePattern = '*.gd'): Promise<any> {
  try {
    const extensions = filePattern.replace('*', '').split(',').map(e => e.trim());
    const files = findFilesRecursive(projectPath, '', [...DEFAULT_EXTENSIONS.scripts, ...DEFAULT_EXTENSIONS.scenes]);
    
    const results = searchInFiles(files, pattern);
    
    return {
      success: true,
      pattern,
      count: results.length,
      results: results.map(r => ({
        file: r.file,
        name: basename(r.file),
        matches: r.matches,
        lines: r.lines
      }))
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function searchAssets(projectPath: string, pattern: string): Promise<any> {
  try {
    const assetsDir = join(projectPath, 'res://');
    const files = findFilesRecursive(assetsDir, pattern, [
      ...DEFAULT_EXTENSIONS.images,
      ...DEFAULT_EXTENSIONS.audio,
      ...DEFAULT_EXTENSIONS.models,
      ...DEFAULT_EXTENSIONS.resources
    ]);
    
    return {
      success: true,
      pattern,
      count: files.length,
      assets: files.map(f => ({
        path: f.replace(projectPath, ''),
        name: basename(f),
        type: extname(f).slice(1) || 'resource'
      }))
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function searchNodes(projectPath: string, pattern: string): Promise<any> {
  // Search for nodes in .tscn files
  try {
    const sceneFiles = findFilesRecursive(projectPath, '', DEFAULT_EXTENSIONS.scenes);
    const results: Array<{ file: string; nodes: string[] }> = [];
    
    for (const file of sceneFiles) {
      try {
        const content = readFileSync(file, 'utf-8');
        const nodes: string[] = [];
        const lines = content.split('\n');
        
        lines.forEach((line) => {
          if (line.includes('node name=')) {
            const match = line.match(/node name="([^"]+)"/);
            if (match && match[1].toLowerCase().includes(pattern.toLowerCase())) {
              nodes.push(match[1]);
            }
          }
        });
        
        if (nodes.length > 0) {
          results.push({ file, nodes });
        }
      } catch (e) {
        // Skip
      }
    }
    
    return {
      success: true,
      pattern,
      count: results.length,
      results
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function findScriptByClass(projectPath: string, className: string): Promise<any> {
  try {
    const files = findFilesRecursive(projectPath, '', DEFAULT_EXTENSIONS.scripts);
    const results: Array<{ file: string; className: string }> = [];
    
    for (const file of files) {
      try {
        const content = readFileSync(file, 'utf-8');
        
        // Look for class_name or extends
        if (content.includes(`class_name ${className}`) || 
            content.includes(`extends ${className}`)) {
          results.push({
            file,
            name: basename(file),
            className
          });
        }
      } catch (e) {
        // Skip
      }
    }
    
    return {
      success: true,
      className,
      count: results.length,
      results
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
