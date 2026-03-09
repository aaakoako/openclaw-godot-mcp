# OpenClaw Godot MCP Server

一个专为 OpenClaw 设计的 Godot 引擎 MCP 服务器，支持远程内网操作。

## 功能特性

### Runtime (运行时控制)
- `run_project` - 运行项目
- `stop_project` - 停止项目
- `get_debug_output` - 获取调试输出

### Visual (视觉捕获)
- `capture_screenshot` - 截屏
- `capture_video` - 录屏

### Engine (引擎感知)
- `get_engine_info` - 获取引擎信息
- `get_project_settings` - 获取项目配置
- `get_available_classes` - 获取可用类
- `get_renderer_info` - 获取渲染器信息

### Retrieval (检索能力)
- `search_files` - 文件搜索
- `search_code` - 代码搜索
- `search_assets` - 资源搜索
- `search_nodes` - 节点搜索
- `find_script_by_class` - 按类名查找脚本

### Debug (运行时调试)
- `attach_debugger` - 附加调试器
- `get_runtime_vars` - 获取运行时变量
- `get_stack_trace` - 获取堆栈跟踪
- `set_breakpoint` - 设置断点
- `evaluate_expr` - 执行表达式
- `get_perf_profile` - 性能分析
- `get_memory_info` - 内存信息

### Editor (编辑器操作)
- `launch_editor` - 启动编辑器
- `create_scene` - 创建场景
- `add_node` - 添加节点
- `load_sprite` - 加载图片
- `save_scene` - 保存场景

### Project (项目管理)
- `list_projects` - 列出项目
- `get_project_info` - 获取项目信息
- `get_uid` - 获取 UID
- `update_project_uids` - 更新 UID

## 架构

```
┌─────────────────────────────────────────────────────┐
│                 OpenClaw (TinyPC)                    │
│                      HTTP                           │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│           内网 Godot MCP Server (VM)                │
│  ┌─────────────────────────────────────────────┐   │
│  │  REST API Endpoints                         │   │
│  │  - /api/run_project                        │   │
│  │  - /api/capture_screenshot                  │   │
│  │  - /api/search_code                         │   │
│  │  ...                                        │   │
│  └─────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────┐   │
│  │  Tool Implementations                        │   │
│  │  - runtime, visual, engine, retrieval       │   │
│  │  - debug, editor, project                   │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

## 安装

```bash
# 克隆项目
git clone <repo-url> godot-mcp-server
cd godot-mcp-server

# 安装依赖
npm install

# 构建
npm run build
```

## 配置

通过环境变量配置：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| PORT | 3000 | HTTP 服务器端口 |
| GODOT_PATH | G:\Godot-AI\Godot_v4.6.1-stable_win64.exe | Godot 路径 |
| PROJECTS_DIR | G:\Godot-AI | 项目目录 |
| SCREENSHOT_DIR | G:\Godot-AI\screenshots | 截图目录 |
| LOG_FILE | G:\Godot-AI\mcp-server.log | 日志文件 |

## 运行

```bash
# 开发模式
npm run dev

# 生产模式
npm start
```

## API 使用示例

### 运行项目
```bash
curl -X POST http://192.168.8.104:3000/api/run_project \
  -H "Content-Type: application/json" \
  -d '{"projectPath": "G:\\Godot-AI\\lianliankan"}'
```

### 截屏
```bash
curl -X POST http://192.168.8.104:3000/api/capture_screenshot \
  -H "Content-Type: application/json" \
  -d '{"projectPath": "G:\\Godot-AI\\lianliankan"}'
```

### 搜索代码
```bash
curl -X POST http://192.168.8.104:3000/api/search_code \
  -H "Content-Type: application/json" \
  -d '{"projectPath": "G:\\Godot-AI\\lianliankan", "pattern": "func _ready"}'
```

## OpenClaw 集成

在 OpenClaw 中通过 HTTP 调用：

```typescript
// 示例：运行 Godot 项目
await fetch('http://192.168.8.104:3000/api/run_project', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    projectPath: 'G:\\Godot-AI\\myproject'
  })
})
```

## 远程部署

```bash
# 在 VM 上
scp -r godot-mcp-server Administrator@192.168.8.104:G:/Godot-AI/

# SSH 进入 VM 并运行
ssh Administrator@192.168.8.104
cd G:\Godot-AI\godot-mcp-server
npm install
npm start
```

## 后续开发

- [ ] 完整 DAP (Debug Adapter Protocol) 集成
- [ ] WebSocket 实时调试
- [ ] 截屏 Base64 返回
- [ ] MCP 协议支持
- [ ] 项目模板生成

## 许可证

MIT
