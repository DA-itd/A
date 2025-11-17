// =============================================================================
// SISTEMA DE INSCRIPCIÓN A CURSOS - INSTITUTO TECNOLÓGICO DE DURANGO
// Versión: 2.0.0 - UI/UX Mejorada
// Última actualización: Noviembre 2025
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
        
        const response = await fetch(url.toString(), { method: 'GET', mode: 'cors' });
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
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
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
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ ...payload, action: 'cancelSingle' })
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

const App = () => {
    const { useState, useEffect } = React;
    
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
                    hours: c.hours
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
            return React.createElement('div', { className: 'flex justify-center items-center h-64' },
                React.createElement('div', { className: 'animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-800' })
            );
        }
        
        if (error && currentStep !== 3) {
            return React.createElement('div', { 
                className: 'bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mx-auto max-w-4xl', 
                role: 'alert' 
            },
                React.createElement('p', { className: 'font-bold' }, 'Error Crítico'),
                React.createElement('p', null, error)
            );
        }

        switch (currentStep) {
            case 1:
                return React.createElement(Step1PersonalInfo, {
                    formData, setFormData, departments, teachers, allCourses,
                    setSelectedCourses, setOriginalSelectedCourses, onNext: handleNext, onGoToStep: goToStep
                });
            case 2:
                return React.createElement(Step2CourseSelection, {
                    courses: allCourses, 
                    selectedCourses, 
                    setSelectedCourses, 
                    originalSelectedCourses,
                    onNext: handleNext, 
                    onBack: handleBack
                });
            case 3:
                return React.createElement(Step3Confirmation, {
                    formData, courses: selectedCourses, originalCourses: originalSelectedCourses,
                    onBack: handleBack, onSubmit: handleSubmit
                });
            case 4:
                return React.createElement(Step4Success, {
                    registrationResult, applicantName: formData.fullName, selectedCourses, submissionType,
                    emailSent, emailError
                });
            default:
                return React.createElement('div', null, 'Paso desconocido');
        }
    };

    return React.createElement('div', { className: 'flex flex-col min-h-screen bg-gray-100' },
        React.createElement('main', { className: 'flex-grow' },
            React.createElement(Stepper, { currentStep, steps: studentSteps }),
            React.createElement('div', { className: 'container mx-auto px-4 sm:px-6 lg:px-8 pb-8' },
                error && currentStep === 3 && React.createElement('div', {
                    className: 'bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-md w-full max-w-4xl mx-auto',
                    role: 'alert'
                },
                    React.createElement('p', { className: 'font-bold' }, 'Error al Enviar'),
                    React.createElement('p', { className: 'whitespace-pre-wrap' }, error)
                ),
                renderContent()
            )
        )
    );
};

// =============================================================================
// == COMPONENTE STEPPER
// =============================================================================

const Stepper = ({ currentStep, steps }) => {
    return React.createElement('div', { className: 'w-full max-w-5xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-8' },
        React.createElement('div', { className: 'flex items-start overflow-x-auto pb-2' },
            steps.map((step, index) => {
                const isCompleted = index < currentStep - 1;
                const isActive = index === currentStep - 1;

                return React.createElement(React.Fragment, { key: index },
                    React.createElement('div', {
                        'aria-current': isActive ? 'step' : undefined,
                        className: `flex flex-col items-center text-center w-1/4 min-w-[70px]`
                    },
                        React.createElement('div', { className: 'relative flex items-center justify-center' },
                            React.createElement('div', {
                                className: `w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center z-10 rounded-full font-semibold text-white text-sm sm:text-base transition-colors duration-300 ${
                                    isCompleted ? 'bg-blue-800' : (isActive ? 'bg-blue-800' : 'bg-gray-300')
                                }`
                            }, index + 1),
                            index < steps.length - 1 && React.createElement('div', {
                                className: `absolute w-full top-1/2 -translate-y-1/2 left-1/2 h-1 ${isCompleted ? 'bg-blue-800' : 'bg-gray-300'}`
                            })
                        ),
                        React.createElement('div', { className: 'mt-2' },
                            React.createElement('p', {
                                className: `text-xs sm:text-sm font-medium transition-colors duration-300 ${
                                    isCompleted || isActive ? 'text-blue-800' : 'text-gray-500'
                                }`
                            }, step)
                        )
                    )
                );
            })
        )
    );
};

