# Ubuntu 本地原生开发环境搭建指南

本文档介绍如何在 Ubuntu 系统下，不依赖 Docker 容器，直接在本地搭建 Viseron NVR 项目的完整开发及运行环境。

## 1. 系统环境与前置依赖

建议使用 **Ubuntu 22.04 LTS** 或更新版本。

### 1.1 系统工具与基础库
更新软包列表并安装必要的编译工具和系统库：

```bash
sudo apt update
sudo apt install -y \
    build-essential \
    cmake \
    git \
    wget \
    curl \
    unzip \
    pkg-config \
    libjpeg-dev \
    libpng-dev \
    libtiff-dev \
    libavcodec-dev \
    libavformat-dev \
    libswscale-dev \
    libv4l-dev \
    libxvidcore-dev \
    libx264-dev \
    libgtk-3-dev \
    libatlas-base-dev \
    gfortran \
    python3-dev \
    python3-venv \
    python3-pip \
    ffmpeg \
    libgstreamer1.0-dev \
    libgstreamer-plugins-base1.0-dev \
    gstreamer1.0-plugins-good \
    gstreamer1.0-plugins-bad \
    gstreamer1.0-plugins-ugly \
    gstreamer1.0-libav \
    gstreamer1.0-tools \
    gstreamer1.0-x \
    gstreamer1.0-alsa \
    gstreamer1.0-gl \
    gstreamer1.0-gtk3 \
    gstreamer1.0-qt5 \
    gstreamer1.0-pulseaudio \
    libgirepository1.0-dev \
    nginx
```

**说明**: `dlib` 和 `opencv` 的编译安装需要依赖上述大量的图像处理和数学计算库。

### 1.2 安装 Node.js (用于前端)
推荐安装 Node.js LTS 版本 (v20+)。

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### 1.3 安装 Go2RTC
该项目依赖 Go2RTC 处理 WebRTC 流。需要手动下载二进制文件。

```bash
# 假设当前在项目根目录
wget https://github.com/AlexxIT/go2rtc/releases/latest/download/go2rtc_linux_amd64 -O go2rtc
chmod +x go2rtc
```

---

## 2. 后端开发环境搭建

### 2.1 Python 环境配置
建议使用 Python 虚拟环境，避免污染系统库。

```bash
# 在项目根目录下创建虚拟环境
python3 -m venv .venv

# 激活虚拟环境
source .venv/bin/activate
```

### 2.2 安装 Python 依赖
**注意**: `dlib` 的编译可能比较耗时且对内存有要求。

```bash
# 升级 pip
pip install --upgrade pip

# 安装项目依赖
# 请确保当前仍在虚拟环境中
pip install -r requirements.txt
```

如果遇到 `dlib` 安装失败，请确保 `cmake` 和 `cmake-data` 已正确安装 (`sudo apt install cmake`)。

### 2.3 配置文件准备
默认情况下，项目读取 `/config` 目录下的配置。我们需要在本地创建配置目录并告知程序。

```bash
# 创建配置目录
mkdir -p config

# 创建空白配置文件 (或者复制示例配置)
# 可参考 const.py 中的 DEFAULT_CONFIG
touch config/config.yaml
```


**环境变量配置**:
为了让程序知道配置文件在哪里，需要设置环境变量 `VISERON_CONFIG_DIR`。建议将其写入启动脚本或 `.env` 文件。

```bash
export VISERON_CONFIG_DIR=$(pwd)/config
```

### 2.4 数据库配置 (PostgreSQL)

项目默认使用 PostgreSQL 存储数据。你需要在本地安装并运行 PostgreSQL 服务。

**1. 启动 PostgreSQL 服务**
确保 PostgreSQL 服务已启动：
```bash
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**2. 创建数据库和用户**
进入 PostgreSQL 命令行创建项目所需的数据库和用户：
```bash
sudo -u postgres psql

# 在 psql 这里执行以下 SQL:
CREATE USER viseron WITH PASSWORD 'viseron';
CREATE DATABASE viseron OWNER viseron;
\q
```

**3. 配置连接字符串**
Viseron 使用环境变量 `POSTGRES_DATABASE_URL` 连接数据库。
在运行项目前，需要导出该环境变量：

```bash
# 格式: postgresql://<user>:<password>@<host>:<port>/<database>
export POSTGRES_DATABASE_URL="postgresql://viseron:viseron@localhost:5432/viseron"
```

建议将上述 export 命令也加入到你的启动脚本或环境变量配置文件中。


---

## 3. 前端开发环境搭建

```bash
cd frontend

