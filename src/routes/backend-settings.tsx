import { Navigate } from "react-router";

const APP_HOME_PATH = "/";

// This route exists so that `/settings/backend` is a valid URL.
// When the backend is unavailable, App() intercepts this path and renders
// AgentServerConnectionScreen before the route component ever runs.
// When the backend IS reachable, redirect the user home.
export default function BackendSettingsScreen() {
  return <Navigate to={APP_HOME_PATH} replace />;
}
