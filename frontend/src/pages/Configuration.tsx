import Container from "@mui/material/Container";
import { lazy } from "react";

import { useHideScrollbar } from "hooks/UseHideScrollbar";
import { useTitle } from "hooks/UseTitle";

function Configuration() {
  useTitle("Configuration");
  useHideScrollbar();

  return (
    <Container maxWidth={false} sx={{ paddingX: { xs: 1, md: 2 } }}>

    </Container>
  );
}

export default Configuration;
