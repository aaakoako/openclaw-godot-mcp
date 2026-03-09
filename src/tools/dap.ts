/**
 * DAP (Debug Adapter Protocol) Client for Godot
 * 
 * Godot 4.x supports DAP for debugging.
 * This module provides a basic DAP client implementation.
 * 
 * Usage:
 *   Start Godot in debug mode: godot --headless --debug --debugger-fd 2
 */

import { spawn } from 'child_process';
import { existsSync } from 'fs';

const CONFIG = {
  godotPath: process.env.GODOT_PATH || 'G:\\Godot-AI\\Godot_v4.6.1-stable_win64.exe',
  dapPort: process.env.DAP_PORT || 6009,
};

interface DAPMessage {
  seq: number;
  type: 'request' | 'response' | 'event';
  command?: string;
  arguments?: any;
  success?: boolean;
  body?: any;
  message?: string;
  event?: string;
}

class DAPClient {
  private seq = 0;
  private process: any = null;
  private messageHandler: ((msg: DAPMessage) => void) | null = null;
  private pendingRequests = new Map<number, { resolve: Function; reject: Function }>();
  private connected = false;
  private output = '';
  private errorOutput = '';

  async startDebugServer(projectPath: string, scene?: string): Promise<any> {
    if (this.process) {
      return { success: false, error: 'Debugger already running' };
    }

    if (!existsSync(projectPath)) {
      return { success: false, error: 'Project path does not exist' };
    }

    const args = ['--path', projectPath, '--headless', '--debug', '--debugger-fd', '2'];
    if (scene) args.push('--scene', scene);

    return new Promise((resolve) => {
      this.output = '';
      this.errorOutput = '';
      
      this.process = spawn(CONFIG.godotPath, args, {
        shell: true,
        cwd: projectPath,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.process.stdout.on('data', (data: Buffer) => {
        this.output += data.toString();
        this.handleOutput(data.toString());
      });

      this.process.stderr.on('data', (data: Buffer) => {
        this.errorOutput += data.toString();
        this.handleOutput(data.toString());
      });

      this.process.on('close', (code: number) => {
        this.connected = false;
        this.process = null;
      });

      this.process.on('error', (err: Error) => {
        resolve({ success: false, error: err.message });
      });

      setTimeout(() => {
        this.connected = true;
        resolve({ success: true, message: 'Debug server started', projectPath });
      }, 1000);
    });
  }

  stop(): any {
    if (!this.process) {
      return { success: false, error: 'No debug session running' };
    }
    this.process.kill();
    this.process = null;
    this.connected = false;
    return { success: true, message: 'Debug server stopped' };
  }

  private handleOutput(data: string) {
    const lines = data.split('\n');
    for (const line of lines) {
      if (line.startsWith('Content-Length:')) continue;
      try {
        if (line.trim().startsWith('{')) {
          const msg = JSON.parse(line) as DAPMessage;
          this.handleMessage(msg);
        }
      } catch (e) {}
    }
  }

  private handleMessage(msg: DAPMessage) {
    if (msg.type === 'response') {
      const pending = this.pendingRequests.get(msg.seq);
      if (pending) {
        if (msg.success) pending.resolve(msg.body);
        else pending.reject(new Error(msg.message || 'Unknown error'));
        this.pendingRequests.delete(msg.seq);
      }
    } else if (msg.type === 'event' && this.messageHandler) {
      this.messageHandler(msg);
    }
  }

  private sendRequest(command: string, args?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.process) {
        reject(new Error('Not connected'));
        return;
      }

      const seq = ++this.seq;
      const msg: DAPMessage = { seq, type: 'request', command, arguments: args };
      const json = JSON.stringify(msg);
      const content = `Content-Length: ${json.length}\r\n\r\n${json}`;
      
      this.process.stdin.write(content, (err: Error) => {
        if (err) reject(err);
        else {
          this.pendingRequests.set(seq, { resolve, reject });
          setTimeout(() => {
            if (this.pendingRequests.has(seq)) {
              this.pendingRequests.delete(seq);
              reject(new Error('Request timeout'));
            }
          }, 30000);
        }
      });
    });
  }

  onMessage(handler: (msg: DAPMessage) => void) {
    this.messageHandler = handler;
  }

  async initialize(): Promise<any> {
    try {
      const result = await this.sendRequest('initialize', {
        adapterID: 'openclaw-godot-mcp',
        clientID: 'openclaw',
        linesStartAt1: true,
        columnsStartAt1: true
      });
      return { success: true, ...result };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  async launch(projectPath: string, noDebug = false): Promise<any> {
    try {
      const result = await this.sendRequest('launch', { noDebug, projectPath, request: 'launch' });
      return { success: true, ...result };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  async setBreakpoint(path: string, line: number): Promise<any> {
    try {
      const result = await this.sendRequest('setBreakpoints', { source: { path }, breakpoints: [{ line }] });
      return { success: true, breakpoints: result.breakpoints };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  async clearBreakpoint(path: string, line: number): Promise<any> {
    try {
      await this.sendRequest('setBreakpoints', { source: { path }, breakpoints: [] });
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  async continue(): Promise<any> {
    try {
      const result = await this.sendRequest('continue', { threadId: 1 });
      return { success: true, ...result };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  async pause(threadId = 1): Promise<any> {
    try {
      const result = await this.sendRequest('pause', { threadId });
      return { success: true, ...result };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  async next(threadId = 1): Promise<any> {
    try {
      const result = await this.sendRequest('next', { threadId });
      return { success: true, ...result };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  async stepIn(threadId = 1): Promise<any> {
    try {
      const result = await this.sendRequest('stepIn', { threadId });
      return { success: true, ...result };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  async stepOut(threadId = 1): Promise<any> {
    try {
      const result = await this.sendRequest('stepOut', { threadId });
      return { success: true, ...result };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  async stackTrace(threadId = 1): Promise<any> {
    try {
      const result = await this.sendRequest('stackTrace', { threadId });
      return { success: true, stackFrames: result.stackFrames };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  async scopes(frameId: number): Promise<any> {
    try {
      const result = await this.sendRequest('scopes', { frameId });
      return { success: true, scopes: result.scopes };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  async variables(variablesReference: number): Promise<any> {
    try {
      const result = await this.sendRequest('variables', { variablesReference });
      return { success: true, variables: result.variables };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  async evaluate(expression: string, frameId?: number): Promise<any> {
    try {
      const result = await this.sendRequest('evaluate', { expression, context: 'repl', frameId });
      return { success: true, result: result.result, type: result.type, variablesReference: result.variablesReference };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  async threads(): Promise<any> {
    try {
      const result = await this.sendRequest('threads');
      return { success: true, threads: result.threads };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  async disconnect(): Promise<any> {
    try {
      const result = await this.sendRequest('disconnect', { terminateDebuggee: true });
      this.connected = false;
      return { success: true, ...result };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  getOutput(): string { return this.output; }
  getErrorOutput(): string { return this.errorOutput; }
  isConnected(): boolean { return this.connected; }
}

let dapClient: DAPClient | null = null;

export function getDAPClient(): DAPClient {
  if (!dapClient) dapClient = new DAPClient();
  return dapClient;
}

export async function startDebugSession(projectPath: string, scene?: string): Promise<any> {
  return await getDAPClient().startDebugServer(projectPath, scene);
}

export async function stopDebugSession(): Promise<any> {
  return getDAPClient().stop();
}

export async function dapInitialize(): Promise<any> {
  return await getDAPClient().initialize();
}

export async function dapLaunch(projectPath: string, noDebug = false): Promise<any> {
  return await getDAPClient().launch(projectPath, noDebug);
}

export async function dapSetBreakpoint(path: string, line: number): Promise<any> {
  return await getDAPClient().setBreakpoint(path, line);
}

export async function dapClearBreakpoint(path: string, line: number): Promise<any> {
  return await getDAPClient().clearBreakpoint(path, line);
}

export async function dapContinue(): Promise<any> {
  return await getDAPClient().continue();
}

export async function dapPause(): Promise<any> {
  return await getDAPClient().pause();
}

export async function dapNext(): Promise<any> {
  return await getDAPClient().next();
}

export async function dapStepIn(): Promise<any> {
  return await getDAPClient().stepIn();
}

export async function dapStepOut(): Promise<any> {
  return await getDAPClient().stepOut();
}

export async function dapStackTrace(): Promise<any> {
  return await getDAPClient().stackTrace();
}

export async function dapVariables(ref: number): Promise<any> {
  return await getDAPClient().variables(ref);
}

export async function dapEvaluate(expr: string, frameId?: number): Promise<any> {
  return await getDAPClient().evaluate(expr, frameId);
}

export async function dapThreads(): Promise<any> {
  return await getDAPClient().threads();
}

export async function dapDisconnect(): Promise<any> {
  return await getDAPClient().disconnect();
}

export function dapGetOutput(): string { return getDAPClient().getOutput(); }
export function dapIsConnected(): boolean { return getDAPClient().isConnected(); }
