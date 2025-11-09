import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom/client';

// Fix: Add global declarations for window properties to avoid TypeScript errors.
declare global {
    interface Window {
        google: any;
        CONFIG?: {
            APPS_SCRIPT_URL: string;
        };
    }
}

// ============================================================================
// === CONSTANCIAS APP ========================================================
// ============================================================================

const ConstanciasApp = () => {
    const CONFIG = {
        GOOGLE_CLIENT_ID: '524996225715-5l95j3lces5hi49c19rfgotdrfo2seq1.apps.googleusercontent.com',
        APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbwaCOFUQFQnvuCEVJU33uNsILIGaVTuv_aREuMdqxrsKYAZ7dtYNtWxX3LdqwP614i6/exec',
    };

    const sessionManager = {
        save: (data) => localStorage.setItem('certificate_session', JSON.stringify({ ...data, timestamp: new Date().getTime() })),
        load: () => {
            const stored = localStorage.getItem('certificate_session');
            if (!stored) return null;
            const sessionData = JSON.parse(stored);
            if ((new Date().getTime() - sessionData.timestamp) / (1000 * 60) > 60) {
                localStorage.removeItem('certificate_session');
                return null;
            }
            return sessionData;
        },
        clear: () => localStorage.removeItem('certificate_session'),
    };

    const LoginStep = ({ onLogin, error }) => {
        useEffect(() => {
            if (window.google) {
                window.google.accounts.id.initialize({ client_id: CONFIG.GOOGLE_CLIENT_ID, callback: onLogin });
                window.google.accounts.id.prompt();
            }
        }, [onLogin]);

        return (
            <div className="text-center">
                <div className="text-6xl mb-4">📜</div>
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">Generador de Constancias</h2>
                <p className="text-gray-600 mt-2 max-w-2xl mx-auto">Inicia sesión con tu cuenta institucional para ver y generar las constancias de los cursos finalizados.</p>
                {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded my-6 text-left" role="alert">{error}</div>}
                <div className="mt-8">
                    <button onClick={() => window.google?.accounts.id.prompt()} className="bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 mx-auto">
                        Acceder con Google
                    </button>
                </div>
            </div>
        );
    };
    
    const CertificateCard = ({ course, onGenerate }) => {
        const [status, setStatus] = useState(course.status || 'idle'); // idle, loading, success, error
        
        const handleGenerate = async () => {
            setStatus('loading');
            try {
                await onGenerate(course.id);
                setStatus('success');
            } catch (e) {
                setStatus('error');
            }
        };
        
        const getButtonContent = () => {
            switch(status) {
                case 'loading': return 'Generando...';
                case 'success': return '✔️ Enviada al correo';
                case 'error': return '❌ Error, reintentar';
                case 'issued': return '✅ Ya generada';
                default: return 'Generar y Enviar Constancia';
            }
        };
        
        const getButtonClasses = () => {
            switch(status) {
                case 'loading': return 'bg-gray-400 cursor-not-allowed';
                case 'success': return 'bg-green-600';
                case 'error': return 'bg-red-600 hover:bg-red-700';
                case 'issued': return 'bg-gray-500';
                default: return 'bg-indigo-600 hover:bg-indigo-700';
            }
        };
        
        return (
            <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md border-l-4 border-amber-500">
                <h3 className="text-lg font-bold text-gray-900 mb-3">{course.name}</h3>
                <button onClick={handleGenerate} disabled={status === 'loading' || status === 'success' || status === 'issued'}
                    className={`w-full text-center font-semibold py-2 px-4 rounded-md transition-colors flex items-center justify-center gap-2 text-white ${getButtonClasses()}`}>
                    {getButtonContent()}
                </button>
            </div>
        );
    };

    const CertificateListStep = ({ teacherData, eligibleCourses, onLogout, onGenerate }) => (
        <div>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">Constancias Disponibles</h2>
                    <p className="text-gray-600 mt-1">Hola, <strong>{teacherData.fullName}</strong>.</p>
                </div>
                <button onClick={onLogout} className="text-sm bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded-lg">Cerrar Sesión</button>
            </div>

            <div className="space-y-6">
                {eligibleCourses.length > 0 ? (
                    eligibleCourses.map(course => <CertificateCard key={course.id} course={course} onGenerate={onGenerate} />)
                ) : (
                    <div className="text-center bg-blue-50 text-blue-800 p-6 rounded-lg">
                        <div className="text-5xl mb-3">👍</div>
                        <p className="font-semibold">No tienes constancias pendientes por generar.</p>
                        <p>Asegúrate de haber contestado la encuesta de opinión del curso correspondiente.</p>
                    </div>
                )}
            </div>
        </div>
    );

    const CertificateApp = () => {
        const [step, setStep] = useState('loading');
        const [error, setError] = useState(null);
        const [appData, setAppData] = useState({ teacherData: null, eligibleCourses: [] });

        const fetchEligibleCourses = useCallback(async (email) => {
            setError(null);
            try {
                const url = new URL(CONFIG.APPS_SCRIPT_URL);
                url.searchParams.append('action', 'getEligibleCoursesForCertificate');
                url.searchParams.append('email', email);
                const response = await fetch(url.toString());
                const result = await response.json();

                if (result.success && result.data) {
                    setAppData(result.data);
                    setStep('list');
                    return result.data.teacherData;
                } else {
                    throw new Error(result.message || 'No se pudieron cargar los datos.');
                }
            } catch (err) {
                setError(err.message);
                sessionManager.clear();
                setStep('login');
                return null;
            }
        }, []);

        const handleLogin = useCallback(async (response) => {
            if (window.google && response.credential) {
                const decodedToken = JSON.parse(atob(response.credential.split('.')[1]));
                if (!decodedToken?.email?.endsWith('@itdurango.edu.mx')) {
                    setError("Por favor, inicie sesión con una cuenta institucional.");
                    setStep('login');
                    return;
                }
                
                const teacherData = await fetchEligibleCourses(decodedToken.email);
                if (teacherData) {
                    sessionManager.save({ ...teacherData, email: decodedToken.email });
                }
            }
        }, [fetchEligibleCourses]);

        useEffect(() => {
            const session = sessionManager.load();
            if (session?.email) {
                fetchEligibleCourses(session.email);
            } else {
                setStep('login');
            }
        }, [fetchEligibleCourses]);

        const handleLogout = () => {
            sessionManager.clear();
            window.google?.accounts.id.disableAutoSelect();
            window.location.reload();
        };

        const handleGenerate = async (courseId) => {
            const session = sessionManager.load();
            if (!session?.email) throw new Error("No hay sesión activa.");
            
            const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
                method: 'POST',
                mode: 'cors',
                body: JSON.stringify({ action: 'generateAndEmailCertificate', email: session.email, courseId })
            });
            const result = await response.json();
            if (!result.success) throw new Error(result.message || 'Error en el servidor.');
            return true;
        };
        
        const renderContent = () => {
            switch(step) {
                case 'loading': return <div className="text-center p-8">Cargando...</div>;
                case 'login': return <LoginStep onLogin={handleLogin} error={error} />;
                case 'list': return <CertificateListStep teacherData={appData.teacherData} eligibleCourses={appData.eligibleCourses} onLogout={handleLogout} onGenerate={handleGenerate} />;
                default: return <LoginStep onLogin={handleLogin} error={"Ocurrió un error inesperado."} />;
            }
        };

        return (
            <main className="container mx-auto px-4 py-8 sm:py-12">
                <div className="max-w-3xl mx-auto">
                    <a href="index.html" className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 hover:underline mb-8">← Volver al Portal Principal</a>
                    <div className="bg-white rounded-lg shadow-xl p-6 sm:p-8">{renderContent()}</div>
                </div>
            </main>
        );
    };
    
    return <CertificateApp />;
};


