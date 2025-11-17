// =============================================================================
// SISTEMA DE INSCRIPCIÓN A CURSOS - INSTITUTO TECNOLÓGICO DE DURANGO
// Versión: 2.1.0 - UI de Acordeón
// Última actualización: Noviembre 2025
// =============================================================================

const {
    useState,
    useEffect,
    useCallback,
    useMemo,
    useRef
} = React;

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
                    type: cleanCSVValue(values[7])
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

        const response = await fetch(url.toString(), {
            method: 'GET',
            mode: 'cors'
        });
        const result = await response.json();

        if (result?.success && result.data?.registeredCourses) {
            return result.data.registeredCourses;
        }
        return [];
    } catch (error) {
        console.error("Error al buscar CURP:", error);
        return [];
    }
};

const submitRegistration = async (submission) => {
    const APPS_SCRIPT_URL = window.CONFIG?.APPS_SCRIPT_URL;
    if (!APPS_SCRIPT_URL) throw new Error("URL de configuración no disponible");

    try {
        const response = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'cors',
            redirect: 'follow',
            headers: {
                'Content-Type': 'text/plain;charset=utf-8'
            },
            body: JSON.stringify(submission)
        });

        const result = await response.json();
        if (result?.success) {
            return result.data;
        } else {
            throw new Error(result.message || 'Error en el servidor');
        }
    } catch (error) {
        console.error("Error al enviar registro:", error);

        if (error instanceof Error && error.message !== 'Failed to fetch') {
            throw error;
        }

        throw new Error(
            "No se pudo comunicar con el servidor.\n\n" +
            "Posibles causas:\n" +
            "1. URL del script incorrecta\n" +
            "2. Script sin permisos públicos\n" +
            "3. Problema de conexión"
        );
    }
};

const cancelSingleCourse = async (payload) => {
    const APPS_SCRIPT_URL = window.CONFIG?.APPS_SCRIPT_URL;
    if (!APPS_SCRIPT_URL) throw new Error("URL no disponible");

    try {
        const response = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'cors',
            redirect: 'follow',
            headers: {
                'Content-Type': 'text/plain;charset=utf-8'
            },
            body: JSON.stringify({ ...payload,
                action: 'cancelSingle'
            })
        });

        const result = await response.json();
        if (!result?.success) {
            throw new Error(result.message || 'Error al cancelar');
        }
    } catch (error) {
        throw new Error("No se pudo cancelar el curso.");
    }
};

// =============================================================================
// == COMPONENTE PRINCIPAL APP
// =============================================================================

