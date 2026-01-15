# Live Stream 请求处理流程

## 概述

当前端请求 `${BASE_PATH}/live?src=${camera.identifier}` 时，这个请求会经过多个层次的处理，最终由 **go2rtc** 服务提供 WebRTC/MSE/HLS 等流媒体服务。

## 完整的请求处理流程

### 1. 前端发起请求

**文件**: `frontend/src/pages/Live.tsx` (第 777 行)

```typescript
<LivePlayer
  playerRef={safePlayerRef}
  camera={camera}
  src={`${BASE_PATH}/live?src=${camera.identifier}`}
  // ...
/>
```

- `BASE_PATH` 通常为空字符串或配置的子路径
- `camera.identifier` 是摄像头的唯一标识符
- 最终构造的 URL 类似: `/live?src=camera_front_door`

### 2. LivePlayer 组件处理

**文件**: `frontend/src/components/player/liveplayer/LivePlayer.tsx` (第 363 行)

```typescript
useEffect(() => {
  if (elementRef.current) {
    elementRef.current.src = src;  // 设置 video-stream 元素的 src
    elementRef.current.controls = false;
  }
}, [elementRef, src]);
```

LivePlayer 使用自定义的 `<video-stream>` Web Component。

### 3. VideoRTC 转换为 WebSocket URL

**文件**: `frontend/src/components/player/liveplayer/video-rtc.js` (第 149-160 行)

```javascript
set src(value) {
  if (typeof value !== "string") value = value.toString();

  // HTTP URL 转换为 WebSocket URL
  if (value.startsWith("http")) {
    value = `ws${value.substring(4)}`;  // http:// -> ws://
  } else if (value.startsWith("/")) {
    // 相对路径转换为完整的 WebSocket URL
    value = `ws${location.origin.substring(4)}${value}`;
    // 例如: /live?src=camera_id -> ws://localhost:8888/live?src=camera_id
  }

  this.wsURL = value;
  this.onconnect();  // 建立 WebSocket 连接
}
```

**转换示例**:
- 输入: `/live?src=camera_front_door`
- 输出: `ws://localhost:8888/live?src=camera_front_door`

### 4. Nginx 代理层处理

**文件**: `rootfs/usr/local/nginx/conf/nginx.conf` (第 81-87 行)

```nginx
location /live {
    set $auth_token $arg_access_token;
    set $camera_identifier $arg_src;
    auth_request /auth/camera_access_token;  # 认证检查
    proxy_pass http://go2rtc/api/ws;         # 代理到 go2rtc
    include proxy.conf;
}
```

**处理步骤**:

1. **提取参数**:
   - `$arg_access_token`: 从 URL 参数中提取访问令牌（如果有）
   - `$arg_src`: 从 URL 参数中提取摄像头标识符

2. **认证检查** (`auth_request /auth/camera_access_token`):
   - 发送内部请求到 Viseron 后端验证用户权限
   - 请求路径: `/api/v1/auth/request/camera_access_token/{camera_identifier}?access_token={token}`
   - 如果认证失败，返回 401/403 错误

3. **代理转发**:
   - 将请求代理到 `http://localhost:1984/api/ws`
   - go2rtc 的 WebSocket API 端点

**Nginx upstream 配置** (第 51-53 行):
```nginx
upstream go2rtc {
    server localhost:1984;
}
```

### 5. go2rtc 处理 WebSocket 连接

**go2rtc** 是一个独立的流媒体服务器，运行在 `localhost:1984`。

**文件**: `viseron/components/go2rtc/__init__.py`

```python
class Go2RTC:
    def configured_cameras(self) -> list[str]:
        """返回配置的摄像头列表"""
        response = requests.get("http://localhost:1984/api/streams", timeout=5)
        cameras = response.json()
        return list(cameras)
```

**go2rtc 的职责**:

1. **接收 WebSocket 连接**: `/api/ws?src={camera_identifier}`
2. **协商流媒体协议**:
   - WebRTC (优先)
   - MSE (Media Source Extensions)
   - HLS (HTTP Live Streaming)
   - MJPEG (降级方案)
3. **从摄像头源获取流**: 根据配置读取 RTSP/RTMP/其他协议的视频流
4. **转码和传输**: 将视频流转换为浏览器支持的格式并通过 WebSocket 传输

### 6. 前端接收和播放

**文件**: `frontend/src/components/player/liveplayer/video-rtc.js`

VideoRTC 类支持多种播放模式（按优先级）:

1. **WebRTC** (第 560-634 行):
   ```javascript
   onwebrtc() {
     const pc = new RTCPeerConnection(this.pcConfig);
     // 建立 P2P 连接
     // 交换 ICE candidates
     // 接收媒体流
   }
   ```

2. **MSE** (Media Source Extensions) (第 449-558 行):
   ```javascript
   onmse() {
     const ms = new MediaSource();
     // 接收二进制数据
     // 通过 SourceBuffer 追加到 video 元素
   }
   ```

3. **HLS** (第 715-729 行):
   ```javascript
   onhls() {
     // 接收 m3u8 播放列表
     // 设置 video.src
   }
   ```

4. **MJPEG** (第 706-713 行):
   ```javascript
   onmjpeg() {
     // 接收 JPEG 帧
     // 更新 video.poster
   }
   ```

## 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                         前端 (浏览器)                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │  Live.tsx    │───▶│ LivePlayer   │───▶│ VideoRTC     │      │
│  │              │    │              │    │ (video-stream)│      │
│  └──────────────┘    └──────────────┘    └──────┬───────┘      │
└────────────────────────────────────────────────│────────────────┘
                                                  │ WebSocket
                                                  │ ws://host:8888/live?src=camera_id
                                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Nginx (端口 8888)                            │