// ============================================================================
// === TYPE DEFINITIONS for InscripcionesApp ==================================
// ============================================================================

interface Course {
    id: string;
    name: string;
    dates: string;
    period: string;
    hours: number;
    location: string;
    schedule: string;
    type: string;
}

interface Teacher {
    nombreCompleto: string;
    curp: string;
    email: string;
}

interface FormData {
    fullName: string;
    curp: string;
    email: string;
    gender: string;
    department: string;
    selectedCourses: Course[];
}

// ============================================================================
// === INSCRIPCIONES APP ======================================================
// ============================================================================
const InscripcionesApp = () => {
    // This is the refactored code from the original index.js file
    const { useState, useEffect, useRef, useCallback, useMemo } = React;

    const COURSES_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSAe4dmVN4CArjEy_lvI5qrXf16naxZLO1lAxGm2Pj4TrdnoebBg03Vv4-DCXciAkHJFiZaBMKletUs/pub?gid=0&single=true&output=csv';
    const TEACHERS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSAe4dmVN4CArjEy_lvI5qrXf16naxZLO1lAxGm2Pj4TrdnoebBg03Vv4-DCXciAkHJFiZaBMKletUs/pub?gid=987931491&single=true&output=csv';
    const CURP_REGEX = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[0-9A-Z]\d$/;
    const MOCK_DEPARTMENTS = [ "DEPARTAMENTO DE SISTEMAS Y COMPUTACION", "DEPARTAMENTO DE INGENIERÍA ELÉCTRICA Y ELECTRÓNICA", "DEPARTAMENTO DE CIENCIAS ECONOMICO-ADMINISTRATIVAS", "DEPARTAMENTO DE INGENIERÍA QUÍMICA-BIOQUÍMICA", "DEPARTAMENTO DE CIENCIAS DE LA TIERRA", "DEPARTAMENTO DE CIENCIAS BASICAS", "DEPARTAMENTO DE METAL-MECÁNICA", "DEPARTAMENTO DE INGENIERÍA INDUSTRIAL", "DIVISION DE ESTUDIOS DE POSGRADO E INVESTIGACION", "ADMINISTRATIVO", "EXTERNO" ];

    const removeAccents = (text) => {
        if (!text) return '';
        return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    };
    const parseCSVLine = (line) => {
        const result = []; let current = ''; let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') { current += '"'; i++; } else { inQuotes = !inQuotes; }
            } else if (char === ',' && !inQuotes) { result.push(current.trim()); current = ''; } else { current += char; }
        }
        result.push(current.trim()); return result;
    };
    const cleanCSVValue = (val) => {
        let cleaned = val.trim();
        if (cleaned.startsWith('"') && cleaned.endsWith('"')) { cleaned = cleaned.substring(1, cleaned.length - 1).replace(/""/g, '"'); }
        return cleaned;
    };
    const getTeachers = async (): Promise<Teacher[]> => {
        try {
            const response = await fetch(`${TEACHERS_CSV_URL}&_=${Date.now()}`);
            if (!response.ok) throw new Error('Error al cargar docentes');
            const csvText = await response.text(); const lines = csvText.trim().split(/\r?\n/);
            return lines.slice(1).filter(line => line.trim()).map(line => {
                const values = parseCSVLine(line); if (values.length < 3) return null;
                return { nombreCompleto: cleanCSVValue(values[0]), curp: cleanCSVValue(values[1]), email: cleanCSVValue(values[2]) };
            }).filter((teacher): teacher is Teacher => teacher !== null);
        } catch (error) { console.error("Error al obtener docentes:", error); return []; }
    };
    const getCourses = async (): Promise<Course[]> => {
        try {
            const response = await fetch(`${COURSES_CSV_URL}&_=${Date.now()}`);
            if (!response.ok) throw new Error('Error al cargar cursos');
            const csvText = await response.text(); const lines = csvText.trim().split(/\r?\n/);
            return lines.slice(1).filter(line => line.trim()).map(line => {
                const values = parseCSVLine(line); if (values.length < 8) return null;
                const hours = parseInt(cleanCSVValue(values[4]), 10);
                return { id: cleanCSVValue(values[0]), name: cleanCSVValue(values[1]), dates: cleanCSVValue(values[2]), period: cleanCSVValue(values[3]), hours: isNaN(hours) ? 30 : hours, location: cleanCSVValue(values[5]), schedule: cleanCSVValue(values[6]), type: cleanCSVValue(values[7]) };
            }).filter((course): course is Course => course !== null);
        } catch (error) { console.error("Error al obtener cursos:", error); return []; }
    };
    const getDepartments = () => Promise.resolve(MOCK_DEPARTMENTS);
    const getRegistrationByCurp = async (curp) => {
        const APPS_SCRIPT_URL = window.CONFIG?.APPS_SCRIPT_URL; if (!APPS_SCRIPT_URL) throw new Error("URL no configurada");
        try {
            const url = new URL(APPS_SCRIPT_URL);
            url.searchParams.append('action', 'lookupByCurp'); url.searchParams.append('curp', curp.toUpperCase()); url.searchParams.append('_', Date.now().toString());
            const response = await fetch(url.toString(), { method: 'GET', mode: 'cors' });
            const result = await response.json();
            if (result?.success && result.data?.registeredCourses) { return result.data.registeredCourses; }
            return [];
        } catch (error) { console.error("Error al buscar CURP:", error); return []; }
    };
    const submitRegistration = async (submission) => {
        const APPS_SCRIPT_URL = window.CONFIG?.APPS_SCRIPT_URL; if (!APPS_SCRIPT_URL) throw new Error("URL de configuración no disponible");
        try {
            const response = await fetch(APPS_SCRIPT_URL, { method: 'POST', mode: 'cors', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(submission) });
            const result = await response.json();
            if (result?.success) { return result.data; } else { throw new Error(result.message || 'Error en el servidor'); }
        } catch (error) {
            console.error("Error al enviar registro:", error);
            if (error instanceof Error && error.message !== 'Failed to fetch') { throw error; }
            throw new Error("No se pudo comunicar con el servidor.\n\nPosibles causas:\n1. URL del script incorrecta\n2. Script sin permisos públicos\n3. Problema de conexión");
        }
    };
    const cancelSingleCourse = async (payload) => {
        const APPS_SCRIPT_URL = window.CONFIG?.APPS_SCRIPT_URL; if (!APPS_SCRIPT_URL) throw new Error("URL no disponible");
        try {
            const response = await fetch(APPS_SCRIPT_URL, { method: 'POST', mode: 'cors', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ ...payload, action: 'cancelSingle' }) });
            const result = await response.json();
            if (!result?.success) { throw new Error(result.message || 'Error al cancelar'); }
        } catch (error) { throw new Error("No se pudo cancelar el curso."); }
    };
    
    // Components start here
    const Stepper = ({ currentStep, steps }) => (
        <div className='w-full max-w-5xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-8'>
            <div className='flex items-start overflow-x-auto pb-2'>
                {steps.map((step, index) => {
                    const isCompleted = index < currentStep - 1;
                    const isActive = index === currentStep - 1;
                    return (
                        <React.Fragment key={index}>
                            <div aria-current={isActive ? 'step' : undefined} className='flex flex-col items-center text-center w-1/4 min-w-[70px]'>
                                <div className='relative flex items-center justify-center'>
                                    <div className={`w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center z-10 rounded-full font-semibold text-white text-sm sm:text-base transition-colors duration-300 ${isCompleted ? 'bg-blue-800' : (isActive ? 'bg-blue-800' : 'bg-gray-300')}`}>
                                        {index + 1}
                                    </div>
                                    {index < steps.length - 1 && <div className={`absolute w-full top-1/2 -translate-y-1/2 left-1/2 h-1 ${isCompleted ? 'bg-blue-800' : 'bg-gray-300'}`}></div>}
                                </div>
                                <div className='mt-2'>
                                    <p className={`text-xs sm:text-sm font-medium transition-colors duration-300 ${isCompleted || isActive ? 'text-blue-800' : 'text-gray-500'}`}>{step}</p>
                                </div>
                            </div>
                        </React.Fragment>
                    );
                })}
            </div>
        </div>
    );
    const ExistingRegistrationModal = ({ isOpen, courses, onModify, onClose, onDeleteCourse, deletingCourseId, onCancelAll }) => {
        useEffect(() => {
            const handleEsc = (event) => { if (event.key === 'Escape') onClose(); };
            if (isOpen) { window.addEventListener('keydown', handleEsc); }
            return () => { window.removeEventListener('keydown', handleEsc); };
        }, [isOpen, onClose]);
        if (!isOpen) return null;
        return (
            <div className='fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4'>
                <div role='dialog' aria-modal='true' className='relative mx-auto p-6 sm:p-8 border w-full max-w-lg shadow-lg rounded-md bg-white'>
                    <h3 className='text-xl sm:text-2xl font-bold text-gray-800'>Ya Tienes un Registro Activo</h3>
                    <div className='mt-4'>
                        <p className='text-sm sm:text-base text-gray-600'>Hemos detectado que ya estás inscrito en los siguientes cursos. ¿Qué te gustaría hacer?</p>
                        <div className='mt-4 space-y-2 bg-gray-50 p-4 rounded-md border'>
                            {courses.length > 0 ? courses.map(course => (
                                <div key={course.id} className='flex items-center justify-between py-1 gap-2'>
                                    <span className='font-semibold text-sm sm:text-base text-gray-700 flex-1 pr-2'>{course.name}</span>
                                    <button onClick={() => onDeleteCourse(course.id)} disabled={!!deletingCourseId} className='p-2 rounded-full text-gray-500 hover:bg-red-100 hover:text-red-700 transition-colors disabled:opacity-50 flex-shrink-0' aria-label={`Eliminar curso ${course.name}`}>
                                        {deletingCourseId === course.id ? '⏳' : '🗑️'}
                                    </button>
                                </div>
                            )) : <p className='text-gray-500 italic text-sm'>No tiene cursos registrados.</p>}
                        </div>
                        <p className='text-sm sm:text-base text-gray-600 mt-6'>Puede modificar su selección o cancelar toda su inscripción.</p>
                    </div>
                    <div className='mt-8 flex flex-col sm:flex-row-reverse gap-3'>
                        <button onClick={onModify} className='w-full sm:w-auto bg-blue-700 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-800'>Modificar Selección</button>
                        <button onClick={onCancelAll} className='w-full sm:w-auto bg-red-700 text-white font-bold py-2 px-6 rounded-lg hover:bg-red-800'>Cancelar Inscripción</button>
                        <button onClick={onClose} className='w-full sm:w-auto bg-gray-200 text-gray-800 font-bold py-2 px-6 rounded-lg hover:bg-gray-300'>Cerrar</button>
                    </div>
                </div>
            </div>
        );
    };
    
    // Fix: Define props for AutocompleteInput and make placeholder optional.
    interface AutocompleteInputProps {
        teachers: Teacher[];
        onSelect: (teacher: Teacher) => void;
        value: string;
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
        name: string;
        placeholder?: string;
        required?: boolean;
    }
    const AutocompleteInput: React.FC<AutocompleteInputProps> = ({ teachers, onSelect, value, onChange, name, placeholder, required = false }) => {
        const [suggestions, setSuggestions] = useState<Teacher[]>([]); const [showSuggestions, setShowSuggestions] = useState(false); const containerRef = useRef(null);
        useEffect(() => {
            const handleClickOutside = (event) => { if (containerRef.current && !containerRef.current.contains(event.target)) { setShowSuggestions(false); } };
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }, []);
        const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const currentValue = e.target.value; onChange(e);
            if (currentValue && currentValue.length > 0) {
                const normalizedInput = removeAccents(currentValue.toLowerCase());
                const filtered = teachers.filter(teacher => removeAccents(teacher.nombreCompleto.toLowerCase()).includes(normalizedInput)).slice(0, 5);
                setSuggestions(filtered); setShowSuggestions(filtered.length > 0);
            } else { setSuggestions([]); setShowSuggestions(false); }
        };
        const handleSelect = (teacher: Teacher) => { onSelect(teacher); setShowSuggestions(false); };
        return (
            <div className='relative' ref={containerRef}>
                <input type='text' name={name} value={value} onChange={handleInputChange} onFocus={(e) => {
                    const val = e.target.value;
                    if (val) {
                        const normalizedInput = removeAccents(val.toLowerCase());
                        const filtered = teachers.filter(t => removeAccents(t.nombreCompleto.toLowerCase()).includes(normalizedInput)).slice(0, 5);
                        setSuggestions(filtered); setShowSuggestions(filtered.length > 0);
                    }
                }} placeholder={placeholder || "Escriba su nombre"} className='mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base' required={required} autoComplete='off' />
                {showSuggestions && suggestions.length > 0 && <ul className='absolute z-10 w-full bg-white border border-gray-300 rounded-md shadow-lg mt-1 max-h-60 overflow-auto'>
                    {suggestions.map((teacher) => <li key={teacher.curp || teacher.nombreCompleto} onMouseDown={(e) => { e.preventDefault(); handleSelect(teacher); }} className='px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm sm:text-base'>{teacher.nombreCompleto}</li>)}
                </ul>}
            </div>
        );
    };
    const Step1PersonalInfo = ({ formData, setFormData, departments, teachers, allCourses, setSelectedCourses, setOriginalSelectedCourses, onNext, onGoToStep }) => {
        // Fix: Type state for errors to avoid property access errors.
        const [errors, setErrors] = useState<{ [key: string]: string }>({}); const [isCheckingCurp, setIsCheckingCurp] = useState(false); const [isModalOpen, setIsModalOpen] = useState(false); const [existingCourses, setExistingCourses] = useState<Course[]>([]); const [deletingCourseId, setDeletingCourseId] = useState(null); const lastCheckedCurp = useRef('');
        useEffect(() => {
            const checkForRegistration = async () => {
                setIsCheckingCurp(true);
                try {
                    const registeredCourseIds = await getRegistrationByCurp(formData.curp);
                    if (formData.curp === lastCheckedCurp.current) {
                        if (registeredCourseIds.length > 0) {
                            const preSelectedCourses = allCourses.filter(c => registeredCourseIds.includes(c.id));
                            if (preSelectedCourses.length > 0) { setExistingCourses(preSelectedCourses); setOriginalSelectedCourses(preSelectedCourses); setIsModalOpen(true); }
                        } else { setExistingCourses([]); setOriginalSelectedCourses([]); setIsModalOpen(false); }
                    }
                } catch (error) { console.error("Error al verificar registro:", error); } finally { if (formData.curp === lastCheckedCurp.current) { setIsCheckingCurp(false); } }
            };
            if (formData.curp.length === 18 && lastCheckedCurp.current !== formData.curp) { lastCheckedCurp.current = formData.curp; checkForRegistration(); } else if (formData.curp.length !== 18) { lastCheckedCurp.current = ''; setIsModalOpen(false); }
        }, [formData.curp, allCourses, setOriginalSelectedCourses]);
        const handleCloseModal = () => setIsModalOpen(false);
        const handleModifyRegistration = () => { setSelectedCourses(existingCourses); setOriginalSelectedCourses(existingCourses); setIsModalOpen(false); onNext(); };
        const handleCancelAllRegistration = () => { setSelectedCourses([]); setOriginalSelectedCourses(existingCourses); setIsModalOpen(false); onGoToStep(3); };
        const handleDeleteCourse = async (courseIdToDelete) => {
            setDeletingCourseId(courseIdToDelete);
            try {
                const courseToDelete = existingCourses.find(c => c.id === courseIdToDelete);
                if (!courseToDelete) throw new Error("Curso no encontrado");
                await cancelSingleCourse({ curp: formData.curp, email: formData.email, fullName: formData.fullName, courseToCancel: { id: courseToDelete.id, name: courseToDelete.name } });
                const updatedCourses = existingCourses.filter(c => c.id !== courseIdToDelete);
                setExistingCourses(updatedCourses); setOriginalSelectedCourses(updatedCourses);
                if (updatedCourses.length === 0) setIsModalOpen(false);
            } catch (error) { alert(`Error: ${error instanceof Error ? error.message : "Error al eliminar"}`); } finally { setDeletingCourseId(null); }
        };
        const validate = () => {
            // Fix: Type newErrors object to allow dynamic property assignment.
            const newErrors: { [key: string]: string } = {};
            if (!formData.fullName) { newErrors.fullName = "Campo obligatorio"; }
            if (!formData.curp) { newErrors.curp = "Campo obligatorio"; } else if (formData.curp.length !== 18) { newErrors.curp = "CURP debe tener 18 caracteres"; } else if (!CURP_REGEX.test(formData.curp.toUpperCase())) { newErrors.curp = "CURP inválido (formato incorrecto)"; }
            if (!formData.email) { newErrors.email = "Campo obligatorio"; } else if (!/^\S+@\S+\.\S+$/.test(formData.email)) { newErrors.email = "Email inválido"; }
            if (!formData.department) { newErrors.department = "Campo obligatorio"; }
            setErrors(newErrors); return Object.keys(newErrors).length === 0;
        };
        const handleSubmit = (e) => { e.preventDefault(); if (validate()) onNext(); };
        const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
            const { name, value } = e.target; let finalValue = value;
            if (name === 'email') finalValue = value.toLowerCase(); else if (name === 'curp' || name === 'fullName') finalValue = value.toUpperCase();
            setFormData(prev => {
                const newState = { ...prev, [name]: finalValue };
                if (name === 'curp' && finalValue.length >= 11) { const genderChar = finalValue.charAt(10).toUpperCase(); if (genderChar === 'H') newState.gender = 'Hombre'; else if (genderChar === 'M') newState.gender = 'Mujer'; }
                return newState;
            });
        };
        const handleTeacherSelect = (teacher: Teacher) => {
            const { nombreCompleto, curp, email } = teacher; const upperCurp = (curp || '').toUpperCase();
            let inferredGender = 'Mujer';
            if (upperCurp.length >= 11) { const genderChar = upperCurp.charAt(10).toUpperCase(); if (genderChar === 'H') inferredGender = 'Hombre'; else if (genderChar === 'M') inferredGender = 'Mujer'; }
            setFormData({ ...formData, fullName: (nombreCompleto || '').toUpperCase(), curp: upperCurp, email: (email || '').toLowerCase(), gender: inferredGender, });
        };
        return (
            <React.Fragment>
                <ExistingRegistrationModal isOpen={isModalOpen} courses={existingCourses} onModify={handleModifyRegistration} onClose={handleCloseModal} onDeleteCourse={handleDeleteCourse} deletingCourseId={deletingCourseId} onCancelAll={handleCancelAllRegistration} />
                <div className='bg-white p-4 sm:p-6 lg:p-8 rounded-lg shadow-md w-full max-w-4xl mx-auto'>
                    <h2 className='text-xl sm:text-2xl font-bold mb-6 text-gray-800'>Información Personal</h2>
                    <form onSubmit={handleSubmit} noValidate={true}>
                        <div className='grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6'>
                            <div>
                                <label className='block text-sm font-medium text-gray-700'>Nombre Completo *</label>
                                <AutocompleteInput teachers={teachers} onSelect={handleTeacherSelect} value={formData.fullName} onChange={handleChange} name='fullName' required={true} />
                                {errors.fullName && <p className='text-red-500 text-xs mt-1'>{errors.fullName}</p>}
                            </div>
                            <div>
                                <label className='block text-sm font-medium text-gray-700'>CURP *</label>
                                <div className='relative'>
                                    <input type='text' name='curp' value={formData.curp} onChange={handleChange} className='mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base' placeholder='18 caracteres' maxLength={18} required={true} />
                                    {isCheckingCurp && <div className='absolute inset-y-0 right-0 flex items-center pr-3'><div className='animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900'></div></div>}
                                </div>
                                {errors.curp && <p className='text-red-500 text-xs mt-1'>{errors.curp}</p>}
                            </div>
                            <div>
                                <label className='block text-sm font-medium text-gray-700'>Email Institucional *</label>
                                <input type='email' name='email' value={formData.email} onChange={handleChange} className='mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base' placeholder='email@itdurango.edu.mx' required={true} />
                                {errors.email && <p className='text-red-500 text-xs mt-1'>{errors.email}</p>}
                            </div>
                            <div>
                                <label className='block text-sm font-medium text-gray-700'>Género *</label>
                                <select name='gender' value={formData.gender} onChange={handleChange} className='mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base' required={true}>
                                    <option>Mujer</option><option>Hombre</option><option>Otro</option>
                                </select>
                            </div>
                            <div className='md:col-span-2'>
                                <label className='block text-sm font-medium text-gray-700'>Departamento *</label>
                                <select name='department' value={formData.department} onChange={handleChange} className='mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base' required={true}>
                                    <option value=''>Seleccione un departamento</option>
                                    {departments.map(dep => <option key={dep} value={dep}>{dep}</option>)}
                                </select>
                                {errors.department && <p className='text-red-500 text-xs mt-1'>{errors.department}</p>}
                            </div>
                        </div>
                        <div className='mt-8 flex justify-end'>
                            <button type='submit' className='w-full sm:w-auto bg-blue-700 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-800'>Continuar</button>
                        </div>
                    </form>
                </div>
            </React.Fragment>
        );
    };
    const Step2CourseSelection = ({ courses, selectedCourses, setSelectedCourses, originalSelectedCourses, onNext, onBack }) => {
        const [error, setError] = useState(null); const [searchTerm, setSearchTerm] = useState(''); const [filterPeriod, setFilterPeriod] = useState('all'); const [filterType, setFilterType] = useState('all');
        const availablePeriods = useMemo(() => [...new Set(courses.map(c => c.period).filter(Boolean))], [courses]);
        const availableTypes = useMemo(() => [...new Set(courses.map(c => c.type).filter(Boolean))], [courses]);
        const schedulesOverlap = (course1, course2) => {
            if (!course1.dates || !course2.dates || course1.dates !== course2.dates) return false;
            if (!course1.schedule || !course2.schedule) return false;
            const parseTime = (schedule) => { const matches = schedule.match(/(\d{1,2}:\d{2})/g); if (!matches || matches.length < 2) return null; return [parseInt(matches[0].replace(':', ''), 10), parseInt(matches[1].replace(':', ''), 10)]; };
            const time1 = parseTime(course1.schedule); const time2 = parseTime(course2.schedule); if (!time1 || !time2) return false;
            return time1[0] < time2[1] && time2[0] < time1[1];
        };
        const handleSelectCourse = (course) => {
            const isSelected = selectedCourses.some(c => c.id === course.id); let newSelection = [...selectedCourses]; setError(null);
            if (isSelected) { newSelection = newSelection.filter(c => c.id !== course.id); } else {
                if (selectedCourses.length >= 3) { setError("No puede seleccionar más de 3 cursos."); return; }
                if (selectedCourses.some(selected => schedulesOverlap(selected, course))) { setError("El horario de este curso se solapa con otra selección."); return; }
                newSelection.push(course);
            }
            setSelectedCourses(newSelection);
        };
        const handleSubmit = (e) => { e.preventDefault(); const isTotalCancellation = selectedCourses.length === 0 && originalSelectedCourses && originalSelectedCourses.length > 0; if (selectedCourses.length > 0 || isTotalCancellation) { onNext(); } else { setError("Debe seleccionar al menos un curso."); } };
        const filteredCourses = useMemo(() => {
            return courses.filter(course => {
                const searchMatch = removeAccents(course.name.toLowerCase()).includes(removeAccents(searchTerm.toLowerCase()));
                const periodMatch = filterPeriod === 'all' || course.period === filterPeriod;
                const typeMatch = filterType === 'all' || course.type === filterType;
                return searchMatch && periodMatch && typeMatch;
            });
        }, [courses, searchTerm, filterPeriod, filterType]);
        const CheckmarkIcon = () => <svg className='h-3 w-3 sm:h-4 sm:w-4 text-white' fill='none' viewBox='0 0 24 24' stroke='currentColor'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth='3' d='M5 13l4 4L19 7' /></svg>;
        return (
            <div className='bg-white p-4 sm:p-6 lg:p-8 rounded-lg shadow-md w-full max-w-7xl mx-auto'>
                <h2 className='text-xl sm:text-2xl font-bold mb-2 text-gray-800'>Selección de Cursos</h2>
                <p className='text-sm sm:text-base text-gray-600 mb-6'>Seleccione hasta 3 cursos. No puede inscribir cursos con horarios que se solapen.</p>
                <div className='flex flex-col lg:flex-row gap-8'>
                    <div className='flex-grow lg:w-2/3'>
                        <div className='mb-6 grid grid-cols-1 sm:grid-cols-3 gap-4 items-center bg-gray-50 p-4 rounded-lg'>
                            <input type='text' placeholder='🔍 Buscar por nombre...' className='sm:col-span-3 lg:col-span-1 w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm' value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                            <select className='w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm' value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)}>
                                <option value='all'>Todos los Periodos</option>{
                                    // Fix: Explicitly convert mapped period to string to handle 'unknown' type and allow string operations.
                                    availablePeriods.map(p => <option key={String(p)} value={String(p)}>{String(p).replace(/_/g, ' ')}</option>)
                                }
                            </select>
                            <select className='w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm' value={filterType} onChange={e => setFilterType(e.target.value)}>
                                <option value='all'>Todos los Tipos</option>{
                                    // Fix: Explicitly convert mapped type to string to handle 'unknown' type.
                                    availableTypes.map(t => <option key={String(t)} value={String(t)}>{String(t)}</option>)
                                }
                            </select>
                        </div>
                        {error && <div className='bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-md' role='alert'><p className='text-sm sm:text-base'>{error}</p></div>}
                        {filteredCourses.length > 0 ? <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                            {filteredCourses.map(course => {
                                const isSelected = selectedCourses.some(c => c.id === course.id); const hasConflict = !isSelected && selectedCourses.some(selected => schedulesOverlap(selected, course)); const hasReachedMax = !isSelected && selectedCourses.length >= 3; const isDisabled = hasConflict || hasReachedMax;
                                const baseStyles = course.period === 'PERIODO_1' ? 'border-teal-300 bg-teal-50' : 'border-indigo-300 bg-indigo-50';
                                const checkedStyles = isSelected ? (course.period === 'PERIODO_1' ? 'ring-2 ring-offset-2 ring-teal-500' : 'ring-2 ring-offset-2 ring-indigo-500') : 'hover:shadow-md';
                                return (
                                    <div key={course.id} className='relative h-full'>
                                        <input type='checkbox' id={`course-${course.id}`} checked={isSelected} disabled={isDisabled} onChange={() => handleSelectCourse(course)} className='sr-only peer' />
                                        <label htmlFor={`course-${course.id}`} className={`p-4 rounded-lg border-2 transition-all flex flex-col h-full ${baseStyles} ${isDisabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'} ${checkedStyles}`}>
                                            <div className='flex-grow'>
                                                <div className='flex justify-between items-start'>
                                                    <h3 className='font-bold text-sm mb-3 pr-4 text-gray-800'>{course.name}</h3>
                                                    <div className={`flex-shrink-0 h-5 w-5 sm:h-6 sm:w-6 border-2 rounded-md flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-400'}`}>{isSelected && <CheckmarkIcon />}</div>
                                                </div>
                                                <div className='text-xs text-gray-700 space-y-2'>
                                                    <p><span>📅</span> <strong>Fechas: </strong>{course.dates}</p>
                                                    <p><span>🕒</span> <strong>Horario: </strong>{course.schedule}</p>
                                                    <p><span>📍</span> <strong>Lugar: </strong>{course.location}</p>
                                                    <p><span>💻</span> <strong>Tipo: </strong>{course.type}</p>
                                                </div>
                                            </div>
                                            <div className='mt-3 text-right'><span className={`px-2 py-1 text-xs font-semibold rounded-full ${course.period === 'PERIODO_1' ? 'bg-teal-200 text-teal-800' : 'bg-indigo-200 text-indigo-800'}`}>{course.period.replace('_', ' ')}</span></div>
                                        </label>
                                        {hasConflict && <div className='absolute inset-0 bg-yellow-200 bg-opacity-80 flex items-center justify-center p-2 rounded-lg'><p className='text-xs font-bold text-yellow-800 text-center'>⚠️<br />Conflicto de horario</p></div>}
                                    </div>
                                );
                            })}
                        </div> : <div className='text-center p-8 bg-gray-50 rounded-lg'><p className='text-gray-600'>No se encontraron cursos con los filtros aplicados.</p></div>}
                    </div>
                    <div className='lg:w-1/3'>
                        <div className='sticky top-24 bg-gray-50 p-4 rounded-lg shadow-inner border'>
                            <h3 className='text-lg font-bold text-gray-800 border-b pb-2 mb-3'>{`Tu Selección (${selectedCourses.length} / 3)`}</h3>
                            {selectedCourses.length > 0 ? <ul className='space-y-3'>
                                {selectedCourses.map(course => <li key={course.id} className='bg-white p-3 rounded-md shadow-sm flex justify-between items-center text-sm'><span className='font-semibold text-gray-700 pr-2'>{course.name}</span><button onClick={() => handleSelectCourse(course)} className='text-red-500 hover:text-red-700 font-bold text-lg' aria-label={`Quitar ${course.name}`}>×</button></li>)}
                            </ul> : <p className='text-sm text-gray-500 p-4 text-center'>Selecciona hasta 3 cursos de la lista.</p>}
                        </div>
                    </div>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className='mt-8 flex flex-col-reverse sm:flex-row justify-between gap-3'>
                        <button type='button' onClick={onBack} className='w-full sm:w-auto bg-gray-300 text-gray-800 font-bold py-2 px-6 rounded-lg hover:bg-gray-400'>Regresar</button>
                        <button type='submit' className='w-full sm:w-auto bg-blue-700 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-800'>Continuar</button>
                    </div>
                </form>
            </div>
        );
    };
    const Step3Confirmation = ({ formData, courses, originalCourses, onBack, onSubmit }) => {
        const [isSubmitting, setIsSubmitting] = useState(false);
        const isCancellation = courses.length === 0 && originalCourses.length > 0;
        const handleSubmit = async () => { setIsSubmitting(true); try { await onSubmit(); } catch (error) { console.error("Error de envío:", error); } finally { setIsSubmitting(false); } };
        return (
            <div className='bg-white p-4 sm:p-6 lg:p-8 rounded-lg shadow-md w-full max-w-4xl mx-auto'>
                <h2 className='text-xl sm:text-2xl font-bold mb-6 text-gray-800'>{isCancellation ? 'Confirmar Cancelación' : 'Confirmación de Registro'}</h2>
                <div className='border border-gray-200 rounded-lg p-4 sm:p-6 mb-6'>
                    <h3 className='text-base sm:text-lg font-semibold text-gray-700 mb-4'>Resumen de su Registro</h3>
                    <div className='grid grid-cols-1 md:grid-cols-2 gap-4 text-sm'>
                        <div><p><strong>Nombre: </strong>{formData.fullName}</p><p><strong>CURP: </strong>{formData.curp}</p><p><strong>Género: </strong>{formData.gender}</p></div>
                        <div><p><strong>Email: </strong>{formData.email}</p><p><strong>Departamento: </strong>{formData.department}</p></div>
                    </div>
                </div>
                <div className='mt-6'>
                    <h3 className='text-base sm:text-lg font-semibold text-gray-700 mb-4'>{isCancellation ? "Cursos a Cancelar" : "Cursos Seleccionados"}</h3>
                    {isCancellation ? <div className='border border-yellow-400 bg-yellow-50 text-yellow-800 rounded-lg p-4'>
                        <p className='font-bold'>Atención: Está a punto de cancelar su inscripción.</p>
                        <p className='mt-2 text-sm'>{`Al confirmar, se eliminará su registro de ${originalCourses.length} curso(s).`}</p>
                        <ul className='list-disc list-inside mt-2 space-y-1 text-sm'>{originalCourses.map(course => <li key={course.id}>{course.name}</li>)}</ul>
                    </div> : courses.length > 0 ? <div className='space-y-4'>
                        {courses.map(course => <div key={course.id} className='border border-gray-200 rounded-lg p-4'>
                            <h4 className='font-bold text-sm sm:text-base text-gray-800'>{course.name}</h4>
                            <div className='grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 mt-2 text-xs sm:text-sm text-gray-600'>
                                <div><strong>Horario: </strong>{course.schedule || 'N/A'}</div><div><strong>Lugar: </strong>{course.location || 'N/A'}</div><div><strong>Fechas: </strong>{course.dates}</div><div><strong>Horas: </strong>{course.hours || 30}</div>
                            </div>
                        </div>)}
                    </div> : <div className='border border-gray-200 rounded-lg p-4 bg-gray-50'><p className='text-gray-600 text-sm'>No ha seleccionado ningún curso.</p></div>}
                </div>
                <div className='mt-8 flex flex-col-reverse sm:flex-row justify-between gap-3'>
                    <button onClick={onBack} disabled={isSubmitting} className='w-full sm:w-auto bg-gray-300 text-gray-800 font-bold py-2 px-6 rounded-lg hover:bg-gray-400 disabled:opacity-50'>Regresar</button>
                    <button onClick={handleSubmit} disabled={isSubmitting} className='w-full sm:w-auto bg-blue-700 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-800 flex items-center justify-center gap-2 disabled:opacity-50'>
                        {isSubmitting ? '⏳ Procesando...' : (isCancellation ? 'Confirmar Cancelación' : 'Confirmar Registro')}
                    </button>
                </div>
            </div>
        );
    };
    const Step4Success = ({ registrationResult, applicantName, selectedCourses, submissionType, emailSent, emailError }) => {
        const isCancellation = submissionType === 'cancellation';
        const hasResult = registrationResult && registrationResult.length > 0;
        const coursesToDisplay = hasResult ? registrationResult : selectedCourses;
        return (
            <div className='bg-white p-4 sm:p-6 lg:p-8 rounded-lg shadow-md w-full max-w-4xl mx-auto text-center'>
                <div className='mx-auto h-12 w-12 sm:h-16 sm:w-16 text-green-500 mb-4 text-5xl sm:text-6xl'>✅</div>
                <h2 className='text-xl sm:text-2xl font-bold text-gray-800'>{isCancellation ? "¡Cancelación Exitosa!" : "¡Registro Exitoso!"}</h2>
                <p className='mt-2 text-sm sm:text-base text-gray-600'>{isCancellation ? `Gracias, ${applicantName}. Tu cancelación ha sido procesada.` : `Gracias, ${applicantName}. Tu inscripción ha sido procesada.`}</p>
                {!isCancellation && emailSent === false && <div className='mt-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded-md text-left max-w-2xl mx-auto' role='alert'>
                    <p className='font-bold text-sm sm:text-base'>⚠️ Advertencia sobre el email</p>
                    <p className='text-xs sm:text-sm mt-1'>{emailError || 'No se pudo enviar el email de confirmación. Tu inscripción SÍ fue registrada exitosamente. Verifica tu bandeja de spam.'}</p>
                </div>}
                {!isCancellation && coursesToDisplay && coursesToDisplay.length > 0 && <div className='mt-6 text-left border border-gray-200 rounded-lg p-4 sm:p-6'>
                    <h3 className='text-base sm:text-lg font-semibold text-gray-700 mb-4'>Detalles de la Inscripción:</h3>
                    <ul className='space-y-3'>
                        {coursesToDisplay.map((result) => <li key={result.registrationId || result.id} className={`p-3 rounded-md border ${result.error ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
                            <div className='flex flex-col sm:flex-row sm:justify-between gap-2'>
                                <span className='font-semibold text-sm sm:text-base text-gray-800'>{(result.courseName || result.name)}{result.dates && ` (${result.dates})`}</span>
                                {result.folio && <span className='text-xs sm:text-sm'>Folio: <strong className={`font-mono px-2 py-1 rounded ${result.error ? 'bg-red-200 text-red-800' : 'bg-gray-200'}`}>{result.folio}</strong></span>}
                            </div>
                            {result.error && <p className='text-xs text-red-700 mt-1'>{`⚠️ ${result.error}`}</p>}
                        </li>)}
                    </ul>
                </div>}
                <div className='mt-8 border-t pt-6'>
                    <div className='flex justify-center'><a href='index.html' className='bg-blue-700 hover:bg-blue-800 text-white font-bold py-3 px-8 rounded-lg transition-colors inline-block'>← Volver al Portal Principal</a></div>
                </div>
            </div>
        );
    };

    const [currentStep, setCurrentStep] = useState(1);
    // Fix: Add explicit types for states to ensure type safety.
    const [formData, setFormData] = useState<FormData>({ fullName: '', curp: '', email: '', gender: 'Mujer', department: '', selectedCourses: [] });
    const [allCourses, setAllCourses] = useState<Course[]>([]);
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [departments, setDepartments] = useState<string[]>([]);
    const [selectedCourses, setSelectedCourses] = useState<Course[]>([]);
    const [originalSelectedCourses, setOriginalSelectedCourses] = useState<Course[]>([]);
    const [registrationResult, setRegistrationResult] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [submissionType, setSubmissionType] = useState('enrollment');
    const [emailSent, setEmailSent] = useState(true);
    const [emailError, setEmailError] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const [coursesData, teachersData, departmentsData] = await Promise.all([getCourses(), getTeachers(), getDepartments()]);
                setAllCourses(coursesData); setTeachers(teachersData); setDepartments(departmentsData);
            } catch (err) { setError("No se pudieron cargar los datos."); } finally { setIsLoading(false); }
        };
        fetchData();
    }, []);
    
    const studentSteps = ["Información", "Cursos", "Confirmar", "Finalizado"];
    const handleNext = () => setCurrentStep(prev => prev < 4 ? prev + 1 : prev);
    const handleBack = () => setCurrentStep(prev => prev > 1 ? prev - 1 : prev);
    const goToStep = (step: number) => { if (step > 0 && step <= studentSteps.length) setCurrentStep(step); };
    const handleSubmit = async () => {
        setError(null);
        try {
            const isCancellation = selectedCourses.length === 0 && originalSelectedCourses.length > 0;
            setSubmissionType(isCancellation ? 'cancellation' : 'enrollment');
            const submissionData = {
                action: 'enrollStudent', timestamp: new Date().toISOString(), fullName: formData.fullName, curp: formData.curp, email: formData.email, gender: formData.gender, DepartamentoSeleccionado: formData.department,
                selectedCourses: selectedCourses.map(c => ({ id: c.id, name: c.name, dates: c.dates, location: c.location, schedule: c.schedule })),
                previousRegistrationIds: originalSelectedCourses.map(c => c.id)
            };
            const result = await submitRegistration(submissionData);
            const registrationResultsArray = result.results || [];
            const augmentedResult = registrationResultsArray.map((reg) => {
                const courseDetails = selectedCourses.find(c => c.id === reg.registrationId);
                return { ...reg, dates: courseDetails ? courseDetails.dates : 'Fechas no disponibles' };
            });
            setRegistrationResult(augmentedResult); setEmailSent(result.emailSent !== false); setEmailError(result.emailError);
            handleNext();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Error desconocido";
            setError(errorMessage); setCurrentStep(3);
        }
    };
    
    const renderContent = () => {
        if (isLoading) return <div className='flex justify-center items-center h-64'><div className='animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-800'></div></div>;
        if (error && currentStep !== 3) return <div className='bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mx-auto max-w-4xl' role='alert'><p className='font-bold'>Error Crítico</p><p>{error}</p></div>;
        switch (currentStep) {
            case 1: return <Step1PersonalInfo formData={formData} setFormData={setFormData} departments={departments} teachers={teachers} allCourses={allCourses} setSelectedCourses={setSelectedCourses} setOriginalSelectedCourses={setOriginalSelectedCourses} onNext={handleNext} onGoToStep={goToStep} />;
            case 2: return <Step2CourseSelection courses={allCourses} selectedCourses={selectedCourses} setSelectedCourses={setSelectedCourses} originalSelectedCourses={originalSelectedCourses} onNext={handleNext} onBack={handleBack} />;
            case 3: return <Step3Confirmation formData={formData} courses={selectedCourses} originalCourses={originalSelectedCourses} onBack={handleBack} onSubmit={handleSubmit} />;
            case 4: return <Step4Success registrationResult={registrationResult} applicantName={formData.fullName} selectedCourses={selectedCourses} submissionType={submissionType} emailSent={emailSent} emailError={emailError} />;
            default: return <div>Paso desconocido</div>;
        }
    };

    return (
        <div className='flex flex-col min-h-screen bg-gray-100'>
            <main className='flex-grow'>
                <Stepper currentStep={currentStep} steps={studentSteps} />
                <div className='container mx-auto px-4 sm:px-6 lg:px-8 pb-8'>
                    {error && currentStep === 3 && <div className='bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-md w-full max-w-4xl mx-auto' role='alert'>
                        <p className='font-bold'>Error al Enviar</p>
                        <p className='whitespace-pre-wrap'>{error}</p>
                    </div>}
                    {renderContent()}
                </div>
            </main>
        </div>
    );
};

// ============================================================================
// === APP ROUTER =============================================================
// ============================================================================

const rootElement = document.getElementById('root');
if (rootElement) {
    const root = ReactDOM.createRoot(rootElement);
    const appType = rootElement.dataset.app;

    if (appType === 'constancias') {
        root.render(<React.StrictMode><ConstanciasApp /></React.StrictMode>);
    } else if (appType === 'inscripciones') {
        root.render(<React.StrictMode><InscripcionesApp /></React.StrictMode>);
    } else {
        const isAppPage = window.location.pathname.includes('inscripciones.html') || window.location.pathname.includes('constancias.html');
        if (isAppPage) {
            console.error(`Root element found, but 'data-app' attribute is missing or invalid. Found: ${appType}`);
        }
    }
}
