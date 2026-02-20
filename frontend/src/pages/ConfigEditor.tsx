import Container from "@mui/material/Container";
import { lazy } from "react";

import { useHideScrollbar } from "hooks/UseHideScrollbar";
import { useTitle } from "hooks/UseTitle";

const Editor = lazy(() => import("components/editor/Editor"));
function ConfigEditor() {
  useTitle("Configuration Editor");
  useHideScrollbar();

  return (
    <Container maxWidth={false} sx={{ paddingX: { xs: 1, md: 2 } }}>
      <Editor />
    </Container>
  );
}

export default ConfigEditor;
