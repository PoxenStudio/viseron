/**
 * Object Detector Settings
 *
 * Per-camera object detection configuration. Shows FPS / scan settings and a
 * full CRUD interface for detection labels (confidence threshold, trigger
 * logic, storage options).
 *
 * Data is loaded from and saved to /api/v1/tune/{camera_id} using the
 * "object_detector" domain. Available label names (if provided by the
 * backend) are used to populate the label selector.
 *
 * Dependency note: settings only apply if the camera has an object_detector
 * entry in config.yaml (e.g. darknet.object_detector.cameras.{id}).
 */
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import SaveIcon from "@mui/icons-material/Save";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormHelperText from "@mui/material/FormHelperText";
import IconButton from "@mui/material/IconButton";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Switch from "@mui/material/Switch";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useEffect, useMemo, useState } from "react";

import { Loading } from "components/loading/Loading";
import { useCameras } from "lib/api/cameras";
import { useTuneConfig, useUpdateTuneConfig } from "lib/api/tune";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LabelConfig {
  label: string;
  confidence: number;
  trigger_event_recording: boolean;
  require_motion: boolean;
  store: boolean;
  store_interval: number;
}

interface ObjectDetectorFormValues {
  fps: string;
  scan_on_motion_only: boolean;
  log_all_objects: boolean;
  max_frame_age: string;
  labels: LabelConfig[];
}

const DEFAULT_LABEL: LabelConfig = {
  label: "person",
  confidence: 0.8,
  trigger_event_recording: true,
  require_motion: false,
  store: true,
  store_interval: 60,
};

const DEFAULT_FORM: ObjectDetectorFormValues = {
  fps: "1",
  scan_on_motion_only: true,
  log_all_objects: false,
  max_frame_age: "2",
  labels: [],
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
): { form: ObjectDetectorFormValues; component: string; availableLabels: string[] } | null {
  const odSection = tuneData?.object_detector;
  if (!odSection || typeof odSection !== "object") return null;

  const componentName = Object.keys(odSection)[0];
  if (!componentName) return null;

  const cfg = odSection[componentName] ?? {};
  const rawLabels: any[] = Array.isArray(cfg.labels) ? cfg.labels : [];
  const availableLabels: string[] = Array.isArray(cfg.available_labels)
    ? cfg.available_labels
    : [];

  const labels: LabelConfig[] = rawLabels.map((l: any) => ({
    label: l.label ?? "person",
    confidence: l.confidence ?? 0.8,
    trigger_event_recording: l.trigger_event_recording ?? true,
    require_motion: l.require_motion ?? false,
    store: l.store ?? true,
    store_interval: l.store_interval ?? 60,
  }));

  return {
    component: componentName,
    availableLabels,
    form: {
      fps: cfg.fps != null ? String(cfg.fps) : "1",
      scan_on_motion_only: cfg.scan_on_motion_only ?? true,
      log_all_objects: cfg.log_all_objects ?? false,
      max_frame_age: cfg.max_frame_age != null ? String(cfg.max_frame_age) : "2",
      labels,
    },
  };
}

function formToData(values: ObjectDetectorFormValues): Record<string, any> {
  return {
    fps: parseInt(values.fps, 10) || 1,
    scan_on_motion_only: values.scan_on_motion_only,
    log_all_objects: values.log_all_objects,
    max_frame_age: parseFloat(values.max_frame_age) || 2,
    labels: values.labels,
  };
}

// ---------------------------------------------------------------------------
// Add-label inline form
// ---------------------------------------------------------------------------

interface AddLabelRowProps {
  availableLabels: string[];
  onAdd: (label: LabelConfig) => void;
  existingLabels: string[];
}

