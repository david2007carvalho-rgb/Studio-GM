import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { billingError } from "../game/cast";
import { BASE_PRODUCTION_COST, CAST_SIZE, IP_BACKLASH_MAX, IP_BACKLASH_PER_POINT, RETIRED } from "../game/constants";
import { GENRE_LABEL, fmtMoney } from "../game/format";
import { chemistryGate, chemistryPotential, returningDuos } from "../game/chemistry";
import { continuityOf, franchiseName, franchiseWeights, installmentOf, sequelCandidates, sequelFatigue, sequelGrowth } from "../game/franchise";
import { genSequelTitle, genTitle } from "../game/generate";
import { allIps, licenseOf, lockReason, projectedCritic, propertyById, propertyFilms, propertyStats, propertyTitle } from "../game/ip";
import { activeRules, ipBlocker, repertoryStatus, sequelBlocker, SHOESTRING_CAP, streamingBlocker, talentBlocker } from "../game/challenges";
import { refusalReason, salaryOf } from "../game/hiring";
import { pitchLeftover } from "../game/directorPitches";
import { movieBudget, movieCost, teamRating } from "../game/movie";
import { signReturningTalent } from "../game/signing";
import { ipFeeDiscount } from "../game/streamingPerks";
import { streamPitch } from "../game/streaming";
import { platformById } from "../game/streamingData";
import { StreamingPartner } from "./StreamingPartner";
import { BrandPartners } from "./BrandPartners";
import { useBrandDeals } from "./useBrandDeals";
import { planBrands } from "../game/brands";
import { ScriptCard, ScriptPicker } from "./ScriptPicker";
import { CHEM_KILL, heatWord, teamTension } from "../game/rivalries";
import { directorScript, infoOf, scriptsFor } from "../game/scripts";
import type { GreenlightPlan } from "../game/phase";
import { GENRES } from "../game/types";
import type { DirectorPitch, GameState, Movie, Person } from "../game/types";

type Props = {
	state: GameState;
	draft: GreenlightPlan;
	setDraft: Dispatch<SetStateAction<GreenlightPlan>>;
	greenlit: Movie | undefined;
	error: string | null;
	onGreenlight: () => void;
	onOpenStore: () => void;
	pitch: DirectorPitch | undefined; // the director's pitch you funded and this plan is built on (see directorPitches.ts)
	onDropPitch: () => void; // withdraw the funding
};

