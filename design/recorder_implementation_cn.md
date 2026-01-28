# 录制功能设计与实现分析

本文档基于 `domains/camera/recorder.py` 及其相关组件（`ffmpeg/stream.py`, `domains/camera/fragmenter.py`）的实现，分析 Viseron 中录制功能的主要控制逻辑。

## 1. 核心架构概述

Viseron 的录制机制采用 **持续分片（Continuous Fragmentation）** + **逻辑事件（Logical Events）** 的模式。

- **底层数据流**：无论是否触发录制事件，底层 FFmpeg 进程（通过 `Stream` 组件）通常都在持续地将视频流切分为短小的片段（Segments，默认为 `fmp4` 格式）。
- **录制逻辑**：`Recorder` 并不控制数据流的开启/暂停，而是记录感兴趣的时间段（Start Time 到 End Time）。
- **文件生成**：当录制事件结束时，系统会根据记录的时间段，从持续生成的片段池中检索对应的文件，并将它们拼接（Concatenate）成一个完整的事件视频文件（Clip）。

## 2. 初始化 (Initialization)

录制功能的初始化分散在几个组件中：

1.  **Camera 初始化 (`AbstractCamera`)**:
    - 在相机组件初始化时，会实例化 `Fragmenter` 类。`Fragmenter` 负责处理生成的片段文件。
    - 同时会实例化具体的 `Recorder` 实现（如 `ffmpeg.recorder.Recorder`）。

2.  **Recorder 初始化 (`AbstractRecorder`)**:
    - 创建必要的目录结构：`segments` (存放分片), `temp_segments` (临时分片), `event_clips` (最终录像), `thumbnails` (缩略图)。
    - 向系统注册 `RecorderBinarySensor` 等实体。

3.  **流初始化 (`Stream`)**:
    - 在 FFmpeg 相机启动时，`Stream` 类负责构建 FFmpeg 命令。
    - **关键点**：`Stream` 会构建一个名为 `segments_alias` 的 FFmpeg 进程（或作为主进程的一部分），配置为 **HLS (HTTP Live Streaming)** 模式输出。
    - 该进程启动后立即开始向 `temp_segments` 目录写入 `.m4s` 或 `.mp4` 片段。

## 3. 源数据获取 (Source Data Acquisition)

源数据的获取和处理主要由 `viseron/components/ffmpeg/stream.py` 控制。

### 3.1 视频与音频输入

- **输入源**：通过 FFmpeg 读取配置的 RTSP/RTMP/HTTP 流。
- **解码与编码**：
  - 系统根据配置决定是否对视频进行转码（`CONFIG_RECORDER_CODEC`）。如果不转码，通常使用 `-c:v copy` 以最小化 CPU 占用。
  - **音频处理**：
    - 系统会检查输入流的音频编码。
    - 如果是 MP4 容器不支持的格式（如 `pcm_alaw`, `pcm_s16be`），会自动转码为 `aac`。
    - 如果支持，则直接复制 (`-c:a copy`)。
    - 如果未配置音频或不需要，则使用 `-an` 丢弃音频。

### 3.2 分片生成 (Segmentation)

FFmpeg 被配置为生成 HLS 流（`Stream.segment_args`）：

- **格式**：`fmp4` (Fragmented MP4)。
- **时长**：由 `CAMERA_SEGMENT_DURATION` 控制（默认为 **5秒**，该值是系统常量不可配置）。
- **输出**：文件首先写入 `temp_segments_folder`。

## 4. 技术细节 (Technical Details)

### 4.1 音视频同步 (A/V Synchronization)

Viseron 在录制过程中采用了严格的时间戳重写策略来保证音视频同步，主要通过 FFmpeg 的输入参数配置实现（见 `viseron/const.py` 中的 `CAMERA_INPUT_ARGS`）。

由于网络摄像头（特别是 RTSP/Onvif 协议）的原始时间戳（PTS/DTS）往往不可靠或出现漂移，Viseron 采取“**以接收时间为准 (Wallclock Time)**”的策略：

