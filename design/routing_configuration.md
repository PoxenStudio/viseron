# Project Routing Configuration

This document outlines the routing configuration for the Viseron project, covering both server-side Nginx routing and client-side Frontend routing.

## 1. Sever-Side Routing (Nginx)

The Nginx server acts as the entry point, serving static frontend assets and proxying API requests to backend services.

- **Configuration File:** `rootfs/usr/local/nginx/conf/nginx.conf`
- **Listen Port:** `8888`
- **Server Name:** `localhost`

### API & Backend Proxies

Requests matching these patterns are proxied to internal services.

| URL Pattern       | Internal Destination                      | Description                         |
| :---------------- | :---------------------------------------- | :---------------------------------- |
| `/auth`           | `http://viseron:9999/api/v1/auth/request` | Internal auth requests              |
| `/api`            | `http://viseron:9999/api`                 | Main Viseron API                    |
| `/websocket`      | `http://viseron:9999/websocket`           | Viseron WebSocket connection        |
| `/files`          | `http://viseron:9999/files`               | File access (recordings, etc.)      |
| `/live`           | `http://go2rtc:1984/api/ws`               | Go2RTC WebSocket for live streaming |
| `/*/mjpeg-stream` | `http://viseron:9999`                     | MJPEG Camera Streams                |

### Static Assets (Frontend)

The frontend is a Single Page Application (SPA). Nginx serves the static files and handles the fallback to `index.html` for client-side routing.

- **Root Directory:** `/src/viseron/frontend`
- **Asset Caching:** `/assets/` is served with long-term caching.
- **SPA Fallback:** All other requests (`/`) try to serve the file directly or fall back to `index.html`.

## 2. Client-Side Routing (Frontend)

The frontend uses `react-router-dom` to handle navigation within the Single Page Application.

- **Configuration File:** `frontend/src/App.tsx`

### Public Routes

Accessible without authentication.

| Path          | Component    | Description              |
| :------------ | :----------- | :----------------------- |
| `/login`      | `Login`      | User login page          |
| `/onboarding` | `Onboarding` | Initial setup/onboarding |

### Private Routes

Require authentication (Wrapped in `PrivateLayout`).

| Path                                   | Component               | Access    | Description                 |
| :------------------------------------- | :---------------------- | :-------- | :-------------------------- |
| `/`                                    | `Cameras`               | All       | Main dashboard/cameras view |
| `/cameras`                             | -                       | All       | Redirects to `/`         |
| `/cameras/:camera_identifier`          | `Tuning`                | Admin     | Camera tuning/debugging     |
| `/recordings`                          | `Recordings`            | All       | All recordings overview     |
| `/recordings/:camera_identifier`       | `CameraRecordings`      | All       | Specific camera recordings  |
| `/recordings/:camera_identifier/:date` | `CameraRecordingsDaily` | All       | Daily recordings view       |
| `/events`                              | `Events`                | All       | Events log                  |
| `/live`                                | `Live`                  | All       | Live camera view            |
| `/entities`                            | `Entities`              | All       | Entities management         |
| `/profile`                             | `Profile`               | All       | User profile settings       |

### Admin Settings Routes

Require **Admin** role (Wrapped in `RequireRole`).

| Path                        | Component        | Description                  |
| :-------------------------- | :--------------- | :--------------------------- |
| `/settings`                 | `Settings`       | Settings dashboard           |
| `/settings/configuration`   | `Configuration`  | RAW Configuration editor     |
| `/settings/users`           | `Users`          | User management              |
| `/settings/system-events`   | `SystemEvents`   | System event logs            |
| `/settings/template-editor` | `TemplateEditor` | Notification template editor |

### Development Proxy (Vite)

- **Configuration File:** `frontend/vite.config.ts`
- **Proxy Target:** `localhost:8888` (or `VITE_PROXY_HOST`)
- **Proxied Paths:** `/api`, `/websocket`, `/files`, `/live`, MJPEG streams.
