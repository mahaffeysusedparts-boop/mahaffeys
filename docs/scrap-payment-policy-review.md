# Scrap purchase payment policy — rollout review

## Sources and implemented rule baseline

Start with the official [South Carolina Code §16-17-680](https://www.scstatehouse.gov/code/t16c017.php). The full section was cross-checked against the [2025 section text](https://law.justia.com/codes/south-carolina/title-16/chapter-17/section-16-17-680/). The official chapter fetch was truncated before this section; therefore this implementation review is **not a certification that later amendments are absent**. Before rollout, the named yard reviewer must confirm the current official text, recycler permit, grade classifications, seller documentation and effective dates. Do not deploy a fabricated reviewer approval or automatically create an active policy.

- **(D)(4):** Copper, catalytic converters and beer kegs at **$25 or more** require a check alone, payable to the seller. No more than one cash transaction per seller/day for these materials. No check cashing/ATM substitute.
- **(A)(3), (C), (D)(1):** Statutory nonferrous classifications extend beyond a grade's iron-content category. Valid seller/recycler permits are required unless a verified statutory exception applies.
- **(D)(2), (D)(3), (H):** Seller identity, address, ID copy, applicable permit copy, seller photograph/video, material description/weights, payout and signed ownership statement must be retained; identification types and retention periods are prescribed.
- **(I), (J):** Catalytic converters, coils, prohibited covers/grates and exempt entities have additional conditions. This routine payment model does not implement specialized acquisition documentation or legal exemptions. Keep those grades unapproved / `REQUIRES_SPECIAL_DOCUMENTATION`; do not classify them as ordinary ferrous/nonferrous to bypass their requirements.

## Source-backed conservative configuration

Administrator policy setup remains separate from routine operator payments. Every grade needs an explicit, reviewed `paymentClass` in the versioned policy. Earlier policy versions without that field fail closed for new payments; existing payments/receipts are not migrated or reissued.

| Reviewed material | `paymentClass` | Minimum permit/documentation behavior | Cash behavior |
|---|---|---|---|
| Ordinary permitted ferrous scrap, not prohibited covers/grates | `FERROUS` | Existing intake requirements | Yard cap: **over $100** requires Check |
| Ordinary statutory nonferrous metal | `NONFERROUS` | Valid permit reference and retained seller-documentation reference | Yard cap: **over $25** requires Check |
| Aluminum cans only | `ALUMINUM_CANS` | Existing intake requirements; no automatic permit requirement | Yard nonferrous cap remains **over $25** |
| Copper, including applicable copper-containing grades | `COPPER` | Valid permit and retained seller documentation | Check at **$25 or more**, one cash transaction/day |
| Beer kegs (even if categorized as ferrous in the grade list) | `BEER_KEG` | Valid permit and retained seller documentation | Check at **$25 or more**, one cash transaction/day |
| Catalytic converters, coils, prohibited/unknown material | `REQUIRES_SPECIAL_DOCUMENTATION` | Specialized acquisition conditions not supported in routine intake | Routine purchase blocked, regardless of method |

The broad $25/$100 limits are **yard preferences**, not universal legal mandates. The legal restricted-material threshold is exclusive for cash: $24.99 can be eligible; $25.00 cannot. Other yard boundaries remain inclusive: ordinary nonferrous $25.00 / ferrous $100.00 can be eligible unless stricter reviewed limits apply.

For restricted-material cash eligibility, the implementation conservatively counts **all earlier seller cash purchases** that Eastern-calendar day, including reconciled historical evidence. This may be stricter than counting only restricted-material purchases; it prevents splitting or incomplete classification history from opening another cash purchase. Mixed loads apply restrictions to the whole payout and use the tightest applicable rule. The reviewer may configure stricter integer-cent thresholds/day limits; null does not override the hard legal baseline or yard preferences.

## Rollout checklist (deployment/setup, not per-ticket approval)

- Confirm current official effective law and any applicable amendments with the named yard reviewer/local authority or counsel.
- Verify each live grade identity (name/code/category) and statutory classification. Unknown/special/prohibited grades stay unapproved.
- Record reviewer, review reference, official HTTPS source, effective start and expiration in administrator policy setup. No new payment is permitted with missing/expired/unclassified policy.
- Verify valid recycler permit and seller permit/document retention procedures. Nonferrous payment records retain the operator-entered external documentation reference; the software does not itself authenticate those documents.
- Verify approved scale-operator accounts; general employees and pending accounts cannot pay. Policy editing, requirement settings, legacy reconciliation and reversals retain their separate guards.
- Run isolated PostgreSQL integration tests with the project's safe `TEST_DATABASE_URL` setup. Never point them at live yard data.
- Confirm uncertain-response recovery and two-workstation behavior on staging. Refresh/reprint is not permission to hand over funds a second time.

No migration changes historical check numbers, marks unpaid purchases paid, reconciles old evidence or creates drawer entries.
