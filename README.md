# Studio GM

A movie-studio management game inspired by Basketball GM.

## Run
    npm install
    npm run dev          # open the URL it prints
    npm run typecheck

## How to play
0. Pick a difficulty on the start screen. Easy: lots of cash, everyone hires. Hard: less cash, and better talent refuses you until your reputation is high enough (see "Needs rep" in the talent table). Edit `DIFFICULTY_SETTINGS` in `constants.ts` to tune them.
1. **Development:** choose a genre, hire 1 director and 3 actors, set each actor's billing (**Lead** or **Supporting**, at least one of each), set extra budget and marketing, click "Greenlight film". Billing is per film: the same actor can be a lead one year and supporting the next.
2. Advance through **Production -> Post -> Distribution -> Awards -> Off-season**.
3. **Franchises:** in Development, pick "Sequel to ..." under Franchise to continue one of your released films. The sequel keeps the genre, and part of its box office and critic score follows the prequel (see below). Rival studios make sequels to their own hits too.
4. Ten films are released every year: yours plus nine from the rival studios (`MOVIES_PER_SEASON` in `constants.ts`). A director can only make one film per season, but an actor can be in several (rivals use up to `MAX_ACTOR_FILMS`, 3). Awards compare everyone's films.
4b. **Awards race:** in the Distribution phase a panel shows the top 5 contenders per award (picture, director, actor, actress, supporting actor, supporting actress) with their chance of winning. It is estimated by simulating the vote 4000 times (`computeRace` in `awards.ts`). The real awards are a fresh draw, so the favourite can lose.
5. In the off-season people age, develop, retire, and new talent arrives.
The game has 5 save slots and saves itself into the current slot after every action (browser localStorage). The start screen lists the slots: Continue or Delete a used one, or pick a difficulty and start a new game in an empty one. "Save slots" in the top bar returns to that screen without deleting anything. The game reopens the slot you played last. A single save from before slots existed is moved into slot 1.
If you change the shape of `GameState`, bump `SLOT_PREFIX` in `src/game/storage.ts`.

## Where things live (src/game)
| File | What it does |
|---|---|
| `types.ts` | Data model: Person, Movie, Studio, Phase, awards |
| `constants.ts` | Tuning numbers: economy, specialties, genre bonuses |
| `ovr.ts` | Overall rating + genre fit (weights are here) |
| `realTalent.ts` | The real actors/directors the game starts with (edit the lists to add more) |
| `generate.ts` | Invented people: attributes, specialties, contracts, potential |
| `titles.ts` | Film title generator: genre-aware word pools, ~17 title patterns, no-repeat memory (add words to the pools at the top) |
| `develop.ts` | Yearly aging, development, retirement |
| `movie.ts` | The sims: production, post, critic score, box office |
| `ai.ts` | Rival studios choose their films |
| `awards.ts` | Best picture / director, plus lead and supporting actor / actress (men and women compete separately). Licensed films are discounted by their IP's `awardsPenalty` |
| `cast.ts` | Lead vs. supporting billing helpers (`MIN_LEADS` / `MIN_SUPPORTING` live in `constants.ts`) |
| `franchise.ts` | Sequels and franchises: continuity, the blend with the prequel, sequel fatigue, rival sequel picks |
| `ip.ts` | Licensed IPs: buying rights, boost, fan expectations, backlash/acclaim, goodwill, rival purchases, critic projection |
| `trade.ts` | Trading IP rights: valuation, negotiation with rivals, quick sale, rival offers, turning your own sequel franchise into a sellable IP |
| `ipData.ts` | The catalogue: 20 real IPs (Marvel, DC, Star Wars, Harry Potter, Dune, Fast & Furious, 007...) with their heroes and stories |
| `directorPitches.ts` | Director pitches: generating them each Development phase, funding / counter-offers / passing, the funded budget, rivals picking up films you passed on |
| `records.ts` | Record books for the Records page: biggest openings, biggest flops, top 10 critics and audience scores, longest awards droughts |
| `legacy.ts` | All-time rankings for the Frivolities page: GOAT actor / director / film scores, top earners, famous IPs, pairs and duos, plus a person's filmography (weights at the top) |
| `streaming.ts` | Streaming contracts: platform pitches at the greenlight, release modes, term generation, offers, yearly payments, renewals |
| `streamingData.ts` | The 9 platforms: wallet, taste, view of cinemas, financing share, perk weights, demand styles |
| `streamingPerks.ts` | What running contracts do for the rest of the game (talent, awards, IP fees, box office). Types only, so no import cycles |
| `challenges.ts` | Challenges: the rule and goal definitions, the checks the rest of the game asks before an action (`planBlocker`, `streamingBlocker`, `ipBlocker`...), goal progress, win / lose settling, bankruptcy |
| `rivalries.ts` | Lasting feuds and frenemies between two people: bonds, what they do to a film, how they cool, end and start (`news/bonds.ts` writes the off-season gossip) |
| `scripts.ts` | Scripts: the per-season writers\' market (4 styles x 9 genres), script quality as its own stat, style strengths, genre fit, prices, what a script does to the sims |
| `traits.ts` | Talent personality traits (Diva, Workaholic, Injury-prone, Loyal, Scandal-prone, Mentor, Peacemaker, Press darling): what each does to the drama odds, how people get them, how they are discovered |
| `negotiate.ts` | Advanced negotiations: asking price, demands, chance of a yes, signed promises checked at the greenlight, backend shares (tuning constants `NEG_*` at the top) |
| `brands.ts` | Brand Deals: greenlight quotes, release effects, hit bonus / make-good, off-season engine (merchandise, games, TV, studio partners), offers (tuning constants at the top) |
| `brandData.ts` | The brand catalogue: 50+ real brands with prestige, promo reach, genres they love and avoid, and what they do with you |
| `features.ts` | The on/off switch for optional features (shared with the Studio GM Toolkit extension) |
| `phase.ts` | The phase machine + greenlighting |
| `storage.ts` | Save / load |
| `news/` | The news feed: `voice.ts` (epithets), `drama.ts` (feuds, injuries, scandals), one writer per phase (`production.ts`, `release.ts`, `awardsNews.ts`, `offseason.ts`), `index.ts` (orchestrator) |