│  ┌──────────────────────────────────────────────────────┐       │
│  │  location /live {                                    │       │
│  │    auth_request /auth/camera_access_token;  ◀────┐   │       │
│  │    proxy_pass http://go2rtc/api/ws;               │   │       │
│  │  }                                                │   │       │
│  └───────────────────────────────────┬───────────────┘   │       │
│                                      │                   │       │
│                                      │ 认证请求            │       │
│  ┌───────────────────────────────────▼───────────────┐   │       │
│  │  location = /auth/camera_access_token {           │   │       │
│  │    proxy_pass http://viseron/api/v1/auth/...;     │   │       │
│  │  }                                                 │   │       │
│  └────────────────────────────────────────────────────┘   │       │
└────────────────┬────────────────────────────┬──────────────┘
                 │                            │
                 │ 代理到 go2rtc               │ 认证请求
                 ▼                            ▼
┌─────────────────────────────┐  ┌──────────────────────────────┐
│   go2rtc (端口 1984)         │  │  Viseron Backend (端口 9999)  │
│  ┌────────────────────────┐ │  │  ┌────────────────────────┐  │
│  │  /api/ws               │ │  │  │  /api/v1/auth/request  │  │
│  │  - WebRTC 信令         │ │  │  │  - 验证访问令牌         │  │
│  │  - MSE 数据传输        │ │  │  │  - 检查摄像头权限       │  │
│  │  - HLS 播放列表        │ │  │  └────────────────────────┘  │
│  │  - MJPEG 帧           │ │  │                               │
│  └────────┬───────────────┘ │  └───────────────────────────────┘
│           │                 │
│           │ 从摄像头获取流    │
│           ▼                 │
│  ┌────────────────────────┐ │
│  │  RTSP/RTMP/其他源      │ │
│  │  (实际摄像头)          │ │
│  └────────────────────────┘ │
└─────────────────────────────┘
```

## 关键组件说明

### 1. Nginx (端口 8888)
- **作用**: 反向代理和路由
- **认证**: 在代理到 go2rtc 之前验证用户权限
- **配置文件**: `rootfs/usr/local/nginx/conf/nginx.conf`

### 2. Viseron Backend (端口 9999)
- **作用**:
  - 用户认证和授权
  - 摄像头配置管理
  - 录像和事件处理
- **框架**: Tornado (Python)
- **主文件**: `viseron/components/webserver/__init__.py`

### 3. go2rtc (端口 1984)
- **作用**: 流媒体服务器
- **支持协议**:
  - 输入: RTSP, RTMP, HTTP, 等
  - 输出: WebRTC, MSE, HLS, MJPEG
- **配置**: 由 Viseron 动态生成
- **管理**: `viseron/components/go2rtc/__init__.py`

### 4. VideoRTC (前端)
- **作用**: Web Component，处理多种流媒体协议
- **来源**: 基于 go2rtc 的示例实现
- **文件**: `frontend/src/components/player/liveplayer/video-rtc.js`

## 认证流程

```
1. 前端发起 WebSocket 连接: ws://host:8888/live?src=camera_id&access_token=xxx

2. Nginx 拦截请求:
   - 提取 $arg_src = camera_id
   - 提取 $arg_access_token = xxx

3. Nginx 发送内部认证请求:
   GET http://viseron:9999/api/v1/auth/request/camera_access_token/camera_id?access_token=xxx

4. Viseron Backend 验证:
   - 检查 access_token 是否有效
   - 检查用户是否有访问 camera_id 的权限
   - 返回 200 (允许) 或 401/403 (拒绝)

5. 如果认证成功:
   - Nginx 将 WebSocket 连接代理到 go2rtc
   - go2rtc 开始推送视频流

6. 如果认证失败:
   - Nginx 返回 401/403 错误
   - 前端显示错误信息
```

## 数据流

```
摄像头 (RTSP/RTMP)
    │
    ▼
go2rtc (转码/转发)
    │
    ▼ WebSocket (二进制数据)
Nginx (代理)
    │
    ▼ WebSocket
浏览器 (VideoRTC)
    │
    ▼ 解码
<video> 元素 (播放)
```

## 相关文件索引

### 前端
- `frontend/src/pages/Live.tsx` - Live 页面主组件
- `frontend/src/components/player/liveplayer/LivePlayer.tsx` - 播放器组件
- `frontend/src/components/player/liveplayer/video-rtc.js` - WebRTC/MSE 处理
- `frontend/src/components/player/liveplayer/video-stream.ts` - VideoRTC 包装器

### 后端
- `viseron/components/webserver/__init__.py` - Webserver 主组件
- `viseron/components/webserver/api/v1/auth.py` - 认证 API
- `viseron/components/go2rtc/__init__.py` - go2rtc 管理

### 配置
- `rootfs/usr/local/nginx/conf/nginx.conf` - Nginx 配置
- `rootfs/usr/local/nginx/conf/proxy.conf` - 代理配置
- `config/go2rtc.yaml` - go2rtc 配置（动态生成）

## 总结

`/live?src={camera_identifier}` 请求的处理流程：

1. **前端**: 构造 WebSocket URL
2. **Nginx**: 认证并代理到 go2rtc
3. **Viseron**: 验证用户权限
4. **go2rtc**: 提供流媒体服务
5. **前端**: 接收并播放视频流

这个架构的优势：
- **解耦**: 流媒体服务与业务逻辑分离
- **安全**: 通过 Nginx 统一认证
- **灵活**: 支持多种流媒体协议
- **高效**: go2rtc 专门优化流媒体传输
