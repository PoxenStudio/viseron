/**
 * Motion Detector Settings
 *
 * Per-camera motion detection configuration. Supports the mog2 (MOG2
 * Background Subtractor) component and the shared motion_detector domain
 * settings exposed through the /tune/{camera_id} API.
 *
 * Dependency note: configuration is only meaningful when the camera has a
 * motion_detector component entry in config.yaml (e.g. under mog2.motion_
 * detector.cameras).  If none exists the panel shows a helpful placeholder.
 */
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import SaveIcon from "@mui/icons-material/Save";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
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

import { Loading } from "components/loading/Loading";
import { useCameras } from "lib/api/cameras";
import { useTuneConfig, useUpdateTuneConfig } from "lib/api/tune";

// ---------------------------------------------------------------------------
// Form value types
// ---------------------------------------------------------------------------

interface MotionFormValues {
  // shared motion_detector domain
  fps: string;
  area: string;
  width: string;
  height: string;
  trigger_event_recording: boolean;
  recorder_keepalive: boolean;
  max_recorder_keepalive: string;
  // mog2-specific
  threshold: string;
  history: string;
  detect_shadows: boolean;
  learning_rate: string;
}

const DEFAULT_MOTION_FORM: MotionFormValues = {
  fps: "1",
  area: "0.08",
  width: "300",
  height: "300",
  trigger_event_recording: false,
  recorder_keepalive: true,
  max_recorder_keepalive: "30",
  threshold: "15",
  history: "500",
  detect_shadows: false,
  learning_rate: "0.01",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function Section({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ mt: 2.5, mb: 1 }}>
      <Typography
        variant="caption"
        color="text.secondary"
        fontWeight="bold"
        sx={{ textTransform: "uppercase", letterSpacing: 0.8 }}
      >
        {children}
      </Typography>
      <Divider sx={{ mt: 0.5 }} />
    </Box>
  );
}

function tuneToForm(
  tuneData: Record<string, any>,
): { form: MotionFormValues; component: string } | null {
  const mdSection = tuneData?.motion_detector;
  if (!mdSection || typeof mdSection !== "object") return null;

  const componentName = Object.keys(mdSection)[0];
  if (!componentName) return null;

  const cfg = mdSection[componentName] ?? {};
  return {
    component: componentName,
    form: {
      fps: cfg.fps != null ? String(cfg.fps) : DEFAULT_MOTION_FORM.fps,
      area: cfg.area != null ? String(cfg.area) : DEFAULT_MOTION_FORM.area,
      width: cfg.width != null ? String(cfg.width) : DEFAULT_MOTION_FORM.width,
      height:
        cfg.height != null ? String(cfg.height) : DEFAULT_MOTION_FORM.height,
      trigger_event_recording:
        cfg.trigger_event_recording ??
        DEFAULT_MOTION_FORM.trigger_event_recording,
      recorder_keepalive:
        cfg.recorder_keepalive ?? DEFAULT_MOTION_FORM.recorder_keepalive,
      max_recorder_keepalive:
        cfg.max_recorder_keepalive != null
          ? String(cfg.max_recorder_keepalive)
          : DEFAULT_MOTION_FORM.max_recorder_keepalive,
      threshold:
        cfg.threshold != null
          ? String(cfg.threshold)
          : DEFAULT_MOTION_FORM.threshold,
      history:
        cfg.history != null ? String(cfg.history) : DEFAULT_MOTION_FORM.history,
      detect_shadows:
        cfg.detect_shadows ?? DEFAULT_MOTION_FORM.detect_shadows,
      learning_rate:
        cfg.learning_rate != null
          ? String(cfg.learning_rate)
          : DEFAULT_MOTION_FORM.learning_rate,
    },
  };
}

