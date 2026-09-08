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
        className="w-full rounded-lg border border-dashed border-stone-300 px-3 py-2 text-left text-sm font-medium text-stone-500 transition hover:border-emerald-700/60 hover:bg-emerald-50/50 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
      >
        + Log a visit
      </button>

      <dialog
        ref={dialogRef}
        onClick={closeOnBackdrop}
        className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-0 shadow-2xl shadow-stone-900/10 backdrop:bg-stone-900/30 backdrop:backdrop-blur-sm"
      >
        <form onSubmit={submit} noValidate className="space-y-5 p-6">
          <h3 className="border-b border-stone-200 pb-4 text-lg font-semibold tracking-tight text-stone-900">Log a visit</h3>

          {FIELDS.map((field) => {
            const error = fieldErrors[field.name];
            // One modal per restaurant row, so the id carries the restaurant:
            // a bare "date" would repeat down the page and each label would
            // point at whichever input the browser found first.
            const inputId = `visit-${restaurantId}-${field.name}`;
            return (
              <div key={field.name}>
                <label htmlFor={inputId} className="block text-sm font-medium text-stone-800">
                  {field.label}
                </label>
                <p className="text-xs text-stone-500">{field.hint}</p>
                <input
                  id={inputId}
                  name={field.name}
                  type={field.type ?? 'text'}
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