UI is in `src/App.tsx` and `src/ui/`.

## Advanced negotiations (negotiate.ts)
Switch it on with the **Negotiations** checkbox in the Talent panel (or the Studio GM Toolkit popup; it is the same switch). **Hire** and **Pitch** become **Negotiate**, for actors and directors alike.
- **You offer**: a salary, a backend (0-15% of the box office), and optional promises: a genre, a script type, a director (for actors) and up to two co-stars (actors for a director).
- **They ask**: a fair price (`askingSalary`: market price x (1 + 5% per reputation point you are short), up to 30% less for the least famous) and **demands** (`demandsOf`): a minimum backend, a genre, a script type, a director or castmate of a given standing. The count grows with fame and with the reputation gap; the same person asks the same things all season. Demands you meet are ticked live.
- **Chance of a yes** (`evaluate`): a logistic curve of (salary + backend value) / ask, minus a penalty per unmet demand, plus small bonuses for a genre that suits them or a castmate as good as they are. Less famous people forgive unmet demands, are keener, and so accept worse contracts more often. Past `PITCH_MAX_GAP` they will not take the meeting.
- **Rounds**: 3 offers per person per season, each failed one lowers the chance (`NEG_PATIENCE`); an offer worth under 55% of their ask ends the talks. A no tells you what they want, and a salary that would get a yes.
- **A signed deal** replaces their price (`salaryOf`) and lets a refusing person work with you this season. **Promises are binding**: `greenlightMovie` refuses a film that breaks them (`dealBlocker`). **Backend** is snapshotted on the film (`Movie.backend`) and paid out of the box office at release (`Movie.backendPaid`, counted in profit and reputation).
- Saves: `GameState.negotiations` (missing in older saves = none), so no save version bump.

## Brand Deals (brands.ts, brandData.ts, src/ui/Brands.tsx, BrandPartners.tsx)
On by default. Switch it with the checkbox on the **Brands** page or the Studio GM Toolkit's *Brand Deals* mod (same switch; the toolkit also sets how much brands pay and whether beer and spirits brands appear). Switched off: no sponsors, no new offers; deals already signed keep running.
- **At the greenlight** (*Brand partners*): up to 3 **product placements** and 1 **presenting sponsor**, one brand per category. They pay up front (subtracted from the cost, never more than 15% of budget + marketing). Each brand has *prestige* (reputation your studio needs: `5 + 8 x prestige`), *promo* (cross-promotion), genres it *loves* (pays 25% more, costs half the critic points) and *avoids* (refuses).
- **At the release**: every logo costs critic points (`CRITIC_CAP` 10, diminishing; action and adventure shrug it off, drama suffers 2.3x as much) and adds gross (`PROMO_CAP` 10%). Four or more points lost also costs studio reputation.
- **After the release**: gross >= 2x the film's budget + marketing -> a **hit bonus** (30% of the fees); under 0.6x -> a **make-good** (25% of the fees back). Each brand's **relationship** (0-100, `GameState.brandRel`) moves, and moves the fees (0.85x-1.15x); below 15 a brand will not work with you.
- **Offers after a hit** (made when the awards end, valid for the off-season): **merchandise** (LEGO, Hasbro, Mattel, Funko, Bandai, Spin Master: upfront + 3 years of fading royalties), a **video game** (PlayStation, Xbox, Nintendo, Ubisoft, EA, Activision, Epic: released next off-season, scored 0-100, royalties from 0.15x to 2x the estimate), a **TV spin-off** (Netflix, Prime, Disney+, Max, Apple TV+, Paramount+, Peacock, Hulu: 1-3 seasons, a hit is renewed, a flop cancelled). The odds depend on box office, reviews, genre (family and action sell toys and games), sequels and licensed IP. A film gets one game and one series ever.
- **Studio partners**: famous studios (reputation `minRep + 8`) get yearly partnerships (3-4 years, max 3). A partner locks its category on your films and pays 15% more for placements.
- **Franchise heat** (`GameState.brandHeat`, by franchise id): merchandise, games and TV raise it, flops lower it, it fades 10% a year. A sequel's gross gets up to +10% (`HEAT_GROSS`).
- Saves: every new field is optional, so older saves load unchanged and the save key was not bumped. Tuning: constants at the top of `brands.ts`.

## Rivalries and feuds (rivalries.ts)
A **bond** (`GameState.bonds`) is a lasting FEUD or FRENEMIES between two people (director + actor, or two actors) with a heat from 0 to 100.
- **Where they come from**: the on-set drama (`news/drama.ts`): the director-vs-star feud and the star walkout start feuds, "Creative friction" starts frenemies, a patched-up feud calms an existing one, and the new **Cast clash** event does the same between two actors. The tabloids start one or two more every off-season (they favour divas), and a new game begins with a few in the air.
- **What a feud costs a film** that casts both (`teamTension`, applied in `simProduction`): up to `FEUD_DIRECTOR` (5) production points for a director + actor pair or `FEUD_ACTORS` (4) for two actors, scaled by heat, and the chemistry bonus from their earlier films is cut by up to `CHEM_KILL` (60%). A Peacemaker on the film halves it (`CALM`). Total feud damage is capped at `FEUD_CAP`.
- **Frenemies** perform better: up to `FRENEMY` (3) production points each (cap 5), and a hot pair adds `FRENEMY_GROSS` (+3%) buzz at the box office.
- **They persist and feed on themselves**: a pair with a bond is likelier to have another on-set fight, walkout or clash if cast together (`tensionOdds`), and the news says "it is not the first time".
- **They fade**: each off-season a bond cools (`COOL`) unless the pair worked together; a cooled feud may end in a reconciliation (`RECONCILE_*`), and a bond is dropped when either retires.
- **Where you see them**: the greenlight panel lists feuds and friendships among the director and cast you picked (with the quality they cost or add), the Talent list flags anyone who feuds with someone you have already picked, a person's profile lists their bonds, and a film's page lists the tensions it had. The licensed-IP "fans' bar" projection includes them. The data on a film is `Movie.tension`.
- Rivalries on the real roster are invented for the game and say nothing about the real people.

