import { useState } from 'react';
import { FileText } from 'lucide-react';

export interface ManualEntryData {
  amount: string;
  date: string;
  merchant: string;
  notes: string;
}

export interface ManualEntryFallbackProps {
  /** Called when user submits manual entry */
  onSubmit: (data: ManualEntryData) => void;
  /** Called when user cancels / goes back */
  onCancel: () => void;
  /** Optional initial values */
  defaultValues?: Partial<ManualEntryData>;
}

export function ManualEntryFallback({
  onSubmit,
  onCancel,
  defaultValues = {},
}: ManualEntryFallbackProps) {
  const [amount, setAmount] = useState(defaultValues.amount ?? '');
  const [date, setDate] = useState(
    defaultValues.date ?? new Date().toISOString().slice(0, 10)
  );
  const [merchant, setMerchant] = useState(defaultValues.merchant ?? '');
  const [notes, setNotes] = useState(defaultValues.notes ?? '');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const num = parseFloat(amount.replace(/,/g, '.'));
    if (Number.isNaN(num) || num <= 0) {
      setError('Please enter a valid amount.');
      return;
    }
    onSubmit({
      amount: num.toFixed(2),
      date,
      merchant: merchant.trim(),
      notes: notes.trim(),
    });
  };

  return (
    <div className="bg-card-theme border border-theme rounded-xl p-4 md:p-6">
      <div className="flex items-center gap-2 text-muted-theme mb-4">
        <FileText size={20} />
        <h3 className="text-lg font-medium text-theme">Enter receipt details manually</h3>
      </div>
      <p className="text-sm text-muted-theme mb-4">
        No receipt image? Add the key details below.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="manual-amount" className="block text-sm font-medium text-theme mb-1">
            Amount *
          </label>
          <input
            id="manual-amount"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-theme bg-surface text-theme placeholder:text-muted-theme focus:outline-none focus:ring-2 ring-theme min-h-[44px]"
            aria-required
          />
        </div>
        <div>
          <label htmlFor="manual-date" className="block text-sm font-medium text-theme mb-1">
            Date
          </label>
          <input
            id="manual-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-theme bg-surface text-theme focus:outline-none focus:ring-2 ring-theme min-h-[44px]"
          />
        </div>
        <div>
          <label htmlFor="manual-merchant" className="block text-sm font-medium text-theme mb-1">
            Merchant / Store
          </label>
          <input
            id="manual-merchant"
            type="text"
            placeholder="e.g. Grocery Store"
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-theme bg-surface text-theme placeholder:text-muted-theme focus:outline-none focus:ring-2 ring-theme min-h-[44px]"
          />
        </div>
        <div>
          <label htmlFor="manual-notes" className="block text-sm font-medium text-theme mb-1">
            Notes
          </label>
          <textarea
            id="manual-notes"
            rows={3}
            placeholder="Optional notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-theme bg-surface text-theme placeholder:text-muted-theme focus:outline-none focus:ring-2 ring-theme min-h-[44px] resize-y"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 min-h-[44px] px-4 py-2 rounded-xl border border-theme bg-surface text-theme hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 ring-theme"
          >
            Back
          </button>
          <button
            type="submit"
            className="flex-1 min-h-[44px] px-4 py-2 rounded-xl bg-accent text-white hover:opacity-90 focus:outline-none focus:ring-2 ring-theme"
          >
            Save details
          </button>
        </div>
      </form>
    </div>
  );
}
