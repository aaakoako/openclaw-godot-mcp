/**
 * OpenClaw Godot MCP Server
 * 
 * A custom MCP server for interacting with Godot Engine,
 * designed for remote operation via OpenClaw over HTTP.
 * 
 * Features:
 * - Runtime control (run/stop projects)
 * - Visual capture (screenshot/video)
 * - Engine perception (info, settings)
 * - Retrieval (search files, code, assets)
 * - Runtime debug (variables, stack trace, breakpoints)
 * - Editor operations (scene manipulation)
 * 
 * Architecture:
 * - HTTP REST API for OpenClaw integration
 * - MCP protocol support (for future MCP clients)
 * - Godot CLI / DAP integration
 */

import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { spawn, exec } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const CONFIG = {
  port: process.env.PORT || 3000,
  godotPath: process.env.GODOT_PATH || 'G:\\Godot-AI\\Godot_v4.6.1-stable_win64.exe',
  projectsDir: process.env.PROJECTS_DIR || 'G:\\Godot-AI',
  screenshotDir: process.env.SCREENSHOT_DIR || 'G:\\Godot-AI\\screenshots',
  logFile: process.env.LOG_FILE || 'G:\\Godot-AI\\mcp-server.log',
};

// Ensure directories exist
if (!existsSync(CONFIG.screenshotDir)) {
  mkdirSync(CONFIG.screenshotDir, { recursive: true });
}

// Express app
const app = express();
app.use(express.json());