function App() {
    const [currentStep, setCurrentStep] = useState(1);
    const [formData, setFormData] = useState({
        fullName: '',
        curp: '',
        email: '',
        gender: 'Mujer',
        department: '',
        selectedCourses: [],
    });

    const [allCourses, setAllCourses] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [selectedCourses, setSelectedCourses] = useState([]);
    const [originalSelectedCourses, setOriginalSelectedCourses] = useState([]);
    const [registrationResult, setRegistrationResult] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [submissionType, setSubmissionType] = useState('enrollment');
    const [emailSent, setEmailSent] = useState(true);
    const [emailError, setEmailError] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const [coursesData, teachersData, departmentsData] = await Promise.all([
                    getCourses(),
                    getTeachers(),
                    getDepartments()
                ]);
                setAllCourses(coursesData);
                setTeachers(teachersData);
                setDepartments(departmentsData);
            } catch (err) {
                setError("No se pudieron cargar los datos.");
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    const studentSteps = ["Información", "Cursos", "Confirmar", "Finalizado"];

    const handleNext = () => setCurrentStep(prev => prev < 4 ? prev + 1 : prev);
    const handleBack = () => setCurrentStep(prev => prev > 1 ? prev - 1 : prev);
    const goToStep = (step) => {
        if (step > 0 && step <= studentSteps.length) setCurrentStep(step);
    };

    const handleSubmit = async () => {
        setError(null);
        try {
            const isCancellation = selectedCourses.length === 0 && originalSelectedCourses.length > 0;
            setSubmissionType(isCancellation ? 'cancellation' : 'enrollment');

            const submissionData = {
                action: 'enrollStudent',
                timestamp: new Date().toISOString(),
                fullName: formData.fullName,
                curp: formData.curp,
                email: formData.email,
                gender: formData.gender,
                DepartamentoSeleccionado: formData.department,
                selectedCourses: selectedCourses.map(c => ({
                    id: c.id,
                    name: c.name,
                    dates: c.dates,
                    location: c.location,
                    schedule: c.schedule,
                })),
                previousRegistrationIds: originalSelectedCourses.map(c => c.id)
            };

            const result = await submitRegistration(submissionData);
            const registrationResultsArray = result.results || [];

            const augmentedResult = registrationResultsArray.map((reg) => {
                const courseDetails = selectedCourses.find(c => c.id === reg.registrationId);
                return {
                    ...reg,
                    dates: courseDetails ? courseDetails.dates : 'Fechas no disponibles'
                };
            });

            setRegistrationResult(augmentedResult);
            setEmailSent(result.emailSent !== false);
            setEmailError(result.emailError);

            handleNext();

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Error desconocido";
            setError(errorMessage);
            setCurrentStep(3);
        }
    };

    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-800"></div>
                </div>
            );
        }

        if (error && currentStep !== 3) {
            return (
                <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mx-auto max-w-4xl" role="alert">
                    <p className="font-bold">Error Crítico</p>
                    <p>{error}</p>
                </div>
            );
        }

        switch (currentStep) {
            case 1:
                return <Step1PersonalInfo
                    formData={formData} setFormData={setFormData} departments={departments} teachers={teachers} allCourses={allCourses}
                    setSelectedCourses={setSelectedCourses} setOriginalSelectedCourses={setOriginalSelectedCourses} onNext={handleNext} onGoToStep={goToStep}
                />;
            case 2:
                return <Step2CourseSelection
                    courses={allCourses}
                    selectedCourses={selectedCourses}
                    setSelectedCourses={setSelectedCourses}
                    originalSelectedCourses={originalSelectedCourses}
                    onNext={handleNext}
                    onBack={handleBack}
                />;
            case 3:
                return <Step3Confirmation
                    formData={formData} courses={selectedCourses} originalCourses={originalSelectedCourses}
                    onBack={handleBack} onSubmit={handleSubmit}
                />;
            case 4:
                return <Step4Success
                    registrationResult={registrationResult} applicantName={formData.fullName} selectedCourses={selectedCourses} submissionType={submissionType}
                    emailSent={emailSent} emailError={emailError}
                />;
            default:
                return <div>Paso desconocido</div>;
        }
    };

    return (
        <div className="flex flex-col min-h-screen bg-gray-100">
            <main className="flex-grow">
                <Stepper currentStep={currentStep} steps={studentSteps} />
                <div className="container mx-auto px-4 sm:px-6 lg:px-8 pb-8">
                    {error && currentStep === 3 && (
                        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-md w-full max-w-4xl mx-auto" role="alert">
                            <p className="font-bold">Error al Enviar</p>
                            <p className="whitespace-pre-wrap">{error}</p>
                        </div>
                    )}
                    {renderContent()}
                </div>
            </main>
        </div>
    );
};


// =============================================================================
// == COMPONENTE STEPPER
// =============================================================================

function Stepper({
    currentStep,
    steps
}) {
    return (
        <div className="w-full max-w-5xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-8">
            <div className="flex items-start overflow-x-auto pb-2">
                {steps.map((step, index) => {
                    const isCompleted = index < currentStep - 1;
                    const isActive = index === currentStep - 1;

                    return (
                        <React.Fragment key={index}>
                            <div
                                aria-current={isActive ? 'step' : undefined}
                                className="flex flex-col items-center text-center w-1/4 min-w-[70px]"
                            >
                                <div className="relative flex items-center justify-center">
                                    <div
                                        className={`w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center z-10 rounded-full font-semibold text-white text-sm sm:text-base transition-colors duration-300 ${
                                            isCompleted ? 'bg-blue-800' : (isActive ? 'bg-blue-800' : 'bg-gray-300')
                                        }`}
                                    >
                                        {index + 1}
                                    </div>
                                    {index < steps.length - 1 && (
                                        <div className={`absolute w-full top-1/2 -translate-y-1/2 left-1/2 h-1 ${isCompleted ? 'bg-blue-800' : 'bg-gray-300'}`}></div>
                                    )}
                                </div>
                                <div className="mt-2">
                                    <p
                                        className={`text-xs sm:text-sm font-medium transition-colors duration-300 ${
                                            isCompleted || isActive ? 'text-blue-800' : 'text-gray-500'
                                        }`}
                                    >
                                        {step}
                                    </p>
                                </div>
                            </div>
                        </React.Fragment>
                    );
                })}
            </div>
        </div>
    );
};

