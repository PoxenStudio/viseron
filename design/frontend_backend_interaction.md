# Viseron 前后端交互实现总结

## 1. 概述

Viseron是一个NVR（网络视频录像机）系统，采用前后端分离架构：
- **后端**: Python (Tornado框架)
- **前端**: React + TypeScript
- **通信方式**: RESTful API + WebSocket

## 2. 主要接口分类

### 2.1 RESTful API接口

后端API基于 Tornado Web 框架实现，所有API路由定义在 `viseron/components/webserver/api/v1/` 目录下。

#### 2.1.1 Camera API (`camera.py`)

**接口列表**:

1. **GET `/api/v1/camera/{camera_identifier}/snapshot`**
   - 功能: 获取摄像头截图
   - 认证: 需要camera token（通过URL参数或Header）
   - 参数:
     - `width` (可选): 截图宽度
     - `height` (可选): 截图高度
     - `rand` (可选): 随机参数，防止缓存
   - 返回: JPEG图像（Content-Type: image/jpeg）
   - 实现方式:
     - 如果配置了`still_image`，从摄像头URL获取截图
     - 否则从内存中的`current_frame`获取
     - 支持调整尺寸和缓存最后一张正常截图

2. **GET `/api/v1/camera/{camera_identifier}`**
   - 功能: 获取摄像头详细信息
   - 返回: Camera对象的JSON表示

3. **POST `/api/v1/camera/{camera_identifier}/start`**
   - 功能: 启动摄像头

4. **POST `/api/v1/camera/{camera_identifier}/stop`**
   - 功能: 停止摄像头

5. **POST `/api/v1/camera/{camera_identifier}/manual_recording`**
   - 功能: 手动开始/停止录像
   - Body参数:
     - `action`: "start" 或 "stop"
     - `duration` (可选): 录制时长（秒）

#### 2.1.2 Events API (`events.py`)

**接口列表**:

1. **GET `/api/v1/events/{camera_identifier}`**
   - 功能: 获取事件列表
   - 参数:
     - `time_from`, `time_to`: 时间范围（Unix时间戳）
     - 或 `date`: 日期（YYYY-MM-DD格式）
   - 返回: 包含motion、object、face_recognition、license_plate_recognition等事件
   - 事件数据包含`snapshot_path`字段指向截图文件

2. **GET `/api/v1/events/{camera_identifier}/amount`**
   - 功能: 获取每日事件数量统计

3. **POST `/api/v1/events/amount`**
   - 功能: 获取多个摄像头的事件数量
   - Body: `camera_identifiers` 数组

4. **POST `/api/v1/events/dates_of_interest`**
   - 功能: 获取有事件和录像的日期列表
   - Body: `camera_identifiers` 数组

#### 2.1.3 HLS API (`hls.py`)

**接口列表**:

1. **GET `/api/v1/hls/{camera_identifier}/recording/{recording_id}/playlist.m3u8`**
   - 功能: 获取录像的HLS播放列表

2. **GET `/api/v1/hls/{camera_identifier}/playlist.m3u8`**
   - 功能: 获取时间段的HLS播放列表
   - 参数:
     - `start_timestamp`: 开始时间
     - `end_timestamp`: 结束时间（可选）
     - `date`: 日期（可选）
     - `hls_client_id`: 客户端ID（用于跟踪播放进度）

3. **GET `/api/v1/hls/{camera_identifier}/timespans`**
   - 功能: 获取可用的时间段列表

#### 2.1.4 其他API

- **Auth API** (`auth.py`): 用户认证、token刷新
- **Cameras API** (`cameras.py`): 获取所有摄像头列表
- **Download API** (`download.py`): 文件下载（录像、截图导出）
- **Recordings API** (`recordings.py`): 录像管理
- **System API** (`system.py`): 系统信息
- **Tuning API** (`tune.py`): 摄像头调优配置

### 2.2 WebSocket API

WebSocket连接地址: `ws(s)://{host}{BASE_PATH}/websocket`

#### 2.2.1 连接建立流程

1. 客户端建立WebSocket连接
2. 服务器发送 `auth_required` 消息
3. 客户端发送认证信息（JWT token）
4. 服务器验证后发送 `auth_ok` 和系统信息
5. 连接建立成功，开始双向通信

**核心代码位置**:
- 前端: `frontend/src/lib/websockets.ts`
- 后端: `viseron/components/webserver/websocket_api/`

