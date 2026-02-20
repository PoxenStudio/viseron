import DeleteIcon from "@mui/icons-material/DeleteOutline";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import { useMemo } from "react";

import { useDeleteCamera, useTuneConfig } from "lib/api/tune";
import * as types from "lib/types";

export interface DeleteCameraDialogProps {
  open: boolean;
  camera: types.Camera | null;
  onClose: () => void;
}

export function DeleteCameraDialog({
  open,
  camera,
  onClose,
}: DeleteCameraDialogProps) {
  const tuneQuery = useTuneConfig({
    camera_identifier: camera?.identifier ?? "",
    configOptions: { enabled: open && !!camera?.identifier },
  });

  // Determine which component owns this camera (needed by delete API)
  const component = useMemo(() => {
    if (!tuneQuery.data) return "ffmpeg";
    const camSection = tuneQuery.data?.camera ?? {};
    return Object.keys(camSection)[0] ?? "ffmpeg";
  }, [tuneQuery.data]);

  const deleteMutation = useDeleteCamera({
    onSuccess: () => onClose(),
  });

  const handleConfirm = () => {
    if (!camera) return;
    deleteMutation.mutate({
      camera_identifier: camera.identifier,
      component,
    });
  };

  const isLoading = deleteMutation.isPending;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <DeleteIcon color="error" fontSize="small" />
        Delete Camera
      </DialogTitle>

      <DialogContent>
        <DialogContentText>
          Are you sure you want to delete{" "}
          <strong>{camera?.name ?? camera?.identifier}</strong>?
        </DialogContentText>
        <DialogContentText sx={{ mt: 1 }} color="warning.main">
          This removes the camera from <code>config.yaml</code>. Viseron must
          be restarted for the change to take effect.
        </DialogContentText>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color="error"
          startIcon={
            isLoading ? (
              <CircularProgress size={16} color="inherit" />
            ) : (
              <DeleteIcon />
            )
          }
          onClick={handleConfirm}
          disabled={isLoading}
        >
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  );
}
