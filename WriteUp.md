# Write-up

## 1. What did you build for Part B, and why that?

The app is called Feeding Brennen and its README says it tracks what Brennen spends eating out. The template shipped a `visits` table with an `amountSpent` column, seeded it, wrote a `toVisit()` mapper, and then nothing read any of it. So the app could list restaurants and could not answer its own question.

I built the spending half: log a visit to a restaurant, see what you have spent there, and see what you spent across all restaurants in any date range, with a chart. The visits scaffolding was a hint, and following it meant every piece I added had a real consumer on day one.

## 2. What did you decide, and what did you rule out?

**Visits are nested under a restaurant.** `POST /api/restaurants/:id/visits`. The restaurant comes from the URL and a `restaurantId` in the body is ignored, so a client cannot file a visit under a restaurant it did not name. Delete carries both ids in its `WHERE`, so one restaurant cannot remove another's visit.

**Totals are computed, never stored.** I ruled out a `totalSpent` column on `restaurants`: every visit insert and delete would have to update it, and the day they disagree you cannot tell which is right. `COUNT` and `SUM` over visits on every read costs nothing at this size and cannot drift.

**Totals live on their own endpoint.** My first cut added `visitCount` and `totalSpent` to every restaurant response. The Part A contract shows six keys and says to match them exactly, so I moved the totals to `GET /api/restaurants/total-spending-and-visit-count` and the page fetches both in parallel. Two requests instead of one, in exchange for an untouched contract. The PR history shows the change of mind.

**The server is the only validator.** Neither form has rules of its own. A 400 names the field it is about, and the form places the message under that input. Every error costs one round trip. I took that over a second copy of the rules that drifts.

**Spending is one endpoint, one query.** Every number in the overview (totals, unique restaurants, average, most expensive, most visited, per day, per restaurant) is derived from one list of visits in the handler, so the tiles, the chart, and the breakdown cannot disagree.

**`amountSpent` is required** even though the column is nullable. A visit with no amount is useless to a spending tracker.

**Ruled out:** a chart library (the bar chart is 400 lines of inline SVG and I wanted to own the scaling); a shared form builder for the two modals (two similar files beat an abstraction until a third form appears); a client-side copy of the validation rules; server-side search (the list is already loaded).

**A tradeoff I am not sure about:** the migration cascades a restaurant delete to its visits. I left it, and the trash icon deletes with one click. For a spending tracker the history is the point, and a real product would block the delete or soft-delete. I removed the `window.confirm` because browsers can suppress it; an in-page confirm is the right fix.

## 3. Where did you cut corners?

With another day, in order:

1. **Edit a visit.** Typos in amounts are the most common fix and the only path today is delete and re-log. `PUT /api/restaurants/:id/visits/:visitId` plus a pencil icon that opens the log modal pre-filled.
2. **Three-decimal amounts round silently.** `12.345` is stored as `12.35`. Every other bad input gets a 400; this one should too.
3. **`DELETE /:id/visits/:visitId` never checks the restaurant separately.** `/99999/visits/1` says "Visit not found" while `/abc/visits/1` says "Restaurant not found." Both are 404 and the contract is met, but the messages disagree.
4. **The default date range is computed during server render too.** If the server's timezone crosses a month boundary against the user's, React would warn about mismatched input values. Local dev is unaffected.
5. `GET /api/restaurants/:id` and `PUT` have no UI caller. A detail page with an edit form would use both.

---

## Part A notes

- **A1.** The list query sorted by `createdAt`; the column is `created_at`. Both reads also used `SELECT *`, so `toRestaurant()` saw no `createdAt` key and returned the string `"undefined"` for every date. Every restaurant query now selects columns by name with `created_at AS "createdAt"`, so the mapper never learns the database spelling.
- **A3.** `HttpError` carries its own status and optional field; `handleError()` has one branch. Unknown errors log server-side and return a generic 500. `parseRestaurantId()` rejects anything that is not a positive integer with a 404, including leading zeros and values past the Postgres integer max. That last case was found by a verification sweep: `/api/restaurants/2147483648` passed the digits check and overflowed inside Postgres as a 500.
- Malformed ids and missing records both answer 404, as the contract asks. I would lean 400 for a malformed id in a public API so a client can tell a typo from a deleted record.