// =============================================================================
// == MODAL DE REGISTRO EXISTENTE
// =============================================================================

const ExistingRegistrationModal = ({ isOpen, courses, onModify, onClose, onDeleteCourse, deletingCourseId, onCancelAll }) => {
    const { useEffect } = React;
    
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

    return React.createElement('div', {
        className: 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4'
    },
        React.createElement('div', {
            role: 'dialog',
            'aria-modal': 'true',
            className: 'relative mx-auto p-6 sm:p-8 border w-full max-w-lg shadow-lg rounded-md bg-white'
        },
            React.createElement('h3', { className: 'text-xl sm:text-2xl font-bold text-gray-800' }, 
                'Ya Tienes un Registro Activo'
            ),
            React.createElement('div', { className: 'mt-4' },
                React.createElement('p', { className: 'text-sm sm:text-base text-gray-600' },
                    'Hemos detectado que ya estás inscrito en los siguientes cursos. ¿Qué te gustaría hacer?'
                ),
                React.createElement('div', { className: 'mt-4 space-y-2 bg-gray-50 p-4 rounded-md border' },
                    courses.length > 0 ? courses.map(course =>
                        React.createElement('div', {
                            key: course.id,
                            className: 'flex items-center justify-between py-1 gap-2'
                        },
                            React.createElement('span', { className: 'font-semibold text-sm sm:text-base text-gray-700 flex-1 pr-2' }, 
                                course.name
                            ),
                            React.createElement('button', {
                                onClick: () => onDeleteCourse(course.id),
                                disabled: !!deletingCourseId,
                                className: 'p-2 rounded-full text-gray-500 hover:bg-red-100 hover:text-red-700 transition-colors disabled:opacity-50 flex-shrink-0',
                                'aria-label': `Eliminar curso ${course.name}`
                            },
                                deletingCourseId === course.id ? '⏳' : '🗑️'
                            )
                        )
                    ) : React.createElement('p', { className: 'text-gray-500 italic text-sm' }, 
                        'No tiene cursos registrados.'
                    )
                ),
                React.createElement('p', { className: 'text-sm sm:text-base text-gray-600 mt-6' },
                    'Puede modificar su selección o cancelar toda su inscripción.'
                )
            ),
            React.createElement('div', { className: 'mt-8 flex flex-col sm:flex-row-reverse gap-3' },
                React.createElement('button', {
                    onClick: onModify,
                    className: 'w-full sm:w-auto bg-blue-700 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-800'
                }, 'Modificar Selección'),
                React.createElement('button', {
                    onClick: onCancelAll,
                    className: 'w-full sm:w-auto bg-red-700 text-white font-bold py-2 px-6 rounded-lg hover:bg-red-800'
                }, 'Cancelar Inscripción'),
                React.createElement('button', {
                    onClick: onClose,
                    className: 'w-full sm:w-auto bg-gray-200 text-gray-800 font-bold py-2 px-6 rounded-lg hover:bg-gray-300'
                }, 'Cerrar')
            )
        )
    );
};

// =============================================================================
// == COMPONENTE AUTOCOMPLETE (CON BÚSQUEDA SIN ACENTOS)
// =============================================================================