#### 2.2.2 WebSocket命令类型

**订阅类命令**:

1. **subscribe_event**
   - 订阅特定事件
   - 参数:
     - `event`: 事件名称（支持通配符）
     - `debounce`: 防抖时间（可选）
   - 示例: `camera_identifier/camera_event/*/*`

2. **subscribe_states**
   - 订阅实体状态变化
   - 参数: `entity_id` 或 `entity_ids`

3. **subscribe_timespans**
   - 订阅摄像头可用时间段
   - 参数:
     - `camera_identifiers`: 摄像头ID数组
     - `date`: 日期（可选）
     - `debounce`: 防抖时间
   - 用途: 实时更新录像时间轴

**导出类命令**:

1. **export_recording**
   - 导出录像为MP4文件
   - 参数: `camera_identifier`, `recording_id`
   - 返回: 下载token

2. **export_snapshot**
   - 导出事件截图
   - 参数: `event_type`, `camera_identifier`, `snapshot_id`
   - 返回: 下载token

3. **export_timespan**
   - 导出时间段视频
   - 参数: `camera_identifier`, `start`, `end`
   - 返回: 下载token

**查询类命令**:

- `get_cameras`: 获取所有摄像头
- `get_entities`: 获取所有实体
- `get_config`: 获取配置（需要管理员权限）

**管理类命令**:

- `save_config`: 保存配置（需要管理员权限）
- `restart_viseron`: 重启系统（需要管理员权限）

#### 2.2.3 消息格式

**请求消息**:
```json
{
  "type": "subscribe_event",
  "command_id": 1,
  "event": "camera_1/camera_event/*/*"
}
```

**响应消息**:
```json
{
  "type": "result",
  "command_id": 1,
  "success": true,
  "result": { ... }
}
```

**订阅推送**:
```json
{
  "type": "subscription_result",
  "command_id": 1,
  "result": {
    "event_type": "object_detected",
    "data": { ... }
  }
}
```

## 3. 数据传输方式

### 3.1 Camera截图传输

**获取方式**:

1. **实时截图** (通过REST API):
   - 路径: `/api/v1/camera/{camera_identifier}/snapshot`
   - 前端定期轮询（默认10s间隔）
   - 支持尺寸调整参数
   - 返回JPEG格式二进制数据

2. **事件截图** (通过文件路径):
   - 事件数据包含 `snapshot_path` 字段
   - 格式: `/api/v1/files{absolute_path}`
   - 前端直接使用`<img>`标签加载

**缓存机制**:
- 后端缓存: `CameraAPIHandler.camera_snapshots`字典
- 前端: 通过`rand`参数避免浏览器缓存

### 3.2 检测Object数据传输

**数据流**:

1. **事件创建**:
   - 后端检测到对象后，在数据库中创建Object记录
   - 保存检测信息: label, confidence, bounding_box等
   - 保存截图到文件系统

2. **事件推送** (通过WebSocket):
   - 后端触发事件: `{camera_identifier}/camera_event/object/*`
   - 前端订阅此事件，实时接收

3. **事件查询** (通过REST API):
   - 接口: `GET /api/v1/events/{camera_identifier}`
   - 返回完整的事件列表，包括检测数据

**Object事件数据结构**:
```typescript
{
  id: number,
  type: "object",
  label: string,              // 对象标签（如"person", "car"）
  confidence: number,         // 置信度 (0-1)
  snapshot_path: string,      // 截图路径
  created_at_timestamp: number,
  camera_identifier: string
}
```

### 3.3 视频流传输

**HLS (HTTP Live Streaming)**:

1. **M3U8播放列表**:
   - 后端生成M3U8文件，列出所有视频片段（fragments）
   - 片段为fMP4格式，存储在数据库中

2. **视频片段**:
   - 通过 `/api/v1/files{path}` 提供片段文件
   - 前端使用HLS.js播放器解析和播放

3. **实时更新**:
   - 通过WebSocket的`subscribe_timespans`订阅
   - 有新片段时推送更新，前端刷新播放列表

## 4. 前端绘制检测结果

### 4.1 绘制场景

1. **调优页面** (`components/tuning/`):
   - 绘制检测区域（zones）
   - 绘制掩码（masks）
   - 绘制OSD文本
   - 支持拖拽调整

2. **事件展示** (`components/events/`):
   - 显示检测事件的截图
   - 图标显示事件类型（motion、object等）
   - 不绘制检测框（直接显示带检测框的截图）

