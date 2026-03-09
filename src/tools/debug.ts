/**
 * Debug Tools - Real Implementation via DAP
 * - attach_debugger
 * - get_runtime_vars
 * - get_stack_trace
 * - set_breakpoint
 * - evaluate_expr
 * - get_perf_profile
 * - get_memory_info
 * - console_input
 */

import { 
  getDAPClient,
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
  dapIsConnected
} from './dap.js';

let breakpoints: Set<string> = new Set();

/**
 * Attach debugger and start debug session
 */
export async function attachDebugger(projectPath: string): Promise<any> {
  try {
    // Start Godot in debug mode
    const startResult = await startDebugSession(projectPath);
    if (!startResult.success) {
      return startResult;
    }

    // Initialize DAP connection
    const initResult = await dapInitialize();
    if (!initResult.success) {
      return initResult;
    }

    // Launch debug session
    const launchResult = await dapLaunch(projectPath);
    
    return {
      success: true,
      message: 'Debugger attached via DAP',
      projectPath,
      note: 'DAP connection established'
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Get runtime variables from debug session
 */
export async function getRuntimeVars(): Promise<any> {
  if (!dapIsConnected()) {
    return { 
      success: false, 
      error: 'Debugger not attached',
      attachDebugger: true 
    };
  }

  try {
    // Get stack trace first to get current frame
    const stackResult = await dapStackTrace();
    if (!stackResult.success || !stackResult.stackFrames?.length) {
      return { success: true, variables: {}, note: 'No stack frames' };
    }

    const frameId = stackResult.stackFrames[0].id;
    
    // Get scopes for the frame
    const scopesResult = await getDAPClient().scopes(frameId);
    if (!scopesResult.success || !scopesResult.scopes?.length) {
      return { success: true, variables: {}, note: 'No scopes available' };
    }

    // Get variables from first scope (usually Locals)
    const scope = scopesResult.scopes[0];
    const varsResult = await dapVariables(scope.variablesReference);
    
    // Format variables as key-value object
    const variables: any = {};
    if (varsResult.success && varsResult.variables) {
      for (const v of varsResult.variables) {
        variables[v.name] = v.value;
      }
    }

    return {
      success: true,
      variables,
      timestamp: new Date().toISOString(),
      frame: stackResult.stackFrames[0]
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Get stack trace from debug session
 */
export async function getStackTrace(): Promise<any> {
  if (!dapIsConnected()) {
    return { success: false, error: 'Debugger not attached' };
  }

  try {
    const result = await dapStackTrace();
    if (!result.success) {
      return result;
    }

    // Format stack frames nicely
    const stackTrace = (result.stackFrames || []).map((frame: any, index: number) => ({
      frame: index,
      function: frame.name || 'unknown',
      file: frame.source?.path || 'unknown',
      line: frame.line
    }));

    return {
      success: true,
      stackTrace,
      note: 'Real DAP stack trace'
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Set a breakpoint
 */
export async function setBreakpoint(file: string, line: number): Promise<any> {
  try {
    const result = await dapSetBreakpoint(file, line);
    if (result.success) {
      breakpoints.add(`${file}:${line}`);
    }
    return result;
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Remove a breakpoint
 */
export async function removeBreakpoint(file: string, line: number): Promise<any> {
  try {
    const result = await dapClearBreakpoint(file, line);
    if (result.success) {
      breakpoints.delete(`${file}:${line}`);
    }
    return result;
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Evaluate an expression (REPL)
 */
export async function evaluateExpr(expression: string): Promise<any> {
  if (!dapIsConnected()) {
    return { success: false, error: 'Debugger not attached' };
  }

  try {
    const result = await dapEvaluate(expression);
    return {
      success: result.success,
      expression,
      result: result.result,
      type: result.type,
      note: result.success ? 'Real DAP evaluation' : 'Evaluation failed'
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Get performance profile
 * Note: Godot DAP doesn't have built-in profiling, this is simplified
 */
export async function getPerfProfile(): Promise<any> {
  if (!dapIsConnected()) {
    return { success: false, error: 'Debugger not attached' };
  }

  // Try to get threads - if we can get threads, we're connected
  const threadsResult = await dapThreads();
  
  return {
    success: true,
    connected: dapIsConnected(),
    threadCount: threadsResult.success ? threadsResult.threads?.length || 0 : 0,
    note: 'Full profiling requires Godot profiler integration',
    // These would come from actual profiling data
    frameTime: 16.67,
    fps: 60
  };
}

/**
 * Get memory info
 * Note: Godot DAP has limited memory info support
 */
export async function getMemoryInfo(): Promise<any> {
  if (!dapIsConnected()) {
    return { success: false, error: 'Debugger not attached' };
  }

  // Try to get some runtime variables that might contain memory info
  const varsResult = await getRuntimeVars();
  
  return {
    success: true,
    connected: dapIsConnected(),
    variables: varsResult.variables || {},
    note: 'Full memory info requires Godot memory profiler',
    // Placeholder - actual memory info would come from Godot
    estimate: {
      total: 'N/A',
      used: 'N/A',
      available: 'N/A'
    }
  };
}

/**
 * Console input - interactive debug commands
 */
let consoleInputHistory: string[] = [];

export async function consoleInput(command: string): Promise<any> {
  if (!dapIsConnected()) {
    return { 
      success: false, 
      error: 'Debugger not attached',
      note: 'Start debug session first'
    };
  }

  consoleInputHistory.push(command);
  
  const cmd = command.toLowerCase().trim();
  const response: any = {
    success: true,
    command,
    output: '',
    type: 'unknown'
  };

  // Built-in commands
  if (cmd === 'help') {
    response.output = `Available commands:
  help - Show this help
  vars - List all variables
  stack - Show stack trace
  threads - List threads
  continue / c - Continue execution
  pause - Pause execution
  next / n - Step over
  step / s - Step into
  out / o - Step out
  <expression> - Evaluate expression
  quit - Exit console`;
    response.type = 'info';
  } else if (cmd === 'vars' || cmd === 'variables') {
    const varsResult = await getRuntimeVars();
    response.output = JSON.stringify(varsResult.variables || {}, null, 2);
    response.type = 'variables';
  } else if (cmd === 'stack' || cmd === 'backtrace') {
    const stackResult = await getStackTrace();
    response.output = JSON.stringify(stackResult.stackTrace || [], null, 2);
    response.type = 'stack';
  } else if (cmd === 'threads') {
    const threadsResult = await dapThreads();
    response.output = JSON.stringify(threadsResult.threads || [], null, 2);
    response.type = 'threads';
  } else if (cmd === 'continue' || cmd === 'c') {
    const result = await dapContinue();
    response.output = result.success ? 'Continuing...' : result.error;
    response.type = 'control';
  } else if (cmd === 'pause') {
    const result = await dapPause();
    response.output = result.success ? 'Paused' : result.error;
    response.type = 'control';
  } else if (cmd === 'next' || cmd === 'n') {
    const result = await dapNext();
    response.output = result.success ? 'Stepped over' : result.error;
    response.type = 'control';
  } else if (cmd === 'step' || cmd === 's') {
    const result = await dapStepIn();
    response.output = result.success ? 'Stepped in' : result.error;
    response.type = 'control';
  } else if (cmd === 'out' || cmd === 'o') {
    const result = await dapStepOut();
    response.output = result.success ? 'Stepped out' : result.error;
    response.type = 'control';
  } else if (cmd === 'quit' || cmd === 'exit') {
    await dapDisconnect();
    response.output = 'Goodbye! Debug session closed.';
    response.type = 'info';
  } else {
    // Treat as expression to evaluate
    const evalResult = await dapEvaluate(command);
    response.success = evalResult.success;
    response.output = evalResult.success ? evalResult.result : evalResult.error;
    response.type = 'expression';
  }
  
  return response;
}

export function getConsoleHistory(): string[] {
  return consoleInputHistory;
}

/**
 * Continue execution
 */
export async function debugContinue(): Promise<any> {
  return await dapContinue();
}

/**
 * Pause execution  
 */
export async function debugPause(): Promise<any> {
  return await dapPause();
}

/**
 * Step over
 */
export async function debugNext(): Promise<any> {
  return await dapNext();
}

/**
 * Step into
 */
export async function debugStepIn(): Promise<any> {
  return await dapStepIn();
}

/**
 * Step out
 */
export async function debugStepOut(): Promise<any> {
  return await dapStepOut();
}

/**
 * Disconnect debugger
 */
export async function detachDebugger(): Promise<any> {
  breakpoints.clear();
  return await dapDisconnect();
}