## Scripts (scripts.ts)
Every film starts from a script, picked in the **Script** section of the greenlight form (below Title / Genre). Each Development phase the market offers 36 scripts: one of each style for each genre. Choosing a genre shows that genre's four scripts, and the film's genre is the script's genre.
- **Script quality** (0-100) is its own stat. A script's *rating* is its quality plus the style's genre fit (`AFFINITY`, x`AFFINITY_SCALE`). Rating above 60 lifts production quality (`SCRIPT_PROD_WEIGHT`) and post-production (`SCRIPT_POST_WEIGHT`); below 60 drags them down.
- **Styles** (`STYLES`): *High concept* +10% box office, critics -1, suits action / sci-fi / adventure. *Character-driven* +4 critics, -5% box office, suits drama / romance / crime. *Crowd-pleaser* +4 audience score, safe, critics -2, suits comedy / romance / adventure. *Risky original* cheaper, +2 critics, audience -2, and it **lands** anywhere (`landed`, sd 11) on the shoot, so you only find out when it is shot.
- **Genre vintage**: each genre's shelf is a little richer or thinner every year, so the best genre to make changes.
- **Price**: grows 7.5% per quality point (about $2M at 60, $9M at 80, $27M at 95) and is added to the film's cost (`Movie.scriptFee`, counted in `movieCost`, cash checks, the Shoestring rule and the Money stats).
- **Funded director pitches** come with the director's own script (`directorScript`: style from their attributes, quality from their craft, no fee). Rivals buy the better of two scripts (`aiScript`). Films from older saves have no script, which counts as a plain 60.
- Saves from before scripts get a market when loaded in Development (`storage.ts`). Hide ratings shows words (Weak ... Superb) instead of numbers.

## Personality traits (traits.ts)
Every actor and director has 0-2 traits (42% none, 42% one, 16% two). Traits are **hidden**: the Talent table and a person's profile only show the ones you have discovered. They work whether or not you know them, so who you cast changes your luck.
- **What they do to the drama** (`news/drama.ts`). Each trait has three numbers in the `TRAITS` table:
  - `odds`: how much likelier an event is when the person is on the film (e.g. Diva: feud x2.2, walkout x3.2; Injury-prone: injury x4.5; Scandal-prone: scandal x4.5). Several people's traits add up. Only the people an event concerns count (`SCOPE`: injuries and walkouts look at the cast, final-cut wars at the director, feuds at everyone).
  - `tilt`: how the outcome leans when the event is about that person (a Peacemaker turns feuds into "nothing happened", a Press darling shrugs off scandals, a Diva's walkout is likelier to hurt).
  - `heat`: how often the film has *any* event at a stage (`stageHeat`). Hot films also win the limited news slots (`STAGE_MAX`) more often.
  - Events are also about the right person: `chooseSubject` favours the castmate whose traits fit, and leads over supporting players.
- **Trait-only events**: Star demands (Diva), A mentor on set (Mentor, with a young castmate), A star rallies the crew (Loyal), Marathon shoot (Workaholic). They only exist when someone with the trait is in the cast.
- **Outside the drama**: a Mentor teaches castmates `MENTOR_TRAIT_GAIN` times faster (mentor.ts). A Loyal person needs `LOYAL_REP_DISCOUNT` less reputation from a studio they have already worked for (hiring.ts). Veterans (38-52) may grow into Mentors (`lateBloom`, develop.ts).
- **Discovery**: some traits are public from the start (`known` per trait, about a third overall). A trait that causes an event is named in the article and on the film page's "Behind the scenes". Every released film also has a chance per hidden trait to show it (`LEARN_CHANCE`: 30% on your films, 8% on rivals').
- **Who gets what** (`genTraits`): stars skew toward Diva, Scandal-prone and Press darling; only older actors start as Mentors. The real roster and old saves get traits from a seeded roll on the person's name, so the same person always has the same personality. Those traits are invented for the game and say nothing about the real people.
- Data: `Person.traits` / `Person.knownTraits` and `DramaRecord.who` / `.trait` (types.ts). Old saves are filled in on load (`withTraits` in storage.ts), so `SLOT_PREFIX` did not need a bump.

