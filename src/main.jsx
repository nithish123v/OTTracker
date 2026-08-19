import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import OTTracker from "./OTTracker";

createRoot(document.getElementById("root")).render(
  <React.StrictMode><OTTracker /></React.StrictMode>
);