function AddLabelRow({ availableLabels, onAdd, existingLabels }: AddLabelRowProps) {
  const [draft, setDraft] = useState<LabelConfig>({ ...DEFAULT_LABEL });
  const [customLabel, setCustomLabel] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const handleAdd = () => {
    const labelName = useCustom || availableLabels.length === 0
      ? customLabel.trim()
      : draft.label;
    if (!labelName) return;

    onAdd({ ...draft, label: labelName });
    setDraft({ ...DEFAULT_LABEL });
    setCustomLabel("");
    setShowForm(false);
  };

  if (!showForm) {
    return (
      <Box sx={{ mt: 1 }}>
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={() => setShowForm(true)}
        >
          Add Label
        </Button>
      </Box>
    );
  }

  return (
    <Paper variant="outlined" sx={{ p: 2, mt: 1.5 }}>
      <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
        New Detection Label
      </Typography>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "flex-start" }}>
        {/* Label name */}
        {availableLabels.length > 0 && !useCustom ? (
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Label</InputLabel>
            <Select
              label="Label"
              value={draft.label}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
            >
              {availableLabels
                .filter((l) => !existingLabels.includes(l))
                .map((l) => (
                  <MenuItem key={l} value={l}>
                    {l}
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
        ) : (
          <TextField
            label="Label Name"
            size="small"
            value={customLabel}
            onChange={(e) => setCustomLabel(e.target.value)}
            sx={{ width: 160 }}
          />
        )}
        {availableLabels.length > 0 && (
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={useCustom}
                onChange={(e) => setUseCustom(e.target.checked)}
              />
            }
            label="Custom label"
          />
        )}

        {/* Confidence */}
        <TextField
          label="Confidence (0–1)"
          type="number"
          size="small"
          sx={{ width: 160 }}
          value={draft.confidence}
          onChange={(e) =>
            setDraft({ ...draft, confidence: parseFloat(e.target.value) })
          }
          slotProps={{ htmlInput: { step: 0.05, min: 0, max: 1 } }}
        />

        {/* Toggles */}
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={draft.trigger_event_recording}
              onChange={(e) =>
                setDraft({ ...draft, trigger_event_recording: e.target.checked })
              }
            />
          }
          label="Trigger recording"
        />
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={draft.require_motion}
              onChange={(e) =>
                setDraft({ ...draft, require_motion: e.target.checked })
              }
            />
          }
          label="Require motion"
        />
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={draft.store}
              onChange={(e) => setDraft({ ...draft, store: e.target.checked })}
            />
          }
          label="Store snapshots"
        />
        {draft.store && (
          <TextField
            label="Store interval (s)"
            type="number"
            size="small"
            sx={{ width: 140 }}
            value={draft.store_interval}
            onChange={(e) =>
              setDraft({ ...draft, store_interval: parseInt(e.target.value, 10) })
            }
            slotProps={{ htmlInput: { min: 1 } }}
          />
        )}
      </Box>

      <Box sx={{ display: "flex", gap: 1, mt: 2 }}>
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={handleAdd}>
          Add
        </Button>
        <Button size="small" onClick={() => setShowForm(false)}>
          Cancel
        </Button>
      </Box>
    </Paper>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function ObjectDetectorSettings() {
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

  const parsed = useMemo(
    () => (tuneQuery.data ? tuneToForm(tuneQuery.data) : null),
    [tuneQuery.data],
  );

  const [values, setValues] = useState<ObjectDetectorFormValues>(DEFAULT_FORM);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const syncState = () => {
      if (parsed) {
        setValues(parsed.form);
        setDirty(false);
      } else if (!tuneQuery.isPending && selectedCameraId) {
        setValues(DEFAULT_FORM);
        setDirty(false);
      }
    };
    syncState();
  }, [parsed, tuneQuery.isPending, selectedCameraId]);

  const updateMutation = useUpdateTuneConfig(selectedCameraId, {
    onSuccess: () => setDirty(false),
  });

  const setField = (key: keyof ObjectDetectorFormValues, value: any) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const addLabel = (label: LabelConfig) => {
    setValues((prev) => ({ ...prev, labels: [...prev.labels, label] }));
    setDirty(true);
  };

  const removeLabel = (index: number) => {
    setValues((prev) => ({
      ...prev,
      labels: prev.labels.filter((_, i) => i !== index),
    }));
    setDirty(true);
  };

  const updateLabelField = (
    index: number,
    key: keyof LabelConfig,
    value: any,
  ) => {
    setValues((prev) => {
      const labels = prev.labels.map((l, i) =>
        i === index ? { ...l, [key]: value } : l,
      );
      return { ...prev, labels };
    });
    setDirty(true);
  };

  const handleSave = () => {
    if (!parsed) return;
    updateMutation.mutate({
      domain: "object_detector",
      component: parsed.component,
      data: formToData(values),
    });
  };

  // ── Render ────────────────────────────────────────────────

  if (camerasQuery.isPending) return <Loading text="Loading cameras…" />;
  if (camerasQuery.isError)
    return <Typography color="error">Failed to load camera list.</Typography>;

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
        <Typography variant="h6">Object Detector Settings</Typography>
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

      {cameraOptions.length === 0 ? (
        <Typography color="text.secondary">
          No cameras found. Add a camera first.
        </Typography>
      ) : (
        <>
          {/* Camera selector */}
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
            <Alert severity="info" icon={<InfoOutlinedIcon />} sx={{ mt: 1 }}>
              No object detector is configured for{" "}
              <strong>{selectedCameraId}</strong>. Add a{" "}
              <code>darknet.object_detector.cameras.{selectedCameraId}</code>{" "}
              entry to <code>config.yaml</code> to enable it.
            </Alert>
          ) : (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: 2,
                maxWidth: 900,
              }}
            >
              {/* ── Scanning ──────────────────────────────── */}
              <Section>Scanning</Section>

              <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                <TextField
                  label="FPS"
                  type="number"
                  value={values.fps}
                  onChange={(e) => setField("fps", e.target.value)}
                  helperText="Frames per second to analyze"
                  size="small"
                  sx={{ width: 100 }}
                  slotProps={{ htmlInput: { min: 1, max: 30 } }}
                />
                <TextField
                  label="Max Frame Age (s)"
                  type="number"
                  value={values.max_frame_age}
                  onChange={(e) => setField("max_frame_age", e.target.value)}
                  helperText="Discard frames older than this"
                  size="small"
                  sx={{ width: 160 }}
                  slotProps={{ htmlInput: { step: 0.5, min: 0 } }}
                />
              </Box>

              <Box sx={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                <Box>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={values.scan_on_motion_only}
                        onChange={(e) =>
                          setField("scan_on_motion_only", e.target.checked)
                        }
                      />
                    }
                    label="Scan on motion only"
                  />
                  <FormHelperText sx={{ mt: -0.5 }}>
                    Skip object detection frames when no motion is detected
                  </FormHelperText>
                </Box>
                <Box>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={values.log_all_objects}
                        onChange={(e) =>
                          setField("log_all_objects", e.target.checked)
                        }
                      />
                    }
                    label="Log all objects"
                  />
                  <FormHelperText sx={{ mt: -0.5 }}>
                    Log every detected object regardless of configured labels
                  </FormHelperText>
                </Box>
              </Box>

              {/* ── Labels ────────────────────────────────── */}
              <Section>Detection Labels</Section>

              {values.labels.length === 0 ? (
                <Typography color="text.secondary" variant="body2">
                  No labels configured. All detected objects will be ignored.
                </Typography>
              ) : (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Label</TableCell>
                        <TableCell align="center">Confidence</TableCell>
                        <TableCell align="center">Trigger Recording</TableCell>
                        <TableCell align="center">Require Motion</TableCell>
                        <TableCell align="center">Store</TableCell>
                        <TableCell align="center">Store Interval (s)</TableCell>
                        <TableCell align="center">Remove</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {values.labels.map((label, index) => (
                        <TableRow key={label.label}>
                          <TableCell>
                            <Typography variant="body2" fontWeight="medium">
                              {label.label}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <TextField
                              type="number"
                              value={label.confidence}
                              onChange={(e) =>
                                updateLabelField(
                                  index,
                                  "confidence",
                                  parseFloat(e.target.value),
                                )
                              }
                              size="small"
                              sx={{ width: 90 }}
                              slotProps={{
                                htmlInput: { step: 0.05, min: 0, max: 1 },
                              }}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Switch
                              size="small"
                              checked={label.trigger_event_recording}
                              onChange={(e) =>
                                updateLabelField(
                                  index,
                                  "trigger_event_recording",
                                  e.target.checked,
                                )
                              }
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Switch
                              size="small"
                              checked={label.require_motion}
                              onChange={(e) =>
                                updateLabelField(
                                  index,
                                  "require_motion",
                                  e.target.checked,
                                )
                              }
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Switch
                              size="small"
                              checked={label.store}
                              onChange={(e) =>
                                updateLabelField(index, "store", e.target.checked)
                              }
                            />
                          </TableCell>
                          <TableCell align="center">
                            <TextField
                              type="number"
                              value={label.store_interval}
                              onChange={(e) =>
                                updateLabelField(
                                  index,
                                  "store_interval",
                                  parseInt(e.target.value, 10),
                                )
                              }
                              disabled={!label.store}
                              size="small"
                              sx={{ width: 80 }}
                              slotProps={{ htmlInput: { min: 1 } }}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Tooltip title="Remove label">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => removeLabel(index)}
                              >
                                <DeleteOutlineIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              <AddLabelRow
                availableLabels={parsed.availableLabels}
                existingLabels={values.labels.map((l) => l.label)}
                onAdd={(label) => addLabel(label)}
              />
            </Box>
          )}
        </>
      )}
    </Box>
  );
}
