import { useState, useRef } from 'react';
import { usePolls } from '../../hooks/usePolls';

export default function PollImporter() {
  const { importPolls, loading } = usePolls();
  const [result, setResult] = useState<{ imported: number; errors: string[] } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setResult(null);
    setImportError(null);

    try {
      const text = await file.text();
      const res = await importPolls(text);
      setResult(res);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import hiba');
    }
  };

  return (
    <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
      <h3 className="text-sm font-medium text-gray-400 mb-3">CSV import</h3>

      <div className="mb-3 text-xs text-gray-500">
        <p className="mb-1">Elvárt formátum:</p>
        <code className="block bg-gray-800 p-2 rounded text-gray-400">
          date,institute,basis,fidesz_kdnp,tisza,mi_hazank,dk,mkkp,other,sample_size,margin_of_error
        </code>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleFileSelect}
        className="hidden"
      />

      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={loading}
        className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-sm transition-colors disabled:opacity-50"
      >
        {loading ? 'Importálás...' : 'CSV fájl kiválasztása'}
      </button>

      {result && (
        <div className="mt-3 text-sm">
          <div className="text-green-400">
            {result.imported} adat sikeresen importálva.
          </div>
          {result.errors.length > 0 && (
            <div className="mt-2 text-yellow-400">
              <p className="font-medium">Figyelmeztetések:</p>
              <ul className="list-disc list-inside text-xs mt-1">
                {result.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {importError && (
        <div className="mt-3 text-sm text-red-400">{importError}</div>
      )}
    </div>
  );
}
