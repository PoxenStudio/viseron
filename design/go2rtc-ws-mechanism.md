# Go2RTC WebSocket 连接与数据流机制深度解析

针对您提出的关于 Go2RTC 调用、配置以及 WebSocket 连接机制的问题，以下是基于代码的深度分析。

## 1. Go2RTC 如何被配置和调用

### 配置生成与启动
Viseron 并不直接调用 Go2RTC 的二进制接口来"通过参数"传输每一个摄像头，而是通过生成配置文件的方式。

- **代码位置**: `viseron/components/go2rtc/__init__.py`
- **流程**:
  1. Viseron 启动时读取自身的 `config.yaml`。
  2. 提取 `go2rtc` 组件的配置部分。
  3. 调用 `_create_config` 方法，将配置转储为 `/tmp/go2rtc.yaml`。
  4. Go2RTC 服务（作为独立进程或容器）启动时读取这个标准配置文件。
  5. Go2RTC 自动根据配置文件中的 `streams` 定义连接到摄像头的 RTSP/RTMP 源。

### WebSocket 接口暴露
Go2RTC 启动后会在内部开启一个 HTTP/WebSocket 服务（默认端口 1984）。
- **Nginx 代理**: Viseron 的 Nginx 配置将前端的 `ws://.../live` 请求代理到了 Go2RTC 的 `ws://localhost:1984/api/ws` 接口。

## 2. 为什么使用 WebSocket 连接？

前端使用 WebSocket (WS) 连接 Go2RTC 主要是为了**统一信令通道**和**低延迟数据传输**。

### 核心优势
1. **统一入口**: 无论最终使用 WebRTC、MSE 还是 MJPEG，浏览器都可以通过同一个 WS URL 发起连接。
2. **低延迟信令**: 建立 WebRTC 连接需要交换 SDP (Offer/Answer) 和 ICE Candidates。WS 提供了比 HTTP 轮询更高效的双向通信通道。
3. **穿透性与复用**: 对于 MSE 和 MJPEG，WS 允许在一个长连接上持续推送二进制流数据，避免了频繁创建 HTTP 请求的开销，且比 HTTP Chunked Transfer 更易于在现有 Web 基础设施中传输（如通过 Nginx 代理）。

## 3. 数据传输流程：是"切换地址"还是"按帧发送"？

这完全取决于前端与 Go2RTC 协商的**流媒体模式**。`video-rtc.js` 支持多种模式，它们的WS使用方式截然不同：

### 模式 A: WebRTC (主流/推荐)
**机制**: **先使用 WS 握手，再切换到 P2P/RTP 连接**。

1. **信令阶段 (WS)**:
   - 前端通过 WS 发送 `{type: "webrtc/offer", value: sdp}` (SDP 包含客户端支持的编码等信息)。
   - Go2RTC 通过 WS 回复 `{type: "webrtc/answer", value: sdp}`。
   - 双方通过 WS 交换 `{type: "webrtc/candidate"}` (网络路径信息)。
2. **连接切换**:
   - 一旦 WebRTC 的 `PeerConnection` 建立成功，视频流通过 **RTP 协议** (UDP 或 TCP) 直接传输。
   - **此时 WS 不再传输视频数据**，仅保持控制连接状态。
3. **代码证据** (`video-rtc.js`):
   ```javascript
   // onwebrtc()
   // 监听 WS 消息处理信令
   this.onmessage.webrtc = (msg) => { ... pc.setRemoteDescription(...) ... }
   // 视频数据来自 PeerConnection，不来自 WS
   video2.srcObject = new MediaStream(tracks);
   ```

### 模式 B: MSE (Media Source Extensions)
**机制**: **使用 WS 作为数据隧道，持续传输视频片段**。

1. **握手**: 前端通过 WS 发送支持的 Codec 信息 `{type: "mse", value: "..."}`。
2. **传输**: Go2RTC 开始通过 **同一个 WS 连接** 下发二进制数据（**fMP4 Segments**）。
3. **播放**: 前端收到 WS 的 binary data (`ondata`)，直接 append 到 `<video>` 标签的 `SourceBuffer` 中。
4. **代码证据** (`video-rtc.js`):
   ```javascript
   // onmse()
   // 动态绑定数据处理函数
   this.ondata = (data) => {
       sb.appendBuffer(data); // 将 WS 收到的二进制数据喂给播放器
   };
   ```

### 模式 C: MJPEG (降级/备用)
**机制**: **使用 WS 按帧发送图片**。

1. **命令**: 前端通过 WS 发送 `{type: "mjpeg"}`。
2. **传输**: Go2RTC 通过 WS 持续发送每一帧的 JPEG 二进制数据。
3. **播放**: 前端收到数据后，将其转换为 Base64 字符串，不断替换 `<video>` 标签的 `poster` 属性来实现"动图"效果。
4. **代码证据** (`video-rtc.js`):
   ```javascript
   // onmjpeg()
   this.ondata = (data) => {
       // 将每帧数据转为 base64 设置为封面图，视觉上就是视频
       this.video.poster = `data:image/jpeg;base64,${VideoRTC.btoa(data)}`;
   };
   ```

## 总结

- **Go2RTC** 通过 Viseron 生成的 YAML 文件配置。
- **WebSocket** 是所有流模式的初始握手通道。
- **WebRTC 模式**: WS 仅用于前期握手（几KB数据），之后**切换**到 RTP 传输视频。
- **MSE/MJPEG 模式**: WS 充当传输管道，视频数据流/帧序列**直接通过 WS 连接**持续发送到前端。

Viseron 的前端实现 (`LivePlayer`) 默认配置是优先尝试 WebRTC，不支持时降级到 MSE，最后是 MJPEG。这意味着在大多数现代浏览器中，WS 只短暂用于建立连接，随后流量会走 WebRTC 协议。
