import { getRestaurants, getSpendByRestaurant } from '@/lib/apiClient';
import AddRestaurantModal from './components/AddRestaurantModal';
import RestaurantList from './components/RestaurantList';
import SpendingOverview from './components/SpendingOverview';

// Server component. Fetches on each request and hands the data to client
// components that hold the interactive state. If the API is down or returns
// something unexpected, the helpers throw and this page errors out loudly.
export default async function HomePage() {
  // Two requests, in parallel: the restaurant shape is fixed by the Part A
  // contract, so the totals come from their own endpoint and are matched
  // to rows by id in the list.
  const [restaurants, spend] = await Promise.all([getRestaurants(), getSpendByRestaurant()]);

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

      <RestaurantList restaurants={restaurants} spend={spend} />
    </div>
  );
}