1.  **`-use_wallclock_as_timestamps 1`**：强制使用 Viseron 服务器接收到数据包的系统时间作为时间戳，忽略摄像头的原始时间戳。这确保了音频和视频在本地时间轴上是严格对齐的。
2.  **`-fflags +genpts`**：如果流中缺少 PTS，则重新生成它们。
3.  **`-vsync 0` (Pass-through)**：视频帧直接透传，不进行丢帧或补帧操作，保留重写后的时间戳。

**一致性保证**：
由于录制是基于**持续分片**的，同一个 FFmpeg 进程不间断地生成片段，这保证了所有片段之间的时间戳是单调递增且连续的。当这些片段最后通过 `concatenate_fragments`（使用 `-c copy`）拼接成事件录像时，这种同步关系被完美保留，不会出现音画不同步的问题。

## 5. 数据处理与片段管理 (Segment Processing)

`Fragmenter` (`viseron/domains/camera/fragmenter.py`) 扮演了后台工人的角色：

1.  **监控 (`FragmenterSubProcessWorker`)**：
    - 定期扫描 `temp_segments_folder`。
    - 发现新生成的片段（`.m4s` 或 `.mp4`）后，通过 `MP4Box` 或直接处理，提取元数据（时长、创建时间）。

2.  **移动与索引**：
    - 将处理好的片段从 `temp` 目录移动到永久的 `segments_folder`。
    - 将片段的元数据（文件名、开始时间、持续时间）写入数据库 (`Files` 表)。
    - 这使得系统拥有了一个可被检索的视频时间轴。

## 6. 录制控制逻辑 (Recording Control Logic)

`Recorder` (`viseron/domains/camera/recorder.py`) 负责业务逻辑控制。

### 6.1 开始录制 (`start`)

- 当触发录制（如对象检测、外部事件、手动触发）时，调用 `start()`。
- **动作**：
  - 记录当前的 UTC 时间作为 `start_time`。
  - 在数据库 `Recordings` 表中插入一条新记录。
  - 生成并保存当前的缩略图 (`create_thumbnail`)。
  - **注意**：此时并不创建视频文件，只是标记了“开始”。

### 6.2 停止录制 (`stop`)

- 当事件结束或超时，调用 `stop()`。
- **动作**：
  - 更新数据库记录的 `end_time`。
  - **触发文件生成**：如果配置了 `CONFIG_CREATE_EVENT_CLIP`，则启动一个后台线程 (`_concatenate_fragments`) 来生成目标文件。

### 6.3 目标文件生成 (`_concatenate_fragments`)

这是生成用户可见录像文件的关键步骤：

1.  **等待**：稍微等待几秒，确保所有相关的片段都已从临时目录移动到存储目录。
2.  **检索片段 (`get_fragments`)**：
    - 根据录制的 `start_time` (减去 `lookback`) 和 `end_time`，查询数据库中所有落在此时间范围内的片段。
3.  **拼接 (`concatenate_fragments`)**：
    - `Fragmenter` 生成一个临时的 HLS 播放列表 (`.m3u8`)，包含所有检索到的片段。
    - 调用 FFmpeg，使用 concat 协议（或通过 playlist 输入），采用 `-c copy` (不重新编码) 的方式，将这些片段合并为一个单独的 MP4 文件。
4.  **移动与更新**：
    - 生成的 MP4 文件被命名（基于 `CONFIG_FILENAME_PATTERN`）。
    - 移动到 `event_clips_folder`。
    - 更新数据库 `Recordings` 表，填入 `clip_path`。
    - 分发 `EVENT_RECORDER_COMPLETE` 事件。

## 7. 总结流转图

1.  **FFmpeg (Stream)** --> [持续写入] --> **Temp Segments (.m4s)**
2.  **Fragmenter** --> [扫描 & 移动] --> **Segments Dir** & **DB (Files)**
3.  **Trigger** --> **Recorder.start()** --> [DB: Recording Start]
4.  **Event End** --> **Recorder.stop()** --> [DB: Recording End] --> **Concatenate Thread**
5.  **Concatenate Thread** --> [Query DB for Segments] --> [FFmpeg Concat] --> **Event Clip (.mp4)**

这种设计的优点是**零预缓冲（Zero Pre-buffer）**延迟（因为一直在录制）和**低开销事件剪辑**（只涉及文件复制和元数据操作，无需重编码）。