### 4.2 绘制技术

**使用SVG Overlay**:

```typescript
// 文件: frontend/src/components/tuning/TuneOverlay.tsx
<svg
  style={{ position: "absolute", top: 0, left: 0 }}
  viewBox={`0 0 ${imageWidth} ${imageHeight}`}
  preserveAspectRatio="xMidYMid meet"
>
  {/* 绘制zones, masks, osd_texts */}
</svg>
```

**绘制步骤**:

1. **获取配置数据**:
   - 从componentData中获取zones、masks等配置
   - 坐标都是相对于图像尺寸的像素值

2. **SVG坐标系统**:
   - viewBox设置为图像实际尺寸
   - `preserveAspectRatio="xMidYMid meet"` 确保比例正确
   - SVG自动缩放到容器大小

3. **绘制polygon**:
```typescript
<polygon
  points={coordinates.map((c) => `${c.x},${c.y}`).join(" ")}
  fill="rgba(0,255,0,0.2)"
  stroke="green"
  strokeWidth="2"
/>
```

4. **交互功能**:
   - 拖拽点: 监听`mousedown`、`mousemove`、`mouseup`事件
   - 拖拽整个polygon: 计算offset并更新所有点
   - 通过回调函数`onPointDrag`、`onPolygonDrag`更新状态

### 4.3 绘制配置数据

检测配置通过WebSocket或REST API获取，包含：

```typescript
{
  zones: [
    {
      coordinates: [
        { x: 100, y: 100 },
        { x: 200, y: 100 },
        { x: 200, y: 200 },
        { x: 100, y: 200 }
      ]
    }
  ],
  mask: [...],
  osd_texts: [
    {
      text: "Camera 1",
      x: 10,
      y: 10,
      font_size: 20,
      font_color: [255, 255, 255]
    }
  ]
}
```

## 5. 长连接机制

### 5.1 WebSocket长连接

**连接管理**:

1. **自动重连**:
   - 连接断开后5秒自动重连
   - 重连时重新订阅所有subscription
   - 代码位置: `frontend/src/lib/websockets.ts`

2. **心跳机制**:
   - 每30秒发送ping消息
   - 保持连接活跃

3. **认证刷新**:
   - Token过期时自动刷新
   - 重新建立WebSocket连接

**订阅恢复**:
```typescript
// 连接断开时保存订阅
this.oldSubscriptions = this.commands;

// 重连成功后恢复订阅
oldSubscriptions.forEach((subscription) => {
  if (subscription.subscribe) {
    subscription.subscribe().then((unsub) => {
      subscription.unsubscribe = unsub;
    });
  }
});
```

### 5.2 无WebSocket的替代方案

当WebSocket不可用时:
- 使用轮询方式定期调用REST API
- 事件通过定期查询 `/api/v1/events` 获取
- 实时性降低，但功能可用

## 6. 认证与授权

### 6.1 认证方式

**JWT Token**:
- Header + Payload 在Authorization header或URL参数中
- Signature 在secure cookie中
- 分离存储提高安全性

**Camera Token**:
- 特定摄像头的访问token
- 用于无需用户认证的场景（如外部访问截图）

### 6.2 权限级别

```python
Role.ADMIN   # 管理员：所有权限
Role.WRITE   # 写入：GET, POST, PUT, DELETE
Role.READ    # 只读：仅GET
```

## 7. 架构优势

1. **前后端分离**:
   - 前端可独立开发和部署
   - 后端API可被多个客户端使用

2. **实时性**:
   - WebSocket提供低延迟推送
   - 事件触发即时显示

3. **可扩展性**:
   - REST API易于扩展新功能
   - WebSocket订阅模式灵活

4. **性能优化**:
   - HLS流式传输视频
   - 截图缓存减少重复请求
   - 防抖机制减少不必要的更新

## 8. 文件路径映射

```
后端文件路径           API路径
/path/to/snapshot.jpg  →  /api/v1/files/path/to/snapshot.jpg
```

静态文件通过专门的handler提供，支持Range请求用于视频流。

## 9. 总结

Viseron采用现代化的前后端架构：
- **RESTful API** 用于数据查询和操作
- **WebSocket** 用于实时事件推送和长时间操作
- **HLS** 用于视频流传输
- **SVG** 用于前端可视化绘制

这种架构提供了良好的实时性、可扩展性和用户体验。