export const Greenlight = ({ state, draft, setDraft, greenlit, error, onGreenlight, onOpenStore, pitch: fundedPitch, onDropPitch }: Props) => {
	const find = (pid: number) => state.people.find((p) => p.pid === pid);
	const director = draft.directorPid === null ? undefined : find(draft.directorPid);
	const cast = draft.castPids.map(find).filter((p): p is Person => p !== undefined);
	const cash = state.studios.find((s) => s.tid === state.userTid)?.cash ?? 0;

	// A funded pitch fixes the budget: what the director and cast do not cost goes into production, and your extra budget comes on top.
	const pitchLeft = fundedPitch && director ? pitchLeftover(state, fundedPitch, director, cast) : 0;
	const extraTotal = draft.extraBudget + Math.max(0, pitchLeft);
	const budget = movieBudget([...(director ? [director] : []), ...cast], extraTotal, (p) => salaryOf(state, p));
	const marketing = Math.round((budget * draft.marketingPct) / 100);

	// Licensed property (see ip.ts)
	const found = draft.propertyId ? propertyById(state, draft.propertyId) : undefined;
	const lic = found ? licenseOf(state, found.ip.id) : undefined;
	const stats = found ? propertyStats(found.ip, found.prop, lic?.goodwill) : undefined;
	const discount = ipFeeDiscount(state);
	const licenseFee = stats ? Math.round(stats.fee * (1 - discount)) : 0; // streaming contracts can discount it

	// Lasting feuds and friendships among the team you picked (see rivalries.ts).
	const tension = teamTension(state.bonds, director, cast);

	// Preview of how well this team suits the genre (no randomness).
	const stub = { genre: draft.genre } as Movie;
	const fit = director && cast.length === CAST_SIZE ? Math.round(teamRating(stub, director, cast)) : null;
	const hide = !!state.hideRatings; // "Hide ratings": no fit numbers on this form

	// Streaming partner: what it pays towards this film (see streaming.ts)
	const platform = draft.platformId ? platformById(draft.platformId) : undefined;
	const pitch = platform ? streamPitch(state, platform, { genre: draft.genre, budget, marketing, fit }, draft.release ?? "wide") : null;
	const financing = pitch?.terms ? pitch.financing : 0;
	const marketingCover = pitch?.terms ? pitch.marketingCover : 0;
	// The script (see scripts.ts): one you buy from the market, or the director's own when you funded their pitch.
	const scripts = scriptsFor(state, draft.genre);
	const chosenScript = fundedPitch ? undefined : scripts.find((s) => s.id === draft.scriptId);
	const scriptFee = chosenScript?.price ?? 0;
	const scriptInfo = fundedPitch ? (director ? directorScript(director, draft.genre, state.season) : undefined) : chosenScript ? infoOf(chosenScript) : undefined;
	// Brand partners (see brands.ts): sponsors and product placements pay part of the cost.
	const brandsOn = useBrandDeals().on;
	const propertyPrequel = draft.propertyId ? propertyFilms(state, state.userTid, draft.propertyId).slice(-1)[0] : undefined;
	const brandCtx = { genre: draft.genre, budget, marketing, prequelMid: draft.sequelOfMid ?? propertyPrequel?.mid ?? null };
	const brandPlan = brandsOn && (draft.brands?.length ?? 0) > 0 ? planBrands(state, draft.brands, brandCtx) : null;
	const brandMoney = brandPlan?.ok ? brandPlan.funding : 0;
	const total = budget + marketing + licenseFee + scriptFee - financing - marketingCover - brandMoney;

	// Challenge rules (see challenges.ts): what this run forbids, and how the current plan stands against the rules that judge a plan.
	const streamLocked = streamingBlocker(state);
	const ipLocked = ipBlocker(state);
	const sequelLocked = sequelBlocker(state);
	const hints: { text: string; ok: boolean }[] = [];
	for (const rule of activeRules(state)) {
		if (rule.id === "shoestring") hints.push({ text: `${rule.name}: this film costs ${fmtMoney(total)} of the ${fmtMoney(SHOESTRING_CAP)} limit`, ok: total <= SHOESTRING_CAP });
		if (rule.id === "freshFaces") {
			const old = cast.filter((p) => talentBlocker(state, p));
			hints.push({ text: old.length ? `${rule.name}: too old for this rule: ${old.map((p) => p.name).join(", ")}` : `${rule.name}: every actor so far is young enough`, ok: old.length === 0 });
		}
		if (rule.id === "repertory") {
			const rep = repertoryStatus(state, draft.directorPid, draft.castPids, (pid) => {
				const person = state.people.find((x) => x.pid === pid);
				return !!person && person.tid !== RETIRED && !refusalReason(state, person) && !talentBlocker(state, person);
			});
			if (rep) {
				const names = rep.returning.map((pid) => state.people.find((x) => x.pid === pid)?.name ?? "?").join(", ");
				hints.push({ text: `${rule.name}: ${rep.have} of ${rep.required} returning from “${rep.film.title}” (${names})`, ok: rep.have >= rep.required });
			} else {
				hints.push({ text: `${rule.name}: nobody has to come back this season`, ok: true });
			}
		}
	}

	// Chemistry: pairs on this team who already made films together
	const duos = returningDuos(draft.directorPid, draft.castPids, state.season, state.movies);
	const chemPotential = chemistryPotential(duos);
	const chemEstimate = fit !== null ? chemPotential * chemistryGate(fit) * tension.chemMult : null;
	const nameOf = (pid: number) => find(pid)?.name ?? "?";
	const duoTip = duos
		.map((d) => `${nameOf(d.a)} & ${nameOf(d.b)}: ${d.films} film${d.films > 1 ? "s" : ""} together`)
		.join("\n");

	// Sequel / franchise
	const takenTitles = state.movies.map((m) => m.title);
	// titles in use, not counting the film you are about to replace
	const takenOther = state.movies.filter((m) => !(m.season === state.season && m.tid === state.userTid)).map((m) => m.title);
	const ownedIps = allIps(state).filter((ip) => licenseOf(state, ip.id)?.tid === state.userTid);
	const candidates = sequelCandidates(state, state.userTid);
	// The film this one continues: one of your released films, or (for a custom IP bought from another studio) the franchise's last film.
	const propertyLast = found ? propertyFilms(state, state.userTid, found.prop.id).slice(-1)[0] : undefined;
	const prequel =
		draft.sequelOfMid === null || draft.sequelOfMid === undefined
			? undefined
			: candidates.find((m) => m.mid === draft.sequelOfMid) ?? (propertyLast?.mid === draft.sequelOfMid ? propertyLast : undefined);
	const part = prequel ? installmentOf(prequel) + 1 : 1;
	const continuity = prequel ? continuityOf(draft.directorPid, draft.castPids, prequel) : 0;
	const weights = franchiseWeights(continuity);

	// Licensed film: what the fans expect, and how this team is likely to do against it (no luck).
	const projected =
		found && stats && director && cast.length === CAST_SIZE
			? projectedCritic(draft.genre, director, cast, extraTotal, (chemEstimate ?? 0) + tension.prod, prequel, continuity, scriptInfo)
			: null;
	const shortBy = projected !== null && stats ? stats.expectCritic - projected : 0;
	const backlash = stats ? Math.min(IP_BACKLASH_MAX, Math.max(0, shortBy) * IP_BACKLASH_PER_POINT * stats.severity) : 0;
	const chooseSequel = (value: string) => {
		const picked = candidates.find((m) => m.mid === Number(value));
		if (!picked) {
			update({ sequelOfMid: null, propertyId: null, title: genTitle(draft.genre, takenTitles) });
			return;
		}
		setSignNote(null);
		const prop = picked.propertyId ? propertyById(state, picked.propertyId)?.prop : undefined;
		update({
			sequelOfMid: picked.mid,
			propertyId: picked.propertyId ?? null, // continuing a licensed film keeps its licence
			genre: picked.genre, // a sequel keeps its prequel's genre
			title: prop
				? propertyTitle(prop, installmentOf(picked) + 1, takenOther)
				: genSequelTitle(franchiseName(state, picked), installmentOf(picked) + 1, takenTitles),
		});
	};
	// Pick a licensed hero. A second film about the same hero is a sequel to the last one.
	const chooseProperty = (id: string) => {
		setSignNote(null);
		const hero = propertyById(state, id);
		if (!hero) {
			update({ propertyId: null, sequelOfMid: null, title: genTitle(draft.genre, takenTitles) });
			return;
		}
		const earlier = propertyFilms(state, state.userTid, id);
		const last = earlier.length ? earlier[earlier.length - 1] : null;
		update({
			propertyId: id,
			sequelOfMid: last ? last.mid : null,
			genre: last ? last.genre : hero.prop.genre,
			title: propertyTitle(hero.prop, last ? installmentOf(last) + 1 : 1, takenOther),
		});
	};
	const newTitle = () =>
		update({
			title: found
				? propertyTitle(found.prop, part, takenOther)
				: prequel
				? genSequelTitle(franchiseName(state, prequel), part, takenTitles)
				: genTitle(draft.genre, takenTitles),
		});

	// Changing the genre puts the script back: scripts belong to a genre.
	const update = (patch: Partial<GreenlightPlan>) => setDraft((d) => ({ ...d, ...(patch.genre && patch.genre !== d.genre ? { scriptId: null } : {}), ...patch }));
	const [signNote, setSignNote] = useState<string | null>(null);
	const signReturning = () => {
		if (!prequel) return;
		const report = signReturningTalent(state, prequel, draft);
		setDraft(report.plan);
		setSignNote(
			`Signed ${report.signed.length}: ${report.signed.join(", ") || "nobody"}.` +
				(report.skipped.length ? ` Could not sign: ${report.skipped.join("; ")}.` : ""),
		);
	};
	const removeActor = (pid: number) =>
		update({ castPids: draft.castPids.filter((x) => x !== pid), leadPids: draft.leadPids.filter((x) => x !== pid) });
	const setBilling = (pid: number, lead: boolean) =>
		update({ leadPids: lead ? [...new Set([...draft.leadPids, pid])] : draft.leadPids.filter((x) => x !== pid) });
	const billing = cast.length === CAST_SIZE ? billingError(draft.castPids, draft.leadPids) : null;

	return (
		<section className="panel greenlight">
			<h2>Plan this year&rsquo;s film</h2>
			{greenlit && (
				<p className="ok" style={{ marginTop: 0 }}>
					Greenlit: <b>{greenlit.title}</b> ({fmtMoney(movieCost(greenlit))} total). You can still
					change it and greenlight again.
				</p>
			)}

			{fundedPitch && (
				<div className="franchise-box pitch-banner">
					<b>
						Funded pitch: &ldquo;{fundedPitch.title}&rdquo; ({fmtMoney(fundedPitch.agreed ?? fundedPitch.ask)} budget)
					</b>
					<div>
						{director?.name ?? "The director"} directs. Pick the cast from the wish list ({fundedPitch.pool.length} actors, shown in the talent list). The director and cast are paid out of the budget;
						what is left goes into sets and effects.
					</div>
					{pitchLeft < 0 ? (
						<div className="error" style={{ margin: 0 }}>
							This cast costs {fmtMoney(-pitchLeft)} more than the funded budget. Pick cheaper actors, or withdraw and counter for more money.
						</div>
					) : (
						<div className="muted">
							{cast.length === CAST_SIZE ? "Left for sets and effects" : "Left for sets and effects so far"}: <b>{fmtMoney(pitchLeft)}</b>
						</div>
					)}
					<div>
						<button className="btn quiet" type="button" onClick={onDropPitch}>
							Withdraw funding
						</button>
					</div>
				</div>
			)}

			<div className="field">
				<label htmlFor="property">Licensed property</label>
				{ipLocked ? (
					<span className="muted">🔒 {ipLocked}</span>
				) : ownedIps.length === 0 ? (
					<span className="muted">
						You own no film rights yet. Famous IPs give your film a box-office boost, at the price of high expectations.{" "}
						<button className="btn quiet" type="button" onClick={onOpenStore}>
							Open the IP Store
						</button>
					</span>
				) : (
					<select id="property" disabled={!!fundedPitch} value={draft.propertyId ?? ""} onChange={(e) => chooseProperty(e.target.value)}>
						<option value="">Original idea (no licence)</option>
						{ownedIps.map((ip) => (
							<optgroup key={ip.id} label={`${ip.emoji} ${ip.name}`}>
								{ip.properties.map((prop) => {
									const locked = lockReason(state, state.userTid, ip, prop);
									const made = propertyFilms(state, state.userTid, prop.id).length;
									return (
										<option key={prop.id} value={prop.id} disabled={!!locked}>
											{prop.name}
											{made > 0 ? ` (next: part ${made + 1})` : ""}
											{locked ? " (locked)" : ""}
										</option>
									);
								})}
							</optgroup>
						))}
					</select>
				)}
				{found && stats && (
					<div className="ip-box">
						<b>
							{found.ip.emoji} {found.ip.name}: {found.prop.name}
							{part > 1 && ` (part ${part})`}
						</b>
						<div>
							Licence fee <b>{fmtMoney(licenseFee)}</b>{discount > 0 && <> (&minus;{Math.round(discount * 100)}% thanks to a streaming contract)</>}, added to the cost. Box-office boost about <b className="gain">+{Math.round((stats.boost - 1) * 100)}%</b>
							{lic && <> (fan goodwill {Math.round(lic.goodwill)}/100)</>}, and a bigger opening weekend.
						</div>
						<div>
							The fans expect critics <b>{stats.expectCritic}+</b> and <b>{fmtMoney(stats.expectGross)}+</b> at the box office ({found.ip.name} fans are{" "}
							{found.ip.severity >= 1.4 ? "ruthless" : found.ip.severity >= 1.15 ? "demanding" : found.ip.severity >= 0.9 ? "fair" : "forgiving"}).
						</div>
						{projected === null ? (
							<span className="muted">Hire a director and {CAST_SIZE} actors to see how your team compares with the fans&rsquo; bar.</span>
						) : shortBy <= 0 ? (
							<span className="verdict ok-line">
								{hide ? <>On track: your team looks strong enough to clear the fans&rsquo; bar.</> : <>On track: projected critics about <b>{projected}</b>, above the bar of {stats.expectCritic}.</>}
							</span>
						) : shortBy <= 3 ? (
							<span className="verdict warn-line">
								{hide ? <>Borderline: your team may fall just short of the fans&rsquo; bar.</> : <>Borderline: projected critics about <b>{projected}</b>, {shortBy} below the bar of {stats.expectCritic}.</>} A bad roll costs you box office and reputation.
							</span>
						) : (
							<span className="verdict bad-line">
								{hide ? <>Below the bar: your team looks short of what the fans expect.</> : <>Below the bar: projected critics about <b>{projected}</b> against {stats.expectCritic}.</>} Expect around &minus;{Math.round(backlash * 100)}% box office
								from backlash and a reputation hit. A better director or cast would help.
							</span>
						)}
					</div>
				)}
			</div>

			<div className="row2">
			<div className="field grow">
				<label htmlFor="title">Title</label>
				<div className="inline">
					<input id="title" type="text" value={draft.title} onChange={(e) => update({ title: e.target.value })} />
					<button className="btn quiet" onClick={newTitle}>
						New title
					</button>
				</div>
			</div>

			<div className="field">
				<label htmlFor="genre">Genre</label>
				<select id="genre" disabled={!!prequel || !!found || !!fundedPitch} value={draft.genre} onChange={(e) => update({ genre: e.target.value as GreenlightPlan["genre"] })}>
					{GENRES.map((g) => (
						<option key={g} value={g}>
							{GENRE_LABEL[g]}
						</option>
					))}
				</select>
				{prequel ? (
					<span className="muted">A sequel keeps the genre of the film it continues.</span>
				) : fundedPitch ? (
					<span className="muted">The genre comes with the director&rsquo;s pitch.</span>
				) : (
					found && <span className="muted">The genre comes with the licensed property.</span>
				)}
			</div>

			</div>

			{fundedPitch ? (
				<div className="field">
					<span className="label">Script</span>
					{scriptInfo ? (
						<div className="script-grid">
							<ScriptCard info={scriptInfo} genre={draft.genre} hide={hide} note="Comes with the pitch: no fee." />
						</div>
					) : (
						<span className="muted">The director writes their own script. Pick the director to see it.</span>
					)}
				</div>
			) : (
				<ScriptPicker scripts={scripts} genre={draft.genre} pickedId={draft.scriptId} hide={hide} cash={cash} onPick={(id) => update({ scriptId: id })} />
			)}

			{sequelLocked ? (
				<div className="field">
					<label>Franchise</label>
					<span className="muted">🔒 {sequelLocked}</span>
				</div>
			) : candidates.length > 0 && (
				<div className="field">
					<label htmlFor="sequel">Franchise</label>
					<select id="sequel" disabled={!!fundedPitch} value={prequel && candidates.some((m) => m.mid === prequel.mid) ? prequel.mid : ""} onChange={(e) => chooseSequel(e.target.value)}>
						<option value="">New original film</option>
						{candidates.map((m) => (
							<option key={m.mid} value={m.mid}>
								Sequel to &ldquo;{m.title}&rdquo; ({m.season}, {fmtMoney(m.boxOffice ?? 0)}, critics {m.criticScore})
							</option>
						))}
					</select>
					{prequel ? (
						<div className="franchise-box">
							<b>
								Part {part} of the {franchiseName(state, prequel)} franchise
							</b>
							<div>
								About <b>{Math.round(weights.money * 100)}%</b> of its box office and{" "}
								<b>{Math.round(weights.critic * 100)}%</b> of its critic score will follow &ldquo;{prequel.title}&rdquo;
								(which made {fmtMoney(prequel.boxOffice ?? 0)}, critics {prequel.criticScore}). The rest depends on this film&rsquo;s own quality.
							</div>
							<div className="muted">
								Returning from the last film: {Math.round(continuity * (CAST_SIZE + 1))} of {CAST_SIZE + 1} people. Bringing back the same
								director and cast strengthens the link.
							</div>
							<div>
								<button className="btn" type="button" onClick={signReturning}>
									Sign all returning cast &amp; director
								</button>
								{signNote && <div className="muted">{signNote}</div>}
							</div>
							<div className="muted">
								Audience carry-over x{sequelGrowth(part).toFixed(2)}
								{sequelFatigue(part) > 0 && <>, sequel fatigue &minus;{sequelFatigue(part).toFixed(1)} critic points</>}. A flop
								drags the sequel down too.
							</div>
						</div>
					) : (
						<span className="muted">Continue one of your released films to build on its audience.</span>
					)}
				</div>
			)}

			<div className="field">
				<span className="label">Director</span>
				<div className={`slot ${director ? "filled" : ""}`}>
					{director ? (
						<>
							<span>
								{director.name} <span className="muted num">{fmtMoney(director.contract.amount)}</span>
							</span>
							{!fundedPitch && (
								<button className="btn quiet" onClick={() => update({ directorPid: null })}>
									Remove
								</button>
							)}
						</>
					) : (
						<span className="muted">Hire a director from the talent list</span>
					)}
				</div>
			</div>

			<div className="field">
				<span className="label">
					Cast ({cast.length} of {CAST_SIZE})
				</span>
				{Array.from({ length: CAST_SIZE }, (_, i) => {
					const actor = cast[i];
					return (
						<div key={i} className={`slot ${actor ? "filled" : ""}`}>
							{actor ? (
								<>
									<span>
										{actor.name} <span className="muted num">{fmtMoney(salaryOf(state, actor))}</span>
									</span>
									<span className="slot-actions">
										<span className="role-toggle" role="group" aria-label={`Role for ${actor.name}`}>
											{([true, false] as const).map((lead) => (
												<button
													key={String(lead)}
													type="button"
													className="role-btn"
													aria-pressed={draft.leadPids.includes(actor.pid) === lead}
													onClick={() => setBilling(actor.pid, lead)}
												>
													{lead ? "Lead" : "Supporting"}
												</button>
											))}
										</span>
										<button className="btn quiet" onClick={() => removeActor(actor.pid)}>
											Remove
										</button>
									</span>
								</>
							) : (
								<span className="muted">Hire an actor from the talent list</span>
							)}
						</div>
					);
				})}
				{billing ? (
					<span className="error" style={{ margin: 0 }}>{billing}</span>
				) : (
					<span className="muted fine">Leads compete for Best Actor / Actress, supporting for the supporting awards.</span>
				)}
			</div>

			{tension.pairs.length > 0 && (
				<div className="field">
					<span className="label">Feuds and friendships on this team</span>
					<ul className="tension-list">
						{tension.pairs.map((t) => {
							const bond = (state.bonds ?? []).find((k) => k.a === t.a && k.b === t.b);
							const feud = t.kind === "feud";
							return (
								<li key={`${t.a}-${t.b}`} className={feud ? "bad" : "ok"}>
									{feud ? "⚠" : "✦"} <b>{nameOf(t.a)}</b> and <b>{nameOf(t.b)}</b>: {bond ? heatWord(t.kind, bond.heat) : t.kind}
									{bond && <span className="muted"> since {bond.since}</span>}.{" "}
									{hide ? (
										feud ? "Expect a rougher shoot." : "They should push each other."
									) : (
										<>
											<b>{t.prod > 0 ? "+" : "−"}{Math.abs(t.prod)}</b> production quality
											{feud && duos.some((d) => (d.a === t.a && d.b === t.b) || (d.a === t.b && d.b === t.a)) && ", and the chemistry from their earlier films shrinks"}.
										</>
									)}
								</li>
							);
						})}
					</ul>
					{tension.chemMult < 1 && chemPotential > 0 && !hide && (
						<span className="muted fine">Chemistry from returning duos is cut to about {Math.round(tension.chemMult * 100)}% (a feud at full heat wipes out {Math.round(CHEM_KILL * 100)}%).</span>
					)}
					{tension.pairs.some((t) => t.kind === "feud") && <span className="muted fine">A Peacemaker on the team halves the damage.</span>}
				</div>
			)}

			<div className="row2">
			<div className="field">
				<label htmlFor="extra">Extra production budget ($k){fundedPitch ? " on top of the pitch" : ""}</label>
				<input
					id="extra"
					type="number"
					min={0}
					step={1000}
					value={draft.extraBudget}
					onChange={(e) => update({ extraBudget: Math.max(0, Number(e.target.value) || 0) })}
				/>
				<span className="muted fine">Better sets and effects, diminishing returns.</span>
			</div>
			<div className="field">
				<label htmlFor="marketing">
					Marketing: {draft.marketingPct}% of budget
				</label>
				<input
					id="marketing"
					type="range"
					min={0}
					max={100}
					step={5}
					value={draft.marketingPct}
					onChange={(e) => update({ marketingPct: Number(e.target.value) })}
				/>
			</div>
			</div>

			{streamLocked ? (
				<p className="muted fine">🔒 {streamLocked}</p>
			) : (
			<details className="fold" open={!!draft.platformId}>
				<summary>Streaming partner <span className="muted">{platform ? `· ${platform.emoji} ${platform.name}` : "(optional)"}</span></summary>
			<StreamingPartner
				state={state}
				genre={draft.genre}
				budget={budget}
				marketing={marketing}
				fit={fit}
				platformId={draft.platformId}
				release={draft.release ?? "wide"}
				onPick={(platformId, release) => update({ platformId, release })}
			/>
			</details>
			)}

			{brandsOn && (
				<details className="fold" open={(draft.brands?.length ?? 0) > 0}>
					<summary>
						Brand partners <span className="muted">{(draft.brands?.length ?? 0) > 0 ? `· ${draft.brands!.length} brand${draft.brands!.length > 1 ? "s" : ""}${brandPlan?.ok ? ` pay ${fmtMoney(brandMoney)}` : ""}` : "(optional)"}</span>
					</summary>
					<BrandPartners state={state} ctx={brandCtx} picks={draft.brands ?? []} onChange={(brands) => update({ brands })} />
				</details>
			)}

			<details className="fold">
				<summary>Cost breakdown <span className="muted">· total {fmtMoney(total)} of {fmtMoney(cash)} cash</span></summary>
			<table className="cost num">
				<tbody>
					<tr>
						<td>Salaries</td>
						<td>{fmtMoney(budget - BASE_PRODUCTION_COST - extraTotal)}</td>
					</tr>
					<tr>
						<td>Base production</td>
						<td>{fmtMoney(BASE_PRODUCTION_COST)}</td>
					</tr>
					<tr>
						<td>Extra production{fundedPitch && <span className="muted"> (what the pitch leaves, plus your extra)</span>}</td>
						<td>{fmtMoney(extraTotal)}</td>
					</tr>
					<tr>
						<td>Marketing</td>
						<td>{fmtMoney(marketing)}</td>
					</tr>
					{chosenScript && (
						<tr>
							<td>Script ({chosenScript.writer})</td>
							<td>{fmtMoney(scriptFee)}</td>
						</tr>
					)}
					{found && (
						<tr>
							<td>Licence fee ({found.ip.name}){discount > 0 && <span className="muted"> &minus;{Math.round(discount * 100)}% from your streaming contracts</span>}</td>
							<td>{fmtMoney(licenseFee)}</td>
						</tr>
					)}
					{financing > 0 && (
						<tr>
							<td>{platform?.name} pays towards the budget</td>
							<td className="gain">&minus;{fmtMoney(financing)}</td>
						</tr>
					)}
					{marketingCover > 0 && (
						<tr>
							<td>{platform?.name} pays towards marketing</td>
							<td className="gain">&minus;{fmtMoney(marketingCover)}</td>
						</tr>
					)}
					{brandMoney > 0 && (
						<tr>
							<td>Brand partners pay</td>
							<td className="gain">&minus;{fmtMoney(brandMoney)}</td>
						</tr>
					)}
					<tr className="total">
						<td>Total cost</td>
						<td className={total > cash ? "loss" : ""}>{fmtMoney(total)}</td>
					</tr>
					<tr>
						<td className="muted">Cash available</td>
						<td className="muted">{fmtMoney(cash)}</td>
					</tr>
					{fit !== null && !hide && (
						<tr>
							<td className="muted">Team fit for {GENRE_LABEL[draft.genre]}</td>
							<td>
								<b>{fit}</b>
							</td>
						</tr>
					)}
					{duos.length > 0 && (
						<tr title={duoTip}>
							<td className="muted">
								Chemistry ({duos.length} returning duo{duos.length > 1 ? "s" : ""})
							</td>
							<td>
								<b>{chemEstimate !== null ? `about +${chemEstimate.toFixed(1)}` : `up to +${chemPotential.toFixed(1)}`}</b> quality
							</td>
						</tr>
					)}
				</tbody>
			</table>
			</details>

			{hints.length > 0 && (
				<ul className="chal-hints">
					{hints.map((h) => (
						<li key={h.text} className={h.ok ? "ok" : "bad"}>
							{h.ok ? "✓" : "✗"} {h.text}
						</li>
					))}
				</ul>
			)}
			<div className="gl-footer">
				<div className="num">
					<span className="muted">Total cost </span>
					<b className={total > cash ? "loss" : ""}>{fmtMoney(total)}</b>
					{fit !== null && !hide && <span className="muted"> · fit <b>{fit}</b></span>}
					{scriptInfo && !hide && <span className="muted"> · script <b>{Math.round(scriptInfo.quality)}</b></span>}
				</div>
				<button className="btn" onClick={onGreenlight}>
					{greenlit ? "Replace greenlit film" : "Greenlight film"}
				</button>
			</div>
			{error && <p className="error">{error}</p>}
		</section>
	);
};
