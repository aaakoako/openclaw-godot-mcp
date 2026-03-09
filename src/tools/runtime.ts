/**
 * Runtime Tools
 * - run_project
 * - stop_project
 * - get_debug_output
 */

import { spawn, exec } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

let activeProcess: any = null;
let debugOutput = '';

const CONFIG = {
  godotPath: process.env.GODOT_PATH || 'G:\\Godot-AI\\Godot_v4.6.1-stable_win64.exe',
};

function execAsync(cmd: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    exec(`${cmd} ${args.join(' ')}`, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

export async function runProject(projectPath: string, scene?: string, headless = true): Promise<any> {
  if (activeProcess) {
    return { success: false, error: 'A project is already running. Stop it first.' };
  }

  if (!existsSync(projectPath)) {
    return { success: false, error: 'Project path does not exist' };
  }

  const args = ['--path', projectPath];
  if (headless) {
    args.push('--headless');
  }
  if (scene) {
    args.push('--scene', scene);
  }
  args.push('--quit-after', '300'); // Auto quit after 5 minutes

  debugOutput = '';
  activeProcess = spawn(CONFIG.godotPath, args, { 
    shell: true,
    cwd: projectPath 
  });

  activeProcess.stdout.on('data', (data: Buffer) => {
    debugOutput += data.toString();
  });

  activeProcess.stderr.on('data', (data: Buffer) => {
    debugOutput += '[ERROR] ' + data.toString();
  });

  activeProcess.on('close', (code: number) => {
    activeProcess = null;
  });

  return { success: true, pid: activeProcess.pid, message: 'Project started' };
}

export async function stopProject(): Promise<any> {
  if (!activeProcess) {
    return { success: false, error: 'No project is running' };
  }

  activeProcess.kill();
  activeProcess = null;
  
  return { success: true, message: 'Project stopped' };
}

export async function getDebugOutput(): Promise<any> {
  return {
    success: true,
    output: debugOutput,
    isRunning: activeProcess !== null
  };
}

export async function getEngineVersion(): Promise<string> {
  const result = await execAsync(CONFIG.godotPath, ['--version']);
  return result.stdout.trim();
}

/**
 * Execute a GDScript file and capture output
 * Usage: godot --script path/to/script.gd -- [arguments]
 */
export async function executeScript(
  scriptPath: string, 
  args: string[] = [],
  projectPath?: string
): Promise<any> {
  if (!existsSync(scriptPath)) {
    return { success: false, error: 'Script file does not exist' };
  }

  return new Promise((resolve) => {
    const cmdArgs = ['--script', scriptPath];
    
    // Add project path if provided
    if (projectPath) {
      if (!existsSync(projectPath)) {
        resolve({ success: false, error: 'Project path does not exist' });
        return;
      }
      cmdArgs.unshift('--path', projectPath);
    }
    
    // Add headless mode
    cmdArgs.push('--headless');
    
    // Add script arguments (after --)
    if (args.length > 0) {
      cmdArgs.push('--', ...args);
    }

    let stdout = '';
    let stderr = '';
    
    const proc = spawn(CONFIG.godotPath, cmdArgs, { 
      shell: true,
      cwd: projectPath || '.'
    });

    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('close', (code: number) => {
      resolve({
        success: code === 0,
        exitCode: code,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        script: scriptPath,
        args
      });
    });

    proc.on('error', (err: Error) => {
      resolve({
        success: false,
        error: err.message,
        script: scriptPath
      });
    });
  });
}

/**
 * Execute inline GDScript code by writing to a temp file first
 */
export async function executeCode(
  code: string,
  projectPath?: string
): Promise<any> {
  // Create a temporary script file
  const tmpDir = projectPath || '.';
  const tmpPath = join(tmpDir, '_temp_script.gd');
  
  try {
    // Write temp script
    const fs = await import('fs');
    fs.writeFileSync(tmpPath, code, 'utf-8');
    
    // Execute it
    const result = await executeScript(tmpPath, [], projectPath);
    
    // Cleanup temp file
    try {
      fs.unlinkSync(tmpPath);
    } catch (e) {
      // Ignore cleanup errors
    }
    
    return result;
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
