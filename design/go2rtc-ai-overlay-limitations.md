# Go2RTC 模式下的 AI 识别框显示问题

在使用 Go2RTC 进行直播时，**您将无法看到 AI 识别框**。这是一个需要在性能和功能之间做出的权衡。

## 1. 原理解析

### Viseron MJPEG 模式 (能看到框)
- **流程**: 摄像头 -> Viseron 解码 -> AI 检测 -> **OpenCV 绘制框** -> 编码为 JPEG -> 浏览器。
- **原理**: 每一帧图片在发送给浏览器之前，已经被后端"PS"过，画上了框。
- **代价**: 延迟高，CPU 占用高（因为要重新编码每一帧）。

### Go2RTC 模式 (通过 /live) (看不到框)
- **流程**: 摄像头 -> (RTSP) -> Go2RTC -> (WebSocket) -> 浏览器。
- **原理**: Go2RTC 进行的是**流转发**。它拿到的H.264/H.265原始数据包含什么，浏览器就显示什么。
- **缺失**: 由于视频流没有经过 Viseron 的 OpenCV 处理环节，也没有被重新编码，所以 AI 检测结果（bounding boxes）没有被"画"进视频里。

## 2. 代码证据

**前端对比**:

- **MjpegPlayer.tsx**: 显式构建带参数的 URL，请求后端绘制。
  ```typescript
  // 拼接参数 draw_objects=1 告诉后端要画框
  if (drawObjects) params.push("draw_objects=1");
  ```

- **LivePlayer.tsx**: 仅接受视频源地址，没有任何绘制覆盖层的逻辑。
  ```typescript
  <LivePlayer
    src={`${BASE_PATH}/live?src=${camera.identifier}`}
    // 没有 drawObjects 属性被使用
  />
  ```

## 3. 产生的影响

这意味着在 Viseron 中：
1. **日常监控**: 推荐使用 Go2RTC 模式，享受低延迟、高帧率和音频。
2. **AI 调试**: 如果您需要观察 AI 识别是否准确（查看绿色检测框），您可能需要临时**禁用 Go2RTC**，或者查看 Viseron 的"事件回放"（录像），因为录像和快照通常会保留（或可以选择保留）检测框。

## 4. 未来可能的改进

要在使用 Go2RTC 的同时显示识别框，架构上需要改变：
1. **元数据流**: Viseron 需要通过 WebSocket 实时推送检测对象的坐标信息 (Metadata Stream)。
2. **前端绘制**: 浏览器端需要在 `<video>` 元素之上覆盖一个 `<canvas>` 层，根据接收到的坐标实时绘制框。

目前 Viseron 的前端代码尚未实现这一机制。
