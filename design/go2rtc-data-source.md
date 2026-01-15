# Go2RTC 数据获取与转发流程详解

您问到了核心问题：**Go2RTC 作为一个独立服务，它是如何知道去哪里获取摄像头数据的？**

简单来说：**它通过配置文件直接连接摄像头**。

## 1. Go2RTC 如何获取 Camera 数据

Go2RTC 并不是从 Viseron 的主进程（负责录像/物体检测的进程）里"拿"数据，而是**自己作为一个独立的 RTSP 客户端**直接去连接摄像头。

### 详细步骤：

1.  **用户配置 (Truth Source)**
    在 Viseron 的 `config.yaml` 中，您通常需要配置两部分：
    ```yaml
    # 1. 定义 Go2RTC 的流（用于直播）
    go2rtc:
      streams:
        camera_front_door: rtsp://user:pass@192.168.1.100:554/stream1

    # 2. 定义 Viseron 的摄像头（用于录像/检测）
    camera:
      camera_front_door:
        host: 192.168.1.100
        # ...
    ```

2.  **配置生成**
    Viseron 启动时，会把上述 `go2rtc` 的配置段提取出来，生成一个标准的 Go2RTC 配置文件 `/tmp/go2rtc.yaml`。

3.  **建立连接 (RTSP Client)**
    当您在浏览器打开直播页面时：
    - Go2RTC 收到请求 `src=camera_front_door`。
    - 它查找配置文件，找到对应的 RTSP 地址。
    - **Go2RTC 启动内部的 RTSP 客户端**，向摄像头的 554 端口发起连接。
    - 摄像头开始向 Go2RTC 发送 RTP 视频流（H.264/H.265）。

    > **注意**：这意味着在默认配置下，您的摄像头会承受**两路连接**：一路来自 Viseron (用于录像/检测)，一路来自 Go2RTC (用于直播)。

## 2. 为什么是 WebSocket 发送？

一旦 Go2RTC 拿到了摄像头的原始流（通常是 RTP 包），它需要把这个流送到您的浏览器。这里就用到了 WebSocket (WS)。

### 流程分析：

1.  **数据封装 (Remuxing/Transcoding)**
    Go2RTC 收到 RTSP 的 RTP 包后：
    - **WebRTC 模式**: 将 RTP 包重新封装为 WebRTC 兼容的 SRTP 包。
    - **MSE 模式**: 将 H.264/H.265 数据封装进 fMP4 (Fragmented MP4) 容器。
    - **MJPEG 模式**: 解码视频帧 -> 编码为 JPEG 图片。

2.  **通过 WS 隧道传输**
    - **WebRTC**: WS 仅用于交换 SDP（"握手"），握手完后，数据通过 UDP/TCP 直接传输，不走 WS。
    - **MSE**: Go2RTC 将 fMP4 片段（二进制数据）**直接写入 WebSocket 连接**。浏览器端的 `video-rtc.js` 从 WS 读取这些二进制数据，喂给 `<video>` 标签播放。
    - **MJPEG**: Go2RTC 将 JPEG 图片数据（二进制）**写入 WebSocket 连接**。

### 架构图解

```
   [ 摄像头 ]
      │
      │ (RTSP 协议: 原始 H.264/H.265 流)
      │
      ▼
 [ Go2RTC 服务 ] <── 配置文件 (/tmp/go2rtc.yaml)
      │
      │ 1. 接收 RTSP 流
      │ 2. 根据浏览器请求进行封装 (WebRTC/MSE/MJPEG)
      │
      ▼
 [ WebSocket 连接 ] (ws://host:8888/live...)
      │
      │ (二进制流: fMP4 / JPEG / 或 WebRTC 信令)
      │
      ▼
  [ 浏览器 ]
    (VideoRTC 解析数据 -> 渲染画面)
```

## 3. 为什么 Viseron 这样做？

Viseron 的设计非常聪明，它解耦了**分析**和**直播**：

- **Viseron 主进程**: 专注使用 FFmpeg 解码视频进行 AI 分析（对象检测）和录像。这是一个重计算任务。
- **Go2RTC**: 专注**直播流分发**。它使用 Go 语言编写，对并发流处理极其高效，且支持零拷贝转发（不解码直接转发 RTSP->WebRTC），延迟极低。

**Viseron 是如何联动的？**
Viseron 的代码 (`viseron/domains/camera/__init__.py`) 会检查 Go2RTC 是否配置了同名的摄像头流。
- 如果配置了 -> 前端显示 "Live" 播放器（走 Go2RTC）。
- 如果没配置 -> 前端降级使用 Viseron 自己的 MJPEG 流（效率较低）。
