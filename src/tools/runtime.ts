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
