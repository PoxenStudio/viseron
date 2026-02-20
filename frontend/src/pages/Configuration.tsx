import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Container from "@mui/material/Container";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import { SyntheticEvent, useState } from "react";

import { useHideScrollbar } from "hooks/UseHideScrollbar";
import { useTitle } from "hooks/UseTitle";
import CameraSettings from "pages/settings/CameraSettings";
import LoggerSettings from "pages/settings/LoggerSettings";
import MotionDetectorSettings from "pages/settings/MotionDetectorSettings";
import ObjectDetectorSettings from "pages/settings/ObjectDetectorSettings";

// ---------------------------------------------------------------------------
// Tab definitions – add new tabs here
// ---------------------------------------------------------------------------

const TABS = [
  { label: "Camera" },
  { label: "Motion Detector" },
  { label: "Object Detector" },
  { label: "Logger" },
] as const;

// ---------------------------------------------------------------------------
// TabPanel wrapper
// ---------------------------------------------------------------------------

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`vertical-tabpanel-${index}`}
      aria-labelledby={`vertical-tab-${index}`}
      style={{ flexGrow: 1, overflow: "auto" }}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Configuration page
// ---------------------------------------------------------------------------

function Configuration() {
  useTitle("Configuration");
  useHideScrollbar();

  const [tab, setTab] = useState(0);

  const handleTabChange = (_: SyntheticEvent, newValue: number) => {
    setTab(newValue);
  };

  return (
    <Container maxWidth={false} sx={{ paddingX: { xs: 1, md: 2 }, py: 3 }}>
      <Card>
        <Box sx={{ display: "flex", minHeight: 520 }}>
          {/* Vertical tab list */}
          <Tabs
            orientation="vertical"
            value={tab}
            onChange={handleTabChange}
            sx={{
              borderRight: 1,
              borderColor: "divider",
              minWidth: 180,
              "& .MuiTabs-indicator": { left: 0, right: "auto" },
            }}
          >
            {TABS.map((t, i) => (
              <Tab
                key={t.label}
                label={t.label}
                id={`vertical-tab-${i}`}
                aria-controls={`vertical-tabpanel-${i}`}
              />
            ))}
          </Tabs>

          {/* Tab panels */}
          <TabPanel value={tab} index={0}>
            <CameraSettings />
          </TabPanel>
          <TabPanel value={tab} index={1}>
            <MotionDetectorSettings />
          </TabPanel>
          <TabPanel value={tab} index={2}>
            <ObjectDetectorSettings />
          </TabPanel>
          <TabPanel value={tab} index={3}>
            <LoggerSettings />
          </TabPanel>
        </Box>
      </Card>
    </Container>
  );
}

export default Configuration;
