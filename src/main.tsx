import { createRoot } from "react-dom/client";
import { CipherWrap } from "./pages/CipherWrap";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <>
    <header className="topbar">
      <a className="brand" href="/"><span className="brand-mark">CW</span><span>CipherWrap</span></a>
    </header>
    <CipherWrap />
  </>,
);
