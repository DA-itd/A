// =============================================================================
// SISTEMA DE INSCRIPCIÓN A CURSOS - INSTITUTO TECNOLÓGICO DE DURANGO
// Versión: 2.1.0 - Envío de Tipo de Curso para Estadísticas
// =============================================================================

// =============================================================================
// == CONSTANTES Y CONFIGURACIÓN
// =============================================================================

const COURSES_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSAe4dmVN4CArjEy_lvI5qrXf16naxZLO1lAxGm2Pj4TrdnoebBg03Vv4-DCXciAkHJFiZaBMKletUs/pub?gid=0&single=true&output=csv';
const TEACHERS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSAe4dmVN4CArjEy_lvI5qrXf16naxZLO1lAxGm2Pj4TrdnoebBg03Vv4-DCXciAkHJFiZaBMKletUs/pub?gid=987931491&single=true&output=csv';

const CURP_REGEX = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[0-9A-Z]\d$/;

const MOCK_DEPARTMENTS = [
    "DEPARTAMENTO DE SISTEMAS Y COMPUTACION",
    "DEPARTAMENTO DE INGENIERÍA ELÉCTRICA Y ELECTRÓNICA",
    "DEPARTAMENTO DE CIENCIAS ECONOMICO-ADMINISTRATIVAS",
    "DEPARTAMENTO DE INGENIERÍA QUÍMICA-BIOQUÍMICA",
    "DEPARTAMENTO DE CIENCIAS DE LA TIERRA",
    "DEPARTAMENTO DE CIENCIAS BASICAS",
    "DEPARTAMENTO DE METAL-MECÁNICA",
    "DEPARTAMENTO DE INGENIERÍA INDUSTRIAL",
    "DIVISION DE ESTUDIOS DE POSGRADO E INVESTIGACION",
    "ADMINISTRATIVO",
    "EXTERNO"
];

// =============================================================================
// == FUNCIONES DE UTILIDAD
// =============================================================================

const removeAccents = (text) => {
    if (!text) return '';
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
};

const parseCSVLine = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    
    result.push(current.trim());
    return result;
};

const cleanCSVValue = (val) => {
    let cleaned = val.trim();
    if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
        cleaned = cleaned.substring(1, cleaned.length - 1).replace(/""/g, '"');
    }
    return cleaned;
};

// =============================================================================
// == API SERVICE
// =============================================================================

const getTeachers = async () => {
    try {
        const response = await fetch(`${TEACHERS_CSV_URL}&_=${Date.now()}`);
        if (!response.ok) throw new Error('Error al cargar docentes');
        
        const csvText = await response.text();
        const lines = csvText.trim().split(/\r?\n/);
        
        return lines.slice(1)
            .filter(line => line.trim())
            .map(line => {
                const values = parseCSVLine(line);
                if (values.length < 3) return null;
                return {
                    nombreCompleto: cleanCSVValue(values[0]),
                    curp: cleanCSVValue(values[1]),
                    email: cleanCSVValue(values[2])
                };
            })
            .filter(teacher => teacher !== null);
    } catch (error) {
        console.error("Error al obtener docentes:", error);
        return [];
    }
};

const getCourses = async () => {
    try {
        const response = await fetch(`${COURSES_CSV_URL}&_=${Date.now()}`);
        if (!response.ok) throw new Error('Error al cargar cursos');
        
        const csvText = await response.text();
        const lines = csvText.trim().split(/\r?\n/);
        
        return lines.slice(1)
            .filter(line => line.trim())
            .map(line => {
                const values = parseCSVLine(line);
                if (values.length < 8) return null;
                
                const hours = parseInt(cleanCSVValue(values[4]), 10);
                
                return {
                    id: cleanCSVValue(values[0]),
                    name: cleanCSVValue(values[1]),
                    dates: cleanCSVValue(values[2]),
                    period: cleanCSVValue(values[3]),
                    hours: isNaN(hours) ? 30 : hours,
                    location: cleanCSVValue(values[5]),
                    schedule: cleanCSVValue(values[6]),
                    type: cleanCSVValue(values[7]) || 'No especificado' // Asegurar que siempre haya un valor
                };
            })
            .filter(course => course !== null);
    } catch (error) {
        console.error("Error al obtener cursos:", error);
        return [];
    }
};