## Part B: routes

| Method and path | What it does | Success | Errors |
| --- | --- | --- | --- |
| `GET /api/restaurants/:id/visits` | That restaurant's visits, newest date first | `200` + array | `404` if the restaurant is missing or `:id` is malformed |
| `POST /api/restaurants/:id/visits` | Log a visit | `201` + visit | `404` restaurant missing; `400` on missing or invalid `date` or `amountSpent` |
| `DELETE /api/restaurants/:id/visits/:visitId` | Remove a visit | `204`, no body | `404` if the visit is missing, the restaurant is missing, or the visit belongs to another restaurant |
| `GET /api/restaurants/total-spending-and-visit-count` | Visit count and total spent per restaurant, including those with none | `200` + array | – |
| `GET /api/spending?from=&to=` | Totals, tiles, spend per day, spend per restaurant for an inclusive date window | `200` + summary | `400` with `field` on a missing or malformed date or `from` after `to` |

Every 400 in the app is `{"error": "<message>"}` plus `"field": "<name>"` when the message is about one body field.

**`POST /api/restaurants/:id/visits`**

```jsonc
// request. date is a real calendar day; amountSpent is 0 to 99999999.99; notes optional
{ "date": "2026-09-01", "amountSpent": 25.5, "notes": "Lunch" }

// 201 response
{ "id": 4, "restaurantId": 1, "date": "2026-09-01", "amountSpent": 25.5, "notes": "Lunch", "createdAt": "2026-09-07T22:55:06.763Z" }
```

**`GET /api/restaurants/total-spending-and-visit-count`**

```jsonc
// 200
[ { "restaurantId": 1, "visitCount": 1, "totalSpent": 42.5 }, { "restaurantId": 3, "visitCount": 0, "totalSpent": 0 } ]
```

**`GET /api/spending?from=2026-01-01&to=2026-12-31`**

```jsonc
// 200. An empty window returns zeros, nulls, and empty arrays.
{
  "from": "2026-01-01", "to": "2026-12-31",
  "totalSpent": 162.25, "visitCount": 3, "uniqueRestaurants": 3, "averagePerVisit": 54.08,
  "mostExpensiveVisit": { "restaurantId": 2, "restaurantName": "Sakura House", "date": "2026-02-03", "amountSpent": 88 },
  "mostVisitedRestaurant": { "restaurantId": 2, "restaurantName": "Sakura House", "visitCount": 1 },
  "byDay": [ { "date": "2026-01-12", "visitCount": 1, "totalSpent": 42.5 } ],
  "byRestaurant": [ { "restaurantId": 2, "restaurantName": "Sakura House", "visitCount": 1, "totalSpent": 88 } ]
}
```

**UI.** Each restaurant row shows its total and visit count, a collapsible visit history (loaded on first open), a "Log a visit" modal, and a trash icon per visit. Above the list, a Spending card with From/To pickers, quick ranges, six stat tiles, a bar chart that buckets by day, week, or month and fills empty buckets, and a per-restaurant breakdown. A search box filters restaurants by name. No new dependencies; Inter is loaded through `next/font`.

## Schema changes

None. `001_create_tables.sql` is as the template shipped it.

## How I verified this

There is no test suite, so every endpoint was exercised with `curl` against the running database, three times: after Part A, after the visits API, and a final sweep on `main`. Each run took a `pg_dump` snapshot first and restored it after, so the seed data was never changed by testing. The final sweep ran 101 cases. Every status matched the tables above, every restaurant body had exactly the six contract keys, every 4xx body was `{"error"}` or `{"error","field"}`, no response was a 500, a grep of all 61 error bodies for stack or Postgres text found nothing, and the row counts were unchanged across every batch of 400s.

**Part A**, the contract table including the error cases:

