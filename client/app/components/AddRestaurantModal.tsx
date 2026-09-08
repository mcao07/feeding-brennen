'use client';

import { useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError, createRestaurant } from '@/lib/apiClient';

/** What the inputs hold. Everything is a string until submit reshapes it. */
const EMPTY_FORM = { name: '', cuisine: '', address: '', rating: '' };
type FormValues = typeof EMPTY_FORM;
type FieldName = keyof FormValues;

const FIELDS: {
  name: FieldName;
  label: string;
  hint: string;
  /** Only to pick the on-screen keyboard. Every input is a text input, so the
   *  server stays the one authority on what a value may be. */
  inputMode?: 'decimal';
}[] = [
  { name: 'name', label: 'Name', hint: 'Required.' },
  { name: 'cuisine', label: 'Cuisine', hint: 'Optional, for example Japanese.' },
  { name: 'address', label: 'Address', hint: 'Optional.' },
  { name: 'rating', label: 'Rating', hint: 'Optional, 0 to 5.', inputMode: 'decimal' },
];

/**
 * "Add restaurant" button and the modal it opens.
 *
 * The form has no validation rules of its own: the API is the one authority,
 * and each 400 names the field it is about, so this component only reshapes
 * the inputs and positions whatever message comes back.
 */
export default function AddRestaurantModal() {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Reset on the way in, not on the way out: the dialog also closes on Escape
  // and on a backdrop click, so clearing here is the one path every open takes
  // and a message from the last attempt cannot survive into the next one.
  function open() {
    setValues(EMPTY_FORM);
    setFieldErrors({});
    setFormError(null);
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
  }

  // The backdrop is part of the <dialog> element itself, so a click whose
  // target is the dialog rather than the form is a click outside the form.
  function closeOnBackdrop(event: React.MouseEvent<HTMLDialogElement>) {
    if (event.target === dialogRef.current) close();
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setFieldErrors({});
    setFormError(null);
    try {
      await createRestaurant(toRequestBody(values));
      close();
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.field) {
        setFieldErrors({ [err.field]: err.message });
      } else {
        setFormError(err instanceof Error ? err.message : 'Something went wrong');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="inline-flex items-center rounded-lg bg-emerald-700 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 disabled:opacity-50"
      >
        Add restaurant
      </button>

      <dialog
        ref={dialogRef}
        onClick={closeOnBackdrop}
        className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-0 shadow-2xl shadow-stone-900/10 backdrop:bg-stone-900/30 backdrop:backdrop-blur-sm"
      >
        <form onSubmit={submit} noValidate className="space-y-5 p-6">
          <h3 className="border-b border-stone-200 pb-4 text-lg font-semibold tracking-tight text-stone-900">Add a restaurant</h3>

          {FIELDS.map((field) => {
            const error = fieldErrors[field.name];
            return (
              <div key={field.name}>
                <label htmlFor={field.name} className="block text-sm font-medium text-stone-800">
                  {field.label}
                </label>
                <p className="text-xs text-stone-500">{field.hint}</p>
                <input
                  id={field.name}
                  name={field.name}
                  type="text"
                  inputMode={field.inputMode}
                  value={values[field.name]}
                  onChange={(e) => setValues({ ...values, [field.name]: e.target.value })}
                  aria-invalid={error ? true : undefined}
                  className={`mt-1.5 w-full rounded-lg border bg-white px-3 py-2 text-sm text-stone-900 transition focus:outline-none focus:ring-2 ${
                    error
                      ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                      : 'border-stone-300 focus:border-emerald-700 focus:ring-emerald-700/20'
                  }`}
                />
                {error && <p className="mt-1.5 text-sm text-red-600">{error}</p>}
              </div>
            );
          })}

          {formError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {formError}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={close}
              className="inline-flex items-center rounded-lg border border-stone-300 bg-white px-3.5 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center rounded-lg bg-emerald-700 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 disabled:opacity-50"
            >
              {submitting ? 'Adding…' : 'Add'}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}

/**
 * Turn the string inputs into the body the API expects. Blank optional fields
 * are omitted rather than sent as "", and rating becomes a number.
 *
 * Non-numeric rating text is sent as the string it is, because
 * `JSON.stringify(NaN)` is `null` and the API reads null as "not rated" -
 * `Number(values.rating)` alone would quietly store "abc" as an unrated
 * restaurant instead of surfacing the server's 400 next to the field.
 *
 * That is also why the cast stays: the body deliberately carries a value the
 * request type does not allow, and only the server may rule on it.
 */
function toRequestBody(values: FormValues) {
  const body: Record<string, unknown> = { name: values.name };
  if (values.cuisine.trim() !== '') body.cuisine = values.cuisine;
  if (values.address.trim() !== '') body.address = values.address;
  if (values.rating.trim() !== '') {
    const rating = Number(values.rating);
    body.rating = Number.isNaN(rating) ? values.rating : rating;
  }
  return body as Parameters<typeof createRestaurant>[0];
}
