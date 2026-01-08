# Viseron NVR 项目结构文档

## 项目概述

**Viseron** 是一个自托管的、仅限本地的网络视频录像机（NVR）和人工智能计算机视觉软件系统。项目提供了对象检测、运动检测、人脸识别等功能，可以用于监控家庭、办公室等场所。

- **项目地址**: https://github.com/roflcoopter/viseron
- **文档地址**: https://viseron.netlify.app
- **作者**: roflcoopter
- **许可证**: MIT

## 项目根目录结构

```
viseron/
├── .devcontainer/           # 开发容器配置
├── .github/                 # GitHub 工作流和配置
├── .vscode/                 # VS Code 编辑器配置
├── azure-pipelines/         # Azure Pipelines CI/CD 配置
├── config/                  # 配置文件目录
├── design/                  # 设计文档目录（新增）
├── docker/                  # Docker 相关文件
├── docs/                    # 项目文档
├── frontend/                # 前端 Web 应用
├── rootfs/                  # 根文件系统文件
├── scripts/                 # 辅助脚本
├── tests/                   # 测试文件
├── viseron/                 # 核心 Python 应用代码
├── manager.py               # 进程管理器
├── setup.py                 # Python 包安装配置
├── requirements.txt         # Python 依赖
└── README.md                # 项目说明文档
```

## 核心模块架构

### 1. 后端核心 (`viseron/`)

后端采用 **Python** 编写，核心结构如下：

```
viseron/
├── __init__.py              # 核心 Viseron 类和启动逻辑（701行）
├── __main__.py              # 程序入口点
├── config.py                # 配置加载和验证
├── const.py                 # 常量定义
├── events.py                # 事件系统
├── exceptions.py            # 异常定义
├── states.py                # 状态管理
├── types.py                 # 类型定义
├── components/              # 组件系统（24个组件）
├── domains/                 # 领域模块（8个领域）
├── helpers/                 # 辅助工具集（14个辅助模块）
└── watchdog/                # 进程/线程监控
```

#### 核心类: Viseron

主类 `Viseron` 位于 `__init__.py`，负责：
- **组件管理**: 加载和设置组件
- **领域注册**: 注册和获取不同领域的实例（相机、检测器等）
- **事件系统**: 事件分发和监听
- **状态管理**: 应用状态跟踪
- **调度器**: 后台任务调度（使用 APScheduler）
- **生命周期管理**: 启动和关闭流程
- **进程通信**: 通过 QueueManager 实现进程间通信

### 2. 组件系统 (`viseron/components/`)

Viseron 采用**组件化架构**，所有功能通过组件实现。共有 **24 个组件**：

#### 视频处理组件
- **ffmpeg**: FFmpeg 视频流处理
- **gstreamer**: GStreamer 视频流处理
- **go2rtc**: Go2RTC 流媒体服务器集成
- **nvr**: 网络视频录像机核心功能

#### AI/ML 组件
- **darknet**: Darknet YOLO 对象检测
- **yolo**: YOLO 对象检测
- **edgetpu**: Google Edge TPU 加速
- **hailo**: Hailo AI 加速器
- **dlib**: Dlib 人脸识别库
- **codeprojectai**: CodeProject.AI 集成
- **deepstack**: DeepStack AI 服务
- **compreface**: CompreFace 人脸识别

#### 运动检测
- **background_subtractor**: 背景减除
- **mog2**: MOG2 运动检测算法

#### 通知和集成
- **mqtt**: MQTT 消息总线
- **telegram**: Telegram 机器人通知
- **discord**: Discord 消息通知
- **gotify**: Gotify 推送通知
- **webhook**: HTTP Webhook 集成

#### 系统组件
- **storage**: 数据存储和数据库管理
- **webserver**: Web 服务器和 API（Tornado）
- **data_stream**: 数据流处理
- **logger**: 日志管理
- **ptz**: 云台控制（Pan-Tilt-Zoom）

### 3. 领域模块 (`viseron/domains/`)

领域定义了系统中的核心抽象概念，共 **8 个领域**：

```
domains/
├── camera/                  # 摄像头抽象
├── face_recognition/        # 人脸识别
├── image_classification/    # 图像分类
├── license_plate_recognition/ # 车牌识别
├── motion_detector/         # 运动检测器
├── nvr/                     # NVR 录像功能
├── object_detector/         # 对象检测器
└── post_processor/          # 后处理器
```

每个领域定义了抽象基类，具体实现由组件提供。

### 4. 辅助工具 (`viseron/helpers/`)

提供系统级工具和实用函数：

- `child_process_worker.py`: 子进程工作器
- `subprocess_worker.py`: 子进程管理
- `decorators.py`: 装饰器工具
- `filter.py`: 过滤器
- `fixed_size_dict.py`: 固定大小字典
- `json.py`: JSON 编解码
- `logs.py`: 日志工具
- `named_timer.py`: 定时器
- `schemas.py`: 数据模式验证
- `storage.py`: 存储工具
- `template.py`: 模板引擎
- `validators.py`: 验证器

