// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App.tsx";
import "./index.css"
import "leaflet/dist/leaflet.css";

/*const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#050505ff", // can change later to Opencharge brand
    },
  },
});*/

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);