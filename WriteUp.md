# Write-up

> This is the skeleton - replace everything in blockquotes with your own words
> and delete the prompts as you go. Aim for **~300 words** across the four
> questions; the route reference below can be as long as it needs to be.
>
> Write it like you're handing the work to a teammate. We'd rather read an
> honest "I ran out of time on X and here's what I'd do" than a polished list of
> accomplishments. **Submit this even if you didn't finish** - see CHALLENGE.md.

## 1. What did you build for Part B, and why that?

I implemented visit tracking. For each restaurant you can log a visit with the date, amount spent, and notes, and see the list under that restaurant. On top of that I also implemented a spending endpoint and a frontend chart that show visits and spend over a date range.

I picked these features to implement because when I look back at restaurants, one of the things I want to know is how much I spent eating out. Price also plays a really big role in how I judge a restaurant. If the food was worth the money (high taste/cost ratio), I think more of the place and I am more likely to recommend it. The visits table was already in the schema with nothing reading it, so this felt like the feature the app was missing.

## 2. What did you decide, and what did you rule out?

Visits live under a restaurant. Logging one is a POST to the visits route under that restaurant, with a button and form on each restaurant row. The spending endpoint takes a date range and returns high level stats plus a per day and per restaurant breakdown. Totals per restaurant are computed from visits on every read, not stored, so they cannot drift (reduces complexity).

The tradeoff I am not sure I got right is that all the spending calculations happen inside the endpoint. I went back and forth on returning more raw data and doing the calculations higher up, either in the client wrapper functions or in helpers inside the component. I kept it in the endpoint because the page only needs a small set of stats right now, and one response covers all of them. The problem comes if the app grows. If different sections need different parts of the data, every one of them would call the whole endpoint and throw most of the response away. At that point it would make more sense to return the raw visits and let each section compute what it needs.

## 3. Where did you cut corners?

The UI is functional but boring. I would spend more time making it intuitive and interesting.

The first thing I would fix with another day is client side checking. Right now you have to press submit and wait for the request to come back before you know which field is wrong. I would add checks in the browser so the form will not submit unless the fields are in the right format, while keeping the server as the real authority.

You cannot edit a visit. Typos in amounts are the most common thing to fix, and the only path right now is delete and log it again. It would be a PUT on the visit and the same form opened with the values filled in.

The totals endpoint returns every restaurant on every page load. That is fine at twelve restaurants. At a thousand the page would fetch a thousand totals to draw the first screen. The fix is paging the list and asking for totals only for the rows on screen, which means the totals endpoint takes a list of ids.

## 4. What should we look at first?

lib/validation.ts and lib/errors.ts, since the input rules and error handling for every endpoint go through them. Then app/api/spending/route.ts for the one query design. The verification section below has the curl commands.

---

## Part B: routes

| Method and path | What it does | Success | Errors |
| --- | --- | --- | --- |
| `GET /api/restaurants/:id/visits` | That restaurant's visits, newest date first | `200` + array | `404` if the restaurant is missing or `:id` is malformed |
| `POST /api/restaurants/:id/visits` | Log a visit | `201` + visit | `404` restaurant missing; `400` on missing or invalid `date` or `amountSpent` |
| `DELETE /api/restaurants/:id/visits/:visitId` | Remove a visit | `204`, no body | `404` if the visit is missing, the restaurant is missing, or the visit belongs to another restaurant |
| `GET /api/restaurants/total-spending-and-visit-count` | Visit count and total spent per restaurant, including those with none | `200` + array | – |
| `GET /api/spending?from=&to=` | Totals, tiles, spend per day, spend per restaurant for an inclusive date window | `200` + summary | `400` with `field` on a missing or malformed date or `from` after `to` |

Every 400 in the app is `{"error": "<message>"}` plus `"field": "<name>"` when the message is about one body field.

The example bodies below were captured against the template's original seed (5 restaurants, 3 visits). The shipped seed is larger, so the shapes are identical and the numbers differ.

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

## Schema changes

None. `001_create_tables.sql` is as the template shipped it.

The seed changed, though: `db/seed.ts` now loads 12 restaurants and about six months of visits, generated deterministically and dated relative to today, so the spending overview has something to show on first open. `./setup.sh` picks it up; nothing extra to run.

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

- Deleting a restaurant deletes its visits with one click, because the migration cascades and I removed the browser confirm popup, which browsers can suppress. For a spending tracker the history is the point. A real version would block the delete while visits exist, or hide the restaurant instead of removing it. The DELETE stub asked for an opinion on the cascade, and this is mine.
- Duplicate restaurant names are accepted on purpose, since a chain can have two branches, so there is no 409 path and no unique index.
- Amounts with more than two decimals are rounded to cents by Postgres with no warning. Every other bad input gets a 400, and this one should too.
- Deleting a visit through a restaurant that does not exist says "Visit not found" while a malformed restaurant id says "Restaurant not found." Both are 404 and the contract is met, but the messages disagree.
- The spending card's default dates are computed during server render as well as in the browser. If the server's timezone crosses a month boundary against the user's, React would warn about mismatched input values. Local dev is unaffected.
- `averagePerVisit` is rounded to cents, so it does not multiply back to `totalSpent` exactly.
- Unrouted methods (`PATCH /api/restaurants/1`) return Next's default 405 with an empty body rather than `{"error"}`.
- Digit-only names and cuisines are accepted. I tried a "must contain a letter" rule and reverted it as a rule nobody needed; a cuisine dropdown would be the better fix.
- `GET /api/restaurants/:id` and `PUT` have no UI caller. A restaurant detail page with an edit form would use both.
- Next: editing a visit, paging the list and totals (see question 3), a monthly budget with a pace bar (needs a `budgets` table and a migration), and "last visited" on each card.
