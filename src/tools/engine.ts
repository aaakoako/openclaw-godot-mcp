/**
 * Engine Tools
 * - get_engine_info
 * - get_project_settings
 * - get_available_classes
 * - get_renderer_info
 * - get_export_templates
 * - get_performance
 * - get_memory_info
 */

import { exec } from 'child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync, unlinkSync } from 'fs';
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

/**
 * Execute inline GDScript and get output
 */
async function runGDScript(code: string, projectPath?: string): Promise<string> {
  const tmpDir = projectPath || '.';
  const tmpPath = join(tmpDir, '_mcp_temp_script.gd');
  
  // Wrap code in a proper script structure
  const scriptContent = `extends Node\nfunc _ready():\n${code.split('\n').map((l: string) => '    ' + l).join('\n')}\n`;
  
  try {
    writeFileSync(tmpPath, scriptContent, 'utf-8');
    
    const args = ['--script', tmpPath, '--headless', '--quit-after', '5'];
    if (projectPath) {
      args.unshift('--path', projectPath);
    }
    
    const result = await execAsync(`"${CONFIG.godotPath}" ${args.join(' ')}`);
    
    try {
      unlinkSync(tmpPath);
    } catch (e) {}
    
    return result.trim();
  } catch (e: any) {
    try {
      unlinkSync(tmpPath);
    } catch (e) {}
    throw e;
  }
}

export async function getEngineInfo(): Promise<any> {
  try {
    const versionOutput = await execAsync(`"${CONFIG.godotPath}" --version`);
    const verboseOutput = await execAsync(`"${CONFIG.godotPath}" --version --verbose`);
    
    const version = versionOutput.trim();
    const lines = verboseOutput.split('\n');
    const info: any = {
      version,
      executable: CONFIG.godotPath,
      platform: process.platform,
    };
    
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

/**
 * Get available classes from Godot ClassDB
 */
export async function getAvailableClasses(projectPath?: string): Promise<any> {
  const script = `
# Get all classes from ClassDB
var classes = []
for c in ClassDB.get_class_list():
    classes.append(c)
print(JSON.stringify(classes))
`;
  
  try {
    const output = await runGDScript(script, projectPath);
    
    // Try to parse JSON output
    let classes: string[] = [];
    try {
      // Find JSON in output (in case there are other print statements)
      const jsonMatch = output.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        classes = JSON.parse(jsonMatch[0]);
      }
    } catch (parseErr) {
      // If JSON parsing fails, return the raw output as a single item
      classes = output.split('\n').filter((l: string) => l.trim());
    }
    
    // Sort alphabetically and remove duplicates
    classes = [...new Set(classes)].sort();
    
    return {
      success: true,
      count: classes.length,
      classes,
      note: 'Dynamically fetched from Godot ClassDB'
    };
  } catch (e: any) {
    // Fallback to static list
    return {
      success: true,
      count: 0,
      classes: [],
      error: e.message,
      fallback: true,
      message: 'Could not fetch from Godot, using fallback list',
      staticClasses: [
        'Node', 'Node2D', 'Node3D', 'Control', 'CanvasItem',
        'Sprite2D', 'Sprite3D', 'MeshInstance3D', 'Camera3D',
        'RigidBody3D', 'CharacterBody3D', 'Area3D',
        'Label', 'Button', 'LineEdit', 'TextEdit',
        'AudioStreamPlayer', 'AnimationPlayer'
      ]
    };
  }
}

/**
 * Get class details (methods, properties, etc.)
 */
export async function getClassDetails(className: string, projectPath?: string): Promise<any> {
  const script = `
var info = {
    "class_name": "${className}",
    "methods": [],
    "properties": [],
    "signals": []
}

# Try to get methods
if ClassDB.can_instantiate("${className}"):
    var instance = ClassDB.instantiate("${className}")
    if instance:
        info.methods = instance.get_method_list().map(func(m): return m.name)
        info.properties = instance.get_property_list().map(func(p): return p.name)
        instance.free()

print(JSON.stringify(info))
`;
  
  try {
    const output = await runGDScript(script, projectPath);
    const jsonMatch = output.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return { success: true, ...JSON.parse(jsonMatch[0]) };
    }
    return { success: false, error: 'Could not parse class info' };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
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
    current: 'forward_plus',
    note: 'Renderer depends on project settings and GPU support'
  };
}