// Logging helper
function log(level: string, message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] [${level}] ${message}${data ? ' ' + JSON.stringify(data) : ''}\n`;
  console.log(entry.trim());
  try {
    writeFileSync(CONFIG.logFile, entry, { flag: 'a' });
  } catch (e) {
    console.error('Failed to write log:', e);
  }
}

// ============================================================================
// TOOL IMPLEMENTATIONS
// ============================================================================

// Runtime Tools
import { runProject, stopProject, getDebugOutput, executeScript, executeCode } from './tools/runtime.js';
import { captureScreenshot, captureVideo } from './tools/visual.js';
import { getEngineInfo, getProjectSettings, getAvailableClasses, getRendererInfo, getExportTemplates } from './tools/engine.js';
import { searchFiles, searchCode, searchAssets, searchNodes, findScriptByClass } from './tools/retrieval.js';
import { launchEditor, createScene, addNode, loadSprite, saveScene } from './tools/editor.js';
import { getUid, updateProjectUids, listProjects, getProjectInfo, exportMeshLibrary } from './tools/project.js';
import { 
  attachDebugger, 
  getRuntimeVars, 
  getStackTrace, 
  setBreakpoint, 
  evaluateExpr, 
  getPerfProfile, 
  getMemoryInfo, 
  consoleInput,
  detachDebugger,
  debugContinue,
  debugPause,
  debugNext,
  debugStepIn,
  debugStepOut
} from './tools/debug.js';
import { 
  startDebugSession, 
  stopDebugSession,
  dapInitialize,
  dapLaunch,
  dapSetBreakpoint,
  dapClearBreakpoint,
  dapContinue,
  dapPause,
  dapNext,
  dapStepIn,
  dapStepOut,
  dapStackTrace,
  dapVariables,
  dapEvaluate,
  dapThreads,
  dapDisconnect,
  dapGetOutput,
  dapIsConnected
} from './tools/dap.js';

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================================================
// Runtime APIs
// ============================================================================

app.post('/api/run_project', async (req, res) => {
  try {
    const { projectPath, scene, headless = true } = req.body;
    const result = await runProject(projectPath, scene, headless);
    res.json(result);
  } catch (e: any) {
    log('ERROR', 'run_project failed', { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/stop_project', async (req, res) => {
  try {
    const result = await stopProject();
    res.json(result);
  } catch (e: any) {
    log('ERROR', 'stop_project failed', { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/debug_output', async (req, res) => {
  try {
    const result = await getDebugOutput();
    res.json(result);
  } catch (e: any) {
    log('ERROR', 'get_debug_output failed', { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/execute_script', async (req, res) => {
  try {
    const { scriptPath, args, projectPath } = req.body;
    const result = await executeScript(scriptPath, args || [], projectPath);
    res.json(result);
  } catch (e: any) {
    log('ERROR', 'execute_script failed', { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/execute_code', async (req, res) => {
  try {
    const { code, projectPath } = req.body;
    const result = await executeCode(code, projectPath);
    res.json(result);
  } catch (e: any) {
    log('ERROR', 'execute_code failed', { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

// ============================================================================
// Visual APIs
// ============================================================================

app.post('/api/capture_screenshot', async (req, res) => {
  try {
    const { projectPath, outputPath } = req.body;
    const result = await captureScreenshot(projectPath, outputPath);
    res.json(result);
  } catch (e: any) {
    log('ERROR', 'capture_screenshot failed', { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/capture_video', async (req, res) => {
  try {
    const { projectPath, outputPath, frames = 300 } = req.body;
    const result = await captureVideo(projectPath, outputPath, frames);
    res.json(result);
  } catch (e: any) {
    log('ERROR', 'capture_video failed', { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

// ============================================================================
// Engine APIs
// ============================================================================

app.get('/api/engine_info', async (req, res) => {
  try {
    const result = await getEngineInfo();
    res.json(result);
  } catch (e: any) {
    log('ERROR', 'get_engine_info failed', { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/project_settings', async (req, res) => {
  try {
    const { projectPath } = req.query;
    const result = await getProjectSettings(projectPath as string);
    res.json(result);
  } catch (e: any) {
    log('ERROR', 'get_project_settings failed', { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/available_classes', async (req, res) => {
  try {
    const result = await getAvailableClasses();
    res.json(result);
  } catch (e: any) {
    log('ERROR', 'get_available_classes failed', { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/renderer_info', async (req, res) => {
  try {
    const result = await getRendererInfo();
    res.json(result);
  } catch (e: any) {
    log('ERROR', 'get_renderer_info failed', { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/export_templates', async (req, res) => {
  try {
    const result = await getExportTemplates();
    res.json(result);
  } catch (e: any) {
    log('ERROR', 'get_export_templates failed', { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

// ============================================================================
// Retrieval APIs
// ============================================================================

app.post('/api/search_files', async (req, res) => {
  try {
    const { projectPath, pattern, recursive = true } = req.body;
    const result = await searchFiles(projectPath, pattern, recursive);
    res.json(result);
  } catch (e: any) {
    log('ERROR', 'search_files failed', { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/search_code', async (req, res) => {
  try {
    const { projectPath, pattern, filePattern = '*.gd' } = req.body;
    const result = await searchCode(projectPath, pattern, filePattern);
    res.json(result);
  } catch (e: any) {
    log('ERROR', 'search_code failed', { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/search_assets', async (req, res) => {
  try {
    const { projectPath, pattern } = req.body;
    const result = await searchAssets(projectPath, pattern);
    res.json(result);
  } catch (e: any) {
    log('ERROR', 'search_assets failed', { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/search_nodes', async (req, res) => {
  try {
    const { projectPath, pattern } = req.body;
    const result = await searchNodes(projectPath, pattern);
    res.json(result);
  } catch (e: any) {
    log('ERROR', 'search_nodes failed', { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/find_script_by_class', async (req, res) => {
  try {
    const { projectPath, className } = req.body;
    const result = await findScriptByClass(projectPath, className);
    res.json(result);
  } catch (e: any) {
    log('ERROR', 'find_script_by_class failed', { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

// ============================================================================
// Debug APIs
// ============================================================================

app.post('/api/attach_debugger', async (req, res) => {
  try {
    const { projectPath } = req.body;
    const result = await attachDebugger(projectPath);
    res.json(result);
  } catch (e: any) {
    log('ERROR', 'attach_debugger failed', { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/runtime_vars', async (req, res) => {
  try {
    const result = await getRuntimeVars();
    res.json(result);
  } catch (e: any) {
    log('ERROR', 'get_runtime_vars failed', { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/stack_trace', async (req, res) => {
  try {
    const result = await getStackTrace();
    res.json(result);
  } catch (e: any) {
    log('ERROR', 'get_stack_trace failed', { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/evaluate', async (req, res) => {
  try {
    const { expression } = req.body;
    const result = await evaluateExpr(expression);
    res.json(result);
  } catch (e: any) {
    log('ERROR', 'evaluate_expr failed', { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

// ============================================================================
// DAP Debug APIs (Real Debugger Integration)
// ============================================================================

app.post('/api/dap/start', async (req, res) => {
  try {
    const { projectPath, scene } = req.body;
    const result = await startDebugSession(projectPath, scene);
    res.json(result);
  } catch (e: any) {
    log('ERROR', 'dap_start failed', { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/dap/stop', async (req, res) => {
  try {
    const result = await stopDebugSession();
    res.json(result);
  } catch (e: any) {
    log('ERROR', 'dap_stop failed', { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/dap/initialize', async (req, res) => {
  try {
    const result = await dapInitialize();
    res.json(result);
  } catch (e: any) {
    log('ERROR', 'dap_initialize failed', { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/dap/launch', async (req, res) => {
  try {
    const { projectPath, noDebug } = req.body;
    const result = await dapLaunch(projectPath, noDebug);
    res.json(result);
  } catch (e: any) {
    log('ERROR', 'dap_launch failed', { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/dap/breakpoint', async (req, res) => {
  try {
    const { path, line, action = 'set' } = req.body;
    const result = action === 'clear' 
      ? await dapClearBreakpoint(path, line)
      : await dapSetBreakpoint(path, line);
    res.json(result);
  } catch (e: any) {
    log('ERROR', 'dap_breakpoint failed', { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/dap/continue', async (req, res) => {
  try {
    const result = await dapContinue();
    res.json(result);
  } catch (e: any) {
    log('ERROR', 'dap_continue failed', { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/dap/pause', async (req, res) => {
  try {
    const result = await dapPause();
    res.json(result);
  } catch (e: any) {
    log('ERROR', 'dap_pause failed', { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/dap/next', async (req, res) => {
  try {
    const result = await dapNext();
    res.json(result);
  } catch (e: any) {
    log('ERROR', 'dap_next failed', { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/dap/step_in', async (req, res) => {
  try {
    const result = await dapStepIn();
    res.json(result);
  } catch (e: any) {
    log('ERROR', 'dap_step_in failed', { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/dap/step_out', async (req, res) => {
  try {
    const result = await dapStepOut();
    res.json(result);
  } catch (e: any) {
    log('ERROR', 'dap_step_out failed', { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/dap/stack_trace', async (req, res) => {
  try {
    const result = await dapStackTrace();
    res.json(result);
  } catch (e: any) {
    log('ERROR', 'dap_stack_trace failed', { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/dap/variables', async (req, res) => {
  try {
    const { ref } = req.query;
    const result = await dapVariables(parseInt(ref as string) || 0);
    res.json(result);
  } catch (e: any) {
    log('ERROR', 'dap_variables failed', { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/dap/evaluate', async (req, res) => {
  try {
    const { expression, frameId } = req.body;
    const result = await dapEvaluate(expression, frameId);
    res.json(result);
  } catch (e: any) {
    log('ERROR', 'dap_evaluate failed', { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/dap/threads', async (req, res) => {
  try {
    const result = await dapThreads();
    res.json(result);
  } catch (e: any) {
    log('ERROR', 'dap_threads failed', { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/dap/disconnect', async (req, res) => {
  try {
    const result = await dapDisconnect();
    res.json(result);
  } catch (e: any) {
    log('ERROR', 'dap_disconnect failed', { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/dap/status', async (req, res) => {
  res.json({
    connected: dapIsConnected(),
    output: dapGetOutput()
  });
});

app.get('/api/perf_profile', async (req, res) => {
  try {
    const result = await getPerfProfile();
    res.json(result);
  } catch (e: any) {
    log('ERROR', 'get_perf_profile failed', { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/memory_info', async (req, res) => {
  try {
    const result = await getMemoryInfo();
    res.json(result);
  } catch (e: any) {
    log('ERROR', 'get_memory_info failed', { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/console_input', async (req, res) => {
  try {
    const { command } = req.body;
    const result = await consoleInput(command);
    res.json(result);
  } catch (e: any) {
    log('ERROR', 'console_input failed', { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

// ============================================================================
// Editor APIs
// ============================================================================

app.post('/api/launch_editor', async (req, res) => {
  try {
    const { projectPath } = req.body;
    const result = await launchEditor(projectPath);
    res.json(result);
  } catch (e: any) {
    log('ERROR', 'launch_editor failed', { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/create_scene', async (req, res) => {
  try {
    const { projectPath, scenePath, rootNodeType } = req.body;
    const result = await createScene(projectPath, scenePath, rootNodeType);
    res.json(result);
  } catch (e: any) {
    log('ERROR', 'create_scene failed', { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

// ============================================================================
// Project APIs
// ============================================================================

app.get('/api/projects', async (req, res) => {
  try {
    const { directory } = req.query;
    const result = await listProjects(directory as string || CONFIG.projectsDir);
    res.json(result);
  } catch (e: any) {
    log('ERROR', 'list_projects failed', { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/project_info', async (req, res) => {
  try {
    const { projectPath } = req.query;
    const result = await getProjectInfo(projectPath as string);
    res.json(result);
  } catch (e: any) {
    log('ERROR', 'get_project_info failed', { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/export_mesh_library', async (req, res) => {
  try {
    const { projectPath, scenePaths, outputPath } = req.body;
    const result = await exportMeshLibrary(projectPath, scenePaths, outputPath);
    res.json(result);
  } catch (e: any) {
    log('ERROR', 'export_mesh_library failed', { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

// ============================================================================
// Server Start
// ============================================================================

app.listen(CONFIG.port, () => {
  log('INFO', `OpenClaw Godot MCP Server starting on port ${CONFIG.port}`);
  log('INFO', `Godot path: ${CONFIG.godotPath}`);
  log('INFO', `Projects directory: ${CONFIG.projectsDir}`);
});

export default app;