// =============================================================================
// == MODAL DE REGISTRO EXISTENTE
// =============================================================================

function ExistingRegistrationModal({
    isOpen,
    courses,
    onModify,
    onClose,
    onDeleteCourse,
    deletingCourseId,
    onCancelAll
}) {
    useEffect(() => {
        const handleEsc = (event) => {
            if (event.key === 'Escape') onClose();
        };
        if (isOpen) {
            window.addEventListener('keydown', handleEsc);
        }
        return () => {
            window.removeEventListener('keydown', handleEsc);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
            <div role="dialog" aria-modal="true" className="relative mx-auto p-6 sm:p-8 border w-full max-w-lg shadow-lg rounded-md bg-white">
                <h3 className="text-xl sm:text-2xl font-bold text-gray-800">Ya Tienes un Registro Activo</h3>
                <div className="mt-4">
                    <p className="text-sm sm:text-base text-gray-600">
                        Hemos detectado que ya estás inscrito en los siguientes cursos. ¿Qué te gustaría hacer?
                    </p>
                    <div className="mt-4 space-y-2 bg-gray-50 p-4 rounded-md border">
                        {courses.length > 0 ? courses.map(course =>
                            <div key={course.id} className="flex items-center justify-between py-1 gap-2">
                                <span className="font-semibold text-sm sm:text-base text-gray-700 flex-1 pr-2">{course.name}</span>
                                <button
                                    onClick={() => onDeleteCourse(course.id)}
                                    disabled={!!deletingCourseId}
                                    className="p-2 rounded-full text-gray-500 hover:bg-red-100 hover:text-red-700 transition-colors disabled:opacity-50 flex-shrink-0"
                                    aria-label={`Eliminar curso ${course.name}`}
                                >
                                    {deletingCourseId === course.id ? '⏳' : '🗑️'}
                                </button>
                            </div>
                        ) : <p className="text-gray-500 italic text-sm">No tiene cursos registrados.</p>}
                    </div>
                    <p className="text-sm sm:text-base text-gray-600 mt-6">
                        Puede modificar su selección o cancelar toda su inscripción.
                    </p>
                </div>
                <div className="mt-8 flex flex-col sm:flex-row-reverse gap-3">
                    <button onClick={onModify} className="w-full sm:w-auto bg-blue-700 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-800">
                        Modificar Selección
                    </button>
                    <button onClick={onCancelAll} className="w-full sm:w-auto bg-red-700 text-white font-bold py-2 px-6 rounded-lg hover:bg-red-800">
                        Cancelar Inscripción
                    </button>
                    <button onClick={onClose} className="w-full sm:w-auto bg-gray-200 text-gray-800 font-bold py-2 px-6 rounded-lg hover:bg-gray-300">
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
};

// =============================================================================
// == COMPONENTE AUTOCOMPLETE (CON BÚSQUEDA SIN ACENTOS)
// =============================================================================

function AutocompleteInput({
    teachers,
    onSelect,
    value,
    onChange,
    name,
    placeholder,
    required = false
}) {
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

        if (currentValue && currentValue.length > 0) {
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
                name={name}
                value={value}
                onChange={handleInputChange}
                onFocus={(e) => {
                    const val = e.target.value;
                    if (val) {
                        const normalizedInput = removeAccents(val.toLowerCase());
                        const filtered = teachers.filter(t =>
                            removeAccents(t.nombreCompleto.toLowerCase()).includes(normalizedInput)
                        ).slice(0, 5);
                        setSuggestions(filtered);
                        setShowSuggestions(filtered.length > 0);
                    }
                }}
                placeholder={placeholder || "Escriba su nombre"}
                className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
                required={required}
                autoComplete="off"
            />
            {showSuggestions && suggestions.length > 0 && (
                <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md shadow-lg mt-1 max-h-60 overflow-auto">
                    {suggestions.map((teacher) =>
                        <li
                            key={teacher.curp || teacher.nombreCompleto}
                            onMouseDown={(e) => {
                                e.preventDefault();
                                handleSelect(teacher);
                            }}
                            className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm sm:text-base"
                        >
                            {teacher.nombreCompleto}
                        </li>
                    )}
                </ul>
            )}
        </div>
    );
};

// =============================================================================
// == STEP 1: INFORMACIÓN PERSONAL
// =============================================================================

function Step1PersonalInfo({
    formData,
    setFormData,
    departments,
    teachers,
    allCourses,
    setSelectedCourses,
    setOriginalSelectedCourses,
    onNext,
    onGoToStep
}) {
    const [errors, setErrors] = useState({});
    const [isCheckingCurp, setIsCheckingCurp] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [existingCourses, setExistingCourses] = useState([]);
    const [deletingCourseId, setDeletingCourseId] = useState(null);
    const lastCheckedCurp = useRef('');

    useEffect(() => {
        const checkForRegistration = async () => {
            setIsCheckingCurp(true);
            try {
                const registeredCourseIds = await getRegistrationByCurp(formData.curp);
                if (formData.curp === lastCheckedCurp.current) {
                    if (registeredCourseIds.length > 0) {
                        const preSelectedCourses = allCourses.filter(c => registeredCourseIds.includes(c.id));
                        if (preSelectedCourses.length > 0) {
                            setExistingCourses(preSelectedCourses);
                            setOriginalSelectedCourses(preSelectedCourses);
                            setIsModalOpen(true);
                        }
                    } else {
                        setExistingCourses([]);
                        setOriginalSelectedCourses([]);
                        setIsModalOpen(false);
                    }
                }
            } catch (error) {
                console.error("Error al verificar registro:", error);
            } finally {
                if (formData.curp === lastCheckedCurp.current) {
                    setIsCheckingCurp(false);
                }
            }
        };

        if (formData.curp.length === 18 && lastCheckedCurp.current !== formData.curp) {
            lastCheckedCurp.current = formData.curp;
            checkForRegistration();
        } else if (formData.curp.length !== 18) {
            lastCheckedCurp.current = '';
            setIsModalOpen(false);
        }
    }, [formData.curp, allCourses, setOriginalSelectedCourses]);

    const handleCloseModal = () => setIsModalOpen(false);
    const handleModifyRegistration = () => {
        setSelectedCourses(existingCourses);
        setOriginalSelectedCourses(existingCourses);
        setIsModalOpen(false);
        onNext();
    };
    const handleCancelAllRegistration = () => {
        setSelectedCourses([]);
        setOriginalSelectedCourses(existingCourses);
        setIsModalOpen(false);
        onGoToStep(3);
    };

    const handleDeleteCourse = async (courseIdToDelete) => {
        setDeletingCourseId(courseIdToDelete);
        try {
            const courseToDelete = existingCourses.find(c => c.id === courseIdToDelete);
            if (!courseToDelete) throw new Error("Curso no encontrado");

            await cancelSingleCourse({
                curp: formData.curp,
                email: formData.email,
                fullName: formData.fullName,
                courseToCancel: {
                    id: courseToDelete.id,
                    name: courseToDelete.name
                }
            });

            const updatedCourses = existingCourses.filter(c => c.id !== courseIdToDelete);
            setExistingCourses(updatedCourses);
            setOriginalSelectedCourses(updatedCourses);

            if (updatedCourses.length === 0) setIsModalOpen(false);
        } catch (error) {
            alert(`Error: ${error instanceof Error ? error.message : "Error al eliminar"}`);
        } finally {
            setDeletingCourseId(null);
        }
    };

    const validate = () => {
        const newErrors = {};

        if (!formData.fullName) {
            newErrors.fullName = "Campo obligatorio";
        }

        if (!formData.curp) {
            newErrors.curp = "Campo obligatorio";
        } else if (formData.curp.length !== 18) {
            newErrors.curp = "CURP debe tener 18 caracteres";
        } else if (!CURP_REGEX.test(formData.curp.toUpperCase())) {
            newErrors.curp = "CURP inválido (formato incorrecto)";
        }

        if (!formData.email) {
            newErrors.email = "Campo obligatorio";
        } else if (!/^\S+@\S+\.\S+$/.test(formData.email)) {
            newErrors.email = "Email inválido";
        }

        if (!formData.department) {
            newErrors.department = "Campo obligatorio";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (validate()) onNext();
    };

    const handleChange = (e) => {
        const {
            name,
            value
        } = e.target;
        let finalValue = value;

        if (name === 'email') finalValue = value.toLowerCase();
        else if (name === 'curp' || name === 'fullName') finalValue = value.toUpperCase();

        setFormData(prev => {
            const newState = { ...prev,
                [name]: finalValue
            };
            if (name === 'curp' && finalValue.length >= 11) {
                const genderChar = finalValue.charAt(10).toUpperCase();
                if (genderChar === 'H') newState.gender = 'Hombre';
                else if (genderChar === 'M') newState.gender = 'Mujer';
            }
            return newState;
        });
    };

    const handleTeacherSelect = (teacher) => {
        const {
            nombreCompleto,
            curp,
            email
        } = teacher;
        const upperCurp = (curp || '').toUpperCase();

        let inferredGender = 'Mujer';
        if (upperCurp.length >= 11) {
            const genderChar = upperCurp.charAt(10).toUpperCase();
            if (genderChar === 'H') inferredGender = 'Hombre';
            else if (genderChar === 'M') inferredGender = 'Mujer';
        }

        setFormData({
            ...formData,
            fullName: (nombreCompleto || '').toUpperCase(),
            curp: upperCurp,
            email: (email || '').toLowerCase(),
            gender: inferredGender,
        });
    };

    return (
        <React.Fragment>
            <ExistingRegistrationModal
                isOpen={isModalOpen}
                courses={existingCourses}
                onModify={handleModifyRegistration}
                onClose={handleCloseModal}
                onDeleteCourse={handleDeleteCourse}
                deletingCourseId={deletingCourseId}
                onCancelAll={handleCancelAllRegistration}
            />
            <div className="bg-white p-4 sm:p-6 lg:p-8 rounded-lg shadow-md w-full max-w-4xl mx-auto">
                <h2 className="text-xl sm:text-2xl font-bold mb-6 text-gray-800">Información Personal</h2>
                <form onSubmit={handleSubmit} noValidate>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Nombre Completo *</label>
                            <AutocompleteInput
                                teachers={teachers}
                                onSelect={handleTeacherSelect}
                                value={formData.fullName}
                                onChange={handleChange}
                                name="fullName"
                                required
                            />
                            {errors.fullName && <p className="text-red-500 text-xs mt-1">{errors.fullName}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">CURP *</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    name="curp"
                                    value={formData.curp}
                                    onChange={handleChange}
                                    className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
                                    placeholder="18 caracteres"
                                    maxLength={18}
                                    required
                                />
                                {isCheckingCurp && (
                                    <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900"></div>
                                    </div>
                                )}
                            </div>
                            {errors.curp && <p className="text-red-500 text-xs mt-1">{errors.curp}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Email Institucional *</label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
                                placeholder="usuario@itdurango.edu.mx"
                                required
                            />
                            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Departamento de Adscripción *</label>
                            <select
                                name="department"
                                value={formData.department}
                                onChange={handleChange}
                                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                                required
                            >
                                <option value="" disabled>Seleccione una opción</option>
                                {departments.map(dep => <option key={dep} value={dep}>{dep}</option>)}
                            </select>
                            {errors.department && <p className="text-red-500 text-xs mt-1">{errors.department}</p>}
                        </div>
                    </div>
                    <div className="mt-8 flex justify-end">
                        <button
                            type="submit"
                            className="bg-blue-800 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-900 transition-colors"
                        >
                            Siguiente →
                        </button>
                    </div>
                </form>
            </div>
        </React.Fragment>
    );
};

// =============================================================================
// == STEP 2: SELECCIÓN DE CURSOS - REDISEÑADO CON ACORDEÓN
// =============================================================================

function CourseCard({
    course,
    isSelected,
    onSelect,
    isAlreadyRegistered
}) {
    const periodColors = {
        "PERIODO_1": {
            bg: 'bg-teal-50',
            border: 'border-teal-400',
            tagBg: 'bg-teal-100',
            tagText: 'text-teal-800'
        },
        "PERIODO_2": {
            bg: 'bg-indigo-50',
            border: 'border-indigo-400',
            tagBg: 'bg-indigo-100',
            tagText: 'text-indigo-800'
        },
        "default": {
            bg: 'bg-gray-50',
            border: 'border-gray-400',
            tagBg: 'bg-gray-100',
            tagText: 'text-gray-800'
        },
    };
    const colors = periodColors[course.period] || periodColors.default;

    return (
        <label
            htmlFor={`course-${course.id}`}
            className={`block p-4 rounded-lg border-2 transition-all cursor-pointer relative overflow-hidden ${
                isSelected 
                    ? `shadow-lg ring-2 ring-blue-500 ${colors.border}` 
                    : `hover:shadow-md ${colors.border}`
            } ${colors.bg}`}
        >
            <input
                type="checkbox"
                id={`course-${course.id}`}
                checked={isSelected}
                onChange={() => onSelect(course)}
                className="absolute top-4 right-4 h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            {isAlreadyRegistered && (
                <div className="absolute top-0 left-0 bg-yellow-400 text-yellow-900 text-xs font-bold px-3 py-1" style={{clipPath: 'polygon(0 0, 100% 0, 85% 100%, 0% 100%)'}}>
                    Inscrito
                </div>
            )}
            <div className={`flex flex-col h-full ${isAlreadyRegistered ? 'pt-4' : ''}`}>
                <h3 className="font-bold text-gray-800 text-sm sm:text-base mb-3 pr-8">{course.name}</h3>
                
                <div className="space-y-2 text-xs sm:text-sm text-gray-600 mt-auto">
                    <div className="flex items-center gap-2">
                        <span title="Fechas">🗓️</span>
                        <span>{course.dates}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span title="Horario">🕒</span>
                        <span>{course.schedule}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span title="Ubicación">📍</span>
                        <span>{course.location}</span>
                    </div>
                </div>
                
                <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${colors.tagBg} ${colors.tagText}`}>
                        {course.period.replace('_', ' ')}
                    </span>
                     <span className={`px-2 py-1 text-xs font-semibold rounded-full ${colors.tagBg} ${colors.tagText}`}>
                        {course.type}
                    </span>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${colors.tagBg} ${colors.tagText}`}>
                        {course.hours} hrs
                    </span>
                </div>
            </div>
        </label>
    );
}

function AccordionSection({ title, children, isOpen, onToggle }) {
    const contentRef = useRef(null);

    return (
        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
            <button
                onClick={onToggle}
                className="w-full flex justify-between items-center p-4 text-left font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                aria-expanded={isOpen}
            >
                <span>{title}</span>
                <span className={`transform transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
                    ▼
                </span>
            </button>
            <div
                ref={contentRef}
                className="overflow-hidden transition-all duration-500 ease-in-out"
                style={{ maxHeight: isOpen ? `${contentRef.current?.scrollHeight}px` : '0px' }}
            >
                <div className="p-4">
                    {children}
                </div>
            </div>
        </div>
    );
}


function Step2CourseSelection({
    courses,
    selectedCourses,
    setSelectedCourses,
    originalSelectedCourses,
    onNext,
    onBack
}) {
    const [openAccordion, setOpenAccordion] = useState(null);

    const handleSelectCourse = (course) => {
        setSelectedCourses(prev => {
            const isSelected = prev.some(c => c.id === course.id);
            if (isSelected) {
                return prev.filter(c => c.id !== course.id);
            } else if (prev.length < 3) {
                return [...prev, course];
            }
            return prev;
        });
    };

    const groupedCourses = useMemo(() => {
        return courses.reduce((acc, course) => {
            const period = course.period || 'Sin Periodo';
            if (!acc[period]) {
                acc[period] = [];
            }
            acc[period].push(course);
            return acc;
        }, {});
    }, [courses]);
    
    // Abrir el primer periodo por defecto
    useEffect(() => {
        const firstPeriod = Object.keys(groupedCourses)[0];
        if (firstPeriod) {
            setOpenAccordion(firstPeriod);
        }
    }, [groupedCourses]);

    const toggleAccordion = (period) => {
        setOpenAccordion(prev => prev === period ? null : period);
    };

    return (
        <div className="w-full max-w-6xl mx-auto">
            <div className="bg-white p-4 sm:p-6 lg:p-8 rounded-lg shadow-md">
                <h2 className="text-xl sm:text-2xl font-bold mb-2 text-gray-800">Selección de Cursos</h2>
                <p className="text-sm text-gray-600 mb-6">
                    Puedes seleccionar hasta <strong>3 cursos</strong>. Los cursos en los que ya estabas inscrito aparecen preseleccionados.
                </p>

                {selectedCourses.length >= 3 && (
                     <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-6 rounded-md">
                        <p className="font-bold">Límite alcanzado</p>
                        <p>Has seleccionado el máximo de 3 cursos. Para elegir otro, primero deselecciona uno.</p>
                    </div>
                )}
                
                <div className="space-y-4">
                    {Object.entries(groupedCourses).map(([period, courseList]) => (
                        <AccordionSection 
                            key={period} 
                            title={period.replace(/_/g, ' ')}
                            isOpen={openAccordion === period}
                            onToggle={() => toggleAccordion(period)}
                        >
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {courseList.map(course => {
                                    const isSelected = selectedCourses.some(c => c.id === course.id);
                                    const isAlreadyRegistered = originalSelectedCourses.some(c => c.id === course.id);
                                    return (
                                        <CourseCard
                                            key={course.id}
                                            course={course}
                                            isSelected={isSelected}
                                            onSelect={handleSelectCourse}
                                            isAlreadyRegistered={isAlreadyRegistered}
                                        />
                                    );
                                })}
                            </div>
                        </AccordionSection>
                    ))}
                </div>

                <div className="mt-8 flex justify-between items-center">
                    <button
                        onClick={onBack}
                        className="bg-gray-300 text-gray-800 font-bold py-2 px-6 rounded-lg hover:bg-gray-400 transition-colors"
                    >
                        ← Atrás
                    </button>
                    <button
                        onClick={onNext}
                        className="bg-blue-800 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-900 transition-colors"
                    >
                        Siguiente →
                    </button>
                </div>
            </div>
        </div>
    );
}

// =============================================================================
// == STEP 3: CONFIRMACIÓN
// =============================================================================

function Step3Confirmation({
    formData,
    courses,
    originalCourses,
    onBack,
    onSubmit
}) {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const newlySelected = courses.filter(c => !originalCourses.some(oc => oc.id === c.id));
    const cancelled = originalCourses.filter(oc => !courses.some(c => c.id === oc.id));
    const maintained = courses.filter(c => originalCourses.some(oc => oc.id === c.id));
    
    const isModification = originalCourses.length > 0;
    const isTotalCancellation = courses.length === 0 && originalCourses.length > 0;

    const handleSubmitClick = () => {
        setIsSubmitting(true);
        onSubmit();
    };

    const renderCourseList = (courseList, title, color) => {
        if (courseList.length === 0) return null;
        return (
            <div className="mb-4">
                <h4 className={`font-semibold text-lg mb-2 text-${color}-700`}>{title}</h4>
                <ul className="list-disc list-inside space-y-1 pl-2">
                    {courseList.map(c => <li key={c.id} className="text-gray-800">{c.name}</li>)}
                </ul>
            </div>
        );
    };

    return (
        <div className="bg-white p-4 sm:p-6 lg:p-8 rounded-lg shadow-md w-full max-w-4xl mx-auto">
            <h2 className="text-xl sm:text-2xl font-bold mb-6 text-gray-800">Confirmación de Registro</h2>
            
            <div className="border border-gray-200 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-gray-700 mb-2">Resumen de su Registro</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm text-gray-600">
                    <p><strong>Nombre:</strong> {formData.fullName}</p>
                    <p><strong>Email:</strong> {formData.email}</p>
                    <p><strong>CURP:</strong> {formData.curp}</p>
                    <p><strong>Departamento:</strong> {formData.department}</p>
                    <p><strong>Género:</strong> {formData.gender}</p>
                </div>
            </div>

            <div className="border border-gray-200 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-gray-700 mb-4">Cursos Seleccionados</h3>
                {isTotalCancellation ? (
                    <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-md">
                        <p className="font-bold">¡Atención! Se cancelarán todas sus inscripciones.</p>
                        {renderCourseList(cancelled, "Cursos a cancelar:", "red")}
                    </div>
                ) : courses.length > 0 ? (
                    <div className="space-y-4">
                        {renderCourseList(maintained, "Cursos Mantenidos:", "gray")}
                        {renderCourseList(newlySelected, "Nuevos Cursos:", "green")}
                        {renderCourseList(cancelled, "Cursos Cancelados:", "red")}
                    </div>
                ) : (
                    <p className="text-gray-500 italic">No ha seleccionado ningún curso.</p>
                )}
            </div>

            <div className="mt-8 flex justify-between items-center">
                <button
                    onClick={onBack}
                    disabled={isSubmitting}
                    className="bg-gray-300 text-gray-800 font-bold py-2 px-6 rounded-lg hover:bg-gray-400 transition-colors disabled:opacity-50"
                >
                    ← Atrás
                </button>
                <button
                    onClick={handleSubmitClick}
                    disabled={isSubmitting}
                    className="bg-blue-800 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-900 transition-colors flex items-center disabled:opacity-50"
                >
                    {isSubmitting && <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>}
                    {isSubmitting ? 'Procesando...' : isTotalCancellation ? 'Confirmar Cancelación' : 'Confirmar Inscripción'}
                </button>
            </div>
        </div>
    );
};

// =============================================================================
// == STEP 4: FINALIZADO
// =============================================================================

function Step4Success({
    registrationResult,
    applicantName,
    selectedCourses,
    submissionType,
    emailSent,
    emailError
}) {
    const isTotalCancellation = submissionType === 'cancellation';
    
    return (
        <div className="bg-white p-4 sm:p-6 lg:p-8 rounded-lg shadow-md w-full max-w-4xl mx-auto text-center">
            <div className="text-6xl mb-4">{isTotalCancellation ? '🗑️' : '🎉'}</div>
            <h2 className="text-2xl sm:text-3xl font-bold mb-4 text-gray-800">
                {isTotalCancellation ? 'Cancelación Exitosa' : '¡Inscripción Exitosa!'}
            </h2>
            <p className="text-gray-600 mb-6">
                Hola {applicantName}, {isTotalCancellation 
                    ? 'hemos procesado correctamente la cancelación de tu inscripción.' 
                    : 'tu solicitud ha sido registrada con éxito.'
                }
            </p>

            {!isTotalCancellation && registrationResult.length > 0 && (
                <div className="text-left border border-gray-200 rounded-lg p-4 mb-6 space-y-4">
                    <h3 className="font-semibold text-gray-700 mb-2">Detalles de la Inscripción</h3>
                    {registrationResult.map(result => (
                        <div key={result.folio} className="border-b pb-2 last:border-b-0">
                            <p className="font-bold text-gray-800">
                                {selectedCourses.find(c => c.id === result.registrationId)?.name || 'Curso Desconocido'}
                            </p>
                            <p className="text-sm text-gray-600"><strong>Folio de Registro:</strong> {result.folio}</p>
                            <p className="text-sm text-gray-600"><strong>Fechas:</strong> {result.dates}</p>
                        </div>
                    ))}
                </div>
            )}
            
            <div className={`p-4 rounded-md text-sm ${
                emailSent 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
            }`}>
                {emailSent ? 
                    `Se ha enviado un correo de confirmación a tu email. Por favor, revisa tu bandeja de entrada (y la de spam).` :
                    `Hubo un problema al enviar el correo de confirmación. Por favor, toma una captura de esta pantalla como comprobante.`
                }
                {emailError && <p className="mt-1 font-semibold">Detalle del error: {emailError}</p>}
            </div>

            <div className="mt-8">
                <a
                    href="index.html"
                    className="bg-blue-800 text-white font-bold py-3 px-8 rounded-lg hover:bg-blue-900 transition-colors"
                >
                    Finalizar
                </a>
            </div>
        </div>
    );
};


// =============================================================================
// == INICIALIZACIÓN DE LA APP
// =============================================================================

window.addEventListener('load', () => {
    const rootElement = document.getElementById('root');
    if (rootElement) {
        const root = ReactDOM.createRoot(rootElement);
        root.render(
            <React.StrictMode>
                <App />
            </React.StrictMode>
        );
    } else {
        console.error('No se encontró el elemento root');
    }
});
