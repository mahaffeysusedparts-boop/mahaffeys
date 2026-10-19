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

No second freely reusable general-parts fitment dataset was verified. This is **not** a completed multi-provider general-parts database: engine, transmission and body-part interchange remain unpopulated. Mirrors of ANKUSI are not independent sources. New sources require real provenance, reuse rights, direct application/interchange evidence, and preserved restrictions; do not infer equivalents from shared models, shared engines, or transitive part-number chains.
