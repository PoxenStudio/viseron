/**
 * Logger Settings
 *
 * Global Viseron logging configuration. Reads and writes the top-level
 * "logger" section of config.yaml via GET/PUT /api/v1/config/logger.
 *
 * Provides:
 *  - Default log level for all loggers
 *  - Per-module overrides  (e.g. viseron.components.ffmpeg → debug)
 *  - Per-camera overrides  (camera identifier → level)
 *
 * Dependency note: saving requires a restart for the new log levels to apply
 * to already-running loggers (though the backend re-applies them on start-up).
 */
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import SaveIcon from "@mui/icons-material/Save";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import FormHelperText from "@mui/material/FormHelperText";
import IconButton from "@mui/material/IconButton";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useEffect, useState } from "react";

import { Loading } from "components/loading/Loading";
import { useCameras } from "lib/api/cameras";
import {
  LoggerConfig,
  useComponentConfig,
  useUpdateComponentConfig,
} from "lib/api/componentConfig";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LOG_LEVELS = ["debug", "info", "warning", "error", "critical"] as const;
type LogLevel = (typeof LOG_LEVELS)[number];

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

// ---------------------------------------------------------------------------
// Inline key-value row for module overrides
// ---------------------------------------------------------------------------

interface KvRowProps {
  keyLabel: string;
  keyHelperText?: string;
  entries: Array<{ key: string; level: LogLevel }>;
  onChange: (entries: Array<{ key: string; level: LogLevel }>) => void;
  keySuggestions?: string[];
}

