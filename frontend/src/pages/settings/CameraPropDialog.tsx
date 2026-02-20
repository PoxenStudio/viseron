import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormHelperText from "@mui/material/FormHelperText";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useEffect, useMemo, useState } from "react";

import { useTuneConfig, useCreateCamera, useUpdateTuneConfig } from "lib/api/tune";
import * as types from "lib/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DialogMode = "create" | "edit";

export interface CameraPropDialogProps {
  open: boolean;
  mode: DialogMode;
  /** Required for edit mode */
  camera?: types.Camera;
  onClose: () => void;
}

type StreamFormat = "rtsp" | "rtmp" | "mjpeg" | "mp4";
type RtspTransport = "tcp" | "udp" | "udp_multicast" | "http";

interface CameraFormValues {
  // Identity
  identifier: string;
  name: string;

  // Connection
  stream_format: StreamFormat;
  host: string;
  port: string;
  path: string;
  username: string;
  password: string;
  rtsp_transport: RtspTransport;

  // Resolution (blank = auto-detect via FFprobe)
  width: string;
  height: string;
  fps: string;

  // Recorder
  continuous_recording: boolean;
  lookback: string;
  idle_timeout: string;
  create_event_clip: boolean;

  // Advanced
  record_only: boolean;
}

const STREAM_FORMAT_DEFAULTS: Record<StreamFormat, Partial<CameraFormValues>> = {
  rtsp: { port: "554", path: "/" },
  rtmp: { port: "1935", path: "/" },
  mjpeg: { port: "80", path: "/" },
  mp4: { host: "", port: "", path: "" },
};