### 5. 进程监控 (`viseron/watchdog/`)

监控系统中运行的进程和线程：
- `process_watchdog.py`: 进程监控
- `subprocess_watchdog.py`: 子进程监控
- `thread_watchdog.py`: 线程监控

## 前端架构 (`frontend/`)

前端采用现代化的 **React + TypeScript** 技术栈：

```
frontend/
├── e2e/                     # E2E 测试（Playwright）
├── public/                  # 静态资源
├── src/                     # 源代码
│   ├── components/          # React 组件（128个）
│   ├── context/             # React Context
│   ├── hooks/               # 自定义 Hooks（11个）
│   ├── layouts/             # 页面布局
│   ├── lib/                 # 工具库
│   ├── pages/               # 页面组件（16个）
│   ├── stores/              # 状态管理（Zustand）
│   ├── svg/                 # SVG 资源
│   ├── types/               # TypeScript 类型定义
│   ├── App.tsx              # 应用根组件
│   └── index.tsx            # 应用入口
├── tests/                   # 单元测试（Vitest）
├── package.json             # NPM 依赖配置
├── tsconfig.json            # TypeScript 配置
├── vite.config.ts           # Vite 构建配置
└── eslint.config.cjs        # ESLint 配置
```

### 前端技术栈

#### 核心框架
- **React 19.2.0**: UI 框架
- **TypeScript 5.9.3**: 类型系统
- **Vite 7.2.4**: 构建工具
- **React Router 7.9.4**: 路由管理

#### UI 组件库
- **Material-UI (@mui/material) 7.3.4**: 主要 UI 组件库
- **Carbon Icons**: IBM Carbon 图标库
- **Emotion**: CSS-in-JS 样式方案

#### 状态管理
- **Zustand 5.0.8**: 轻量级状态管理
- **TanStack Query 5.90.2**: 服务端状态管理和数据获取

#### 开发工具
- **Monaco Editor**: 代码编辑器（用于配置编辑）
- **CodeMirror**: 轻量级代码编辑器
- **Vitest**: 单元测试框架
- **Playwright**: E2E 测试框架
- **MSW**: Mock Service Worker（API 模拟）

#### 视频播放
- **Video.js 8.23.4**: 视频播放器
- **HLS.js 1.6.13**: HLS 流媒体支持

## Docker 支持

项目提供多平台 Docker 支持：

```
docker/
├── Dockerfile               # 主 Dockerfile
├── Dockerfile.dev           # 开发环境
├── Dockerfile.gpac          # GPAC 支持
├── Dockerfile.hailo         # Hailo AI 支持
├── Dockerfile.models        # AI 模型
├── Dockerfile.tests         # 测试环境
├── Dockerfile.wheels        # Python wheels 构建
├── aarch64/                 # ARM64 平台
├── amd64/                   # AMD64 平台
├── amd64-cuda/              # AMD64 + CUDA
├── jetson-nano/             # NVIDIA Jetson Nano
├── rpi3/                    # Raspberry Pi 3
└── rpi5/                    # Raspberry Pi 5
```

支持的平台：
- **x86_64 (AMD64)**: 标准 Intel/AMD 处理器
- **aarch64 (ARM64)**: ARM 64位处理器
- **AMD64 + CUDA**: 支持 NVIDIA GPU 加速
- **Jetson Nano**: NVIDIA Jetson 开发板
- **Raspberry Pi 3/5**: 树莓派

## Python 依赖

### 核心依赖

```
# Web 框架
- tornado==6.4.2              # 异步 Web 框架
- httpx==0.27.0               # HTTP 客户端

# 数据库
- sqlalchemy==2.0.30          # ORM
- alembic==1.13.1             # 数据库迁移
- psycopg2-binary==2.9.9      # PostgreSQL 驱动

# AI/ML
- numpy==1.26.4               # 数值计算
- scipy==1.13.0               # 科学计算
- scikit-learn==1.2.2         # 机器学习
- supervision==0.21.0         # 视觉监督工具
- ultralytics==8.3.146        # YOLOv8

# 计算机视觉
- pillow==11.1.0              # 图像处理
- imutils==0.5.4              # OpenCV 辅助工具
- face-recognition==1.3.0     # 人脸识别
- dlib==19.24.4               # 机器学习库

# 任务调度
- apscheduler==3.10.4         # 后台任务调度

# 消息通信
- paho-mqtt==2.1.0            # MQTT 客户端
- python-telegram-bot==21.4   # Telegram Bot API

# 配置和验证
- PyYAML==6.0.1               # YAML 解析
- ruamel.yaml==0.18.9         # YAML 处理
- voluptuous==0.14.2          # 数据验证
- Jinja2==3.1.6               # 模板引擎

# 系统工具
- psutil==7.0.0               # 系统进程管理
- watchdog==4.0.0             # 文件系统监控
- setproctitle==1.3.3         # 进程标题设置
```