function KvTable({
  keyLabel,
  keyHelperText,
  entries,
  onChange,
  keySuggestions = [],
}: KvRowProps) {
  const [newKey, setNewKey] = useState("");
  const [newLevel, setNewLevel] = useState<LogLevel>("debug");

  const handleAdd = () => {
    const trimmed = newKey.trim();
    if (!trimmed) return;
    if (entries.some((e) => e.key === trimmed)) return; // skip duplicate
    onChange([...entries, { key: trimmed, level: newLevel }]);
    setNewKey("");
    setNewLevel("debug");
  };

  const handleLevelChange = (index: number, level: LogLevel) => {
    onChange(entries.map((e, i) => (i === index ? { ...e, level } : e)));
  };

  const handleRemove = (index: number) => {
    onChange(entries.filter((_, i) => i !== index));
  };

  return (
    <Box>
      {entries.length > 0 && (
        <Table size="small" sx={{ mb: 1.5 }}>
          <TableHead>
            <TableRow>
              <TableCell>{keyLabel}</TableCell>
              <TableCell>Level</TableCell>
              <TableCell padding="none" />
            </TableRow>
          </TableHead>
          <TableBody>
            {entries.map(({ key, level }, index) => (
              <TableRow key={key}>
                <TableCell>
                  <Typography variant="body2" fontFamily="monospace">
                    {key}
                  </Typography>
                </TableCell>
                <TableCell>
                  <FormControl size="small" sx={{ minWidth: 140 }}>
                    <Select
                      value={level}
                      onChange={(e) =>
                        handleLevelChange(index, e.target.value as LogLevel)
                      }
                    >
                      {LOG_LEVELS.map((l) => (
                        <MenuItem key={l} value={l}>
                          {l}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </TableCell>
                <TableCell padding="none">
                  <Tooltip title="Remove">
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleRemove(index)}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Add row */}
      <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start", flexWrap: "wrap" }}>
        {keySuggestions.length > 0 ? (
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel>{keyLabel}</InputLabel>
            <Select
              label={keyLabel}
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              displayEmpty
            >
              <MenuItem value="">
                <Typography variant="body2" color="text.secondary">
                  — select —
                </Typography>
              </MenuItem>
              {keySuggestions
                .filter((s) => !entries.some((e) => e.key === s))
                .map((s) => (
                  <MenuItem key={s} value={s}>
                    {s}
                  </MenuItem>
                ))}
            </Select>
            {keyHelperText && <FormHelperText>{keyHelperText}</FormHelperText>}
          </FormControl>
        ) : (
          <TextField
            label={keyLabel}
            size="small"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            helperText={keyHelperText}
            sx={{ minWidth: 280 }}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
        )}
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Level</InputLabel>
          <Select
            label="Level"
            value={newLevel}
            onChange={(e) => setNewLevel(e.target.value as LogLevel)}
          >
            {LOG_LEVELS.map((l) => (
              <MenuItem key={l} value={l}>
                {l}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button
          variant="outlined"
          size="small"
          startIcon={<AddIcon />}
          onClick={handleAdd}
          disabled={!newKey.trim()}
          sx={{ mt: 0.5 }}
        >
          Add
        </Button>
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function LoggerSettings() {
  const configQuery = useComponentConfig<LoggerConfig>("logger");
  const updateMutation = useUpdateComponentConfig("logger");
  const camerasQuery = useCameras({});

  const [defaultLevel, setDefaultLevel] = useState<LogLevel>("info");
  const [logEntries, setLogEntries] = useState<
    Array<{ key: string; level: LogLevel }>
  >([]);
  const [cameraEntries, setCameraEntries] = useState<
    Array<{ key: string; level: LogLevel }>
  >([]);
  const [dirty, setDirty] = useState(false);

  // Populate form when config loads
  useEffect(() => {
    if (!configQuery.data) return;
    const cfg = configQuery.data;
    const applyConfig = () => {
      setDefaultLevel((cfg.default_level as LogLevel) ?? "info");

      const logs = cfg.logs ?? {};
      setLogEntries(
        Object.entries(logs).map(([key, level]) => ({
          key,
          level: level as LogLevel,
        })),
      );

      const cameras = cfg.cameras ?? {};
      setCameraEntries(
        Object.entries(cameras).map(([key, level]) => ({
          key,
          level: level as LogLevel,
        })),
      );
      setDirty(false);
    };
    applyConfig();
  }, [configQuery.data]);

  const mark = () => {
    setDirty(true);
  };

  const handleSave = () => {
    const logs = Object.fromEntries(logEntries.map(({ key, level }) => [key, level]));
    const cameras = Object.fromEntries(
      cameraEntries.map(({ key, level }) => [key, level]),
    );

    const payload: LoggerConfig = {
      default_level: defaultLevel,
      logs: Object.keys(logs).length > 0 ? logs : undefined,
      cameras: Object.keys(cameras).length > 0 ? cameras : undefined,
    };

    updateMutation.mutate(payload, {
      onSuccess: () => setDirty(false),
    });
  };

  // Camera identifiers for suggestions
  const cameraIds = Object.keys(camerasQuery.data ?? {});

  if (configQuery.isPending) return <Loading text="Loading logger settings…" />;
  if (configQuery.isError)
    return (
      <Typography color="error">
        Failed to load logger configuration.
      </Typography>
    );

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
        <Typography variant="h6">Logger Settings</Typography>
        <Button
          variant="contained"
          size="small"
          startIcon={<SaveIcon />}
          onClick={handleSave}
          disabled={!dirty || updateMutation.isPending}
        >
          {updateMutation.isPending ? "Saving…" : "Save Changes"}
        </Button>
      </Box>

      <Box sx={{ maxWidth: 700, display: "flex", flexDirection: "column", gap: 2 }}>
        {/* ── Default Level ────────────────────────────────── */}
        <Section>Default Log Level</Section>

        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Default Level</InputLabel>
          <Select
            label="Default Level"
            value={defaultLevel}
            onChange={(e) => {
              setDefaultLevel(e.target.value as LogLevel);
              mark();
            }}
          >
            {LOG_LEVELS.map((l) => (
              <MenuItem key={l} value={l}>
                {l}
              </MenuItem>
            ))}
          </Select>
          <FormHelperText>
            Applied to all loggers unless overridden below
          </FormHelperText>
        </FormControl>

        {/* ── Per-module overrides ─────────────────────────── */}
        <Section>Module Log Level Overrides</Section>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
          Set a specific log level for individual Python logger names (e.g.{" "}
          <code>viseron.components.ffmpeg</code>). Takes precedence over the
          default level.
        </Typography>

        <KvTable
          keyLabel="Logger Name"
          keyHelperText="Full Python logger path, e.g. viseron.components.storage"
          entries={logEntries}
          onChange={(entries) => {
            setLogEntries(entries);
            mark();
          }}
        />

        {/* ── Per-camera overrides ─────────────────────────── */}
        <Section>Per-Camera Log Level Overrides</Section>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
          Override the log level for all loggers containing a specific camera
          identifier. Takes highest precedence.
        </Typography>

        <KvTable
          keyLabel="Camera Identifier"
          keyHelperText="Camera identifier, e.g. front_door"
          entries={cameraEntries}
          onChange={(entries) => {
            setCameraEntries(entries);
            mark();
          }}
          keySuggestions={cameraIds}
        />
      </Box>
    </Box>
  );
}
