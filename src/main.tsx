import { createRoot } from "react-dom/client";
import { App } from "./App";
import { AppMenu, UpdateWatcher } from "./app/AppMenu";
import "./styles.css";
import "./mobile.css";
import "./mods/index.js";
import "./mobile";

createRoot(document.getElementById("root")!).render(
	<>
		<App />
		<AppMenu />
		<UpdateWatcher />
	</>,
);

// Tell the update loader this boot worked (otherwise it falls back to the installed version next time).
setTimeout(() => (window as unknown as { __sgmBooted?: () => void }).__sgmBooted?.(), 2000);
