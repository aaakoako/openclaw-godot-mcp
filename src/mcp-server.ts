/**
 * OpenClaw Godot MCP Server - MCP Protocol Version
 * 
 * This server can be used in two modes:
 * 1. HTTP API mode: node dist/mcp-server.js
 * 2. MCP stdio mode: npx @modelcontextprotocol/inspector node dist/mcp-server.js
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { CallToolRequestSchema, ListToolsRequestSchema, ListResourcesRequestSchema, ReadResourceRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import express from 'express';
import { WebSocketServer } from 'ws';
import { spawn, exec } from 'child_process';
import { existsSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';

const CONFIG = {
  port: process.env.PORT || 3000,
  godotPath: process.env.GODOT_PATH || 'G:\\Godot-AI\\Godot_v4.6.1-stable_win64.exe',
  projectsDir: process.env.PROJECTS_DIR || 'G:\\Godot-AI',
  screenshotDir: process.env.SCREENSHOT_DIR || 'G:\\Godot-AI\\screenshots',
};

// ============================================================================
// MCP Server Definition
// ============================================================================

class GodotMCPServer {
  private server: Server;
  private activeProcess: any = null;

  constructor() {
    this.server = new Server(
      { name: 'openclaw-godot-mcp', version: '0.2.0' },
      { capabilities: { tools: {} } }
    );

    this.setupHandlers();
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'godot_engine_info',
            description: 'Get Godot engine version and information',
            inputSchema: { type: 'object', properties: {} }
          },
          {
            name: 'godot_list_projects',
            description: 'List Godot projects in a directory',
            inputSchema: { 
              type: 'object', 
              properties: { 
                directory: { type: 'string', description: 'Directory to search for projects' }
              },
              required: ['directory']
            }
          },
          {
            name: 'godot_run_project',
            description: 'Run a Godot project in headless mode',
            inputSchema: { 
              type: 'object', 
              properties: { 
                projectPath: { type: 'string', description: 'Path to Godot project' },
                headless: { type: 'boolean', description: 'Run in headless mode', default: true },
                quitAfter: { type: 'number', description: 'Quit after N seconds', default: 60 }
              },
              required: ['projectPath']
            }
          },
          {
            name: 'godot_stop_project',
            description: 'Stop running Godot project',
            inputSchema: { type: 'object', properties: {} }
          },
          {
            name: 'godot_debug_output',
            description: 'Get debug output from running project',
            inputSchema: { type: 'object', properties: {} }
          },
          {
            name: 'godot_execute_script',
            description: 'Execute a GDScript file',
            inputSchema: { 
              type: 'object', 
              properties: { 
                scriptPath: { type: 'string', description: 'Path to GDScript file' },
                projectPath: { type: 'string', description: 'Project path (optional)' }
              },
              required: ['scriptPath']
            }
          },
          {
            name: 'godot_execute_code',
            description: 'Execute inline GDScript code',
            inputSchema: { 
              type: 'object', 
              properties: { 
                code: { type: 'string', description: 'GDScript code to execute' },
                projectPath: { type: 'string', description: 'Project path (optional)' }
              },
              required: ['code']
            }
          },
          {
            name: 'godot_create_scene',
            description: 'Create a new Godot scene file',
            inputSchema: { 
              type: 'object', 
              properties: { 
                projectPath: { type: 'string', description: 'Project path' },
                scenePath: { type: 'string', description: 'Relative path for scene file' },
                rootNodeType: { type: 'string', description: 'Root node type', default: 'Node2D' }
              },
              required: ['projectPath', 'scenePath']
            }
          },
          {
            name: 'godot_search_files',
            description: 'Search for files in a Godot project',
            inputSchema: { 
              type: 'object', 
              properties: { 
                projectPath: { type: 'string', description: 'Project path' },
                pattern: { type: 'string', description: 'Search pattern' }
              },
              required: ['projectPath', 'pattern']
            }
          },
          {
            name: 'godot_search_code',
            description: 'Search for code in GDScript files',
            inputSchema: { 
              type: 'object', 
              properties: { 
                projectPath: { type: 'string', description: 'Project path' },
                pattern: { type: 'string', description: 'Search pattern' }
              },
              required: ['projectPath', 'pattern']
            }
          },
          {
            name: 'godot_get_performance',
            description: 'Get performance metrics from Godot project',
            inputSchema: { 
              type: 'object', 
              properties: { 
                projectPath: { type: 'string', description: 'Project path' }
              }
            }
          },
          {
            name: 'godot_capture_screenshot',
            description: 'Capture a screenshot from Godot project',
            inputSchema: { 
              type: 'object', 
              properties: { 
                projectPath: { type: 'string', description: 'Project path' },
                outputPath: { type: 'string', description: 'Output file path' }
              },
              required: ['projectPath', 'outputPath']
            }
          }
        ]
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const a = args as any;

      try {
        switch (name) {
          case 'godot_engine_info':
            return await this.tool_engine_info();
          case 'godot_list_projects':
            return await this.tool_list_projects(a.directory);
          case 'godot_run_project':
            return await this.tool_run_project(a.projectPath, a.headless, a.quitAfter);
          case 'godot_stop_project':
            return await this.tool_stop_project();
          case 'godot_debug_output':
            return await this.tool_debug_output();
          case 'godot_execute_script':
            return await this.tool_execute_script(a.scriptPath, a.projectPath);
          case 'godot_execute_code':
            return await this.tool_execute_code(a.code, a.projectPath);
          case 'godot_create_scene':
            return await this.tool_create_scene(a.projectPath, a.scenePath, a.rootNodeType);
          case 'godot_search_files':
            return await this.tool_search_files(a.projectPath, a.pattern);
          case 'godot_search_code':
            return await this.tool_search_code(a.projectPath, a.pattern);
          case 'godot_get_performance':
            return await this.tool_get_performance(a.projectPath);
          case 'godot_capture_screenshot':
            return await this.tool_capture_screenshot(a.projectPath, a.outputPath);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error: any) {
        return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true
        };
      }
    });
  }

  // Tool implementations
  private async execGodot(args: string[]): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const cmd = `"${CONFIG.godotPath}" ${args.join(' ')}`;
      exec(cmd, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
        resolve({ stdout, stderr });
      });
    });
  }

  private async tool_engine_info() {
    const { stdout } = await this.execGodot(['--version']);
    return { content: [{ type: 'text', text: stdout.trim() }] };
  }

  private async tool_list_projects(directory: string) {
    if (!existsSync(directory)) {
      return { content: [{ type: 'text', text: `Directory not found: ${directory}` }], isError: true };
    }
    const items = readdirSync(directory, { withFileTypes: true });
    const projects = [];
    for (const item of items) {
      if (!item.isDirectory() || item.name.startsWith('.')) continue;
      const projectFile = join(directory, item.name, 'project.godot');
      if (existsSync(projectFile)) {
        projects.push(item.name);
      }
    }
    return { content: [{ type: 'text', text: JSON.stringify(projects, null, 2) }] };
  }

  private async tool_run_project(projectPath: string, headless = true, quitAfter = 60) {
    if (this.activeProcess) {
      return { content: [{ type: 'text', text: 'Project already running' }], isError: true };
    }
    const args = ['--path', projectPath];
    if (headless) args.push('--headless');
    args.push('--quit-after', String(quitAfter));
    
    this.activeProcess = spawn(CONFIG.godotPath, args, { shell: true, cwd: projectPath });
    
    return { content: [{ type: 'text', text: `Project started (PID: ${this.activeProcess.pid})` }] };
  }

  private async tool_stop_project() {
    if (this.activeProcess) {
      this.activeProcess.kill();
      this.activeProcess = null;
      return { content: [{ type: 'text', text: 'Project stopped' }] };
    }
    return { content: [{ type: 'text', text: 'No project running' }] };
  }

  private async tool_debug_output() {
    return { content: [{ type: 'text', text: 'Debug output not implemented in MCP mode yet' }] };
  }

  private async tool_execute_script(scriptPath: string, projectPath?: string) {
    const args = ['--script', scriptPath, '--headless'];
    if (projectPath) args.unshift('--path', projectPath);
    const { stdout, stderr } = await this.execGodot(args);
    return { content: [{ type: 'text', text: stdout || stderr }] };
  }

  private async tool_execute_code(code: string, projectPath?: string) {
    const tmpDir = projectPath || '.';
    const tmpPath = join(tmpDir, '_mcp_temp.gd');
    const scriptContent = `extends Node\nfunc _ready():\n${code.split('\n').map(l => '    ' + l).join('\n')}\n`;
    
    writeFileSync(tmpPath, scriptContent, 'utf-8');
    try {
      return await this.tool_execute_script(tmpPath, projectPath);
    } finally {
      try { unlinkSync(tmpPath); } catch {}
    }
  }

  private async tool_create_scene(projectPath: string, scenePath: string, rootNodeType = 'Node2D') {
    const fullPath = join(projectPath, scenePath);
    const content = `[gd_scene load_steps=1 format=3]\n\n[node name="Main" type="${rootNodeType}"]\n`;
    writeFileSync(fullPath, content, 'utf-8');
    return { content: [{ type: 'text', text: `Scene created: ${fullPath}` }] };
  }

  private async tool_search_files(projectPath: string, pattern: string) {
    const results: string[] = [];
    const search = (dir: string) => {
      if (!existsSync(dir)) return;
      for (const item of readdirSync(dir, { withFileTypes: true })) {
        if (item.name.startsWith('.') || item.name === 'node_modules') continue;
        const fullPath = join(dir, item.name);
        if (item.isDirectory()) search(fullPath);
        else if (item.name.toLowerCase().includes(pattern.toLowerCase())) results.push(fullPath);
      }
    };
    search(projectPath);
    return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
  }

  private async tool_search_code(projectPath: string, pattern: string) {
    const results: string[] = [];
    const search = (dir: string) => {
      if (!existsSync(dir)) return;
      for (const item of readdirSync(dir, { withFileTypes: true })) {
        if (item.name.startsWith('.') || item.name === 'node_modules') continue;
        const fullPath = join(dir, item.name);
        if (item.isDirectory()) search(fullPath);
        else if (item.name.endsWith('.gd')) {
          const content = readFileSync(fullPath, 'utf-8');
          if (content.toLowerCase().includes(pattern.toLowerCase())) results.push(fullPath);
        }
      }
    };
    search(projectPath);
    return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
  }

  private async tool_get_performance(projectPath?: string) {
    const code = `var p = Performance\nprint(JSON.stringify({"fps": p.get_monitor(p.TIME_FPS), "objects": p.get_monitor(p.OBJECT_COUNT)}))`;
    return await this.tool_execute_code(code, projectPath);
  }

  private async tool_capture_screenshot(projectPath: string, outputPath: string) {
    const { stdout } = await this.execGodot(['--path', projectPath, '--headless', '--write-movie', outputPath, '--quit-after', '1']);
    if (existsSync(outputPath)) {
      return { content: [{ type: 'text', text: `Screenshot saved: ${outputPath}` }] };
    }
    return { content: [{ type: 'text', text: 'Screenshot failed' }], isError: true };
  }

  // Run as MCP server (stdio mode)
  async runStdio() {
    const transport = new SSEServerTransport('/mcp', process.stdout as any);
    await this.server.connect(transport);
    console.error('Godot MCP Server running on stdio...');
  }

  // Run as HTTP server (dual mode)
  async runHTTP(port = CONFIG.port) {
    const app = express();
    app.use(express.json());
    
    app.get('/health', (_, res) => res.json({ status: 'ok' }));
    
    // HTTP endpoints for backward compatibility
    app.get('/api/engine_info', async (_, res) => {
      const result = await this.tool_engine_info();
      res.json({ success: true, output: result.content[0].text });
    });
    
    app.get('/api/projects', async (req, res) => {
      const dir = req.query.directory || CONFIG.projectsDir;
      const result = await this.tool_list_projects(dir as string);
      res.json({ success: true, ...result });
    });
    
    app.post('/api/run_project', async (req, res) => {
      const { projectPath, headless, quitAfter } = req.body;
      const result = await this.tool_run_project(projectPath, headless, quitAfter);
      res.json({ success: !result.isError, ...result });
    });

    app.listen(port, () => {
      console.error(`OpenClaw Godot MCP Server running on port ${port}`);
    });
  }
}

// Start server
const server = new GodotMCPServer();

if (process.argv.includes('--http')) {
  server.runHTTP();
} else {
  server.runStdio();
}

export default server;
