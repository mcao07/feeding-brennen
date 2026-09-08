import { getRestaurants, getSpendByRestaurant } from '@/lib/apiClient';
import { formatUsd } from '@/lib/format';
import AddRestaurantModal from './components/AddRestaurantModal';
import DeleteRestaurantButton from './components/DeleteRestaurantButton';
import SpendingOverview from './components/SpendingOverview';
import VisitsPanel from './components/VisitsPanel';
import type { RestaurantSpend } from '@/lib/types';

// Server component. Fetches restaurants on each request and renders a plain
// list. There is no loading state, no empty state, and no error handling: if
// the API is down or returns something unexpected, this throws.
export default async function HomePage() {
  // Two requests, in parallel: the restaurant shape is fixed by the Part A
  // contract, so the totals come from their own endpoint and are matched
  // to rows by id here.
  const [restaurants, spend] = await Promise.all([getRestaurants(), getSpendByRestaurant()]);
  const spendByRestaurantId = new Map(spend.map((s) => [s.restaurantId, s]));

  // This string changes whenever a visit is logged or deleted, which is exactly
  // when the overview must refetch. Deriving it from totals the page already
  // loads costs nothing and needs no second mechanism to notify a client
  // component that `router.refresh()` alone would leave holding stale numbers.
  const refreshKey = spend.map((s) => `${s.restaurantId}:${s.visitCount}:${s.totalSpent}`).join('|');

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-semibold tracking-tight">Restaurants</h2>
        <AddRestaurantModal />
      </div>

      <SpendingOverview refreshKey={refreshKey} />

      <ul className="space-y-4">
        {restaurants.map((restaurant) => (
          <li
            key={restaurant.id}
            className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm shadow-stone-900/[0.03]"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="truncate text-lg font-semibold tracking-tight text-stone-900">
                  {restaurant.name}
                </h3>
                <div className="mt-0.5 truncate text-sm text-stone-500">
                  {restaurant.cuisine} · {restaurant.address}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-xs font-medium tabular-nums text-stone-700">
                  {restaurant.rating} ★
                </span>
                <DeleteRestaurantButton id={restaurant.id} name={restaurant.name} />
              </div>
            </div>
            <div className="mt-3 text-sm tabular-nums text-stone-500">
              {describeSpend(spendByRestaurantId.get(restaurant.id))}
            </div>
            <VisitsPanel restaurantId={restaurant.id} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The row's spend summary. A restaurant with no visits says so rather than
 * showing $0.00, which would read as a visit that cost nothing. The totals
 * endpoint returns every restaurant, so `undefined` only happens if a row was
 * added between the two fetches; it reads as no visits rather than crashing.
 */
function describeSpend(spend: RestaurantSpend | undefined) {
  if (!spend || spend.visitCount === 0) return 'No visits yet';
  const noun = spend.visitCount === 1 ? 'visit' : 'visits';
  return `${formatUsd(spend.totalSpent)} across ${spend.visitCount} ${noun}`;
}