## 测试架构

### 后端测试 (`tests/`)

```
tests/
├── components/              # 组件测试
├── domains/                 # 领域测试
├── helpers/                 # 辅助工具测试
└── *.py                     # 各类单元测试
```

### 前端测试

- **单元测试**: Vitest + Testing Library
- **E2E 测试**: Playwright
- **代码覆盖率**: Vitest Coverage

## CI/CD 流程

### Azure Pipelines

项目使用 Azure Pipelines 进行 CI/CD：

```
azure-pipelines/
├── templates/               # Pipeline 模板
└── *.yml                    # Pipeline 配置
```

### GitHub Actions

位于 `.github/` 目录，包含：
- 自动化测试
- 代码质量检查
- Docker 镜像构建和发布

## 配置系统

### 配置文件位置

- **主配置**: `config/config.yaml`
- **组件配置**: 每个组件有自己的配置 schema
- **环境变量**:
  - `VISERON_VERSION`: 版本号
  - `VISERON_GIT_COMMIT`: Git 提交哈希
  - `ENV_LOG_MAX_BYTES`: 日志文件最大大小
  - `ENV_LOG_BACKUP_COUNT`: 日志备份数量
  - `ENV_PROFILE_MEMORY`: 内存分析开关

### 配置加载流程

1. 加载 `config.yaml`
2. 验证配置 schema（使用 voluptuous）
3. 设置组件
4. 注册领域
5. 启动服务

## 数据存储

### 存储组件

`viseron/components/storage/` 负责：
- SQLite/PostgreSQL 数据库管理
- 录像文件存储
- 快照存储
- 事件日志存储
- 数据库迁移（Alembic）

### 数据模型

- **Events**: 事件记录
- **Recordings**: 录像记录
- **Snapshots**: 快照记录
- **Entities**: 实体状态

## 进程架构

### 主进程

Viseron 主进程负责：
- 组件加载和初始化
- 领域注册
- 事件分发
- 后台任务调度
- 进程/线程监控

### 子进程/线程

- **Camera 进程**: 每个摄像头独立进程
- **Detector 线程**: 检测器运行在独立线程
- **Recorder 进程**: 录像写入独立进程
- **Watchdog 线程**: 监控线程

### 进程间通信

使用 `manager.py` 中的 `QueueManager`:
- `process_queue`: 进程消息队列
- `output_queue`: 输出消息队列
- 基于 multiprocessing.managers.BaseManager

## Web 服务器

### Tornado Web 应用

`viseron/components/webserver/` 提供：
- **REST API**: 系统控制和数据查询
- **WebSocket**: 实时事件流
- **静态文件服务**: 前端资源
- **认证系统**: JWT Token 认证

### API 端点

- `/api/v1/config`: 配置管理
- `/api/v1/cameras`: 摄像头管理
- `/api/v1/recordings`: 录像查询
- `/api/v1/events`: 事件查询
- `/api/v1/entities`: 实体状态

## 开发工具

### 代码质量

- **flake8**: Python 代码风格检查
- **pylint**: Python 代码分析
- **mypy**: Python 类型检查
- **black**: Python 代码格式化
- **isort**: Python import 排序
- **pre-commit**: Git 提交前检查

### 前端工具

- **ESLint**: JavaScript/TypeScript 代码检查
- **Prettier**: 代码格式化
- **TypeScript**: 类型检查
- **Husky**: Git hooks
- **lint-staged**: 暂存文件检查

## 部署方式

### Docker 部署（推荐）

```bash
docker run -d \
  --name viseron \
  -v /path/to/config:/config \
  -v /path/to/recordings:/recordings \
  -p 8888:8888 \
  roflcoopter/viseron
```

### 开发环境

```bash
# 后端
python -m viseron

# 前端
cd frontend
npm install
npm start
```

## 项目特点

### 1. 模块化设计
- 组件和领域分离
- 松耦合架构
- 易于扩展

### 2. 多平台支持
- x86_64
- ARM64
- CUDA GPU 加速
- Edge TPU 支持

### 3. 现代化技术栈
- Python 异步框架
- React 19 前端
- TypeScript 类型安全
- Material-UI 现代 UI

### 4. 完善的监控
- 进程/线程监控
- 日志系统
- 事件追踪
- 性能分析

### 5. 可扩展性
- 插件式组件系统
- 自定义领域
- Webhook 集成
- MQTT 消息总线

## 总结

Viseron 是一个设计精良的现代化 NVR 系统，具有以下特点：

1. **架构清晰**: 组件化、领域驱动设计
2. **技术先进**: Python + React + TypeScript
3. **功能丰富**: 对象检测、人脸识别、车牌识别等
4. **易于部署**: Docker 容器化
5. **可扩展性强**: 插件式组件系统
6. **跨平台**: 支持多种硬件平台
7. **性能优化**: 进程隔离、异步处理
8. **开发友好**: 完善的工具链和测试框架

项目代码质量高，文档完善，适合学习和二次开发。