const getDepartments = () => {
    return Promise.resolve(MOCK_DEPARTMENTS);
};

const getRegistrationByCurp = async (curp) => {
    const APPS_SCRIPT_URL = window.CONFIG?.APPS_SCRIPT_URL;
    if (!APPS_SCRIPT_URL) throw new Error("URL no configurada");
    
    try {
        const url = new URL(APPS_SCRIPT_URL);
        url.searchParams.append('action', 'lookupByCurp');
        url.searchParams.append('curp', curp.toUpperCase());
        url.searchParams.append('_', Date.now().toString());
        
        const response = await fetch(url.toString(), { method: 'GET', mode: 'cors' });
        const result = await response.json();

        if (result?.success && result.data?.registeredCourses) {
            return result.data.registeredCourses;
        } else {
            throw new Error(result.message || 'Error al buscar registro');
        }
    } catch (error) {
        console.error("Error en getRegistrationByCurp:", error);
        return [];
    }
};

const enrollStudent = async (data) => {
    const APPS_SCRIPT_URL = window.CONFIG?.APPS_SCRIPT_URL;
    if (!APPS_SCRIPT_URL) throw new Error("URL no configurada");
    
    const payload = {
        action: 'enrollStudent',
        ...data
    };
    
    const response = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'cors',
        redirect: 'follow',
        headers: {
            'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(payload),
    });
    
    const result = await response.json();
    if (result.success) {
        return result.data;
    } else {
        throw new Error(result.message || 'Error en la inscripción');
    }
};

// =============================================================================
// == COMPONENTES DE REACT
// =============================================================================

const { useState, useEffect, useCallback, useRef } = React;

