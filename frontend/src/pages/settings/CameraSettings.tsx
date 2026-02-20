import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditIcon from "@mui/icons-material/Edit";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import ListItemText from "@mui/material/ListItemText";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useState } from "react";

import { Loading } from "components/loading/Loading";
import { useCameras } from "lib/api/cameras";
import * as types from "lib/types";

import { CameraPropDialog } from "./CameraPropDialog";
import { DeleteCameraDialog } from "./DeleteCameraDialog";

function CameraSettings() {
  const camerasQuery = useCameras({});

  const [addOpen, setAddOpen] = useState(false);
  const [editCamera, setEditCamera] = useState<types.Camera | null>(null);
  const [deleteCamera, setDeleteCamera] = useState<types.Camera | null>(null);

  if (camerasQuery.isPending) {
    return <Loading text="Loading cameras…" />;
  }

  if (camerasQuery.isError) {
    return <Typography color="error">Failed to load cameras.</Typography>;
  }

  const cameras = camerasQuery.data;

  return (
    <Box>
      {/* Header row */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 2,
        }}
      >
        <Typography variant="h6">Camera Settings</Typography>
        <Button
          variant="contained"
          size="small"
          startIcon={<AddIcon />}
          onClick={() => setAddOpen(true)}
        >
          Add Camera
        </Button>
      </Box>

      {/* Camera list */}
      {!cameras || Object.keys(cameras).length === 0 ? (
        <Typography color="text.secondary">
          No cameras configured. Click &ldquo;Add Camera&rdquo; to get started.
        </Typography>
      ) : (
        Object.values(cameras).map((camera, index) => (
          <Box key={camera.identifier}>
            {index > 0 && <Divider sx={{ my: 1 }} />}
            <Box
              sx={{
                py: 1.5,
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 1,
              }}
            >
              {/* Info */}
              <Box>
                <Typography variant="subtitle1" fontWeight="bold">
                  {camera.name}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  ID: {camera.identifier}
                </Typography>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                  <ListItemText
                    primary="Resolution"
                    secondary={`${camera.width} × ${camera.height}`}
                  />
                  <ListItemText
                    primary="Status"
                    secondary={
                      camera.is_on
                        ? camera.connected
                          ? "Online"
                          : "Connecting…"
                        : "Off"
                    }
                  />
                  <ListItemText
                    primary="Recording"
                    secondary={camera.is_recording ? "Active" : "Inactive"}
                  />
                  <ListItemText
                    primary="Live Stream"
                    secondary={
                      camera.live_stream_available ? "Available" : "Unavailable"
                    }
                  />
                </Box>
              </Box>

              {/* Actions */}
              <Box sx={{ display: "flex", gap: 0.5, flexShrink: 0 }}>
                <Tooltip title="Edit camera">
                  <IconButton
                    size="small"
                    onClick={() => setEditCamera(camera)}
                    aria-label="edit camera"
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete camera">
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => setDeleteCamera(camera)}
                    aria-label="delete camera"
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
          </Box>
        ))
      )}

      {/* Add dialog */}
      <CameraPropDialog
        open={addOpen}
        mode="create"
        onClose={() => setAddOpen(false)}
      />

      {/* Edit dialog */}
      <CameraPropDialog
        open={!!editCamera}
        mode="edit"
        camera={editCamera ?? undefined}
        onClose={() => setEditCamera(null)}
      />

      {/* Delete dialog */}
      <DeleteCameraDialog
        open={!!deleteCamera}
        camera={deleteCamera}
        onClose={() => setDeleteCamera(null)}
      />
    </Box>
  );
}

export default CameraSettings;