# 安装依赖
npm install
```

前端有两种运行模式：
1. **开发模式 (Dev)**: 实时热更新，用于开发调试。
2. **生产构建 (Build)**: 编译成静态文件，由 Nginx 统一向外提供服务。

---


### 2.5 Darknet 目标检测配置

如果你的 `config.yaml` 启用了 `darknet` 组件，需要准备相应的模型文件。

**1. 创建模型目录** (默认为 `/detectors/models/darknet/`)
由于本地运行，我们可以将模型放在项目目录下，例如 `models/darknet`。

```bash
mkdir -p models/darknet
```

**2. 下载 YOLOv4-tiny 模型文件**
Viseron 默认使用 YOLOv4-tiny。

```bash
cd models/darknet

# 下载权重文件 (yolov4-tiny.weights)
wget https://github.com/AlexeyAB/darknet/releases/download/darknet_yolo_v4_pre/yolov4-tiny.weights -O default.weights

# 下载配置文件 (yolov4-tiny.cfg)
wget https://raw.githubusercontent.com/AlexeyAB/darknet/master/cfg/yolov4-tiny.cfg -O default.cfg

# 下载标签文件 (coco.names)
wget https://raw.githubusercontent.com/AlexeyAB/darknet/master/data/coco.names -O coco.names
```

**3. 修改 `config.yaml` 配置**
你需要在 `config.yaml` 中显式指定这些文件的路径，否则它会去寻找默认的 `/detectors/models/darknet/...` 路径。

```yaml
darknet:
  object_detector:
    model_path: /path/to/your/project/models/darknet/default.weights # 修改为绝对路径
    model_config: /path/to/your/project/models/darknet/default.cfg   # 修改为绝对路径
    label_path: /path/to/your/project/models/darknet/coco.names      # 修改为绝对路径
    # ... 其他配置
```

**导出的环境变量**
```
export VISERON_CONFIG_DIR=/home/horky/projects/nvr/viseron/workspace/config
export POSTGRES_DATABASE_URL="postgresql://viseron:viseron@localhost:5432/viseron"
export VISERON_FFMPEG_PATH=/usr/bin/ffmpeg

修改/usr/local/bin的权限: sudo chmod 777 /usr/local/bin
```

**错误排查**:
1.  **`No section: 'net'`**: 通常是因为 `default.cfg` 文件内容为空、格式损坏或者路径错误，导致 OpenCV 无法解析网络结构。请确保 `wget` 下载成功且文件有内容。
2.  **`No module named 'manager'`**: 这是一个 Python 路径问题。当 Viseron 启动子进程处理 Darknet 时，需要能够找到项目根目录下的 `manager.py`。
    解决方法：在运行 Viseron 之前，将当前目录 (即项目根目录) 添加到 `PYTHONPATH`。

    ```bash
    export PYTHONPATH=$PYTHONPATH:$(pwd)
    python3 -m viseron
    ```


### 4.1 端口架构
- **9999**: Viseron 后端 API 服务端口
- **1984**: Go2RTC 服务端口
- **8888**: Nginx 统一入口端口 (浏览器访问此端口)
- **5173**: (开发模式下) Vite 前端开发服务器端口

### 4.2 Nginx 配置文件 (本地开发版)

在项目根目录下创建一个 `nginx_dev.conf` 文件，内容如下 (请**务必修改** `/path/to/your/project` 为你的实际项目绝对路径)：

```nginx
worker_processes  1;
daemon off; # 前台运行，方便调试 Ctrl+C 停止

events {
    worker_connections  1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;
    sendfile        on;
    keepalive_timeout  65;

    # 定义后端服务
    upstream viseron {
        server 127.0.0.1:9999;
    }

    upstream go2rtc {
        server 127.0.0.1:1984;
    }

    server {
        listen       8888;
        server_name  localhost;

        # =========================================================
        # API 和 流媒体代理配置 (直接照搬原项目逻辑)
        # =========================================================

        location = /auth/camera_access_token {
            internal;
            proxy_pass http://viseron/api/v1/auth/request/camera_access_token/$camera_identifier?access_token=$auth_token;
            proxy_http_version 1.1;
        }

        location = /auth {
            internal;
            proxy_pass http://viseron/api/v1/auth/request;
            proxy_http_version 1.1;
        }

        location /api {
            proxy_pass http://viseron/api;
            proxy_http_version 1.1;
        }

        # WebSocket 支持
        location /websocket {
            proxy_pass http://viseron/websocket;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
        }

        location /live {
            set $auth_token $arg_access_token;
            set $camera_identifier $arg_src;
            auth_request /auth/camera_access_token;
            proxy_pass http://go2rtc/api/ws;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
        }

        # 视频流代理
        location ~ ^/[A-Za-z0-9_]+/mjpeg-stream$ {
            proxy_pass http://viseron;
        }

        # 静态文件代理
        location /files {
            proxy_pass http://viseron/files;
        }

        # =========================================================
        # 前端静态资源 (生产模式/完整服务模式)
        # =========================================================
        # 如果你运行 npm run build，静态文件会生成在 dist 目录
        location / {
            # 修改为你的 frontend/dist 的绝对路径
            root /home/horky/projects/nvr/viseron/frontend/dist;
            try_files $uri $uri.html $uri/ /index.html;
            index index.html;
        }
    }
}
```

---


### 2.6 FFMPEG 路径配置(重要)

Viseron 在运行时会尝试为每个摄像头创建一个指向系统 `ffmpeg` 的符号链接（例如 `ffmpeg_camera1`），默认路径硬编码为 `/home/abc/bin/`（这是 Docker 容器内的路径）。
在本地运行时，这个路径不存在且由于权限问题会导致运行失败。

**解决方法**:
我们需要创建一个软链接目录欺骗程序，或者修改源码（不推荐）。最简单的方法是创建该目录并将当前用户设为所有者。

```bash
# 创建 Docker 镜像中使用的路径
sudo mkdir -p /home/abc/bin