const AutocompleteInput = ({ teachers, onSelect, value, onChange, placeholder }) => {
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleInputChange = (e) => {
        const currentValue = e.target.value;
        onChange(e);

        if (currentValue) {
            const normalizedInput = removeAccents(currentValue.toLowerCase());
            const filtered = teachers.filter(teacher =>
                removeAccents(teacher.nombreCompleto.toLowerCase()).includes(normalizedInput)
            ).slice(0, 5);
            setSuggestions(filtered);
            setShowSuggestions(filtered.length > 0);
        } else {
            setSuggestions([]);
            setShowSuggestions(false);
        }
    };

    const handleSelect = (teacher) => {
        onSelect(teacher);
        setShowSuggestions(false);
    };

    return (
        <div className="relative" ref={containerRef}>
            <input
                type="text"
                value={value}
                onChange={handleInputChange}
                onFocus={(e) => {
                  if (e.target.value) {
                     handleInputChange(e);
                  }
                }}
                placeholder={placeholder || "Escriba su nombre"}
                className="w-full p-2 border border-gray-300 rounded-md"
                autoComplete="off"
            />
            {showSuggestions && suggestions.length > 0 && (
                <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md shadow-lg mt-1 max-h-60 overflow-auto">
                    {suggestions.map((teacher) => (
                        <li
                            key={teacher.curp}
                            onMouseDown={(e) => { 
                                e.preventDefault(); 
                                handleSelect(teacher); 
                            }}
                            className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                        >
                            {teacher.nombreCompleto}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

const Step1PersonalInfo = ({ formData, setFormData, onNext, teachers, departments }) => {
    const [error, setError] = useState('');

    const handleTeacherSelect = (teacher) => {
        setFormData({
            ...formData,
            fullName: teacher.nombreCompleto.toUpperCase(),
            curp: teacher.curp.toUpperCase(),
            email: (teacher.email || '').toLowerCase()
        });
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({
            ...formData,
            [name]: name === 'curp' || name === 'fullName' ? value.toUpperCase() : value.toLowerCase()
        });
    };

    const validateAndProceed = async () => {
        setError('');
        if (!formData.fullName || !formData.curp || !formData.email || !formData.DepartamentoSeleccionado || !formData.gender) {
            setError('Todos los campos son obligatorios.');
            return;
        }

        if (!CURP_REGEX.test(formData.curp)) {
            setError('El formato de la CURP no es válido.');
            return;
        }

        try {
            const registeredCourses = await getRegistrationByCurp(formData.curp);
            onNext(registeredCourses);
        } catch (e) {
            setError(e.message);
        }
    };
    
    return (
        <div className="space-y-4">
             <a href="index.html" className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 hover:underline mb-4">
                ← Volver al Portal Principal
            </a>
            <h2 className="text-xl font-bold">Paso 1: Información Personal</h2>
            {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">{error}</div>}
            
            <div>
                <label className="block text-sm font-medium text-gray-700">Nombre Completo</label>
                <AutocompleteInput
                    teachers={teachers}
                    onSelect={handleTeacherSelect}
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value.toUpperCase() })}
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700">CURP</label>
                    <input type="text" name="curp" value={formData.curp} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded-md" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded-md" />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Departamento</label>
                    <select name="DepartamentoSeleccionado" value={formData.DepartamentoSeleccionado} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded-md">
                        <option value="">Seleccione un departamento</option>
                        {departments.map(dep => <option key={dep} value={dep}>{dep}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Género</label>
                    <select name="gender" value={formData.gender} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded-md">
                        <option value="">Seleccione su género</option>
                        <option value="HOMBRE">Hombre</option>
                        <option value="MUJER">Mujer</option>
                    </select>
                </div>
            </div>

            <div className="flex justify-end">
                <button onClick={validateAndProceed} className="bg-blue-600 text-white px-4 py-2 rounded-md">Siguiente</button>
            </div>
        </div>
    );
};

const Step2CourseSelection = ({ onNext, onBack, courses, registeredCourses, initialSelection }) => {
    const [selectedCourses, setSelectedCourses] = useState(initialSelection);
    const [error, setError] = useState('');

    const toggleCourseSelection = (course) => {
        setError('');
        const isSelected = selectedCourses.some(c => c.id === course.id);
        let newSelection;

        if (isSelected) {
            newSelection = selectedCourses.filter(c => c.id !== course.id);
        } else {
            if (selectedCourses.length >= 3) {
                setError('No puedes seleccionar más de 3 cursos.');
                return;
            }
            newSelection = [...selectedCourses, course];
        }
        setSelectedCourses(newSelection);
    };

    const groupedCourses = courses.reduce((acc, course) => {
        const period = course.period || 'Sin Periodo';
        if (!acc[period]) {
            acc[period] = [];
        }
        acc[period].push(course);
        return acc;
    }, {});
    
    const periodThemes = {
      'PERIODO_1': {
        icon: '☀️',
        borderColor: 'border-teal-500',
        bgColor: 'bg-teal-50',
        selectedColor: 'ring-teal-500 bg-teal-200',
        registeredColor: 'bg-teal-100',
      },
      'PERIODO_2': {
        icon: '🍂',
        borderColor: 'border-indigo-500',
        bgColor: 'bg-indigo-50',
        selectedColor: 'ring-indigo-500 bg-indigo-200',
        registeredColor: 'bg-indigo-100',
      }
    };

    return (
        <div className="space-y-6">
            <a href="index.html" className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 hover:underline mb-4">
                ← Volver al Portal Principal
            </a>
            <h2 className="text-xl font-bold">Paso 2: Selección de Cursos</h2>
            {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">{error}</div>}
            
            {Object.entries(groupedCourses).map(([period, courseList]) => {
                const theme = periodThemes[period] || periodThemes['PERIODO_2'];
                return (
                    <div key={period} className={`p-4 rounded-lg border ${theme.borderColor} ${theme.bgColor}`}>
                        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                           <span>{theme.icon}</span> {period.replace('_', ' ')}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {courseList.map(course => {
                                const isSelected = selectedCourses.some(c => c.id === course.id);
                                const isRegistered = registeredCourses.includes(course.id);
                                const isNewSelection = isSelected && !isRegistered;
                                
                                let cardClass = 'p-3 border rounded-lg cursor-pointer transition-all duration-200';
                                if(isRegistered && isSelected) {
                                    cardClass += ` ${theme.registeredColor} border-gray-400`;
                                } else if (isNewSelection) {
                                    cardClass += ` ring-2 ${theme.selectedColor} border-transparent`;
                                } else if (isRegistered) {
                                    cardClass += ` ${theme.registeredColor} border-gray-400 opacity-70`;
                                } else {
                                    cardClass += ' bg-white hover:shadow-md';
                                }

                                return (
                                    <div key={course.id} onClick={() => toggleCourseSelection(course)} className={cardClass}>
                                        <p className="font-bold text-sm">{course.name}</p>
                                        <p className="text-xs text-gray-600 mt-1">{course.dates}</p>
                                        <p className="text-xs text-gray-600">{course.schedule}</p>
                                        <p className="text-xs text-gray-600">{course.location}</p>
                                        {isRegistered && <span className="text-xs font-bold text-gray-500 mt-2 block">✔️ Previamente Inscrito</span>}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}

            <div className="flex justify-between items-center mt-6">
                <button onClick={onBack} className="bg-gray-300 text-black px-4 py-2 rounded-md">Atrás</button>
                <button onClick={() => onNext(selectedCourses)} className="bg-blue-600 text-white px-4 py-2 rounded-md">Siguiente</button>
            </div>
        </div>
    );
};

const Step3Confirmation = ({ onConfirm, onBack, formData, selectedCourses }) => {
    return (
        <div className="space-y-4">
             <a href="index.html" className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 hover:underline mb-4">
                ← Volver al Portal Principal
            </a>
            <h2 className="text-xl font-bold">Paso 3: Confirmación</h2>
            
            <div className="bg-gray-50 p-4 rounded-md border">
                <h3 className="font-semibold mb-2">Información Personal</h3>
                <p><strong>Nombre:</strong> {formData.fullName}</p>
                <p><strong>CURP:</strong> {formData.curp}</p>
                <p><strong>Email:</strong> {formData.email}</p>
                <p><strong>Departamento:</strong> {formData.DepartamentoSeleccionado}</p>
            </div>

            <div className="bg-gray-50 p-4 rounded-md border">
                <h3 className="font-semibold mb-2">Cursos Seleccionados</h3>
                {selectedCourses.length > 0 ? (
                    <ul>
                        {selectedCourses.map(course => <li key={course.id}>- {course.name}</li>)}
                    </ul>
                ) : (
                    <p>No has seleccionado ningún curso nuevo. Si continúas, se cancelarán todas tus inscripciones anteriores.</p>
                )}
            </div>

            <div className="flex justify-between mt-6">
                <button onClick={onBack} className="bg-gray-300 text-black px-4 py-2 rounded-md">Atrás</button>
                <button onClick={onConfirm} className="bg-green-600 text-white px-4 py-2 rounded-md">Confirmar Inscripción</button>
            </div>
        </div>
    );
};

const SuccessScreen = ({ results }) => {
    return (
        <div className="text-center">
            <h2 className="text-2xl font-bold text-green-600">¡Inscripción Exitosa!</h2>
            <p className="mt-2">Se ha enviado un correo de confirmación con los detalles.</p>
            <div className="mt-4 bg-gray-50 p-4 rounded-md border text-left">
                <h3 className="font-semibold mb-2">Folios de Registro:</h3>
                <ul>
                    {results.map(result => (
                        <li key={result.registrationId}>
                            <strong>{result.courseName}:</strong> {result.folio}
                        </li>
                    ))}
                </ul>
            </div>
            <button onClick={() => window.location.href = 'index.html'} className="mt-6 bg-blue-600 text-white px-4 py-2 rounded-md">
                Volver al Portal Principal
            </button>
        </div>
    );
};

const App = () => {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        fullName: '',
        curp: '',
        email: '',
        DepartamentoSeleccionado: '',
        gender: ''
    });
    const [courses, setCourses] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [selectedCourses, setSelectedCourses] = useState([]);
    const [registeredCourses, setRegisteredCourses] = useState([]);
    const [initialSelection, setInitialSelection] = useState([]);
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const loadInitialData = async () => {
            try {
                setLoading(true);
                setError(null);
                const [teachersData, coursesData, departmentsData] = await Promise.all([
                    getTeachers(),
                    getCourses(),
                    getDepartments()
                ]);
                setTeachers(teachersData);
                setCourses(coursesData);
                setDepartments(departmentsData);
            } catch (e) {
                setError("No se pudieron cargar los datos iniciales. Verifique su conexión.");
            } finally {
                setLoading(false);
            }
        };
        loadInitialData();
    }, []);

    const handleStep1Next = (prevRegistered) => {
        setRegisteredCourses(prevRegistered);
        const initial = courses.filter(c => prevRegistered.includes(c.id));
        setSelectedCourses(initial);
        setInitialSelection(initial);
        setStep(2);
    };
    
    const handleStep2Next = (currentSelection) => {
        setSelectedCourses(currentSelection);
        setStep(3);
    };

    const handleConfirm = async () => {
        setLoading(true);
        setError(null);
        try {
            const enrollmentData = {
                ...formData,
                timestamp: new Date().toISOString(),
                selectedCourses: selectedCourses,
                previousRegistrationIds: initialSelection.map(c => c.id)
            };
            const response = await enrollStudent(enrollmentData);
            
            const resultsWithNames = response.results.map(res => {
                const course = courses.find(c => c.id === res.registrationId);
                return { ...res, courseName: course ? course.name : 'Curso desconocido' };
            });
            
            setResults(resultsWithNames);
            setStep(4);
        } catch (e) {
            setError(e.message || "Ocurrió un error al inscribir.");
            setStep(3);
        } finally {
            setLoading(false);
        }
    };
    
    const renderStep = () => {
        if (loading && step === 1) {
            return <div className="text-center p-8">Cargando datos...</div>;
        }
        if (error && step === 1) {
            return <div className="text-center p-8 text-red-500">{error}</div>;
        }

        switch (step) {
            case 1:
                return <Step1PersonalInfo formData={formData} setFormData={setFormData} onNext={handleStep1Next} teachers={teachers} departments={departments} />;
            case 2:
                return <Step2CourseSelection onNext={handleStep2Next} onBack={() => setStep(1)} courses={courses} registeredCourses={registeredCourses} initialSelection={selectedCourses}/>;
            case 3:
                return <Step3Confirmation onConfirm={handleConfirm} onBack={() => setStep(2)} formData={formData} selectedCourses={selectedCourses} />;
            case 4:
                return <SuccessScreen results={results} />;
            default:
                return <div>Paso desconocido</div>;
        }
    };

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8">
            <div className="max-w-4xl mx-auto bg-white p-6 rounded-lg shadow-lg relative">
                {loading && step > 1 && (
                    <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10">
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                            <p className="mt-2">Procesando...</p>
                        </div>
                    </div>
                )}
                {error && step > 1 && (
                     <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">{error}</div>
                )}
                {renderStep()}
            </div>
        </div>
    );
};

window.addEventListener('load', () => {
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(<App />);
});
