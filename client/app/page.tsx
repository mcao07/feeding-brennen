import { getRestaurants, getSpendByRestaurant } from '@/lib/apiClient';
import { formatUsd } from '@/lib/format';
import AddRestaurantModal from './components/AddRestaurantModal';
import DeleteRestaurantButton from './components/DeleteRestaurantButton';
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

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-medium">Restaurants</h2>
        <AddRestaurantModal />
      </div>
      <ul className="space-y-3">
        {restaurants.map((restaurant) => (
          <li
            key={restaurant.id}
            className="rounded-lg border border-gray-200 bg-white p-4"
          >
            <div className="flex items-baseline justify-between">
              <span className="font-medium">{restaurant.name}</span>
              <div className="flex items-baseline gap-3">
                <span className="text-sm text-gray-500">
                  {restaurant.rating}★
                </span>
                <span className="text-sm text-gray-500">
                  {describeSpend(spendByRestaurantId.get(restaurant.id))}
                </span>
                <DeleteRestaurantButton id={restaurant.id} name={restaurant.name} />
              </div>
            </div>
            <div className="mt-1 text-sm text-gray-600">
              {restaurant.cuisine} · {restaurant.address}
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
