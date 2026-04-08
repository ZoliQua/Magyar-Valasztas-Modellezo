interface HeaderProps {
  onExportPdf?: () => void;
  pdfExporting?: boolean;
  canExportPdf?: boolean;
}

export default function Header({ onExportPdf, pdfExporting, canExportPdf }: HeaderProps) {
  return (
    <header className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
      <h1 className="text-xl font-bold tracking-tight">
        <span className="text-red-500">Választási</span>{' '}
        <span className="text-white">Modellező</span>{' '}
        <span className="text-green-500">2026</span>
      </h1>
      <div className="flex gap-3">
        <button className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 transition-colors">
          Mentés
        </button>
        <button className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 transition-colors">
          Betöltés
        </button>
        <button
          onClick={onExportPdf}
          disabled={!onExportPdf || !canExportPdf || pdfExporting}
          className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed text-white rounded border border-blue-500 disabled:border-gray-700 transition-colors"
        >
          {pdfExporting ? 'Generálás...' : 'PDF Export'}
        </button>
      </div>
    </header>
  );
}