const AutocompleteInput = ({ teachers, onSelect, value, onChange, name, placeholder, required = false }) => {
    const { useState, useEffect, useRef } = React;
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

    return React.createElement('div', { className: 'relative', ref: containerRef },
        React.createElement('input', {
            type: 'text',
            name: name,
            value: value,
            onChange: handleInputChange,
            onFocus: (e) => {
                const val = e.target.value;
                if (val) {
                    const normalizedInput = removeAccents(val.toLowerCase());
                    const filtered = teachers.filter(t =>
                        removeAccents(t.nombreCompleto.toLowerCase()).includes(normalizedInput)
                    ).slice(0, 5);
                    setSuggestions(filtered);
                    setShowSuggestions(filtered.length > 0);
                }
            },
            placeholder: placeholder || "Escriba su nombre",
            className: 'mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base',
            required: required,
            autoComplete: 'off'
        }),
        showSuggestions && suggestions.length > 0 && React.createElement('ul', {
            className: 'absolute z-10 w-full bg-white border border-gray-300 rounded-md shadow-lg mt-1 max-h-60 overflow-auto'
        },
            suggestions.map((teacher) =>
                React.createElement('li', {
                    key: teacher.curp || teacher.nombreCompleto,
                    onMouseDown: (e) => {
                        e.preventDefault();
                        handleSelect(teacher);
                    },
                    className: 'px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm sm:text-base'
                }, teacher.nombreCompleto)
            )
        )
    );
};

// =============================================================================
// == STEP 1: INFORMACIÓN PERSONAL
// =============================================================================

const Step1PersonalInfo = ({ formData, setFormData, departments, teachers, allCourses, setSelectedCourses, setOriginalSelectedCourses, onNext, onGoToStep }) => {
    const { useState, useEffect, useRef } = React;
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
                courseToCancel: { id: courseToDelete.id, name: courseToDelete.name }
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
        const { name, value } = e.target;
        let finalValue = value;

        if (name === 'email') finalValue = value.toLowerCase();
        else if (name === 'curp' || name === 'fullName') finalValue = value.toUpperCase();

        setFormData(prev => {
            const newState = { ...prev, [name]: finalValue };
            if (name === 'curp' && finalValue.length >= 11) {
                const genderChar = finalValue.charAt(10).toUpperCase();
                if (genderChar === 'H') newState.gender = 'Hombre';
                else if (genderChar === 'M') newState.gender = 'Mujer';
            }
            return newState;
        });
    };

    const handleTeacherSelect = (teacher) => {
        const { nombreCompleto, curp, email } = teacher;
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

    return React.createElement(React.Fragment, null,
        React.createElement(ExistingRegistrationModal, {
            isOpen: isModalOpen,
            courses: existingCourses,
            onModify: handleModifyRegistration,
            onClose: handleCloseModal,
            onDeleteCourse: handleDeleteCourse,
            deletingCourseId: deletingCourseId,
            onCancelAll: handleCancelAllRegistration
        }),
        React.createElement('div', { className: 'max-w-4xl mx-auto' },
            React.createElement('a', {
                href: 'index.html',
                className: 'inline-flex items-center text-sm text-blue-600 hover:text-blue-800 hover:underline mb-4'
            }, '← Volver al Portal Principal'),
            React.createElement('div', { className: 'bg-white p-4 sm:p-6 lg:p-8 rounded-lg shadow-md' },
                React.createElement('h2', { className: 'text-xl sm:text-2xl font-bold mb-6 text-gray-800' }, 
                    'Información Personal'
                ),
                React.createElement('form', { onSubmit: handleSubmit, noValidate: true },
                    React.createElement('div', { className: 'grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6' },
                        React.createElement('div', null,
                            React.createElement('label', { className: 'block text-sm font-medium text-gray-700' }, 
                                'Nombre Completo *'
                            ),
                            React.createElement(AutocompleteInput, {
                                teachers, onSelect: handleTeacherSelect, value: formData.fullName,
                                onChange: handleChange, name: 'fullName', required: true
                            }),
                            errors.fullName && React.createElement('p', { className: 'text-red-500 text-xs mt-1' }, 
                                errors.fullName
                            )
                        ),
                        React.createElement('div', null,
                            React.createElement('label', { className: 'block text-sm font-medium text-gray-700' }, 
                                'CURP *'
                            ),
                            React.createElement('div', { className: 'relative' },
                                React.createElement('input', {
                                    type: 'text', name: 'curp', value: formData.curp, onChange: handleChange,
                                    className: 'mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base',
                                    placeholder: '18 caracteres', maxLength: 18, required: true
                                }),
                                isCheckingCurp && React.createElement('div', {
                                    className: 'absolute inset-y-0 right-0 flex items-center pr-3'
                                },
                                    React.createElement('div', { className: 'animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900' })
                                )
                            ),
                            errors.curp && React.createElement('p', { className: 'text-red-500 text-xs mt-1' }, 
                                errors.curp
                            )
                        ),
                        React.createElement('div', null,
                            React.createElement('label', { className: 'block text-sm font-medium text-gray-700' }, 
                                'Email *'
                            ),
                            React.createElement('input', {
                                type: 'email', name: 'email', value: formData.email, onChange: handleChange,
                                className: 'mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base',
                                placeholder: 'ejemplo@itdurango.edu.mx', required: true
                            }),
                            errors.email && React.createElement('p', { className: 'text-red-500 text-xs mt-1' }, 
                                errors.email
                            )
                        ),
                        React.createElement('div', null,
                            React.createElement('label', { className: 'block text-sm font-medium text-gray-700' }, 
                                'Género *'
                            ),
                            React.createElement('select', {
                                name: 'gender', value: formData.gender, onChange: handleChange,
                                className: 'mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base'
                            },
                                React.createElement('option', { value: 'Mujer' }, 'Mujer'),
                                React.createElement('option', { value: 'Hombre' }, 'Hombre')
                            )
                        ),
                        React.createElement('div', { className: 'md:col-span-2' },
                            React.createElement('label', { className: 'block text-sm font-medium text-gray-700' }, 
                                'Departamento *'
                            ),
                            React.createElement('select', {
                                name: 'department', value: formData.department, onChange: handleChange,
                                className: 'mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base'
                            },
                                React.createElement('option', { value: '', disabled: true }, 'Seleccione su departamento'),
                                departments.map(dept => React.createElement('option', { key: dept, value: dept }, dept))
                            ),
                            errors.department && React.createElement('p', { className: 'text-red-500 text-xs mt-1' }, 
                                errors.department
                            )
                        )
                    ),
                    React.createElement('div', { className: 'mt-8 flex justify-end' },
                        React.createElement('button', {
                            type: 'submit',
                            className: 'w-full sm:w-auto bg-blue-700 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-800'
                        }, 'Siguiente')
                    )
                )
            )
        )
    );
};

