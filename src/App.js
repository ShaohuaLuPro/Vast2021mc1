import { Routes, Route, NavLink } from "react-router-dom";
import Home from "./pages/Home/Home";
import Question1 from "./pages/Question1/Question1";
import Question2 from "./pages/Question2/Question2";
import Question3 from "./pages/Question3/Question3";

export default function App() {
  return (
    <div className="app-root">
      <nav className="navbar">
        <div className="navbar-brand">VAST 2021 mc-1</div>
        <div className="navbar-links">
          <NavLink to="/" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>Home</NavLink>
          <NavLink to="/q1" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>Question 1</NavLink>
          <NavLink to="/q2" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>Question 2</NavLink>
          <NavLink to="/q3" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>Question 3</NavLink>
        </div>
      </nav>
      <main className="content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/q1" element={<Question1 />} />
          <Route path="/q2" element={<Question2 />} />
          <Route path="/q3" element={<Question3 />} />
        </Routes>
      </main>
    </div>
  );
}
