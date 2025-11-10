declare const React: any;
declare const window: any;

const DATABASE_URL = 'https://raw.githubusercontent.com/DA-itd/web2/main/database.xlsx';
const ITD_LOGO_URL = 'https://raw.githubusercontent.com/DA-itd/web2/main/image.jpg';
const TECNM_LOGO_URL = 'https://raw.githubusercontent.com/DA-itd/web2/main/TecNM_logo.jpg';
const VALIDATION_URL = 'https://da-itd.github.io/web2';

const POTENTIAL_FOLIO_HEADERS = [
    'Folio', 'ID', 'Folio del certificado', 'Folio de la constancia',
    'No. de Folio', '# Folio', 'folio', 'Folio personal'
];

const ValidationStatus = {
    IDLE: 'idle',
    SUCCESS: 'success',
    NOT_FOUND: 'not_found',
    ERROR: 'error',
};

const getProperty = (obj, keyName) => {
    if (!obj || typeof obj !== 'object' || !keyName) return undefined;
    const keyToFind = keyName.toLowerCase();
    const foundKey = Object.keys(obj).find(k => k.trim().toLowerCase() === keyToFind);
    return foundKey ? obj[foundKey] : undefined;
};

const getFlexibleProperty = (obj, keys) => {
    if (!obj || typeof obj !== 'object' || !Array.isArray(keys)) return undefined;
    for (const key of keys) {
        const value = getProperty(obj, key);
        if (value !== undefined && value !== null) return value;
    }
    return undefined;
};