// =============================================================================
// == STEP 2: SELECCIÓN DE CURSOS
// =============================================================================

const Step2CourseSelection = ({ courses, selectedCourses, setSelectedCourses, originalSelectedCourses, onNext, onBack }) => {
    const { useState, useMemo } = React;
    const [searchTerm, setSearchTerm] = useState('');

    const toggleCourse = (course) => {
        setSelectedCourses(prev => {
            const isSelected = prev.some(c => c.id === course.id);
            if (isSelected) {
                return prev.filter(c => c.id !== course.id);
            } else {
                if (prev.length < 3) return [...prev, course];
                return prev;
            }
        });
    };

    const formatCourseDates = (dates) => {
        if (!dates) return '';
        return dates.split(',').map(d => d.trim()).join(' | ');
    };
    
    const filteredCourses = useMemo(() => {
        const normalizedSearch = removeAccents(searchTerm.toLowerCase());
        return courses.filter(course => 
            removeAccents(course.name.toLowerCase()).includes(normalizedSearch)
        );
    }, [searchTerm, courses]);

    const groupedCourses = useMemo(() => {
        return filteredCourses.reduce((acc, course) => {
            const period = course.period || 'Sin Periodo';
            if (!acc[period]) {
                acc[period] = {
                    courses: [],
                    dates: ''
                };
            }
            acc[period].courses.push(course);
            if (!acc[period].dates && course.dates) {
                acc[period].dates = formatCourseDates(course.dates);
            }
            return acc;
        }, {});
    }, [filteredCourses]);

    return React.createElement('div', { className: 'max-w-6xl mx-auto' },
        React.createElement('a', {
            href: 'index.html',
            className: 'inline-flex items-center text-sm text-blue-600 hover:text-blue-800 hover:underline mb-4'
        }, '← Volver al Portal Principal'),
        React.createElement('div', { className: 'bg-white p-4 sm:p-6 lg:p-8 rounded-lg shadow-md w-full' },
            React.createElement('h2', { className: 'text-xl sm:text-2xl font-bold mb-2 text-gray-800' }, 'Selección de Cursos'),
            React.createElement('p', { className: 'text-sm text-gray-600 mb-4' }, 
                `Seleccionados: ${selectedCourses.length} de 3. Límite de inscripción por docente.`
            ),
            React.createElement('input', {
                type: 'text',
                placeholder: 'Buscar curso por nombre...',
                value: searchTerm,
                onChange: (e) => setSearchTerm(e.target.value),
                className: 'w-full px-4 py-2 mb-6 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
            }),
            
            courses.length === 0 
                ? React.createElement('p', { className: 'text-red-500 text-center py-8' }, 'No hay cursos disponibles en este momento.')
                : Object.entries(groupedCourses).map(([period, data]) => {
                    const isPeriod1 = period === 'PERIODO_1';
                    const headerClass = isPeriod1 ? 'text-teal-800 border-teal-300' : 'text-indigo-800 border-indigo-300';
                    const headerIcon = isPeriod1 ? '☀️' : '🍂';

                    return React.createElement('div', { key: period, className: 'mb-8' },
                        React.createElement('h3', { className: `flex items-center gap-3 text-lg sm:text-xl font-semibold border-b-2 pb-2 mb-4 ${headerClass}` },
                            React.createElement('span', { className: 'text-2xl' }, headerIcon),
                            data.dates ? `${period.replace(/_/g, ' ')} | ${data.dates}` : period.replace(/_/g, ' ')
                        ),
                        React.createElement('div', { className: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4' },
                            data.courses.map(course => {
                                const isSelected = selectedCourses.some(c => c.id === course.id);
                                const isOriginal = originalSelectedCourses.some(c => c.id === course.id);
                                const isDisabled = !isSelected && selectedCourses.length >= 3;

                                let bgColor = isPeriod1 ? 'bg-teal-50' : 'bg-indigo-50';
                                if (isSelected) {
                                    bgColor = isOriginal ? (isPeriod1 ? 'bg-teal-200' : 'bg-indigo-200') : 'bg-green-100';
                                }
                                
                                const borderColor = isSelected 
                                    ? (isPeriod1 ? 'border-teal-600' : 'border-indigo-600') 
                                    : 'border-transparent';
                                
                                const hoverEffect = isDisabled 
                                    ? 'opacity-60 cursor-not-allowed' 
                                    : `hover:shadow-md ${isPeriod1 ? 'hover:border-teal-400' : 'hover:border-indigo-400'}`;

                                return React.createElement('div', {
                                    key: course.id,
                                    onClick: () => !isDisabled && toggleCourse(course),
                                    className: `p-4 rounded-lg border-2 transition-all ${borderColor} ${bgColor} ${hoverEffect}`
                                },
                                    React.createElement('h4', { className: 'font-bold text-sm sm:text-base text-gray-800' }, course.name),
                                    React.createElement('p', { className: 'text-xs text-gray-500 mt-2' }, `Lugar: ${course.location}`),
                                    React.createElement('p', { className: 'text-xs text-gray-500' }, `Horario: ${course.schedule}`)
                                );
                            })
                        )
                    );
                }),
            
            React.createElement('div', { className: 'mt-8 pt-6 border-t flex flex-col-reverse sm:flex-row justify-between items-center' },
                React.createElement('button', {
                    onClick: onBack,
                    className: 'mt-4 sm:mt-0 w-full sm:w-auto bg-gray-200 text-gray-800 font-bold py-2 px-6 rounded-lg hover:bg-gray-300'
                }, 'Regresar'),
                React.createElement('button', {
                    onClick: onNext,
                    className: 'w-full sm:w-auto bg-blue-700 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-800'
                }, 'Siguiente')
            )
        )
    );
};

// =============================================================================
// == STEP 3: CONFIRMACIÓN
// =============================================================================

const Step3Confirmation = ({ formData, courses, originalCourses, onBack, onSubmit }) => {
    const { useState, useMemo } = React;
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { coursesToAdd, coursesToCancel, isFullCancellation, noChanges } = useMemo(() => {
        const originalCourseIds = new Set(originalCourses.map(c => c.id));
        const selectedCourseIds = new Set(courses.map(c => c.id));

        const toAdd = courses.filter(c => !originalCourseIds.has(c.id));
        const toCancel = originalCourses.filter(c => !selectedCourseIds.has(c.id));
        
        return {
            coursesToAdd: toAdd,
            coursesToCancel: toCancel,
            isFullCancellation: courses.length === 0 && originalCourses.length > 0,
            noChanges: toAdd.length === 0 && toCancel.length === 0,
        };
    }, [courses, originalCourses]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await onSubmit();
        } catch (err) {
            // The error is handled by the parent component, but we should re-enable the button.
            setIsSubmitting(false);
        }
    };

    const renderCourseList = (courseList, title, colorClass) => {
        if (courseList.length === 0) return null;
        return React.createElement('div', { className: 'mb-4' },
            React.createElement('h4', { className: `font-semibold text-gray-700 ${colorClass}` }, title),
            React.createElement('ul', { className: 'list-disc list-inside mt-2 space-y-1 text-sm text-gray-600' },
                courseList.map(course => React.createElement('li', { key: course.id }, course.name))
            )
        );
    };

    return React.createElement('div', { className: 'max-w-4xl mx-auto' },
        React.createElement('a', {
            href: 'index.html',
            className: 'inline-flex items-center text-sm text-blue-600 hover:text-blue-800 hover:underline mb-4'
        }, '← Volver al Portal Principal'),
        React.createElement('div', { className: 'bg-white p-4 sm:p-6 lg:p-8 rounded-lg shadow-md w-full' },
            React.createElement('h2', { className: 'text-xl sm:text-2xl font-bold mb-6 text-gray-800' }, 'Confirmar Información'),
            
            // Personal Info
            React.createElement('div', { className: 'border-b pb-6 mb-6' },
                React.createElement('h3', { className: 'text-lg font-semibold mb-4 text-gray-700' }, 'Datos Personales'),
                React.createElement('div', { className: 'grid grid-cols-1 md:grid-cols-2 gap-4 text-sm' },
                    React.createElement('div', null,
                        React.createElement('p', { className: 'text-gray-500' }, 'Nombre Completo'),
                        React.createElement('p', { className: 'font-semibold text-gray-800' }, formData.fullName)
                    ),
                    React.createElement('div', null,
                        React.createElement('p', { className: 'text-gray-500' }, 'CURP'),
                        React.createElement('p', { className: 'font-semibold text-gray-800' }, formData.curp)
                    ),
                    React.createElement('div', null,
                        React.createElement('p', { className: 'text-gray-500' }, 'Email'),
                        React.createElement('p', { className: 'font-semibold text-gray-800 break-all' }, formData.email)
                    ),
                    React.createElement('div', null,
                        React.createElement('p', { className: 'text-gray-500' }, 'Departamento'),
                        React.createElement('p', { className: 'font-semibold text-gray-800' }, formData.department)
                    )
                )
            ),
            
            // Course Changes
            React.createElement('div', null,
                React.createElement('h3', { className: 'text-lg font-semibold mb-4 text-gray-700' }, 'Resumen de Inscripción'),
                isFullCancellation ?
                    React.createElement('div', { className: 'bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800 p-4 rounded-md' },
                        React.createElement('p', { className: 'font-bold' }, 'Confirmación de Cancelación Total'),
                        React.createElement('p', { className: 'text-sm mt-1' }, 'Está a punto de cancelar la inscripción a todos sus cursos. Esta acción no se puede deshacer.')
                    ) :
                noChanges ?
                    React.createElement('p', { className: 'text-gray-600' }, 'No se han realizado cambios en su selección de cursos.')
                    :
                    React.createElement('div', null,
                        renderCourseList(coursesToAdd, 'Cursos a Inscribir:', 'text-green-700'),
                        renderCourseList(coursesToCancel, 'Cursos a Cancelar:', 'text-red-700')
                    )
            ),
            
            // Navigation
            React.createElement('div', { className: 'mt-8 pt-6 border-t flex flex-col-reverse sm:flex-row justify-between items-center' },
                React.createElement('button', {
                    onClick: onBack,
                    className: 'mt-4 sm:mt-0 w-full sm:w-auto bg-gray-200 text-gray-800 font-bold py-2 px-6 rounded-lg hover:bg-gray-300'
                }, 'Regresar'),
                React.createElement('button', {
                    onClick: handleSubmit,
                    disabled: isSubmitting,
                    className: 'w-full sm:w-auto bg-blue-700 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-800 disabled:opacity-50 flex items-center justify-center'
                },
                    isSubmitting && React.createElement('div', { className: 'animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3' }),
                    isSubmitting ? 'Enviando...' : 'Confirmar y Enviar'
                )
            )
        )
    );
};