function formToData(values: MotionFormValues): Record<string, any> {
  const parseNum = (v: string, float = false) => {
    const n = float ? parseFloat(v) : parseInt(v, 10);
    return isNaN(n) ? undefined : n;
  };

  return {
    fps: parseNum(values.fps),
    area: parseNum(values.area, true),
    width: parseNum(values.width),
    height: parseNum(values.height),
    trigger_event_recording: values.trigger_event_recording,
    recorder_keepalive: values.recorder_keepalive,
    max_recorder_keepalive: parseNum(values.max_recorder_keepalive),
    threshold: parseNum(values.threshold),
    history: parseNum(values.history),
    detect_shadows: values.detect_shadows,
    learning_rate: parseNum(values.learning_rate, true),
  };
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function MotionDetectorSettings() {
  const camerasQuery = useCameras({});
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");

  // Auto-select first camera
  useEffect(() => {
    const autoSelect = () => {
      if (!selectedCameraId && camerasQuery.data) {
        const ids = Object.keys(camerasQuery.data);
        if (ids.length > 0) setSelectedCameraId(ids[0]);
      }
    };
    autoSelect();
  }, [camerasQuery.data, selectedCameraId]);

  const tuneQuery = useTuneConfig({
    camera_identifier: selectedCameraId,
    configOptions: { enabled: !!selectedCameraId },
  });

  // Derive component name (mog2 / background_subtractor / …) and default form
  const parsed = useMemo(
    () => (tuneQuery.data ? tuneToForm(tuneQuery.data) : null),
    [tuneQuery.data],
  );

  const [values, setValues] = useState<MotionFormValues>(DEFAULT_MOTION_FORM);
  const [dirty, setDirty] = useState(false);

  // Sync form whenever tune data loads or camera changes
  useEffect(() => {
    const syncState = () => {
      if (parsed) {
        setValues(parsed.form);
        setDirty(false);
      } else if (!tuneQuery.isPending && selectedCameraId) {
        setValues(DEFAULT_MOTION_FORM);
        setDirty(false);
      }
    };
    syncState();
  }, [parsed, tuneQuery.isPending, selectedCameraId]);

  const updateMutation = useUpdateTuneConfig(selectedCameraId, {
    onSuccess: () => setDirty(false),
  });

  const setField = (key: keyof MotionFormValues, value: any) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleSave = () => {
    if (!parsed) return;
    updateMutation.mutate({
      domain: "motion_detector",
      component: parsed.component,
      data: formToData(values),
    });
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (camerasQuery.isPending) return <Loading text="Loading cameras…" />;

  if (camerasQuery.isError)
    return (
      <Typography color="error">Failed to load camera list.</Typography>
    );

  const cameras = camerasQuery.data ?? {};
  const cameraOptions = Object.values(cameras);

  return (
    <Box>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 2,
          gap: 2,
        }}
      >
        <Typography variant="h6">Motion Detector Settings</Typography>
        <Button
          variant="contained"
          size="small"
          startIcon={<SaveIcon />}
          onClick={handleSave}
          disabled={!dirty || !parsed || updateMutation.isPending}
        >
          {updateMutation.isPending ? "Saving…" : "Save Changes"}
        </Button>
      </Box>

      {/* Camera selector */}
      {cameraOptions.length === 0 ? (
        <Typography color="text.secondary">
          No cameras found. Add a camera first.
        </Typography>
      ) : (
        <>
          <FormControl size="small" sx={{ minWidth: 260, mb: 2 }}>
            <InputLabel>Camera</InputLabel>
            <Select
              label="Camera"
              value={selectedCameraId}
              onChange={(e) => {
                setSelectedCameraId(e.target.value);
                setDirty(false);
              }}
            >
              {cameraOptions.map((cam) => (
                <MenuItem key={cam.identifier} value={cam.identifier}>
                  {cam.name} ({cam.identifier})
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {tuneQuery.isPending ? (
            <Loading text="Loading configuration…" />
          ) : !parsed ? (
            <Alert
              severity="info"
              icon={<InfoOutlinedIcon />}
              sx={{ mt: 1 }}
            >
              No motion detector is configured for <strong>{selectedCameraId}</strong>.
              Add a <code>mog2.motion_detector.cameras.{selectedCameraId}</code>{" "}
              entry to <code>config.yaml</code> to enable it.
            </Alert>
          ) : (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: 2,
                maxWidth: 640,
              }}
            >
              {/* ── Scanning ─────────────────────────────────── */}
              <Section>Scanning</Section>

              <Box sx={{ display: "flex", gap: 2 }}>
                <TextField
                  label="FPS"
                  type="number"
                  value={values.fps}
                  onChange={(e) => setField("fps", e.target.value)}
                  helperText="Frames per second to scan for motion"
                  size="small"
                  sx={{ width: 120 }}
                  slotProps={{ htmlInput: { min: 1, max: 30 } }}
                />
                <TextField
                  label="Min Area (0–1)"
                  type="number"
                  value={values.area}
                  onChange={(e) => setField("area", e.target.value)}
                  helperText="Fraction of frame that must move"
                  size="small"
                  sx={{ width: 160 }}
                  slotProps={{ htmlInput: { step: 0.01, min: 0, max: 1 } }}
                />
              </Box>

              <Box sx={{ display: "flex", gap: 2 }}>
                <TextField
                  label="Scan Width (px)"
                  type="number"
                  value={values.width}
                  onChange={(e) => setField("width", e.target.value)}
                  helperText="Frame resized to this width before scanning"
                  size="small"
                  fullWidth
                  slotProps={{ htmlInput: { min: 1 } }}
                />
                <TextField
                  label="Scan Height (px)"
                  type="number"
                  value={values.height}
                  onChange={(e) => setField("height", e.target.value)}
                  helperText="Frame resized to this height before scanning"
                  size="small"
                  fullWidth
                  slotProps={{ htmlInput: { min: 1 } }}
                />
              </Box>

              {/* ── Recording ────────────────────────────────── */}
              <Section>Recording</Section>

              <FormControlLabel
                control={
                  <Switch
                    checked={values.trigger_event_recording}
                    onChange={(e) =>
                      setField("trigger_event_recording", e.target.checked)
                    }
                  />
                }
                label="Trigger event recording"
              />
              <FormHelperText sx={{ mt: -1.5 }}>
                Start a recording clip when motion is detected
              </FormHelperText>

              <FormControlLabel
                control={
                  <Switch
                    checked={values.recorder_keepalive}
                    onChange={(e) =>
                      setField("recorder_keepalive", e.target.checked)
                    }
                  />
                }
                label="Recorder keepalive"
              />
              <FormHelperText sx={{ mt: -1.5 }}>
                Keep recording while motion persists
              </FormHelperText>

              <TextField
                label="Max Keepalive (s)"
                type="number"
                value={values.max_recorder_keepalive}
                onChange={(e) =>
                  setField("max_recorder_keepalive", e.target.value)
                }
                helperText="Maximum seconds to keep the recorder running after motion ends"
                size="small"
                sx={{ width: 200 }}
                slotProps={{ htmlInput: { min: 0 } }}
              />

              {/* ── MOG2 Algorithm ───────────────────────────── */}
              {parsed.component === "mog2" && (
                <>
                  <Section>MOG2 Algorithm</Section>

                  <Box sx={{ display: "flex", gap: 2 }}>
                    <TextField
                      label="Threshold (0–255)"
                      type="number"
                      value={values.threshold}
                      onChange={(e) => setField("threshold", e.target.value)}
                      helperText="Pixel difference to classify as motion (lower = more sensitive)"
                      size="small"
                      fullWidth
                      slotProps={{ htmlInput: { min: 0, max: 255 } }}
                    />
                    <TextField
                      label="History (frames)"
                      type="number"
                      value={values.history}
                      onChange={(e) => setField("history", e.target.value)}
                      helperText="Number of past frames used to build background model"
                      size="small"
                      fullWidth
                      slotProps={{ htmlInput: { min: 1 } }}
                    />
                  </Box>

                  <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
                    <TextField
                      label="Learning Rate"
                      type="number"
                      value={values.learning_rate}
                      onChange={(e) => setField("learning_rate", e.target.value)}
                      helperText="Background model adaptation speed (0=static, 1=instant, -1=auto)"
                      size="small"
                      sx={{ width: 200 }}
                      slotProps={{
                        htmlInput: { step: 0.001, min: -1, max: 1 },
                      }}
                    />
                    <Box>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={values.detect_shadows}
                            onChange={(e) =>
                              setField("detect_shadows", e.target.checked)
                            }
                          />
                        }
                        label="Detect shadows"
                      />
                      <FormHelperText>
                        Count shadows as motion (uses more CPU)
                      </FormHelperText>
                    </Box>
                  </Box>
                </>
              )}
            </Box>
          )}
        </>
      )}
    </Box>
  );
}
