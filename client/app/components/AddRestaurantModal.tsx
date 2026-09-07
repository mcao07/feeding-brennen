'use client';

import { useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError, createRestaurant } from '@/lib/apiClient';

/** What the inputs hold. Everything is a string until submit reshapes it. */
const EMPTY_FORM = { name: '', cuisine: '', address: '', rating: '' };
type FormValues = typeof EMPTY_FORM;
type FieldName = keyof FormValues;

const FIELDS: { name: FieldName; label: string; hint: string; type: string }[] = [
  { name: 'name', label: 'Name', hint: 'Required.', type: 'text' },
  { name: 'cuisine', label: 'Cuisine', hint: 'Optional, for example Japanese.', type: 'text' },
  { name: 'address', label: 'Address', hint: 'Optional.', type: 'text' },
  { name: 'rating', label: 'Rating', hint: 'Optional, 0 to 5.', type: 'text' },
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

  function open() {
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
    setValues(EMPTY_FORM);
    setFieldErrors({});
    setFormError(null);
  }

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
        className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700"
      >
        Add restaurant
      </button>

      <dialog
        ref={dialogRef}
        onClose={close}
        onClick={closeOnBackdrop}
        className="w-full max-w-md rounded-lg p-0 backdrop:bg-black/40"
      >
        <form onSubmit={submit} noValidate className="space-y-4 p-6">
          <h3 className="text-lg font-medium">Add a restaurant</h3>

          {FIELDS.map((field) => {
            const error = fieldErrors[field.name];
            return (
              <div key={field.name}>
                <label htmlFor={field.name} className="block text-sm font-medium">
                  {field.label}
                </label>
                <p className="text-xs text-gray-500">{field.hint}</p>
                <input
                  id={field.name}
                  name={field.name}
                  type={field.type}
                  inputMode={field.name === 'rating' ? 'decimal' : undefined}
                  value={values[field.name]}
                  onChange={(e) => setValues({ ...values, [field.name]: e.target.value })}
                  aria-invalid={error ? true : undefined}
                  className={`mt-1 w-full rounded-md border px-3 py-1.5 text-sm ${
                    error ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
              </div>
            );
          })}

          {formError && (
            <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
              {formError}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={close}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
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
 * Turn the string inputs into the body the API expects. Blank optional
 * fields are omitted rather than sent as "", and rating becomes a number.
 * A rating that is not numeric is sent as-is so the server rejects it with
 * its own message.
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