// =============================================================================
// == STEP 4: FINALIZADO
// =============================================================================

const Step4Success = ({ registrationResult, applicantName, selectedCourses, submissionType, emailSent, emailError }) => {
    const isCancellation = submissionType === 'cancellation';
    const hasNewRegistrations = registrationResult && registrationResult.length > 0;

    const title = isCancellation ? 'Cancelación Exitosa' : '¡Inscripción Exitosa!';
    const message = isCancellation
        ? `Hola ${applicantName}, hemos procesado la cancelación de tus cursos. Recibirás un correo de confirmación.`
        : `¡Felicidades, ${applicantName}! Tu inscripción ha sido procesada correctamente.`;

    return React.createElement('div', { className: 'bg-white p-6 sm:p-8 lg:p-10 rounded-lg shadow-md w-full max-w-4xl mx-auto text-center' },
        React.createElement('div', { className: 'text-6xl mb-4' }, isCancellation ? '✅' : '🎉'),
        React.createElement('h2', { className: 'text-2xl sm:text-3xl font-bold mb-4 text-gray-800' }, title),
        React.createElement('p', { className: 'text-gray-600 mb-6' }, message),
        
        hasNewRegistrations && React.createElement('div', { className: 'bg-gray-50 p-4 rounded-lg border text-left my-6' },
            React.createElement('h3', { className: 'font-semibold text-gray-700 mb-4' }, 'Cursos Inscritos:'),
            React.createElement('div', { className: 'space-y-4' },
                registrationResult.map(result => 
                    React.createElement('div', { key: result.folio, className: 'border-l-4 border-blue-500 pl-4 py-2' },
                        React.createElement('p', { className: 'font-bold text-gray-800' }, 
                            (selectedCourses.find(c => c.id === result.registrationId) || {}).name
                        ),
                        React.createElement('p', { className: 'text-sm text-gray-600' }, `Folio: ${result.folio}`),
                        React.createElement('p', { className: 'text-sm text-gray-600' }, `Fechas: ${result.dates}`)
                    )
                )
            )
        ),

        !emailSent && React.createElement('div', { 
            className: 'bg-red-100 border-l-4 border-red-500 text-red-700 p-4 my-6 rounded-md text-left' 
        },
            React.createElement('p', { className: 'font-bold' }, '⚠️ Problema al enviar el correo de confirmación.'),
            React.createElement('p', { className: 'text-sm mt-1' }, 
                'Tu inscripción fue exitosa, pero no pudimos enviarte el correo. Por favor, toma una captura de pantalla de esta página como comprobante.'
            ),
            emailError && React.createElement('p', { className: 'text-xs mt-2 text-gray-600' }, `Detalle: ${emailError}`)
        ),
        
        React.createElement('p', { className: 'text-sm text-gray-500 mt-6' }, 
            'Guarda una captura de pantalla de esta página para tu referencia. Si no recibes un correo de confirmación en breve, revisa tu carpeta de spam.'
        ),
        React.createElement('div', { className: 'mt-8' },
            React.createElement('a', {
                href: 'index.html',
                className: 'w-full sm:w-auto inline-block bg-blue-700 text-white font-bold py-3 px-8 rounded-lg hover:bg-blue-800'
            }, 'Volver al Portal Principal')
        )
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
            React.createElement(React.StrictMode, null, 
                React.createElement(App)
            )
        );
    } else {
        console.error('No se encontró el elemento root');
    }
});
