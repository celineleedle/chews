import { Navigate, Route, Routes } from "react-router-dom";
import Home from "./screens/Home";
import Join from "./screens/Join";
import RoomRoute from "./screens/RoomRoute";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/join" element={<Join />} />
      <Route path="/room/:code" element={<RoomRoute />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
