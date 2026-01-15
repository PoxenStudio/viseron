# Go2RTC 未配置时的系统行为

如果用户没有配置 Go2RTC（或配置错误），`live_stream_available()` 将返回 `False`。此时前端和后端会触发一系列降级（Fallback）机制，确保用户仍然可以看到实时画面（尽管延迟较高且帧率较低）。

## 1. 前端行为：智能回退

**文件**: `frontend/src/pages/Live.tsx` (第 713-790 行)

前端代码中有明确的逻辑检查：

```typescript
// 检查是否可以使用 Go2RTC 直播流
// state.mjpegPlayerMap 若未手动设置，默认为 false
mjpegPlayer: !camera.live_stream_available
  ? true
  : (state.mjpegPlayerMap[camera.identifier] ?? false),
```

- **逻辑**: 如果 `live_stream_available` 为 `false`，则强制将 `mjpegPlayer` 设置为 `true`。
- **结果**: 组件 `<LivePlayer>`（基于 WebSocket/Go2RTC）不会被渲染。取而代之的是渲染 `<MjpegPlayer>` 组件。

### MjpegPlayer 请求路径
```typescript
src={`${BASE_PATH}/${camera.identifier}/mjpeg-stream`}
```
这是一个标准的 HTTP MJPEG 流，不再使用 WebSocket。

## 2. 后端行为：MJPEG 流生成

**文件**: `viseron/components/webserver/stream_handler.py` (DynamicStreamHandler)

当请求打到 `/{camera}/mjpeg-stream` 时，Viseron 后端会接管处理。

- **数据源**: Viseron 内部已经为了 AI 检测（对象识别、运动检测）解码了视频流。
- **原理**:
  1. `StreamHandler` 订阅 Viseron 内部的 `DATA_PROCESSED_FRAME_TOPIC` 数据流。
  2. 获取经过 OpenCV 处理过的帧（包含画上去的边界框、区域掩码等）。
  3. 将每一帧重新编码为 JPEG 格式。
  4. 使用 `multipart/x-mixed-replace` 格式通过 HTTP 长连接发送给浏览器。

**区别**:
- 此流是**经过处理的**（Post-Process），通常包含 AI 检测框。
- 只有视频（一系列图片），**没有音频**。
- 消耗 Viseron 主进程的 CPU 资源进行 JPEG 编码。

## 3. 如果强行请求 /live 会怎样？

如果绕过前端逻辑，直接通过工具或浏览器访问 `/live?src=xxx`：

1. **Nginx 层**: Nginx 配置是静态的，它仍然会尝试将请求代理给 `http://go2rtc/api/ws`。
2. **连接失败**:
   - 如果 Go2RTC 未运行: Nginx 报错 **502 Bad Gateway**。
   - 如果 Go2RTC 运行但未配置该流: Go2RTC 建立连接后可能会立即关闭，或返回错误信息，导致 WebSocket 连接中断。

## 总结对比

| 特性 | Go2RTC (LivePlayer) | Viseron (MjpegPlayer) |
| :--- | :--- | :--- |
| **协议** | WebSocket (WebRTC/MSE) | HTTP (MJPEG) |
| **延迟** | 极低 (<500ms) | 中等 (1-3秒) |
| **音频** | 支持 | 不支持 |
| **性能** | 高 (零拷贝转发) | 低 (需 CPU 重复编码 JPEG) |
| **内容** | 摄像头原始画面 | 包含 AI 检测框的处理后画面 |
| **依赖** | 需配置 `go2rtc` 组件 | 默认可用 (依赖 Viseron 核心) |

因此，如果没有配置 Go2RTC，系统会自动降级为**无音频、带检测框、高延迟**的 MJPEG 模式，但基本监控功能不受影响。
