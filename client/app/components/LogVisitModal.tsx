'use client';

import { useRef, useState, type FormEvent } from 'react';
import { ApiError, createVisit } from '@/lib/apiClient';
import type { VisitInput } from '@/lib/types';

/** What the inputs hold. Everything is a string until submit reshapes it. */
const EMPTY_FORM = { date: '', amountSpent: '', notes: '' };
type FormValues = typeof EMPTY_FORM;
type FieldName = keyof FormValues;

const FIELDS: {
  name: FieldName;
  label: string;
  hint: string;
  /** Widget only. A date input is a calendar picker that emits YYYY-MM-DD,
   *  the shape the API already requires; inputMode picks the on-screen
   *  keyboard. Neither validates anything: the server stays the one authority. */
  type?: 'date';
  inputMode?: 'decimal';
}[] = [
  { name: 'date', label: 'Date', hint: 'Required. Pick the day of the visit.', type: 'date' },
  {
    name: 'amountSpent',
    label: 'Amount spent',
    hint: 'Required. A number, for example 24.50.',
    inputMode: 'decimal',
  },
  { name: 'notes', label: 'Notes', hint: 'Optional.' },
];

/**
 * The see-through "Log a visit" row and the modal it opens.
 *
 * Like AddRestaurantModal, the form has no validation rules of its own: the
 * API is the one authority, and each 400 names the field it is about. The two
 * files stay separate copies of that pattern rather than sharing a form
 * builder, which would be an abstraction over two examples.
 */
export default function LogVisitModal({
  restaurantId,
  onLogged,
}: {
  restaurantId: number;
  onLogged: () => void;
}) {
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
      await createVisit(restaurantId, toRequestBody(values));
      close();
      onLogged();
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
        className="w-full rounded-md border border-dashed border-gray-300 px-3 py-1.5 text-left text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700"
      >
        + Log a visit
      </button>

      <dialog
        ref={dialogRef}
        onClick={closeOnBackdrop}
        className="w-full max-w-md rounded-lg p-0 backdrop:bg-black/40"
      >
        <form onSubmit={submit} noValidate className="space-y-4 p-6">
          <h3 className="text-lg font-medium">Log a visit</h3>

          {FIELDS.map((field) => {
            const error = fieldErrors[field.name];
            // One modal per restaurant row, so the id carries the restaurant:
            // a bare "date" would repeat down the page and each label would
            // point at whichever input the browser found first.
            const inputId = `visit-${restaurantId}-${field.name}`;
            return (
              <div key={field.name}>
                <label htmlFor={inputId} className="block text-sm font-medium">
                  {field.label}
                </label>
                <p className="text-xs text-gray-500">{field.hint}</p>
                <input
                  id={inputId}
                  name={field.name}
                  type={field.type ?? 'text'}
                  inputMode={field.inputMode}
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
              {submitting ? 'Logging…' : 'Log visit'}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}

/**
 * Turn the string inputs into the body the API expects. A blank notes field is
 * omitted rather than sent as "", and amountSpent becomes a number.
 *
 * Blank and non-numeric amounts are sent as the text they are, because
 * `JSON.stringify(NaN)` is `null` and a null amount reads as a different
 * mistake than the one the user made. Sending the typed text back gets the
 * server's 400 about amountSpent placed next to the amountSpent input.
 *
 * That is also why the cast stays: the body deliberately carries a value the
 * request type does not allow, and only the server may rule on it.
 */
function toRequestBody(values: FormValues) {
  const body: Partial<Record<keyof VisitInput, unknown>> = { date: values.date };
  if (values.amountSpent.trim() === '') {
    body.amountSpent = values.amountSpent;
  } else {
    const amountSpent = Number(values.amountSpent);
    body.amountSpent = Number.isNaN(amountSpent) ? values.amountSpent : amountSpent;
  }
  if (values.notes.trim() !== '') body.notes = values.notes;
  return body as Parameters<typeof createVisit>[1];
}