export async function getExportTemplates(): Promise<any> {
  const templatePaths = {
    win32: join(process.env.APPDATA || '', 'Godot', 'export_templates'),
    linux: join(process.env.HOME || '', '.local', 'share', 'godot', 'export_templates'),
    darwin: join(process.env.HOME || '', 'Library', 'Application Support', 'Godot', 'export_templates')
  };
  
  const platform = process.platform;
  const templateDir = templatePaths[platform as keyof typeof templatePaths] || templatePaths.linux;
  
  if (!existsSync(templateDir)) {
    return {
      success: true,
      installed: false,
      path: templateDir,
      templates: [],
      message: 'No export templates installed. Download from Godot website.',
      downloadUrl: 'https://godotengine.org/download'
    };
  }
  
  try {
    const files = readdirSync(templateDir);
    const templates: Array<{ version: string; platform: string; file: string }> = [];
    
    for (const file of files) {
      if (file.endsWith('.zip')) {
        const match = file.match(/godot_export_template_([0-9.]+-[^_]+)_(\w+)\.zip/);
        if (match) {
          templates.push({
            version: match[1],
            platform: match[2],
            file
          });
        }
      }
    }
    
    return {
      success: true,
      installed: true,
      path: templateDir,
      count: templates.length,
      templates
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Get performance metrics from Godot Performance singleton
 */
export async function getPerformance(projectPath?: string): Promise<any> {
  const script = `
var p = Performance
var metrics = {
    "fps": p.get_monitor(Performance.TIME_FPS),
    "frame_time_ms": p.get_monitor(Performance.TIME_PROCESS) * 1000,
    "physics_frame_time_ms": p.get_monitor(Performance.TIME_PHYSICS_PROCESS) * 1000,
    "render_draw_calls": p.get_monitor(Performance.RENDER_DRAW_CALLS),
    "render_vertices": p.get_monitor(Performance.RENDER_VERTICES_IN_FRAME),
    "object_count": p.get_monitor(Performance.OBJECT_COUNT),
    "node_count": p.get_monitor(Performance.OBJECT_NODE_COUNT),
    "resource_count": p.get_monitor(Performance.OBJECT_RESOURCE_COUNT),
    "orphan_node_count": p.get_monitor(Performance.OBJECT_ORPHAN_NODE_COUNT),
    "multiplayer_peers": p.get_monitor(Performance.MULTIPLAYER_PEERS),
    "multiplayer_messages": p.get_monitor(Performance.MULTIPLAYER_MESSAGES_PER_SECOND),
}
print(JSON.stringify(metrics))
`;
  
  try {
    const output = await runGDScript(script, projectPath);
    const jsonMatch = output.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return { success: true, ...JSON.parse(jsonMatch[0]) };
    }
    return { success: false, error: 'Could not parse performance data' };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Get memory information from Godot
 */
export async function getMemoryInfo(projectPath?: string): Promise<any> {
  const script = `
var p = Performance
var os = OS
var metrics = {
    "memory_static": p.get_monitor(Performance.MEMORY_STATIC),
    "memory_static_max": p.get_monitor(Performance.MEMORY_STATIC_MAX),
    "memory_video": p.get_monitor(Performance.MEMORY_VIDEO),
    "memory_messages": p.get_monitor(Performance.MEMORY_MESSAGES),
    "memory_messages_total": p.get_monitor(Performance.MEMORY_MESSAGES_TOTAL),
    "memory_allocated": p.get_monitor(Performance.MEMORY_ALLOCATED),
    "memory_reserved": p.get_monitor(Performance.MEMORY_RESERVED),
    "os_allocated_mem": OS.get_static_memory_usage(),
    "os_allocated_mem_peak": OS.get_static_memory_peak_usage(),
}
print(JSON.stringify(metrics))
`;
  
  try {
    const output = await runGDScript(script, projectPath);
    const jsonMatch = output.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0]);
      
      // Format nicely
      return {
        success: true,
        engine: {
          static: formatBytes(data.memory_static),
          staticMax: formatBytes(data.memory_static_max),
          video: formatBytes(data.memory_video),
          allocated: formatBytes(data.memory_allocated),
          reserved: formatBytes(data.memory_reserved),
        },
        raw: data,
        note: 'Dynamically fetched from Godot Performance and OS'
      };
    }
    return { success: false, error: 'Could not parse memory data' };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Get full engine status (combines multiple metrics)
 */
export async function getEngineStatus(projectPath?: string): Promise<any> {
  const [perfResult, memResult] = await Promise.all([
    getPerformance(projectPath),
    getMemoryInfo(projectPath)
  ]);
  
  return {
    success: true,
    performance: perfResult.success ? perfResult : { error: perfResult.error },
    memory: memResult.success ? memResult : { error: memResult.error },
    timestamp: new Date().toISOString()
  };
}

// Alias for getMemoryInfo (to avoid conflict with debug.ts)
export { getMemoryInfo as getEngineMemory };
