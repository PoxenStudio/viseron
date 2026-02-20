import Box from "@mui/material/Box";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useState } from "react";

function AdvancedSettings() {
  const [debugMode, setDebugMode] = useState(false);
  const [snapshotWidth, setSnapshotWidth] = useState("1280");
  const [maxWorkers, setMaxWorkers] = useState("4");

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Advanced Settings
      </Typography>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <FormControlLabel
          control={
            <Switch
              checked={debugMode}
              onChange={(e) => setDebugMode(e.target.checked)}
            />
          }
          label="Debug Mode"
        />
        <TextField
          label="Snapshot Width (px)"
          type="number"
          value={snapshotWidth}
          onChange={(e) => setSnapshotWidth(e.target.value)}
          sx={{ maxWidth: 280 }}
          slotProps={{ htmlInput: { min: 100 } }}
        />
        <TextField
          label="Max Worker Threads"
          type="number"
          value={maxWorkers}
          onChange={(e) => setMaxWorkers(e.target.value)}
          sx={{ maxWidth: 280 }}
          slotProps={{ htmlInput: { min: 1, max: 32 } }}
        />
      </Box>
    </Box>
  );
}

export default AdvancedSettings;
