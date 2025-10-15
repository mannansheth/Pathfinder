import React, { useState } from "react";

import "./App.css";
import { PathfindingVisualizer } from "./PathfindingVisualizer";
import { ToastContainer } from "react-toastify";

function App() {
  const [showVisualizer, setShowVisualizer] = useState(false);
  const [theme, setTheme] = useState("dark");

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <div className={`app ${theme}`}>
      <PathfindingVisualizer />
      <ToastContainer 
      position="top-right"
      autoClose= {5000}
      hideProgressBar= {false}
      closeOnClic= {true}
      pauseOnHover= {true}
      draggable= {true}
      theme= "colored" 
      />
    </div>
  );
}

export default App;