# 将该目录的所有权移交给当前用户 (替换 'horky' 为你的实际用户名)
sudo chown -R $USER:$USER /home/abc/bin

# 将目录加到PATH中
export PATH=$PATH:/home/abc/bin

# 确保系统 ffmpeg 在PATH中，Viseron 会读取环境变量 VISERON_FFMPEG_PATH，
# 如果未设置，它会尝试找系统 ffmpeg。
# 为了保险，显式设置环境变量指向系统 ffmpeg
export VISERON_FFMPEG_PATH=$(which ffmpeg)
```

建议将 `export VISERON_FFMPEG_PATH=$(which ffmpeg)` 也加入到启动脚本中。


### 终端 2: 运行 Viseron 后端
确保已激活虚拟环境并设置了环境变量。
```bash
source .venv/bin/activate
export VISERON_CONFIG_DIR=$(pwd)/config
python3 -m viseron
```

### 终端 3: 运行 Nginx
使用刚才创建的配置文件启动 Nginx。
```bash
# 注意使用 sudo，因为 nginx 需要权限操作日志文件或绑定端口
# 将路径替换为实际路径
sudo nginx -c $(pwd)/nginx_dev.conf
```

此时，如果你已经执行过前端 build (`cd frontend && npm run build`)，你可以直接访问 `http://localhost:8888` 来使用完整的服务。

### 终端 4: 运行前端开发服务器 (可选 - 推荐用于前端开发)
如果你正在开发前端，不希望每次修改都 build，可以使用 Vite 开发服务器。

```bash
cd frontend
npm run start
```

**关键说明 - WebSocket 连接配置**:

1. **启用 Debug 模式（重要）**：
   为了让 Vite 开发服务器能够正常代理 WebSocket 请求，你需要在 `config.yaml` 中启用 webserver 的 debug 模式：

   ```yaml
   webserver:
     debug: true
   ```

   这会禁用 Tornado 的跨域检查，允许来自 Vite 代理的 WebSocket 连接。

无论哪种情况，都**必须**保持 **终端 1, 2, 3** 的服务处于运行状态。

访问地址:
- **前端开发**: `http://localhost:5173`
- **完全集成测试**: `http://localhost:8888`

## 6. 常见问题排查

1.  **Permission denied for /var/log/nginx/error.log**:
    如果是以非 root 用户运行 nginx (不推荐，但可行)，需要修改 nginx 配置文件中的 `error_log` 和 `pid` 路径到你有权限的目录，例如 `/tmp/nginx_error.log`。推荐直接用 `sudo nginx -c ...` 运行。

2.  **Go2RTC 无法连接**:
    确保 `./go2rtc` 已赋予执行权限，且端口 1984 未被占用。

3.  **dlib 安装失败**:
    通常是缺少 `cmake` 或 `C++` 编译器。请重新检查步骤 1.1 的依赖安装。

4.  **数据库错误**:
    Viseron 可能会尝试连接 PostgreSQL。如果配置文件中未启用 PostgreSQL，它通常会使用默认设置或回退。如果报错，请检查 `config.yaml` 或安装并配置本地 PostgreSQL 服务。

5.  **MJPEG 流 404 错误** (`GET /camera_name/mjpeg-stream 404`):
    如果前端显示摄像头流 404 错误，需要修改 `frontend/vite.config.ts`，添加对摄像头流路径的代理支持。
    在 `server.proxy` 配置中，确保包含以下规则：

    ```typescript
    "^/[A-Za-z0-9_]+/mjpeg-stream": {
      target: `http://${env.VITE_PROXY_HOST ? env.VITE_PROXY_HOST : "localhost:8888"}`,
      ...proxyOptions,
    },
    ```

    注意：正则表达式不要以 `$` 结尾，这样才能匹配带查询参数的 URL（如 `?draw_objects=1`）。
    修改后需要重启 Vite 开发服务器。