## Streaming contracts
- **At the greenlight** (Development, "Streaming partner"): every platform checks your studio reputation, the team's fit for the genre, genre, budget and whether it has room on its slate this season. An interested platform pays part of the budget (and some marketing) when production starts and signs a contract once the film is out.
- **Release mode**: wide, a limited run + festivals, or a streaming premiere. Each platform has a `theatrical` stance (-1 hates cinemas, +1 loves them) that moves financing, box office and the yearly payment (`releaseFx` in `streaming.ts`, numbers in `STREAM_FX`). Netflix punishes a wide release and rewards a premiere; Disney+ and Paramount+ are the opposite; Apple TV+ and Max love a limited prestige run. Streaming premieres pay a viewership payout instead of a box office, lose awards points and earn less reputation.
- **Already-released films cannot be sold from the page.** Platforms make offers in the off-season (`streamingOffseason`), and two can bid for one film.
- **Contracts last 4-5 off-seasons** (3-4 for a renewal). They pay a yearly sum (scaled by the audience score for films backed from the greenlight) and carry 1-3 **perks** (slate promotion, reputation, awards campaign, sequel bonus, IP licence discount, easier talent) and 1-3 **demands** (genre quota, cap or minimum on wide releases, exclusivity, reputation floor). Demands pay a premium on the yearly sum (`STREAM_DEMAND_PREMIUM`).
- **When a contract ends** the platform either offers to renew on different terms (it leans away from the old perks and demands, and gets stricter) or lets the rights lapse. Broken demands cost a penalty (one year's payment each), reputation, and the renewal.
- Old saves are converted by `migrateStreaming` in `storage.ts` (the old deals become plain contracts; old offers and talks are dropped).
- Tuning: `STREAM_*` in `constants.ts`, platforms in `streamingData.ts`.

## All-Time edition
On the start screen, click the "Studio GM" title 5 times in a row (5 more flips it back). A purple "All-Time" tag appears and the UI turns purple. Games started then use `src/game/allTimeTalent.ts` instead of the real roster: the greatest actors and directors ever, all 18 years old, starting well below their prime (the overall on each line is their prime and their potential) and growing into it. Saves remember the edition (`allTime` on `GameState`); the purple theme is `:root[data-theme="purple"]` in `styles.css`.

## Real talent
`realTalent.ts` holds one line per person: `Name|birthYear|overall|specialties`. Ratings are made up for the game.
The game starts with only these people. Invented newcomers start arriving from `RANDOM_TALENT_START_SEASON` (2027, in `constants.ts`), so the pool is refilled while the real generation ages.
Retirement ages are `RETIRE_START_AGE` in `constants.ts` (actors 68, directors 76).

### Keeping talent quality stable over decades
- **Aging** (`ageDelta` in `develop.ts`): role-specific. Actors plateau until 46, then decline slowly. Directors keep improving to 35, plateau until 62, and decline gently after that.
- **Newcomers per year** (`NEW_ACTORS_PER_YEAR`, `NEW_DIRECTORS_PER_YEAR`): added every off-season, on top of the `TARGET_*` minimum.
- **Newcomer quality** (`NEWCOMER_TIERS` in `generate.ts`): each newcomer rolls a peak overall: 5% once-in-a-generation (~91), 19% stars (~84), the rest working talent (~68). They start lower by the growth still ahead of them (`growthLeft`), and `pot` now reflects that.
Simulated over 30 seasons the top-10 actor and director both stay at about 87-88 (before: they fell to 77 and 62 after 24 seasons).

## Balance knobs (constants.ts + generate.ts)
`MARKET_BASE` (how much money exists), `CONTRACT_GROWTH` (star prices),
`SPECIALTY_BOOST`, `*_NOISE` (luck), `EXTRA_BUDGET_*`.

## Franchises (franchise.ts + the FRANCHISE_* knobs in constants.ts)
A franchise is just a chain of films; each sequel remembers the film it continues (`prequelMid`).
A sequel's results are a **blend** of its own result and its prequel's:

    result = (1 - weight) * own + weight * (prequel * growth)

- **weight** is 25-45% for box office and 15-30% for critics. It rises with *continuity*: the share of the prequel's director + 3 actors who return. Bringing everyone back costs more in salaries and is what makes the link strong.
- **growth** is the audience carry-over: x1.5 for part 2, falling 0.2 per part to a floor of x0.7. So sequels peak at parts 2-3 and are back to a normal film by part 5.
- **fatigue** takes 1.5 critic points off per part after the first (max 9).
- Only the first $150M of a prequel's gross carries over, and because it is a blend a sequel can never snowball past its prequel's result by more than a bit. A flop drags its sequel down too.

Measured over thousands of simulated chains: part 2 earns about +10% (new crew) to +18% (same crew) over a standalone film of the same quality, part 5 is about break-even, part 6 is about 15% below.
The movie card shows the "franchise effect" (standalone vs. final numbers), and the Franchises panel tracks each series.
Old saves still load (all new fields are optional), so the save key was not bumped.

## IP Store (ip.ts, ipData.ts, src/ui/IpStore.tsx)
Click **IP Store** in the top bar (right next to Studio). It lists 20 real franchises. Buy the rights to a universe once, then in Development pick one of its heroes or stories under **Licensed property** in the greenlight panel.

**What you get:** a box-office boost on the final gross and a bigger opening weekend (`IP_OPENING_RUSH`).
**What you pay:** the one-time price of the rights (Marvel $260M ... Transformers $70M), plus a licence fee on every film (added to the film's cost and counted in profit).
**What the fans expect:** every property has a critic score and a box office the fans want to see. Both go up with the property's *heat* (Spider-Man asks for more than Moon Knight), and each IP has a *severity* (Fast & Furious fans are forgiving, Star Wars and Dune fans are ruthless).

    boost       = 1 + (IP boost - 1) x IP_BOOST_SCALE x heat x goodwill factor
    after the film is released:
    critics below the bar -> backlash: -1.2% box office per point x severity (max -30%)
    critics above the bar -> acclaim:  +0.8% per point (max +8%)
    met both bars         -> reputation +1 (up to +3); missed -> reputation lost (up to -8), scaled by severity
    goodwill (0-100)      -> moves with how far you beat or missed the bars; it scales the boost 0.6x .. 1.4x

- **Heroes and sequels:** a second film about the same hero continues the first (the normal franchise rules apply on top: carry-over, continuity, fatigue). Real titles are used where they exist (Harry Potter, Dune, the Bond films, Fast & Furious...), otherwise the game numbers them.
- **Crossovers** (The Avengers, Justice League) unlock after films about `TEAMUP_UNLOCK` (2) different heroes of that universe, and have the biggest boost and the highest bar.
- **Exclusive rights:** each IP can have one owner. From `AI_IP_FIRST_SEASON` (2028) a rival that can comfortably afford it may buy rights in the off-season, and then makes licensed films with the same rules. Rights can be traded between studios (see Trading IP rights).
- **Cash you have promised:** while a film is greenlit in Development, its cost is set aside, so you cannot buy rights with that money.
- **Projected critics:** the greenlight panel shows a no-luck estimate (`projectedCritic`) of your team's critic score next to the fans' bar, with a warning when you are below it.
- Movie cards show the boost in dollars, the fan reaction, whether expectations were met, and the goodwill change. Licensed films carry an IP tag in the release lists.

Tuning: prices, fees, boosts, bars and severity per IP are in `ipData.ts`; the global dials (`IP_BOOST_SCALE`, backlash/acclaim rates, reputation, rival behaviour) are at the bottom of `constants.ts`.
Measured with a star team (top director and cast): about 85-100% of films meet the critic bar on most IPs and 70-90% on Dune / Middle-earth. With a mid-tier team (rank 80+ of 448) Marvel, Dune, Middle-earth and Bond almost always miss it, while Transformers and Fast & Furious are comfortable. Hire for the IP.
Old saves still load: `GameState.licenses` and the new `Movie` fields are optional, so the save key was not bumped.

## Trading IP rights (trade.ts, IP Store page)
Rights are no longer permanent.
- **Sell your rights.** On an IP you own, click *Sell rights...*. Each rival that can afford it shows the most it would pay this round. Take it, or ask for more. Rivals give ground over 3 rounds (`TRADE_ROUNDS`) and then walk away until next season; a ridiculous ask burns a round and moves them nowhere. *Quick sale* sells instantly for 60% of the value to the richest rival that can pay.
- **Negotiate to buy.** On an IP a rival owns, click *Negotiate to buy...*. The rival shows an asking price and comes down after each miss, to its reserve in round 3.
- **Sell your own franchise.** A chain of 2+ released original (unlicensed) sequels appears under *Your franchises*. Selling it creates a custom IP (`GameState.customIps`) priced from the series' box office and critics, with its own boost, licence fee and fan expectations. The buyer continues it through the licence; you can no longer make sequels to it unless you buy it back. Rivals that buy it make films on it too.
- **Value** = list price x (0.7 .. 1.3 by fan goodwill) + a share of the owner's profit on it.
- **Rival offers.** In the off-season rivals may offer to buy one of your IPs or franchises; offers expire when the new season starts.
- **Limits.** Rights bought this season cannot be resold until next season; an IP with a film in production cannot be traded; rivals hold at most 3 IPs. Dials: the `TRADE_*` constants at the bottom of `constants.ts`.
Old saves still load (new `GameState` fields are optional).

## Chemistry (chemistry.ts + the CHEMISTRY_* knobs in constants.ts)
People who already made films together work better together. When a film is shot, every pair on it that shared earlier released films adds "chemistry units": a returning director + actor counts 1, two returning actors count 0.7, and each pair's strength is 1 - 0.5^k after k shared films (50%, 75%, 87%...). 5 units give the full bonus of **+4 production quality**.
The bonus is scaled by how good the film already is: nothing at a team+production quality of 50 or below, 25% at 60, 50% at 70, 75% at 80, everything at 90 or above. So a great team gets the full bonus and a weak one almost nothing. (The real-talent roster is so strong that nearly every film is "already good" for now; the gate matters more once invented, lower-rated talent arrives in 2036.)
Measured: one earlier film together is about +2 production quality, two about +3, four about +3.7. In the final results that is roughly +1 critic point and +1-3% box office, a slight edge. Rival studios get it too.
The greenlight panel previews the bonus (hover the row for the duos) and the movie card shows what was applied. Old saves work (the new field is optional).

## Frivolities page (legacy.ts + src/ui/Frivolities.tsx)
Click **Frivolities** in the top bar. It shows, across every studio and every season so far (retired people included):
- **GOAT actor**, **GOAT director** and **GOAT film** with a bar showing where the score comes from, plus the runners-up.
- **Most acting pair** (two actors in the most films together) and **actor-director duo** (a director and an actor with the most films together). Both need at least 2 films together; hover the film count for the titles.
- Top 5 actors by acting awards, top 5 actors by box office, top 5 films by box office, top 5 most famous IPs (franchises).

Scores (all weights are in `GOAT_ACTOR`, `GOAT_FILM`, `IP_FAME` at the top of `legacy.ts`):
- **Actor** = 10 per lead award + 6 per supporting award + 2 per Best Picture film + 1 per $50M of box office + 0.6 x (overall - 50) + 0.4 x (star power - 50) + 0.5 x (average critics - 60). Star power is the average of charisma and audience connection, which stands in for an actor's public reputation. The last four terms never go below zero.
- **Director** = 10 per Best Director + 6 per Best Picture film they directed + 1 per $50M of box office + 0.6 x (overall - 50) + 0.4 x (average of vision and technique - 50) + 0.5 x (average critics - 60).
- **Film** = 0.5 x (critics - 50) + 1 per $25M + awards (Picture 15, Director 6, lead 5 each, supporting 3 each) + profit on cost (up to 7.5) + 2 per later part in its franchise (up to 10).
- **IP fame** = 1 per $10M of total box office (scaled by average critics) + 3 per award its films won + 2 per film. Only series with 2+ films count.
**Peak, not current:** the actor and director scores use each person's *peak* overall (and the attributes they had at that peak), recorded in `Person.peak` by `developPerson` every off-season. So retired legends and veterans in decline are judged at their best. Saves from before this change have no recorded peak yet, so those people count at their current ratings (or their best from the next off-season on).
It only reads the game's history, so it changes nothing about how the game plays and old saves work.

## Profiles
Every actor and director name in the game (Your films, the year's releases, Frivolities, the talent list) is clickable. It opens a window with their awards, total box office, average critics' score, and a full filmography: year, film, role (director / lead / supporting), critic score, box office, and the awards they won for that film (plus a note if the film won Best Picture). Press Esc or click outside to close. The window is `src/ui/Profile.tsx`; names get the click through `profileContext.ts`.

Profiles also list **nominations**. Each ceremony stores its nominees (the awards race's top 5 per category, plus the winner if luck picked someone outside it) in `SeasonAwards.nominees`. The profile shows every nomination with Won / Nominated, and the filmography notes nominations and Best Picture nominees. Seasons saved before this version only have wins.

## Records page (records.ts + src/ui/Records.tsx)
Click **Records** in the top bar. Three top-10 lists across every studio and season:
- **Highest-grossing opening.** Each film now stores `Movie.opening`, rolled by `simOpening` in `movie.ts` after the final box office is known. It is a share of the total, about 15-55%: 32% base, +12 points for max marketing, +4 for sequels, -0.3 per critic point above 50, plus a little luck. So well-reviewed films have legs and loud sequels open big. Films from older saves have no opening figure and are skipped.
- **Biggest flop.** Ranked by dollars lost (box office minus budget and marketing). Hover the loss for the share of the cost lost.
- **Longest awards drought.** For anyone with at least one person award, the most seasons between two wins, or from their last win until now (active people) or their last film (retired people). "Still waiting" marks people who are active and have not won since.

## Career graphs (CareerGraph.tsx, `careerOf` in legacy.ts)
Every profile window now has three dependency-free SVG charts: **overall rating** by season, **critics' score** per film, and **box office** per year. Gold rings and bars mark years the person won an award; hover a point for details.
The rating line needs history, which is new: `developPerson` now takes the new season and stores `Person.history` (overall at the start of each season, seeded with the previous season's value). Old saves load fine, but their rating graph starts at the next off-season; the critics and box office graphs work immediately from existing films.
No save key bump was needed (all new fields are optional).

## Film pages (MovieProfile.tsx, MovieName.tsx, `filmPage` in legacy.ts)
Every film title in the game is clickable, like actor and director names: Your films, the year's releases, the awards winners and race, Frivolities, Records, and a person's filmography and awards list. It opens a window with:
- **Money:** box office, opening weekend (with its share of the total), budget, marketing, licence fee, total cost, profit and return on cost.
- **Reception:** critics' score, production and post quality, and ranks: box office within its season and of all time, critics' rank, opening-weekend rank.
- **Director and cast:** all clickable; leads first, supporting under their own label.
- **Awards and nominations:** every award the film won or was nominated for, with the person's name (Best Picture has none).
- **Franchise:** the whole series with box office and critics per part (click to jump between parts), plus the franchise effect and returning-crew share.
- **More info:** licensed IP boost, fan reaction and expectations, chemistry bonus.
Only one window is open at a time: clicking a person inside a film page opens their profile, and clicking a film inside a profile opens the film. Press Esc or click outside to close. `filmPage` only reads history, so old saves work (films without an opening figure show "not recorded").

## Awards and licensed IPs (`awardsPenalty` in ipData.ts, `AWARDS_PENALTY_WEIGHT` in constants.ts)
Awards voters admire the big franchises but rarely crown them. Every IP has an `awardsPenalty`: critic points knocked off its films' score in the awards vote. Best Picture takes all of it, Best Director 60%, the acting awards 40% (`AWARDS_PENALTY_WEIGHT`). It changes the race odds, the nominations and the real draw alike, but not the critics' score, box office or the GOAT rankings.

| Penalty | IPs |
|---|---|
| 0-2 (judged like any film) | Middle-earth 0, Dune 0, Planet of the Apes 2 |
| 3-5 | Avatar 3, The Matrix 3, Alien & Predator 3, Star Trek 4, Indiana Jones 4, Harry Potter 5, Bond 5, John Wick 5 |
| 6-8 | Star Wars 6, Mission: Impossible 6, Pirates 7, Marvel 8, DC 8, Jurassic Park 8 |
| 9-11 | Monsterverse 9, Fast & Furious 10, Transformers 11 |

Homegrown IPs (your own franchise sold on) have no penalty. The IP Store shows a "Voters snub it / wary / lukewarm" badge, and a licensed film's page shows its discount.
Measured chance of winning Best Picture for a film with a given critics' score (against rival fields from a 20-season simulation, where the best rival film averages 88):

| Critics | Original | Marvel / DC | Star Wars | Transformers |
|---|---|---|---|---|
| 90 | ~41% | ~12% | ~19% | ~4% |
| 94 | ~69% | ~29% | ~40% | ~15% |
| 98 | ~89% | ~52% | ~65% | ~34% |

So a superhero film still sweeps when it is truly the best film of the year, it just isn't a lock any more. To tune: edit `AWARDS_PENALTY` in `ipData.ts` (per IP) or `AWARDS_PENALTY_WEIGHT` (per award). Old saves work: the penalty is read from the catalogue, not stored in the save.

## Voter fatigue (`fatigueAdjusted` in awards.ts)
Director and the four acting awards (not Best Picture: a film only competes once) adjust each contender's score from their history **in that same category**: `A = B(1 - F) + O`.
- `F = min(0.20, W + N + C)`: **W** = sum over past wins of `0.11 x 0.58^(d-1)` (d = seasons since the win); **N** = `0.015 x (nominations in the last 5 seasons, max 5, minus 1)`; **C** = `min(0.02, 0.0075 x (consecutive nominated seasons - 2))`.
- `O` = overdue bonus for someone who has never won: `min(4, 0.8 x (past nominations - 2))`.
It feeds the race odds, the nominations and the real draw alike. History comes from `state.awards` (wins and `nominees`), so old saves work, though seasons saved before nominee lists only count wins. Tune the `FATIGUE_*` / `OVERDUE_*` constants at the top of `awards.ts`.

## Pitching actors (`pitchActor` in hiring.ts, `PITCH_*` in constants.ts)
On difficulties where people can refuse, an **actor** who needs more reputation than you have shows a **Pitch** box in the Talent list: choose how much extra salary to offer (+25% to +200%) and see the odds. `chance = 0.5 + (premium - gap x 0.06) x 1.25` (2%-95%), where gap = the reputation they need minus yours, so the higher their reputation bar, the more you must pay for the same odds. More than 35 points out of reach, they will not take the meeting.
- One pitch per actor per season. A no is final until next season.
- A yes lets you hire them this season at the higher salary, paid through the film's budget when you greenlight. The premium counts as salary, not as extra production value (`Movie.pitchExtra`).
- Directors cannot be pitched.

## Director pitches (directorPitches.ts, src/ui/Pitches.tsx, `DIRECTOR_PITCH*` in constants.ts)
At the start of every Development phase 3-5 directors bring you a film and ask for funding (the **Director pitches** panel above the greenlight form). Each pitch has a **title**, a **genre** (one of the director's three best), a **wish list** of 8-12 actors who suit the genre, and the **budget** the director asks for.
- **What the budget means:** it is the film's total budget, like the greenlight form's: the director's fee, the cast's salaries and the base production cost come out of it, and whatever is left goes into sets and effects (so a cheaper cast means a better-looking film). Marketing is separate and still your call. Your *Extra production budget* field adds on top of the pitch.
- **Fund it** (at the asking price, or by typing your own amount) and the pitch becomes your plan: the director, title and genre are filled in, the talent list shows only the director and the wish list, and the cast must come from it. Sequels and licensed properties are off while a pitch is funded. You can only fund one pitch at a time (funding another one reopens the first); **Withdraw funding** gives the plan back.
- **Counter-offer:** at or above the ask the director says yes. Below it, they say yes only above a hidden reserve (70-92% of the ask, hinted as flexible / reasonable / firm). Each refusal uses up one of `DIRECTOR_PITCH_ROUNDS` (2) counter-offers, and after the last one the director walks away. Nobody will go under the cheapest possible film (their fee, the three cheapest actors on the list and the base cost); that is refused without costing a round.
- **Pass:** final for this season. A film you passed on (or lost by haggling) has a `DIRECTOR_PITCH_RIVAL_CHANCE` (50%) of being made by the rival with the fewest films that year, with the same director, title and genre and the best-fitting actors from the wish list (`rivalsTakePitches`, run just before the other rivals pick their films). You are told in the notice, and the film's page says it is "the one that got away".
- **Who pitches:** only directors who would work with your studio (on hard difficulty the top names stay away until your reputation is high enough), and the wish lists only hold actors who would work with you. Better directors pitch a bit more often. The ask is capped at 70-100% of your cash (with the usual 30% marketing on top) but never below the cheapest possible version of the film; directors whose cheapest version you cannot afford do not come.
- Pitches expire when the season ends and new ones are made in the next Development phase. Old saves get theirs the first time you are in Development (`GameState.directorPitches` is optional, no save bump). A pitched film carries `Movie.directorPitchId`; a rival's copy also has `Movie.passedPitch`.
- Tuning: `DIRECTOR_PITCH*` constants (how many, wish list size, production money, how much slack the ask has over the list's average price, reserve range, rounds, rival chance).

## News feed (src/game/news/, src/ui/News.tsx, Ticker.tsx)
Click **News** in the top bar. Every phase change writes one *issue* of 3-18 articles (about 40-50 a season) into `GameState.news`; the last `NEWS_KEEP` (320) are kept. A rotating **ticker** under the top bar shows the latest headlines, and the News button shows a badge with the unread count. The page has filters (your studio, awards, records, drama & gossip, box office, production, people, studios) and a season picker. Names and films in every article are clickable.

**What gets written**
- *Production starts:* the season slate, your film, the best-cast film, reunions (people who already worked together), sequels, licensed-IP films, the pitch you passed on that a rival made, spending sprees, gossip.
- *Wrap:* your film's set report, early buzz, trouble in the editing room.
- *Release:* the opening-weekend table, **records broken** (opening, gross, critics, audience, profit, biggest flop, all-time top 3), sleeper hits, flops, rave and pan reviews, critic/audience splits, sequels vs. their originals, fan reactions to licensed films, **duos that keep delivering** (or lose the magic), career-best reviews, the studio standings, streaming premieres.
- *Awards race:* a special **nominations article** with a table of all six categories, plus stories about races that are **too close to call**, **frontrunners**, "is this finally their year?" and "can they win again?".
- *Ceremony:* a special **winners article** with a table, then upsets, "finally!", back-to-back and record-setting wins, sweeps, shut-outs, the studio of the night, and speeches.
- *Off-season:* retirements (legends get a bigger send-off), newcomers, risers and decliners, new all-time GOAT leaders, rights deals, the year in review. *New season:* a preview, pitches on the market, sequel talk, power rankings.

**The voice (`voice.ts`).** People are introduced from their own history, as it stood going into the season: "two-time Best Actor winner", "last year's Best Director", "Best Picture-winning director", "perennial nominee", "top-rated actress", "rising star", "box-office king", "audience sweetheart", "visionary auteur", "horror maestro"... plus asides like "the director of arguably one of the best films ever made, *Title*". Adjectives such as *critically acclaimed* or *box-office draw* are **percentiles** (top 10-25% of everyone with 2+ films), so they mean the same thing in season 2 and in season 30. Each person is introduced once per article, then called by surname. Scoring weights are in `descs()`.

**Drama (`drama.ts`).** Each film rolls for an event at three moments: the shoot (`STAGE_CHANCE.production` 17% per film), post-production (13%) and just before release (13%), at most 3 per stage. There are 25 events (feud, injury, overrun, method acting, walkout, rewrite, perfectionist director, romance rumors, "cursed" horror set, final-cut war, reshoots, test screenings, leak, studio meddling, controversy, star scandal, viral moment, boycott, surprise cameo, festival premiere, review-bombing...). Each has weighted **outcomes: hurt, helped, or nothing** (a rumored feud may be patched up; friction may make the film better):
- Shoot / post events change `productionQuality` / `postQuality` by a few points when they happen, and can cost up to ~30% of the budget extra (paid by the studio).
- Buzz and boycotts (`gross`) and festival reviews (`critic`) are applied when the film is released (`releaseEffect`, capped at x0.8-1.3 box office and +/-5 critics).
- Every event is stored on `Movie.drama` and shown on the film page under "Behind the scenes"; the article says what it did. Pure gossip (marked RUMOR) changes nothing, or only adds a little buzz.
- Awards coverage never changes who wins.

Old saves load fine: all new fields are optional and the feed starts at the next phase change. A bug in the news code is caught and logged so it can never block advancing the game. To tune volume, see `STAGE_CHANCE` / `STAGE_MAX` (drama), `NEWS_KEEP` / `ISSUE_MAX` (index) and the thresholds at the top of each writer.

## Hide ratings (new-game option)
Tick **Hide ratings** on an empty save slot before pressing New game. It is stored in the save (`GameState.hideRatings`) and cannot be changed later. In that game:
- **Gone:** Ovr and Fit (talent table, director pitches and their wish lists, greenlight form, profile window), the attribute numbers and the "Ratings" toggle, the profile's rating-history graph, the exact "projected critics" forecast for licensed films (you still get an on-track / borderline / below-the-bar verdict), and the platform "fit 60+" requirements (shown as "a team that suits the genre").
- **The news follows the same rule:** no rating numbers, "top-rated", "A-list", "rising star", risers/decliners, "best cast by rating" or potential hints. The cast story is judged on box office and awards, and the season preview lists last year's champions instead of the top-rated names.
- **New ways to sort talent** (`game/trackRecord.ts`): *Films*, average *Critics*, *Box office*, average critics *in the chosen genre* (with the number of films), *Awards* (wins and nominations), plus *Age*, *Price* and the name column, which sorts by **specialties that suit the genre** (marked with a "suits Drama" tag) and then by genre record. People with no record go last, so in the first season (when nobody has played yet) you work from specialties, age and price, and the record fills in as films come out.
- The game itself is unchanged: ratings still drive every simulation, you just cannot see them.

## Studio name
Type a name in the **Studio name** box of an empty save slot before New game (28 characters at most; empty gives "My Studio"; a rival's name is not allowed and falls back to the default). It is used everywhere the game and the news mention your studio. Logic: `cleanStudioName` in `game/phase.ts`.

## Challenges (challenges.ts, src/ui/Challenge.tsx, the picker in SaveSlots.tsx)
Open **Challenge (optional)** on an empty save slot before New game. Pick a **goal** (a target with a deadline), any number of **rules** (handicaps), or both. The choice is stored in the save (`GameState.challenge`) and cannot be changed later. A game with no challenge, and every old save, plays exactly as before.

**The rules are enforced by the game logic, not just the buttons.** `greenlightMovie`, `buyLicense` / the IP trades and `acceptStreamOffer` all ask `challenges.ts` first, so no screen can get around a rule. The UI only explains them: locked notes on the Streaming and IP Store pages and in the greenlight form, a *Locked* button for barred actors, and a live checklist (`chal-hints`) for the rules that judge a plan (Shoestring, Fresh Faces, Repertory).

| Rule | What the game enforces |
|---|---|
| No Streaming | No platform backing at the greenlight, no licence or renewal deals, platforms stop making offers |
| No Licensed IP | No buying, selling or trading rights, no licensed films (your own sequels are fine) |
| No Sequels | A film cannot continue an earlier one (the 2nd film of a licensed series counts as a sequel) |
| Shoestring | A film's all-in cost (budget + marketing + licence fee - platform money) is at most `SHOESTRING_CAP` ($60M) |
| Repertory Company | From the 2nd film on, at least `REPERTORY_MIN` (2) people from your previous film must come back. People who retired or would refuse you do not count, so it can never trap you |
| Fresh Faces | Every actor must be `FRESH_FACES_MAX_AGE` (30) or younger. Directors are free |
| No Bailouts | Starting a season under `BAILOUT_BELOW` ($30M) ends the challenge in bankruptcy |

| Goal | Win condition | Seasons |
|---|---|---|
| Billionaire | Cash reaches `BILLION` ($1B) | 15 |
| Oscar Dynasty | `DYNASTY_TARGET` (5) Best Picture wins | 15 |
| Prestige | Studio reputation reaches `PRESTIGE_TARGET` (90) | 12 |
| Franchise Empire | Release the `FRANCHISE_TARGET`th (5th) film of one franchise (cannot be combined with No Sequels) | 12 |

A goal is won the moment it is reached and lost when the next season would start after the last one (`deadlineOf`, `settleChallenge`, called at the end of `advancePhase`). When a run ends, won or lost, its rules stop applying and the save carries on as a normal game (the Challenge page keeps the result). A run with rules and no goal never ends. With No Bailouts, bankruptcy fails the run and the usual investor bailout then keeps the save alive.

To add a rule: add its id to `RuleId` (types.ts) and an entry in `RULES`, then enforce it where the action happens (a blocker function in `challenges.ts`, called from the game function, never only from a button). To add a goal: add it to `GoalId` and `GOALS`, and handle it in `goalProgress`. The tuning numbers are the constants at the top of `challenges.ts`.