```bash
curl -s -i http://localhost:3000/api/restaurants
curl -s -i http://localhost:3000/api/restaurants/1
curl -s -i http://localhost:3000/api/restaurants/99999
curl -s -i http://localhost:3000/api/restaurants/abc
curl -s -i http://localhost:3000/api/restaurants/-1
curl -s -i http://localhost:3000/api/restaurants/1.5
curl -s -i http://localhost:3000/api/restaurants/0
curl -s -i http://localhost:3000/api/restaurants/01
curl -s -i http://localhost:3000/api/restaurants/2147483648
curl -s -i -X POST http://localhost:3000/api/restaurants -H "Content-Type: application/json" -d '{"name":"Valid Spot","cuisine":"Test","address":"2 Test St","rating":4.5}'
curl -s -i -X POST http://localhost:3000/api/restaurants -H "Content-Type: application/json" -d '{"name":"Bare"}'
curl -s -i -X POST http://localhost:3000/api/restaurants -H "Content-Type: application/json" -d '{"name":"Extra","foo":1}'
curl -s -i -X POST http://localhost:3000/api/restaurants -H "Content-Type: application/json" -d '{"name":"  Padded  ","cuisine":"   "}'
curl -s -i -X POST http://localhost:3000/api/restaurants -H "Content-Type: application/json" -d '{"cuisine":"Test"}'
curl -s -i -X POST http://localhost:3000/api/restaurants -H "Content-Type: application/json" -d '{"name":"   "}'
curl -s -i -X POST http://localhost:3000/api/restaurants -H "Content-Type: application/json" -d '{"name":123}'
curl -s -i -X POST http://localhost:3000/api/restaurants -H "Content-Type: application/json" -d '{"name":"R","rating":6}'
curl -s -i -X POST http://localhost:3000/api/restaurants -H "Content-Type: application/json" -d '{"name":"R","rating":"abc"}'
curl -s -i -X POST http://localhost:3000/api/restaurants -H "Content-Type: application/json" -d '{"name":"R","cuisine":5}'
curl -s -i -X POST http://localhost:3000/api/restaurants -H "Content-Type: application/json" -d 'nope'
curl -s -i -X POST http://localhost:3000/api/restaurants -H "Content-Type: application/json" -d '[]'
curl -s -i -X POST http://localhost:3000/api/restaurants -H "Content-Type: application/json" -d ""
curl -s -i -X PUT http://localhost:3000/api/restaurants/1 -H "Content-Type: application/json" -d '{"name":"Rusty v2","cuisine":"American","address":"12 Main St","rating":4.7}'
curl -s -i -X PUT http://localhost:3000/api/restaurants/1 -H "Content-Type: application/json" -d '{"name":"Only"}'
curl -s -i -X PUT http://localhost:3000/api/restaurants/99999 -H "Content-Type: application/json" -d '{"name":"X"}'
curl -s -i -X PUT http://localhost:3000/api/restaurants/1 -H "Content-Type: application/json" -d '{"name":"R","rating":6}'
curl -s -i -X PUT http://localhost:3000/api/restaurants/abc -H "Content-Type: application/json" -d 'nope'
curl -s -o /dev/null -w "status=%{http_code} size=%{size_download}\n" -X DELETE http://localhost:3000/api/restaurants/5
curl -s -i -X DELETE http://localhost:3000/api/restaurants/5
curl -s -i -X DELETE http://localhost:3000/api/restaurants/abc
```

**Part B**, the happy paths and the failures:

```bash
curl -s -i http://localhost:3000/api/restaurants/1/visits
curl -s -i http://localhost:3000/api/restaurants/3/visits
curl -s -i http://localhost:3000/api/restaurants/99999/visits
curl -s -i http://localhost:3000/api/restaurants/abc/visits
curl -s -i -X POST http://localhost:3000/api/restaurants/1/visits -H "Content-Type: application/json" -d '{"date":"2026-09-01","amountSpent":25.5,"notes":"Lunch"}'
curl -s -i -X POST http://localhost:3000/api/restaurants/1/visits -H "Content-Type: application/json" -d '{"date":"2026-09-02","amountSpent":0}'
curl -s -i -X POST http://localhost:3000/api/restaurants/1/visits -H "Content-Type: application/json" -d '{"date":"2024-02-29","amountSpent":5}'
curl -s -i -X POST http://localhost:3000/api/restaurants/1/visits -H "Content-Type: application/json" -d '{"date":"2026-09-07","amountSpent":5,"restaurantId":2,"id":999}'
curl -s -i -X POST http://localhost:3000/api/restaurants/1/visits -H "Content-Type: application/json" -d '{"date":"2026-09-01"}'
curl -s -i -X POST http://localhost:3000/api/restaurants/1/visits -H "Content-Type: application/json" -d '{"date":"2026-09-01","amountSpent":-1}'
curl -s -i -X POST http://localhost:3000/api/restaurants/1/visits -H "Content-Type: application/json" -d '{"date":"2026-09-01","amountSpent":"25"}'
curl -s -i -X POST http://localhost:3000/api/restaurants/1/visits -H "Content-Type: application/json" -d '{"date":"2026-09-01","amountSpent":100000000}'
curl -s -i -X POST http://localhost:3000/api/restaurants/1/visits -H "Content-Type: application/json" -d '{"date":"2026-02-30","amountSpent":5}'
curl -s -i -X POST http://localhost:3000/api/restaurants/1/visits -H "Content-Type: application/json" -d '{"date":"2023-02-29","amountSpent":5}'
curl -s -i -X POST http://localhost:3000/api/restaurants/1/visits -H "Content-Type: application/json" -d '{"date":"09/01/2026","amountSpent":5}'
curl -s -i -X POST http://localhost:3000/api/restaurants/1/visits -H "Content-Type: application/json" -d '{"date":"2026-09-01T00:00:00Z","amountSpent":5}'
curl -s -i -X POST http://localhost:3000/api/restaurants/1/visits -H "Content-Type: application/json" -d '{"date":"2026-09-01","amountSpent":5,"notes":7}'
curl -s -i -X POST http://localhost:3000/api/restaurants/99999/visits -H "Content-Type: application/json" -d '{"date":"2026-09-01","amountSpent":25.5}'
curl -s -o /dev/null -w "status=%{http_code} size=%{size_download}\n" -X DELETE http://localhost:3000/api/restaurants/1/visits/4
curl -s -i -X DELETE http://localhost:3000/api/restaurants/1/visits/4
curl -s -i -X DELETE http://localhost:3000/api/restaurants/2/visits/1
curl -s -i -X DELETE http://localhost:3000/api/restaurants/abc/visits/1
curl -s -i http://localhost:3000/api/restaurants/total-spending-and-visit-count
curl -s -i "http://localhost:3000/api/spending?from=2026-01-01&to=2026-12-31"
curl -s -i "http://localhost:3000/api/spending?from=2026-01-12&to=2026-01-12"
curl -s -i "http://localhost:3000/api/spending?from=2026-06-01&to=2026-06-30"
curl -s -i "http://localhost:3000/api/spending?to=2026-12-31"
curl -s -i "http://localhost:3000/api/spending?from=2026-02-30&to=2026-12-31"
curl -s -i "http://localhost:3000/api/spending?from=2026-05-01&to=2026-04-01"
curl -s -o /dev/null -w "status=%{http_code}\n" -X DELETE http://localhost:3000/api/restaurants/4
curl -s -i http://localhost:3000/api/restaurants/4/visits
```

The last two confirm the cascade: deleting restaurant 4 removes its visit and the visits route answers 404 afterwards. Snapshot and restore:

```bash
docker compose exec -T db pg_dump -U postgres feeding_brennen > before.sql
docker compose exec -T db psql -U postgres -d feeding_brennen -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
docker compose exec -T db psql -U postgres -d feeding_brennen < before.sql
```

In the browser: add a restaurant with a blank name and see the message under Name; rating 6 under Rating; expand a row, log a visit, watch the row total and the Spending card update; delete the visit, watch both revert; type a date range backwards and see the controls hold still while the numbers dim.

## Known issues / what I'd do next

- Items 1 through 5 under "Where did you cut corners."
- `averagePerVisit` is rounded to cents, so it does not multiply back to `totalSpent` exactly.
- Unrouted methods (`PATCH /api/restaurants/1`) return Next's default 405 with an empty body rather than `{"error"}`.
- Digit-only names and cuisines are accepted. I tried a "must contain a letter" rule and reverted it as a rule nobody needed; a cuisine dropdown would be the better fix.
- Next: a monthly budget with a pace bar (needs a `budgets` table and a migration), a restaurant detail page, and "last visited" on each card.
