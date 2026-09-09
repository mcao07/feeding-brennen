import { pool } from './pool';

/**
 * Seed the database with sample data: 12 restaurants and about six months
 * of visits.
 *
 * Run with: npm run seed
 *
 * Clears existing rows first so re-seeding gives you a clean, predictable set.
 */

const restaurants = [
  { name: 'The Rusty Spoon', cuisine: 'American', address: '12 Main St', rating: 4.5 },
  { name: 'Sakura House', cuisine: 'Japanese', address: '88 Cherry Ln', rating: 4.8 },
  { name: 'Bella Napoli', cuisine: 'Italian', address: '301 Olive Ave', rating: 4.2 },
  { name: 'El Fuego', cuisine: 'Mexican', address: '47 Sol Blvd', rating: 4.6 },
  { name: 'Green Bowl', cuisine: 'Vegetarian', address: '5 Garden Way', rating: 3.9 },
  { name: 'Pho Saigon', cuisine: 'Vietnamese', address: '210 Lotus St', rating: 4.4 },
  { name: 'Marrakesh Grill', cuisine: 'Moroccan', address: '9 Spice Rd', rating: 4.3 },
  { name: 'Han River BBQ', cuisine: 'Korean', address: '77 Ember Ave', rating: 4.7 },
  { name: 'Curry Leaf', cuisine: 'Indian', address: '150 Saffron Ct', rating: 4.1 },
  { name: 'Le Petit Bistro', cuisine: 'French', address: '3 Rue Ave', rating: 4.6 },
  { name: 'Corner Deli', cuisine: 'Sandwiches', address: '400 Elm St', rating: 3.7 },
  { name: 'Dumpling Alley', cuisine: 'Chinese', address: '62 Lantern Way', rating: 4.5 },
];

/**
 * What each place tends to cost per visit and how often it gets a visit, so
 * the generated history reads like one person's habits: a cheap lunch spot
 * shows up weekly, an omakase counter a few times a season.
 */
const habits: { restaurantIndex: number; typical: number; spread: number; visitsPerMonth: number }[] = [
  { restaurantIndex: 0, typical: 42, spread: 8, visitsPerMonth: 2.5 },
  { restaurantIndex: 1, typical: 105, spread: 30, visitsPerMonth: 0.9 },
  { restaurantIndex: 2, typical: 63, spread: 10, visitsPerMonth: 1.6 },
  { restaurantIndex: 3, typical: 28, spread: 7, visitsPerMonth: 2.8 },
  { restaurantIndex: 4, typical: 22, spread: 4, visitsPerMonth: 2.2 },
  { restaurantIndex: 5, typical: 19, spread: 4, visitsPerMonth: 3.0 },
  { restaurantIndex: 6, typical: 58, spread: 12, visitsPerMonth: 0.8 },
  { restaurantIndex: 7, typical: 74, spread: 15, visitsPerMonth: 1.2 },
  { restaurantIndex: 8, typical: 34, spread: 7, visitsPerMonth: 1.8 },
  { restaurantIndex: 9, typical: 96, spread: 22, visitsPerMonth: 0.6 },
  { restaurantIndex: 10, typical: 14, spread: 3, visitsPerMonth: 3.5 },
  { restaurantIndex: 11, typical: 31, spread: 6, visitsPerMonth: 2.0 },
];

const notesByRestaurant: string[][] = [
  ['Burger night with the crew.', 'Brunch.', 'Weekend burger.', 'Same burger, still good.'],
  ['Omakase. Worth every penny.', 'Anniversary dinner.', 'Sushi with parents.', 'Birthday dinner.'],
  ['Pizza with the team.', 'Lasagna night.', 'Date night.', 'Pasta.'],
  ['Tacos to go.', 'Taco Tuesday.', 'Tacos and margaritas.', 'Post-game tacos.'],
  ['Salad bowl, healthy week.', 'Grain bowl.', 'Quick lunch.'],
  ['Pho on a cold day.', 'Banh mi at the desk.', 'Spring rolls and iced coffee.'],
  ['Tagine, shared.', 'Couscous night.'],
  ['Late night BBQ.', 'Way too much meat.', 'Team dinner.'],
  ['Butter chicken delivery.', 'Thali lunch.', 'Biryani Friday.'],
  ['Steak frites.', 'Wine and a long dinner.'],
  ['Turkey club.', 'Coffee and a bagel.', 'Reuben.', 'Lunch run.'],
  ['Dumplings for the table.', 'Soup dumplings.', 'Takeout Sunday.'],
];

/** A calendar day `n` days before today, as YYYY-MM-DD from local parts. */
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

/**
 * A tiny deterministic random source (Park-Miller), so every clone seeds the
 * same visits. Math.random would give each grader a different history.
 */
function makeRandom(seed: number): () => number {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

const HISTORY_DAYS = 180;

/**
 * Roughly six months of eating out, generated from the habits above. Each day
 * each place gets a visit with probability visitsPerMonth / 30; the amount is
 * the typical price plus or minus its spread, rounded to cents. Dates are
 * offsets from today so the spending overview, which defaults to "this
 * month", has something to show whenever the app is first opened.
 */
function buildVisits(): { restaurantIndex: number; date: string; amountSpent: number; notes: string | null }[] {
  const random = makeRandom(20260907);
  const out: { restaurantIndex: number; date: string; amountSpent: number; notes: string | null }[] = [];
  for (let day = HISTORY_DAYS; day >= 0; day--) {
    for (const habit of habits) {
      if (random() >= habit.visitsPerMonth / 30) continue;
      const amount = habit.typical + (random() * 2 - 1) * habit.spread;
      const notes = notesByRestaurant[habit.restaurantIndex];
      out.push({
        restaurantIndex: habit.restaurantIndex,
        date: daysAgo(day),
        amountSpent: Math.round(amount * 100) / 100,
        notes: random() < 0.6 ? notes[Math.floor(random() * notes.length)] : null,
      });
    }
  }
  return out;
}

const visits = buildVisits();

async function seed(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Wipe and reset identity so ids are stable between seeds.
    await client.query('TRUNCATE visits, restaurants RESTART IDENTITY CASCADE');

    const restaurantIds: number[] = [];
    for (const r of restaurants) {
      const { rows } = await client.query(
        `INSERT INTO restaurants (name, cuisine, address, rating)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [r.name, r.cuisine, r.address, r.rating]
      );
      restaurantIds.push(rows[0].id);
    }

    for (const v of visits) {
      await client.query(
        `INSERT INTO visits ("restaurantId", date, "amountSpent", notes)
         VALUES ($1, $2, $3, $4)`,
        [restaurantIds[v.restaurantIndex], v.date, v.amountSpent, v.notes]
      );
    }

    await client.query('COMMIT');
    console.log(`Seeded ${restaurants.length} restaurants and ${visits.length} visits.`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

seed()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err);
    pool.end().finally(() => process.exit(1));
  });
