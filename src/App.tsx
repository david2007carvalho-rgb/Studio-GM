import { MenuButton } from "./app/AppMenu";
import { useEffect, useRef, useState } from "react";
import { CAST_SIZE, DIFFICULTY_SETTINGS, PHASE_NAMES, RETIRED } from "./game/constants";
import { fmtMoney } from "./game/format";
import { addDirectorPitches, counterPitch, fundPitch, fundedPitch, passPitch, pitchById, withdrawPitch } from "./game/directorPitches";
import type { PitchOutcome } from "./game/directorPitches";
import { negotiationOf, pitchActor, pitchChance, pitchOf, refusalReason, requiredReputation, salaryOf, userReputation } from "./game/hiring";
import { negotiate, negotiateBlocker, termsText, type NegotiationResult } from "./game/negotiate";
import { Negotiate } from "./ui/Negotiate";
import { useNegotiations } from "./ui/useNegotiations";
import { advancePhase, canAdvance, greenlightMovie, newGame, userMovie } from "./game/phase";
import type { GreenlightPlan } from "./game/phase";
import { lastSlot, loadGame, saveGame } from "./game/storage";
import type { DealTerms, GameState, Person } from "./game/types";
import { Phase } from "./game/types";
import { SaveSlots } from "./ui/SaveSlots";
import { buyLicense } from "./game/ip";
import { talentBlocker } from "./game/challenges";
import { Challenge } from "./ui/Challenge";
import { Frivolities } from "./ui/Frivolities";
import { IpStore } from "./ui/IpStore";
import { Greenlight } from "./ui/Greenlight";
import { Pitches } from "./ui/Pitches";
import { newDraft } from "./ui/draft";
import { AwardRace, Awards, Franchises, History, MovieCard, Releases } from "./ui/Results";
import { MovieProfile } from "./ui/MovieProfile";
import { Profile } from "./ui/Profile";
import { News } from "./ui/News";
import { HideRatingsContext } from "./ui/ratingsContext";
import { Records } from "./ui/Records";
import { Ticker } from "./ui/Ticker";
import { Streaming } from "./ui/Streaming";
import { Brands } from "./ui/Brands";
import { useBrandDeals } from "./ui/useBrandDeals";
import { StudioStats } from "./ui/StudioStats";
import { MovieContext, ProfileContext } from "./ui/profileContext";
import { Talent } from "./ui/Talent";

type Session = { slot: number; state: GameState };

export const App = () => {
	// Reopen the slot that was played last; otherwise show the slot screen.
	const [session, setSession] = useState<Session | null>(() => {
		const slot = lastSlot();
		const state = slot === null ? null : loadGame(slot);
		return slot !== null && state ? { slot, state } : null;
	});
	// The All-Time edition is purple. On the start screen the hidden switch decides; in a game, the save does.
	const [allTimePick, setAllTimePick] = useState(false);
	const allTime = session ? !!session.state.allTime : allTimePick;
	useEffect(() => {
		document.documentElement.dataset.theme = allTime ? "purple" : "";
		document.title = allTime ? "Studio GM · All-Time" : "Studio GM";
	}, [allTime]);
	if (!session)
		return (
			<SaveSlots
				allTime={allTimePick}
				onToggleAllTime={() => setAllTimePick((v) => !v)}
				onLoad={(slot) => {
					const state = loadGame(slot);
					if (state) setSession({ slot, state });
				}}
				onStart={(slot, d, options) => setSession({ slot, state: newGame(d, options) })}
			/>
		);
	// key: switching slots remounts the game so no state leaks between saves
	return <Game key={session.slot} slot={session.slot} initial={session.state} onExit={() => setSession(null)} />;
};