const DEFAULT_FORM: CameraFormValues = {
  identifier: "",
  name: "",
  stream_format: "rtsp",
  host: "",
  port: "554",
  path: "/",
  username: "",
  password: "",
  rtsp_transport: "tcp",
  width: "",
  height: "",
  fps: "",
  continuous_recording: true,
  lookback: "5",
  idle_timeout: "10",
  create_event_clip: false,
  record_only: false,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tuneDataToForm(tuneData: Record<string, any>): Partial<CameraFormValues> {
  // tuneData comes from GET /tune/{id} and looks like:
  // { camera: { ffmpeg: { host, port, path, name, ... } } }
  const camSection = tuneData?.camera ?? {};
  // Take the first component found (usually "ffmpeg")
  const camConfig: Record<string, any> =
    Object.values(camSection)[0] ?? {};

  const recorder = camConfig.recorder ?? {};
  return {
    name: camConfig.name ?? "",
    stream_format: (camConfig.stream_format as StreamFormat) ?? "rtsp",
    host: camConfig.host ?? "",
    port: camConfig.port ? String(camConfig.port) : "",
    path: camConfig.path ?? "/",
    username: camConfig.username ?? "",
    password: camConfig.password ?? "",
    rtsp_transport: camConfig.rtsp_transport ?? "tcp",
    width: camConfig.width ? String(camConfig.width) : "",
    height: camConfig.height ? String(camConfig.height) : "",
    fps: camConfig.fps ? String(camConfig.fps) : "",
    continuous_recording: recorder.continuous_recording ?? camConfig.continuous_recording ?? true,
    lookback: recorder.lookback != null ? String(recorder.lookback) : "5",
    idle_timeout: recorder.idle_timeout != null ? String(recorder.idle_timeout) : "10",
    create_event_clip: recorder.create_event_clip ?? false,
    record_only: camConfig.record_only ?? false,
  };
}

function formToTuneData(values: CameraFormValues): Record<string, any> {
  const isFile = values.stream_format === "mp4";

  const base: Record<string, any> = {
    stream_format: values.stream_format,
    path: values.path || "/",
  };

  if (values.name.trim()) base.name = values.name.trim();

  if (!isFile) {
    base.host = values.host;
    if (values.port) base.port = parseInt(values.port, 10);
    if (values.username.trim()) base.username = values.username.trim();
    if (values.password.trim()) base.password = values.password.trim();
    if (values.stream_format === "rtsp") {
      base.rtsp_transport = values.rtsp_transport;
    }
  }

  if (values.width) base.width = parseInt(values.width, 10);
  if (values.height) base.height = parseInt(values.height, 10);
  if (values.fps) base.fps = parseInt(values.fps, 10);

  base.recorder = {
    continuous_recording: values.continuous_recording,
    lookback: parseInt(values.lookback || "5", 10),
    idle_timeout: parseInt(values.idle_timeout || "10", 10),
    create_event_clip: values.create_event_clip,
  };

  if (values.record_only) base.record_only = true;

  return base;
}

function validate(
  values: CameraFormValues,
  mode: DialogMode,
): Record<string, string> {
  const errors: Record<string, string> = {};
  const isFile = values.stream_format === "mp4";

  if (mode === "create") {
    if (!values.identifier.trim()) {
      errors.identifier = "Required";
    } else if (!/^[a-z0-9_]+$/.test(values.identifier)) {
      errors.identifier =
        "Only lowercase letters, digits and underscores allowed";
    }
  }

  if (!isFile) {
    if (!values.host.trim()) errors.host = "Required";
    if (!values.port.trim()) {
      errors.port = "Required";
    } else if (isNaN(parseInt(values.port, 10)) || parseInt(values.port, 10) < 1) {
      errors.port = "Must be a positive integer";
    }
  }

  if (!values.path.trim()) errors.path = "Required";

  const numFields: Array<keyof CameraFormValues> = ["width", "height", "fps", "lookback", "idle_timeout"];
  for (const f of numFields) {
    const v = values[f] as string;
    if (v && isNaN(parseInt(v, 10))) {
      errors[f] = "Must be a number";
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Section header
// ---------------------------------------------------------------------------

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ mt: 2.5, mb: 1 }}>
      <Typography variant="caption" color="text.secondary" fontWeight="bold" sx={{ textTransform: "uppercase", letterSpacing: 0.8 }}>
        {children}
      </Typography>
      <Divider sx={{ mt: 0.5 }} />
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Main Dialog Component
// ---------------------------------------------------------------------------

export function CameraPropDialog({
  open,
  mode,
  camera,
  onClose,
}: CameraPropDialogProps) {
  const isEdit = mode === "edit";

  const tuneQuery = useTuneConfig({
    camera_identifier: camera?.identifier ?? "",
    configOptions: { enabled: isEdit && open && !!camera?.identifier },
  });

  // Detect component from tune data (default "ffmpeg")
  const component = useMemo(() => {
    if (!tuneQuery.data) return "ffmpeg";
    const camSection = tuneQuery.data?.camera ?? {};
    return Object.keys(camSection)[0] ?? "ffmpeg";
  }, [tuneQuery.data]);

  const createMutation = useCreateCamera({
    onSuccess: () => onClose(),
  });

  const updateMutation = useUpdateTuneConfig(camera?.identifier ?? "", {
    onSuccess: () => onClose(),
  });

  const [values, setValues] = useState<CameraFormValues>(DEFAULT_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Pre-fill for edit
  useEffect(() => {
    if (isEdit && tuneQuery.data) {
      const apply = () => {
        setValues((prev) => ({ ...prev, ...tuneDataToForm(tuneQuery.data!) }));
        setErrors({});
        setTouched({});
      };
      apply();
    }
  }, [isEdit, tuneQuery.data]);

  // Reset on open
  useEffect(() => {
    if (open && mode === "create") {
      const reset = () => {
        setValues(DEFAULT_FORM);
        setErrors({});
        setTouched({});
      };
      reset();
    }
  }, [open, mode]);

  function set(field: keyof CameraFormValues, value: any) {
    setValues((prev) => {
      const next = { ...prev, [field]: value };
      // When stream_format changes, update default port
      if (field === "stream_format") {
        const defaults = STREAM_FORMAT_DEFAULTS[value as StreamFormat] ?? {};
        return { ...next, ...defaults };
      }
      return next;
    });
    setTouched((prev) => ({ ...prev, [field]: true }));
  }

  const handleSubmit = () => {
    const allTouched = Object.fromEntries(
      Object.keys(values).map((k) => [k, true]),
    );
    setTouched(allTouched);

    const errs = validate(values, mode);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const data = formToTuneData(values);

    if (mode === "create") {
      createMutation.mutate({
        component: "ffmpeg",
        identifier: values.identifier,
        data,
      });
    } else if (camera) {
      updateMutation.mutate({
        domain: "camera",
        component,
        data,
      });
    }
  };

  const isLoading =
    (isEdit && tuneQuery.isPending) ||
    createMutation.isPending ||
    updateMutation.isPending;

  const isFile = values.stream_format === "mp4";

  function fieldError(field: string) {
    return touched[field] ? errors[field] : undefined;
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle
        sx={{ display: "flex", alignItems: "center", gap: 1 }}
      >
        {isEdit ? <EditIcon fontSize="small" /> : <AddIcon fontSize="small" />}
        {isEdit ? `Edit Camera: ${camera?.name ?? camera?.identifier}` : "Add Camera"}
      </DialogTitle>

      <DialogContent dividers>
        {isEdit && tuneQuery.isPending ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {/* ── Identity ──────────────────────────────────── */}
            <SectionTitle>Identity</SectionTitle>

            {mode === "create" && (
              <TextField
                label="Camera Identifier"
                value={values.identifier}
                onChange={(e) => set("identifier", e.target.value.toLowerCase())}
                error={!!fieldError("identifier")}
                helperText={
                  fieldError("identifier") ??
                  "Unique slug, e.g. front_door (lowercase, digits, underscores)"
                }
                required
                size="small"
                fullWidth
              />
            )}

            <TextField
              label="Friendly Name"
              value={values.name}
              onChange={(e) => set("name", e.target.value)}
              helperText="Optional display name"
              size="small"
              fullWidth
            />

            {/* ── Connection ────────────────────────────────── */}
            <SectionTitle>Connection</SectionTitle>

            <FormControl size="small" fullWidth>
              <InputLabel>Stream Format</InputLabel>
              <Select
                label="Stream Format"
                value={values.stream_format}
                onChange={(e) => set("stream_format", e.target.value)}
              >
                <MenuItem value="rtsp">RTSP — IP camera stream</MenuItem>
                <MenuItem value="rtmp">RTMP — live stream server</MenuItem>
                <MenuItem value="mjpeg">MJPEG — HTTP motion JPEG</MenuItem>
                <MenuItem value="mp4">MP4 — local file / loopback</MenuItem>
              </Select>
              <FormHelperText>Protocol used to connect to the source</FormHelperText>
            </FormControl>

            {/* Network fields (not for mp4) */}
            {!isFile && (
              <>
                <TextField
                  label="Host"
                  value={values.host}
                  onChange={(e) => set("host", e.target.value)}
                  error={!!fieldError("host")}
                  helperText={fieldError("host") ?? "IP address or hostname"}
                  required
                  size="small"
                  fullWidth
                />

                <Box sx={{ display: "flex", gap: 2 }}>
                  <TextField
                    label="Port"
                    type="number"
                    value={values.port}
                    onChange={(e) => set("port", e.target.value)}
                    error={!!fieldError("port")}
                    helperText={fieldError("port")}
                    required
                    size="small"
                    sx={{ width: 120, flexShrink: 0 }}
                    slotProps={{ htmlInput: { min: 1, max: 65535 } }}
                  />
                  <TextField
                    label="Path"
                    value={values.path}
                    onChange={(e) => set("path", e.target.value)}
                    error={!!fieldError("path")}
                    helperText={fieldError("path") ?? "e.g. /Streaming/Channels/101/"}
                    required
                    size="small"
                    fullWidth
                  />
                </Box>

                <Box sx={{ display: "flex", gap: 2 }}>
                  <TextField
                    label="Username"
                    value={values.username}
                    onChange={(e) => set("username", e.target.value)}
                    helperText="Leave blank if not required"
                    size="small"
                    fullWidth
                  />
                  <TextField
                    label="Password"
                    type="password"
                    value={values.password}
                    onChange={(e) => set("password", e.target.value)}
                    size="small"
                    fullWidth
                  />
                </Box>
              </>
            )}

            {/* File path for MP4 */}
            {isFile && (
              <TextField
                label="File Path"
                value={values.path}
                onChange={(e) => set("path", e.target.value)}
                error={!!fieldError("path")}
                helperText={
                  fieldError("path") ??
                  "Absolute path to the MP4 file, e.g. /home/user/video.mp4"
                }
                required
                size="small"
                fullWidth
              />
            )}

            {/* RTSP transport */}
            {values.stream_format === "rtsp" && (
              <FormControl size="small" fullWidth>
                <InputLabel>RTSP Transport</InputLabel>
                <Select
                  label="RTSP Transport"
                  value={values.rtsp_transport}
                  onChange={(e) =>
                    set("rtsp_transport", e.target.value as RtspTransport)
                  }
                >
                  <MenuItem value="tcp">TCP (recommended)</MenuItem>
                  <MenuItem value="udp">UDP</MenuItem>
                  <MenuItem value="udp_multicast">UDP Multicast</MenuItem>
                  <MenuItem value="http">HTTP tunnel</MenuItem>
                </Select>
                <FormHelperText>
                  Change to UDP if the camera does not support TCP
                </FormHelperText>
              </FormControl>
            )}

            {/* ── Stream Resolution ─────────────────────────── */}
            <SectionTitle>
              Stream Resolution{" "}
              <Chip label="auto-detect if blank" size="small" sx={{ ml: 1, verticalAlign: "middle" }} />
            </SectionTitle>

            <Box sx={{ display: "flex", gap: 2 }}>
              <TextField
                label="Width (px)"
                type="number"
                value={values.width}
                onChange={(e) => set("width", e.target.value)}
                error={!!fieldError("width")}
                helperText={fieldError("width")}
                size="small"
                fullWidth
                slotProps={{ htmlInput: { min: 1 } }}
              />
              <TextField
                label="Height (px)"
                type="number"
                value={values.height}
                onChange={(e) => set("height", e.target.value)}
                error={!!fieldError("height")}
                helperText={fieldError("height")}
                size="small"
                fullWidth
                slotProps={{ htmlInput: { min: 1 } }}
              />
              <TextField
                label="FPS"
                type="number"
                value={values.fps}
                onChange={(e) => set("fps", e.target.value)}
                error={!!fieldError("fps")}
                helperText={fieldError("fps")}
                size="small"
                fullWidth
                slotProps={{ htmlInput: { min: 1, max: 120 } }}
              />
            </Box>

            {/* ── Recorder ──────────────────────────────────── */}
            <SectionTitle>Recorder</SectionTitle>

            <FormControlLabel
              control={
                <Switch
                  checked={values.continuous_recording}
                  onChange={(e) => set("continuous_recording", e.target.checked)}
                />
              }
              label="Continuous recording"
            />
            <FormHelperText sx={{ mt: -1.5 }}>
              Keep segment files even when no event is triggered
            </FormHelperText>

            <Box sx={{ display: "flex", gap: 2 }}>
              <TextField
                label="Lookback (s)"
                type="number"
                value={values.lookback}
                onChange={(e) => set("lookback", e.target.value)}
                error={!!fieldError("lookback")}
                helperText={fieldError("lookback") ?? "Seconds to include before event"}
                size="small"
                fullWidth
                slotProps={{ htmlInput: { min: 0 } }}
              />
              <TextField
                label="Idle Timeout (s)"
                type="number"
                value={values.idle_timeout}
                onChange={(e) => set("idle_timeout", e.target.value)}
                error={!!fieldError("idle_timeout")}
                helperText={
                  fieldError("idle_timeout") ?? "Stop recording after N seconds of inactivity"
                }
                size="small"
                fullWidth
                slotProps={{ htmlInput: { min: 0 } }}
              />
            </Box>

            <FormControlLabel
              control={
                <Switch
                  checked={values.create_event_clip}
                  onChange={(e) => set("create_event_clip", e.target.checked)}
                />
              }
              label="Create event clip"
            />
            <FormHelperText sx={{ mt: -1.5 }}>
              Automatically concatenate segments into a single MP4 per event
            </FormHelperText>

            {/* ── Advanced ──────────────────────────────────── */}
            <SectionTitle>Advanced</SectionTitle>

            <FormControlLabel
              control={
                <Switch
                  checked={values.record_only}
                  onChange={(e) => set("record_only", e.target.checked)}
                />
              }
              label="Record only (no image processing)"
            />
            <FormHelperText sx={{ mt: -1.5 }}>
              Disable object detection / motion analysis on this camera
            </FormHelperText>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={handleSubmit}
          disabled={isLoading}
        >
          {isLoading ? "Saving…" : isEdit ? "Save Changes" : "Add Camera"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
