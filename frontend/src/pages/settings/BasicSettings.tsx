import Box from "@mui/material/Box";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useState } from "react";

function BasicSettings() {
  const [motionDetection, setMotionDetection] = useState(true);
  const [objectDetection, setObjectDetection] = useState(true);
  const [retentionDays, setRetentionDays] = useState("30");

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Basic Settings
      </Typography>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <FormControlLabel
          control={
            <Switch
              checked={motionDetection}
              onChange={(e) => setMotionDetection(e.target.checked)}
            />
          }
          label="Motion Detection"
        />
        <FormControlLabel
          control={
            <Switch
              checked={objectDetection}
              onChange={(e) => setObjectDetection(e.target.checked)}
            />
          }
          label="Object Detection"
        />
        <TextField
          label="Recording Retention (days)"
          type="number"
          value={retentionDays}
          onChange={(e) => setRetentionDays(e.target.value)}
          sx={{ maxWidth: 280 }}
          slotProps={{ htmlInput: { min: 1, max: 365 } }}
        />
      </Box>
    </Box>
  );
}

export default BasicSettings;