const formatDate = (dateValue) => {
    if (dateValue === undefined || dateValue === null) return 'N/A';
    if (typeof dateValue === 'string') {
        if (!isNaN(parseFloat(dateValue))) {
            let date = new Date((parseFloat(dateValue) - 25569) * 86400 * 1000);
            date = new Date(date.valueOf() + date.getTimezoneOffset() * 60000);
            if (isNaN(date.getTime())) return String(dateValue);
            return date.toLocaleDateString('es-ES',{ day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).toUpperCase();
        }
        return dateValue.toUpperCase();
    }
    let date;
    if (typeof dateValue === 'number') {
        date = new Date((dateValue - 25569) * 86400 * 1000);
        date = new Date(date.valueOf() + date.getTimezoneOffset() * 60000);
    } else {
        date = new Date(dateValue);
    }
    if (!date || isNaN(date.getTime())) return String(dateValue).toUpperCase();
    return date.toLocaleDateString('es-ES',{ day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).toUpperCase();
};

const VerificadorPage = () => {
    const { useState, useEffect, useCallback } = React;

     const generatePdf = async (result) => {
        alert('La generación de PDF aún no está completamente implementada en esta versión.');
    };

    const loadDatabase = async () => {
        const cacheBustingUrl = `${DATABASE_URL}?v=${new Date().getTime()}`;
        const response = await fetch(cacheBustingUrl);
        if (!response.ok) throw new Error('No se pudo cargar la base de datos.');

        const arrayBuffer = await response.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);
        
        if (data.length < 4 || data[0] !== 0x50 || data[1] !== 0x4B) {
            throw new Error('El archivo descargado no es un Excel (.xlsx) válido.');
        }

        const workbook = window.XLSX.read(data, { type: 'array' });
        let allData = [];

        workbook.SheetNames.forEach(sheetName => {
            const worksheet = workbook.Sheets[sheetName];
            if (!worksheet || !worksheet['!ref']) return;
            
            const dataAoA = window.XLSX.utils.sheet_to_json(worksheet, { header: 1, blankrows: false });
            if (dataAoA.length === 0) return;

            let headerRowIndex = -1;
            for (let i = 0; i < dataAoA.length; i++) {
                 if (Array.isArray(dataAoA[i]) && dataAoA[i].some(cell => POTENTIAL_FOLIO_HEADERS.map(h => h.toLowerCase()).includes(String(cell || '').trim().toLowerCase()))) {
                    headerRowIndex = i;
                    break;
                }
            }
            if (headerRowIndex === -1) return;

            const headers = dataAoA[headerRowIndex].map(h => (h ? String(h).trim() : ''));
            const dataRows = dataAoA.slice(headerRowIndex + 1);

            const sheetJson = dataRows
              .filter(row => Array.isArray(row) && row.some(cell => String(cell || '').trim() !== ''))
              .map(row => {
                const record = headers.reduce((acc, header, i) => {
                  if (header && i < row.length && row[i] !== undefined && row[i] !== null) {
                    acc[header] = row[i];
                  }
                  return acc;
                }, {});
                return record;
              });
            allData = allData.concat(sheetJson);
        });
        return allData;
    };

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [certificateData, setCertificateData] = useState([]);
    const [query, setQuery] = useState('');
    const [status, setStatus] = useState(ValidationStatus.IDLE);
    const [result, setResult] = useState(null);
    const [mode, setMode] = useState('folio');

    useEffect(() => {
        (async () => {
          try {
            setError(null);
            setLoading(true);
            const db = await loadDatabase();
            setCertificateData(db);
          } catch (e) {
            setError(e.message);
          } finally {
            setLoading(false);
          }
        })();
      }, []);

    const handleSearch = useCallback((searchQuery) => {
        if (!searchQuery || certificateData.length === 0) {
            setStatus(ValidationStatus.IDLE);
            setResult(null);
            return;
        }
        let found = null;
        const inputQuery = searchQuery.trim().toUpperCase();

        if (mode === 'folio') {
            const isFullFolio = inputQuery.startsWith('TNM-054-');
            const searchStr = (isFullFolio ? inputQuery : `TNM-054-${inputQuery}`).toLowerCase();

            found = certificateData.find(record => {
                const folio = getFlexibleProperty(record, POTENTIAL_FOLIO_HEADERS);
                return folio && String(folio).trim().toLowerCase() === searchStr;
            });
        }
        
        if (found) {
            setResult(found);
            setStatus(ValidationStatus.SUCCESS);
        } else {
            setResult(null);
            setStatus(ValidationStatus.NOT_FOUND);
        }
    }, [certificateData, mode]);

    const handleClear = useCallback(() => {
        setQuery('');
        setStatus(ValidationStatus.IDLE);
        setResult(null);
    }, []);

    return (
        <div className="container mx-auto px-4 py-8 sm:py-12">
            <div className="max-w-4xl mx-auto">
                {loading && <p className="text-gray-600 p-8 text-center">Cargando base de datos...</p>}
                {error && <p className="text-red-600 p-8 text-center bg-red-50 rounded-lg">{error}</p>}
                {!loading && !error && (
                    <>
                        <SearchForm query={query} setQuery={setQuery} onSearch={handleSearch} onClear={handleClear} mode={mode} setMode={setMode} />
                        <ValidationResult status={status} result={result} mode={mode} generatePdf={generatePdf} />
                    </>
                )}
            </div>
        </div>
    );
};

const SearchForm = ({ query, setQuery, onSearch, onClear, mode, setMode }) => {
    return (
         <div className="bg-white p-6 sm:p-8 rounded-xl shadow-md w-full max-w-2xl mx-auto">
             <form onSubmit={(e) => { e.preventDefault(); onSearch(query); }} className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-4">
                <div className="flex-grow w-full">
                  <div className="flex w-full border border-gray-300 rounded-md focus-within:ring-2 focus-within:ring-blue-500 overflow-hidden">
                    <span className="px-3 text-gray-500 bg-gray-50 border-r border-gray-300 flex items-center whitespace-nowrap">
                      TNM-054-
                    </span>
                    <input
                      type="text"
                      className="w-full pl-4 pr-4 py-2 border-none focus:outline-none bg-transparent"
                      placeholder="XX-YYYY-XX-XX"
                      value={query}
                      onChange={e => setQuery(e.target.value.toUpperCase())}
                      autoFocus
                    />
                  </div>
                </div>
                <div className="flex space-x-2 w-full sm:w-auto flex-shrink-0">
                  <button type="submit" className="flex-1 sm:flex-none px-6 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700">Verificar</button>
                  <button type="button" onClick={onClear} className="flex-1 sm:flex-none px-6 py-2 bg-gray-200 text-gray-700 font-semibold rounded-md hover:bg-gray-300">Borrar</button>
                </div>
              </form>
         </div>
    );
};

const ValidationResult = ({ status, result, mode, generatePdf }) => {
    if (status === 'idle') return null;
    if (status === 'not_found') {
        return <div className="text-red-700 text-center mt-8 p-6 bg-red-50 rounded-lg">Documento no encontrado.</div>;
    }
    if (status === 'success' && result) {
        const data = {
            'Folio': getFlexibleProperty(result, POTENTIAL_FOLIO_HEADERS),
            'Nombre': getFlexibleProperty(result, ['NombreCompleto', 'Nombre']),
            'Curso': getFlexibleProperty(result, ['Curso']),
            'Fecha': formatDate(getFlexibleProperty(result, ['FechaCurso'])),
        };
        return (
            <div className="w-full max-w-2xl mx-auto mt-8 bg-green-50 border-l-4 border-green-500 rounded-r-lg shadow">
                 <div className="p-6">
                    <h3 className="text-lg font-bold text-green-800">Constancia Válida</h3>
                 </div>
                 <div className="bg-white p-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-sm border-t border-green-200">
                    {Object.entries(data).map(([key, value]) => value ? (
                        <div key={key}>
                            <p className="text-gray-500">{key}</p>
                            <p className="font-bold text-gray-800 break-words">{String(value).toUpperCase()}</p>
                        </div>
                    ) : null)}
                 </div>
            </div>
        );
    }
    return null;
};

export default VerificadorPage;
