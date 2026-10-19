# Free fitment source coverage

## Connected sources

- **NHTSA vPIC**: existing make/model and VIN identification APIs. Vehicle taxonomy only; never parts-interchange evidence.
- **ANKUSI Wheel Fitment Dataset**: https://ankusiwheels.com/wheel-fitment-dataset/ ; full JSON endpoint https://ankusiwheels.com/wp-json/ankusi/v1/dataset/json . Public live format and license checked during implementation. Published release 2026.10.16.4 reports 10,081 records; runtime counts reflect validated imported records, not a hard-coded claim.

ANKUSI explicitly releases its dataset under CC BY 4.0, including commercial reuse with visible linked attribution. The app credits the dataset and license and identifies its normalization and hub comparison as adaptations. Source-published specifications are not independently certified by this app.

The first wheel lookup imports the full dataset into PostgreSQL `interchange_source_snapshots` under `ankusi-wheels`. Daily refresh is demand-driven; there is no background scheduled job. Concurrent loads in one server process share a request. A failed refresh preserves the dated previous snapshot and marks it stale; retries after a stale fallback are spaced five minutes apart. No user-supplied URL is fetched.

Normalization preserves exact trim/market, chassis, explicit source year ranges, factory wheel text and source URL. Exact duplicate records are removed. Unsupported/invalid records are excluded and counted. Missing front bore stays unknown; the source documents blank rear bore as equal to front. Candidate comparisons require matching lug count, bolt pattern and both known hub bores. Distinct year rows are not expanded into inferred continuous ranges. A user must select the exact source variant before any comparison.

**These are shared-hub candidates, not confirmed interchangeable wheels.** Diameter, width, offset, brake clearance, load rating, thread/seat, tires and modifications still need checking. No adapter, machining or broader component fitment is inferred. Candidate lists are independent of inventory, and yard badges require exact model/variant records. Full candidate lists are available through incremental display rather than truncation.

## Investigated but not imported

- Hollander: proprietary interchange catalog; no public self-service lookup API or open dataset verified.
- Dorman public catalog/product feed: public application browsing exists, but unrestricted bulk reuse rights were not verified. Not scraped into this database.
- `3r1nC/automotive-part-interchange-database` on GitHub: prototype/sample data, not production compatibility evidence. MIT code does not establish accuracy of sample fitment.
- `carbonautorepair/partadex` on GitHub: source register explicitly says third-party catalog rights are not cleared and some extracted records are quarantined. Not imported as verified open data.

No second open-licensed general-parts fitment dataset was verified. This is **not** a completed all-parts database: selected engine, transmission and electrical applications are connected as unverified public-page evidence; body, lighting, brakes, cooling and interior remain research-only. Mirrors of ANKUSI are not independent sources. New sources require real provenance, review of reuse restrictions, direct application/interchange evidence, and preserved qualifications; do not infer equivalents from shared models, shared engines, or transitive part-number chains.

## Public alternator listings (unverified)

The app reads factual application tables from 17 selected DB Electrical truck-alternator product pages registered in `server/utils/alternatorSources.ts`. These are public web listings, NOT an open-licensed bulk feed or comprehensive interchange database. Every listing is marked unverified with its source URL, retrieval date, specifications and listed replacement references. AS-PL is an additional external research source, not imported. No paywall or login is bypassed; product images and full marketing descriptions are not republished.

Only readable application table rows are imported. Individual years are retained, duplicates removed, missing engines remain unknown, and no title-based coverage, model-family aliases, transitive reference matches or continuous-year ranges are invented. The public HTML may omit additional interactive/paginated applications. The source may contradict its own specifications; both are shown. A common aftermarket replacement establishes donor candidates only, not guaranteed OE-to-OE interchange.

Each page is cached in PostgreSQL under `alternator-<part number>` in `interchange_source_snapshots`. Refresh is daily and on demand, with four concurrent requests, ten-second fetch limits, shared in-flight loading, stale fallback per page and a five-minute retry interval for partial failures. Unsupported formats and unavailable pages are listed explicitly. The first load can take up to a minute. There is no scheduled background crawl.

The customer can filter by source-listed engine displacement; known different donor displacement, cylinder count or explicit fuel type is excluded. Unrecorded engine/part presence/condition is never interpreted as confirmation. All vehicle applications stay visible without yard stock, with incremental display.

## Broader component lookup (unverified)

`server/utils/componentSources.ts` registers 28 selected Powertrain Products engine pages, four transmission pages and six DB Electrical starter pages. `/api/public/component-catalog` loads them independently of the alternator endpoint, retaining successful older-component records when a different catalog is unavailable. Coverage includes selected GM (including Buick/Pontiac applications when explicitly listed), Ford/Lincoln, Chrysler/Dodge/Jeep/Ram, Toyota, Honda/Acura, Subaru and Nissan applications. This is selected factual evidence from public product pages, not an open-licensed bulk feed. Reuse permission for a comprehensive commercial catalog has not been verified; do not expand it into unrestricted bulk scraping without reviewing provider terms/permission. No login, paywall, anti-bot protection or access restriction is bypassed. Full marketing descriptions, product pricing and images are not imported.

The parser requires explicit Year/Make/Model/Engine/Note table columns. It preserves source year ranges, application notes/position, casting numbers, VIN qualifications, included-component specifications, source heading, URL and retrieval time. Headings can identify the part or engine code but NEVER supply missing application rows. Changed/unsupported tables are unavailable, not silently converted into guesses. Individual DB Electrical years stay individual, including starter teeth/type and manual-trans qualifications in source headings. Provider specifications can contradict headings; both are shown without auto-resolving contradictions.

Per-source PostgreSQL snapshots share the existing snapshot table; demand-driven daily refresh, four concurrent requests, ten-second limits and five-minute retry spacing apply. The first broader-catalog lookup may take up to two minutes. There is no scheduled crawl. Supported selection years now start at 1950, and every current yard vehicle can be selected, but this does not imply fitment coverage for all those years, makes or parts.

Engine records are labeled **replacement long-block candidates, not complete plug-and-play engine interchange**. The source may offer several levels of included external parts; verify which assembly and build are being compared. Recognized engine codes read from the source heading/type are compared with recognized yard engine-model codes: known conflicting codes are excluded, unknown or unrecognized codes remain candidates requiring inspection. Code recognition is intentionally limited and establishes no engine-family interchange. Engine/VIN codes, casting, generation, reluctor, VVT/AFM/MDS, electronics, drivetrain and emissions are never auto-certified. Customer code/casting/OE text filters search retained evidence only; they are not VIN decoding or confirmation.

The engine panel separately shows two manually reviewed, modification-dependent references: Holley's 1955–1957 Bel Air LS swap system and ATK's Buick 1977–1987 5.0L/305 application-to-5.7L performance-build listing (Buick page 7). The ATK VIN qualifications, unverified-application warning and prohibition for pollution-controlled vehicles remain visible. Its “Drop-In” marketing name is not treated as direct-fit confirmation. Guide links/checklists do not establish a particular yard donor or a complete installation bill of materials. Other chassis show an explicit guide coverage gap and external research links.

The broader ATK 2016 engine PDF is linked, not fully imported: https://atkvege.com/wp-content/uploads/sites/5/2018/12/engine2016.pdf . Its index includes domestic and Asian manufacturers, but a 2016 reference is not current 1950–present coverage. Doors/body, lighting, axles, brakes, cooling and interior can be searched through part-specific research links; their interchange is not populated yet. A comprehensive free all-parts replacement-and-swap dataset has not been verified.
