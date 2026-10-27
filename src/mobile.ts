/* Phone behaviour that CSS cannot do. */

// 1) The Android back button closes the open window (profile, film page, menu...) instead of leaving the app.
//    One history entry is pushed while any window is open; going back clicks that window's close control.
const WINDOW = ".modal-backdrop, .sgm-sheet, .sgm-ceremony";
let pushed = false;
let ignore = false;
const topWindow = (): HTMLElement | null => {
	const all = document.querySelectorAll<HTMLElement>(WINDOW);
	return all.length ? all[all.length - 1] : null;
};
const closeWindow = (el: HTMLElement): void => {
	const btn = el.querySelector<HTMLElement>("[data-sheet-close], .imdb-close, .sgm-close");
	if (btn) btn.click();
	else el.dispatchEvent(new MouseEvent("click", { bubbles: true })); // the backdrops close on a click
};
const sync = (): void => {
	const open = !!topWindow();
	if (open && !pushed) { history.pushState({ sgm: 1 }, ""); pushed = true; }
	else if (!open && pushed) { pushed = false; if (history.state?.sgm) { ignore = true; history.back(); } }
};
window.addEventListener("popstate", () => {
	if (ignore) { ignore = false; return; }
	const w = topWindow();
	if (w) { pushed = false; closeWindow(w); setTimeout(sync, 50); }
});

// 2) Keep the highlighted page button visible in the bottom bar.
const keepActiveVisible = (): void => {
	const b = document.querySelector<HTMLElement>("nav.views button[aria-pressed='true']");
	b?.scrollIntoView({ inline: "center", block: "nearest" });
};

new MutationObserver(() => { sync(); keepActiveVisible(); }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-pressed"] });
