# Viseron 并发模型 (Concurrency Model) 详解

本文档详细介绍了 Viseron 的并发架构。Viseron 采用 **多进程 (Multiprocessing)** 与 **多线程 (Threading)** 相结合的混合模型，以在保证 Python GIL（全局解释器锁）限制下的性能的同时，实现组件间的隔离与稳定性。

## 1. 架构总览

- **主进程 (Main Process)**: 负责核心调度、事件总线分发、Web 服务以及轻量级逻辑。除 Frame Reader 外的大部分组件运行在主进程的多个线程中。
- **子进程 (Child Processes)**: 用于隔离计算密集型或不稳定的任务，主要是 **FFmpeg 读取** 和 **硬件加速推理**（如 EdgeTPU）。进程间通过 `multiprocessing.Queue` 进行通信。

## 2. 多进程模型 (Process Model)

多进程主要用于隔离那些可能会阻塞主循环或导致崩溃的任务。

### 2.1 FFmpeg Frame Reader

每个摄像头（Camera）的视频流读取都在独立的子进程中进行。

- **发起位置**: `viseron.components.ffmpeg.camera.Camera._create_frame_reader`
- **类**: `RestartableProcess` (封装了 `multiprocessing.Process`)
- **主要功能**:
  - 执行 `FFmpeg` 命令。
  - 从管道（Pipe）中持续读取原始视频帧字节流。
  - 将读取到的帧放入 `_frame_queue`。
- **为何使用进程**: 视频解码是 CPU 密集型操作，且 FFmpeg 可能会因流不稳定而阻塞或崩溃。使用独立进程可以避免拖垮主程序，并且利用多核 CPU。

### 2.2 扩展/插件 Worker

某些插件（如 EdgeTPU 目标检测）可能运行在独立进程中。

- **类**: `viseron.helpers.child_process_worker.ChildProcessWorker`
- **主要功能**: 防止特定硬件驱动崩溃导致主进程退出。

## 3. 多线程模型 (Thread Model)

主进程内部大量使用线程来处理 I/O 密集型任务和并发逻辑。

### 3.1 Frame Relay (帧中继)

- **发起位置**: `Camera._create_frame_reader` (与 Frame Reader 进程成对创建)
- **类**: `RestartableThread`
- **主要功能**:
  - 作为“消费者”从 `_frame_queue` (IPC 队列) 中取出原始数据。
  - 将原始数据解码/封装为 `SharedFrame` 对象。
  - 将处理后的帧发布到 `DataStream`，供后续的运动检测、目标检测使用。

### 3.2 DataStream Consumer (数据流分发)

- **发起位置**: `viseron.components.data_stream.DataStream.__init__`
- **类**: `RestartableThread`
- **主要功能**:
  - 作为系统的“事件总线”。
  - 监听 `_data_queue`。
  - 将消息分发给所有订阅者（回调函数或其他队列）。

### 3.3 Object Detection (目标检测)

- **发起位置**: `viseron.domains.object_detector.AbstractObjectDetector.__init__`
- **类**: `RestartableThread`
- **主要功能**:
  - 运行检测循环。
  - 从 `object_detection_queue` 获取待检测帧。
  - 调用推理引擎（可能是同步的或跨进程的）。
  - 发布检测结果。

### 3.4 Webserver

Web 服务运行在独立的线程中，处理 HTTP 请求和 WebSocket 连接。

## 4. 队列与数据流 (Queues & Data Flow)

Viseron 使用队列在不同的线程和进程间传递数据。

| 队列名称               | 类型          | 缓冲区大小 (Maxsize) | 生产者         | 消费者             | 说明                                           |
| :--------------------- | :------------ | :------------------- | :------------- | :----------------- | :--------------------------------------------- |
| \_frame_queue          | `mp.Queue`    | 2                    | FFmpeg Process | Frame Relay Thread | 极小的缓冲区以保证实时性（丢弃旧帧）。跨进程。 |
| \_data_queue           | `queue.Queue` | 1000                 | Any Component  | DataStream Thread  | 核心事件总线缓冲区。跨线程。                   |
| object_detection_queue | `queue.Queue` | 1                    | Frame Relay    | Object Detector    | 仅缓存最新的一帧进行检测，避免积压。           |

### 数据流向示例 (摄像头 -> 检测)

1.  **[Process]** `FFmpeg` 读取视频帧 -> `pipe`
2.  **[Process]** `Frame Reader` 读取 pipe -> `put(_frame_queue)`
3.  **[Thread]** `Frame Relay` `get(_frame_queue)` -> 创建 `SharedFrame` -> `publish(DataStream)`
4.  **[Thread]** `DataStream` 收到帧 -> 分发给订阅者（如 Object Detector）
5.  **[Thread]** `Object Detector` 的回调函数收到帧 -> `put(object_detection_queue)`
6.  **[Thread]** `Object Detector Loop` `get(object_detection_queue)` -> 执行推理

## 5. 看门狗机制 (Watchdog)

为了保证系统 24/7 稳定运行，Viseron 实现了一套能够自动重启挂掉的进程或线程的机制。

- **RestartableProcess / RestartableThread**: 所有的关键任务都封装在这两个类中。
- **WatchDog 类**: `ProcessWatchDog` 和 `ThreadWatchDog`。
- **检测方式**: 使用 `APScheduler` 定时任务，每隔一段时间检查注册的进程/线程是否 `is_alive()`。如果不存活且未收到停止信号，则自动重新启动该任务。