const Game = ({ slot, initial, onExit }: { slot: number; initial: GameState; onExit: () => void }) => {
	const [state, setState] = useState<GameState>(initial);
	const [draft, setDraft] = useState<GreenlightPlan>(newDraft);
	const [error, setError] = useState<string | null>(null);
	const [pitchError, setPitchError] = useState<string | null>(null);
	const [profilePid, setProfilePid] = useState<number | null>(null);
	const [negPid, setNegPid] = useState<number | null>(null); // the person you are negotiating with (see negotiate.ts)
	const negotiating = useNegotiations();
	const brandsOn = useBrandDeals().on;
	const [movieMid, setMovieMid] = useState<number | null>(null);
	// Only one window at a time: opening a person from a film page (or a film from a profile) swaps them.
	const openProfile = (pid: number) => {
		setMovieMid(null);
		setProfilePid(pid);
	};
	const openMovie = (mid: number) => {
		setProfilePid(null);
		setMovieMid(mid);
	};
	const [lower, setLower] = useState<"releases" | "films" | "franchises">("releases");
	const [view, setView] = useState<"studio" | "ipstore" | "streaming" | "frivolities" | "records" | "stats" | "news" | "challenge" | "brands">("studio");

	// Save shortly after the last change (compressing a long game takes a moment, so not on every click),
	// and always straight away when leaving the page or going back to the slot screen.
	const [saveFailed, setSaveFailed] = useState(false);
	const latest = useRef(state);
	const dirty = useRef(false);
	const flush = () => {
		if (!dirty.current) return;
		dirty.current = false;
		setSaveFailed(!saveGame(slot, latest.current));
	};
	useEffect(() => {
		latest.current = state;
		dirty.current = true;
		const t = window.setTimeout(flush, 300);
		return () => window.clearTimeout(t);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [slot, state]);
	useEffect(() => {
		const onLeave = () => flush();
		const onHide = () => document.visibilityState === "hidden" && flush();
		window.addEventListener("pagehide", onLeave);
		document.addEventListener("visibilitychange", onHide);
		return () => {
			window.removeEventListener("pagehide", onLeave);
			document.removeEventListener("visibilitychange", onHide);
			flush(); // leaving this game (Save slots button)
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [slot]);

	// Opening the News page marks everything as read.
	useEffect(() => {
		if (view === "news" && (state.newsSeen ?? 0) !== (state.newsIssue ?? 0)) setState((s) => ({ ...s, newsSeen: s.newsIssue }));
	}, [view, state.newsIssue, state.newsSeen]);
	const unreadNews = (state.news ?? []).filter((n) => n.issue > (state.newsSeen ?? 0)).length;

	// Saves from before director pitches have none: the directors come with their films as soon as you are in Development.
	useEffect(() => {
		if (state.phase === Phase.DEVELOPMENT && state.directorPitches === undefined) {
			setState((s) => {
				const next = structuredClone(s);
				addDirectorPitches(next);
				return next;
			});
		}
	}, [state.phase, state.directorPitches]);

	const studio = state.studios.find((s) => s.tid === state.userTid)!;
	const movie = userMovie(state);
	const blocker = canAdvance(state);
	const inDevelopment = state.phase === Phase.DEVELOPMENT;
	const nextPhase = (state.phase + 1) % PHASE_NAMES.length;
	const nextLabel = state.phase === Phase.OFFSEASON ? `Start ${state.season + 1}` : `Advance to ${PHASE_NAMES[nextPhase]}`;

	const advance = () => {
		setError(null);
		if (state.phase === Phase.OFFSEASON) setDraft(newDraft());
		setState(advancePhase(state));
	};

	// Buy the rights to an IP. Returns an error message, or null when it worked.
	const buyRights = (ipId: string): string | null => {
		const result = buyLicense(state, ipId, state.userTid);
		if (!result.ok) return result.error;
		setState(result.state);
		return null;
	};

	const greenlight = () => {
		const result = greenlightMovie(state, brandsOn ? draft : { ...draft, brands: [] }); // brands only count while Brand Deals is on
		if (result.ok) {
			setError(null);
			setState(result.state);
		} else {
			setError(result.error);
		}
	};

	// Decide on a director's pitch (fund, counter-offer, pass or withdraw), then line the plan up with the result.
	const decidePitch = (id: number, run: (s: GameState) => PitchOutcome) => {
		const result = run(state);
		if (!result.ok) {
			setPitchError(result.error);
			return;
		}
		setPitchError(null);
		setError(null);
		setState(result.state);
		const dp = pitchById(result.state, id);
		if (dp?.status === "funded") {
			// The plan becomes the director's film: their title, genre and director. Actors already picked stay only if they are on the wish list.
			setDraft((d) => ({
				...d,
				title: dp.title,
				genre: dp.genre,
				directorPid: dp.directorPid,
				directorPitchId: dp.id,
				sequelOfMid: null,
				propertyId: null,
				castPids: d.castPids.filter((pid) => dp.pool.includes(pid)),
				leadPids: d.leadPids.filter((pid) => dp.pool.includes(pid)),
			}));
		} else {
			setDraft((d) => (d.directorPitchId === id ? { ...d, directorPitchId: null } : d));
		}
	};

	// Pitch an actor who refuses you: offer extra salary and see if they bite.
	const pitch = (p: Person, premium: number) => {
		const result = pitchActor(state, p.pid, premium);
		if (result.ok) {
			setError(null);
			setState(result.state);
		} else {
			setError(result.error);
		}
	};

	// One offer at the negotiating table. A yes puts the person on the film straight away.
	const makeOffer = (pid: number, terms: DealTerms): NegotiationResult => {
		const result = negotiate(state, pid, terms, !!state.hideRatings);
		if (!result.ok) return result;
		setError(null);
		setState(result.state);
		const person = state.people.find((x) => x.pid === pid);
		if (result.signed && person && !draft.castPids.includes(pid) && draft.directorPid !== pid) pick(person);
		return result;
	};

	// Click "Hire" or "Remove" in the talent list.
	const pick = (p: Person) => {
		setError(null);
		// A challenge rule can keep someone off your films (see challenges.ts); taking them off the plan is always allowed.
		const barred = talentBlocker(state, p);
		if (barred && !draft.castPids.includes(p.pid)) {
			setError(barred);
			return;
		}
		// A funded pitch fixes the director and limits the cast to the wish list.
		const funded = fundedPitch(state, draft.directorPitchId);
		if (funded) {
			if (p.role === "director") {
				if (p.pid !== funded.directorPid) setError("This film is another director's pitch. Withdraw your funding to hire someone else.");
				return; // the pitch's director stays on the plan
			}
			if (!funded.pool.includes(p.pid)) {
				setError(`${p.name} is not on the director's wish list.`);
				return;
			}
		}
		if (p.role === "director") {
			setDraft((d) => ({ ...d, directorPid: d.directorPid === p.pid ? null : p.pid }));
		} else {
			setDraft((d) => {
				if (d.castPids.includes(p.pid)) {
					return { ...d, castPids: d.castPids.filter((x) => x !== p.pid), leadPids: d.leadPids.filter((x) => x !== p.pid) };
				}
				if (d.castPids.length >= CAST_SIZE) return d;
				// The first actor you hire is the lead by default, the rest start as supporting.
				// You can change each one's billing in the cast list.
				const hasLead = d.castPids.some((x) => d.leadPids.includes(x));
				return { ...d, castPids: [...d.castPids, p.pid], leadPids: hasLead ? d.leadPids : [...d.leadPids, p.pid] };
			});
		}
	};

	const active = state.people.filter((p) => p.tid !== RETIRED);
	// With a funded pitch the talent list only shows the pitching director and their wish list.
	const fundedDp = inDevelopment ? fundedPitch(state, draft.directorPitchId) : undefined;
	const talentPeople = fundedDp ? active.filter((p) => p.pid === fundedDp.directorPid || fundedDp.pool.includes(p.pid)) : active;
	const fundedDirector = fundedDp ? state.people.find((p) => p.pid === fundedDp.directorPid) : undefined;

	return (
		<HideRatingsContext.Provider value={!!state.hideRatings}>
		<ProfileContext.Provider value={openProfile}>
		<MovieContext.Provider value={openMovie}>
			<div className="shell">
			<header className="topbar">
				<div className="topbar-row">
					<h1>
						Studio GM{state.allTime && <span className="edition-tag">All-Time</span>}
						{state.challenge?.status === "active" && <span className="edition-tag chal-tag">Challenge</span>}
					</h1>
					<nav className="views" aria-label="Page">
						<button aria-pressed={view === "studio"} onClick={() => setView("studio")}>
							Studio
						</button>
						<button aria-pressed={view === "news"} onClick={() => setView("news")}>
							News{unreadNews > 0 && view !== "news" && <span className="pill">{unreadNews}</span>}
						</button>
						<button aria-pressed={view === "ipstore"} onClick={() => setView("ipstore")}>
							IP Store{(state.offers?.length ?? 0) > 0 && <span className="pill">{state.offers!.length}</span>}
						</button>
						<button aria-pressed={view === "streaming"} onClick={() => setView("streaming")}>
							Streaming{(state.streamOffers?.length ?? 0) > 0 && <span className="pill">{state.streamOffers!.length}</span>}
						</button>
						<button aria-pressed={view === "brands"} onClick={() => setView("brands")}>
							Brands{(state.brandOffers?.length ?? 0) > 0 && <span className="pill">{state.brandOffers!.length}</span>}
						</button>
						<button aria-pressed={view === "frivolities"} onClick={() => setView("frivolities")}>
							Frivolities
						</button>
						{state.challenge && (
							<button aria-pressed={view === "challenge"} onClick={() => setView("challenge")}>
								Challenge
							</button>
						)}
						<button aria-pressed={view === "records"} onClick={() => setView("records")}>
							Records
						</button>
						<button aria-pressed={view === "stats"} onClick={() => setView("stats")}>
							Stats
						</button>
					</nav>
					<div className="stats num">
						<span title="Difficulty · save slot">
							{DIFFICULTY_SETTINGS[state.difficulty].label} · slot {slot}
						</span>
						<span>
							Season<b>{state.season}</b>
						</span>
						<span>
							Cash<b>{fmtMoney(studio.cash)}</b>
						</span>
						<span>
							Rep<b>{Math.round(studio.reputation)}</b>
						</span>
						<button className="btn ghost" onClick={onExit}>
							Save slots
						</button>
						<MenuButton />
					</div>
				</div>
				<div className="topbar-row phase-row">
					<ol className="track" aria-label="Phases of the year">
						{PHASE_NAMES.map((name, i) => (
							<li key={name} className={i === state.phase ? "current" : i < state.phase ? "done" : ""} aria-current={i === state.phase}>
								{name}
							</li>
						))}
					</ol>
					<div className="advance">
						{blocker && <span className="why">{blocker}</span>}
						<button className="btn" disabled={blocker !== null} onClick={advance}>
							{nextLabel}
						</button>
					</div>
				</div>
			</header>

			{saveFailed && (
				<p className="notice save-failed">
					This game could not be saved: the browser refused to store it (storage full, or blocked in a private window). Delete an old slot on the Save slots screen and play one more action to retry.
				</p>
			)}
			{state.notice && <p className="notice">{state.notice}</p>}
			{view !== "news" && <Ticker state={state} onOpen={() => setView("news")} />}
			<div className="content">

			{view === "news" ? (
				<News state={state} />
			) : view === "ipstore" ? (
				<IpStore state={state} onBuy={buyRights} onChange={setState} onGoStudio={() => setView("studio")} />
			) : view === "streaming" ? (
				<Streaming state={state} onChange={setState} />
			) : view === "brands" ? (
				<Brands state={state} onChange={setState} />
			) : view === "frivolities" ? (
				<Frivolities state={state} />
			) : view === "challenge" ? (
				<Challenge state={state} />
			) : view === "records" ? (
				<Records state={state} />
			) : view === "stats" ? (
				<StudioStats state={state} />
			) : (
			<main className="main">
				<div className="col">
					{inDevelopment && (
						<Pitches
							state={state}
							error={pitchError}
							onFund={(id) => decidePitch(id, (s) => fundPitch(s, id))}
							onCounter={(id, amount) => decidePitch(id, (s) => counterPitch(s, id, amount))}
							onPass={(id) => decidePitch(id, (s) => passPitch(s, id))}
							onWithdraw={(id) => decidePitch(id, (s) => withdrawPitch(s, id))}
						/>
					)}
					{inDevelopment ? (
						<Greenlight
							state={state}
							draft={draft}
							setDraft={setDraft}
							greenlit={movie}
							error={error}
							onGreenlight={greenlight}
							onOpenStore={() => setView("ipstore")}
							pitch={fundedDp}
							onDropPitch={() => fundedDp && decidePitch(fundedDp.id, (s) => withdrawPitch(s, fundedDp.id))}
						/>
					) : (
						movie && <MovieCard state={state} movie={movie} />
					)}
					{state.phase === Phase.DISTRIBUTION && <AwardRace state={state} />}
					{state.phase >= Phase.AWARDS && <Awards state={state} />}
					<div className="subtabs" role="tablist">
						{([["releases", "Releases"], ["films", "Your films"], ["franchises", "Franchises"]] as const).map(([k, label]) => (
							<button key={k} role="tab" aria-selected={lower === k} className="tab" onClick={() => setLower(k)}>
								{label}
							</button>
						))}
					</div>
					{lower === "releases" ? <Releases state={state} /> : lower === "films" ? <History state={state} /> : <Franchises state={state} />}
				</div>
				<div className="col">
					<Talent
						people={talentPeople}
						bonds={state.bonds}
						notice={fundedDp ? `Funded pitch "${fundedDp.title}": showing only ${fundedDirector?.name ?? "the director"} and their wish list. Withdraw your funding to see everyone.` : undefined}
						draft={draft}
						selectable={inDevelopment}
						onPick={pick}
						onPitch={pitch}
						negotiating={negotiating && inDevelopment}
						onNegotiate={(p) => setNegPid(p.pid)}
						negotiation={(p) => negotiationOf(state, p.pid)}
						negotiateBlocker={(p) => negotiateBlocker(state, p)}
						describeDeal={(p) => { const d = negotiationOf(state, p.pid); return d?.terms ? termsText(d.terms, state) : ""; }}
						pitch={(p) => pitchOf(state, p.pid)}
						pitchChance={(p, premium) => pitchChance(state, p, premium)}
						salary={(p) => salaryOf(state, p)}
						refusal={(p) => refusalReason(state, p)}
						locked={(p) => talentBlocker(state, p)}
						needed={(p) => requiredReputation(state.difficulty, p, state)}
						showNeeded={DIFFICULTY_SETTINGS[state.difficulty].refusalFloor !== null}
						reputation={userReputation(state)}
						awards={state.awards}
						movies={state.movies}
					/>
				</div>
			</main>
			)}
			</div>
			{negPid !== null && negotiating && inDevelopment && <Negotiate state={state} pid={negPid} onClose={() => setNegPid(null)} onOffer={makeOffer} />}
			{profilePid !== null && <Profile state={state} pid={profilePid} onClose={() => setProfilePid(null)} />}
			{movieMid !== null && <MovieProfile state={state} mid={movieMid} onClose={() => setMovieMid(null)} />}
			</div>
		</MovieContext.Provider>
		</ProfileContext.Provider>
		</HideRatingsContext.Provider>
	);
};
