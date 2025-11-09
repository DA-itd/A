import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom/client';

declare global {
    interface Window {
        google: any;
    }
}

// ============================================================================
// === CONFIG & HELPERS =======================================================
// ============================================================================

const CONFIG = {
    GOOGLE_CLIENT_ID: '524996225715-5l95j3lces5hi49c19rfgotdrfo2seq1.apps.googleusercontent.com',
    APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbwaCOFUQFQnvuCEVJU33uNsILIGaVTuv_aREuMdqxrsKYAZ7dtYNtWxX3LdqwP614i6/exec',
    SESSION_TIMEOUT_MINUTES: 60,
};

const sessionManager = {
    save: (data: any) => {
        const sessionData = { ...data, timestamp: new Date().getTime() };
        localStorage.setItem('certificate_session', JSON.stringify(sessionData));
    },
    load: () => {
        const stored = localStorage.getItem('certificate_session');
        if (!stored) return null;
        const sessionData = JSON.parse(stored);
        const elapsed = (new Date().getTime() - sessionData.timestamp) / (1000 * 60);
        if (elapsed > CONFIG.SESSION_TIMEOUT_MINUTES) {
            localStorage.removeItem('certificate_session');
            return null;
        }
        return sessionData;
    },
    clear: () => localStorage.removeItem('certificate_session'),
};

interface Course {
    id: string;
    name: string;
    status: 'idle' | 'issued' | 'loading' | 'success' | 'error';
}

// ============================================================================
// === API CALLS ==============================================================
// ============================================================================

const fetchEligibleCourses = async (email: string) => {
    const url = new URL(CONFIG.APPS_SCRIPT_URL);
    url.searchParams.append('action', 'getEligibleCoursesForCertificate');
    url.searchParams.append('email', email);
    url.searchParams.append('_', Date.now().toString());

    const response = await fetch(url.toString(), { method: 'GET', mode: 'cors' });
    const result = await response.json();

    if (result.success && result.data) {
        return result.data;
    }
    throw new Error(result.message || 'No se pudieron cargar los datos.');
};

const generateCertificateApi = async (email: string, courseId: string) => {
    const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'generateAndEmailCertificate', email, courseId })
    });
    const result = await response.json();
    if (!result.success) {
        throw new Error(result.message || 'Error en el servidor al generar la constancia.');
    }
};

// ============================================================================
// === MAIN APP COMPONENT =====================================================
// ============================================================================
const ConstanciasApp = () => {
    // Sub-components are defined inside the main component to match the working structure of InscripcionesApp.
    const Spinner = () => <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-800 mx-auto"></div>;

    const LoginStep = ({ onLogin, error }: { onLogin: (response: any) => void, error: string | null }) => {
        useEffect(() => {
            if (window.google) {
                window.google.accounts.id.initialize({ client_id: CONFIG.GOOGLE_CLIENT_ID, callback: onLogin });
                window.google.accounts.id.prompt();
            }
        }, [onLogin]);
        
        return (
            <div className="text-center animate-fadeIn">
                <div className="text-6xl mb-4">📜</div>
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">Generador de Constancias</h2>
                <p className="text-gray-600 mt-2 max-w-2xl mx-auto">Inicia sesión con tu cuenta institucional para ver y generar las constancias de los cursos donde ya completaste la encuesta de opinión.</p>
                {error && <div className="bg-red-100 border-l-4 border-red-400 text-red-700 p-4 my-6 rounded text-left" role="alert">{error}</div>}
                <div className="mt-8">
                    <button onClick={() => window.google?.accounts.id.prompt()} className="bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700">
                        Acceder con Google
                    </button>
                </div>
            </div>
        );
    };

    const CertificateCard = ({ course, onGenerate }: { course: Course, onGenerate: (courseId: string) => Promise<void> }) => {
        const [status, setStatus] = useState(course.status);
        const [errorMessage, setErrorMessage] = useState('');

        const handleGenerate = async () => {
            setStatus('loading');
            setErrorMessage('');
            try {
                await onGenerate(course.id);
                setStatus('success');
            } catch (e: any) {
                setStatus('error');
                setErrorMessage(e.message || 'Ocurrió un error.');
            }
        };
        
        const ButtonContent = () => {
            switch(status) {
                case 'loading': return <>⏳ Generando...</>;
                case 'success': return <>✔️ Enviada al correo</>;
                case 'error': return <>❌ Error, reintentar</>;
                case 'issued': return <>✅ Ya generada</>;
                default: return <>📧 Generar y Enviar</>;
            }
        };
        
        const buttonClasses = {
            loading: 'bg-gray-400 cursor-not-allowed',
            success: 'bg-green-600 cursor-default',
            error: 'bg-red-600 hover:bg-red-700',
            issued: 'bg-gray-500 cursor-default',
            idle: 'bg-indigo-600 hover:bg-indigo-700',
        }[status];
        
        return (
            <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md border-l-4 border-amber-500">
                <h3 className="text-lg font-bold text-gray-900 mb-3">{course.name}</h3>
                <button onClick={handleGenerate} disabled={status !== 'idle' && status !== 'error'}
                    className={`w-full text-center font-semibold py-2 px-4 rounded-md transition-colors flex items-center justify-center gap-2 text-white ${buttonClasses}`}>
                    <ButtonContent />
                </button>
                {status === 'error' && <p className="text-xs text-red-600 mt-2 text-center">{errorMessage}</p>}
            </div>
        );
    };

    const CertificateListStep = ({ teacherData, courses, onLogout, onGenerate }: { teacherData: { fullName: string }, courses: Course[], onLogout: () => void, onGenerate: (courseId: string) => Promise<void> }) => (
        <div className="animate-fadeIn">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">Constancias Disponibles</h2>
                    <p className="text-gray-600 mt-1">Hola, <strong>{teacherData.fullName}</strong>.</p>
                </div>
                <button onClick={onLogout} className="text-sm bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded-lg">Cerrar Sesión</button>
            </div>

            <div className="space-y-6">
                {courses.length > 0 ? (
                    courses.map(course => <CertificateCard key={course.id} course={course} onGenerate={onGenerate} />)
                ) : (
                    <div className="text-center bg-blue-50 text-blue-800 p-6 rounded-lg">
                        <div className="text-5xl mb-3">👍</div>
                        <p className="font-semibold">No tienes constancias pendientes por generar.</p>
                        <p className="mt-1">Recuerda que para poder generar una constancia, primero debes contestar la <strong>encuesta de opinión</strong> del curso correspondiente.</p>
                    </div>
                )}
            </div>
        </div>
    );

    // Main component state and logic
    const [step, setStep] = useState<'loading' | 'login' | 'list'>('loading');
    const [error, setError] = useState<string | null>(null);
    const [teacherData, setTeacherData] = useState<{ fullName: string } | null>(null);
    const [courses, setCourses] = useState<Course[]>([]);
    const [userEmail, setUserEmail] = useState<string | null>(null);

    const loadUserData = useCallback(async (email: string) => {
        setStep('loading');
        setError(null);
        try {
            const data = await fetchEligibleCourses(email);
            setTeacherData(data.teacherData);
            setCourses(data.eligibleCourses);
            setUserEmail(email);
            setStep('list');
            return data.teacherData;
        } catch (err: any) {
            setError(err.message);
            sessionManager.clear();
            setStep('login');
        }
    }, []);
    
    const handleLogin = useCallback(async (response: any) => {
        if (response.credential) {
            const decodedToken = JSON.parse(atob(response.credential.split('.')[1]));
            if (!decodedToken?.email?.endsWith('@itdurango.edu.mx')) {
                setError("Por favor, inicie sesión con una cuenta institucional (@itdurango.edu.mx).");
                sessionManager.clear();
                window.google?.accounts.id.disableAutoSelect();
                return;
            }
            const teacherData = await loadUserData(decodedToken.email);
            if(teacherData) {
                sessionManager.save({ fullName: teacherData.fullName, email: decodedToken.email });
            }
        }
    }, [loadUserData]);

    useEffect(() => {
        const session = sessionManager.load();
        if (session?.email) {
            loadUserData(session.email);
        } else {
            setStep('login');
        }
    }, [loadUserData]);

    const handleLogout = () => {
        sessionManager.clear();
        window.google?.accounts.id.disableAutoSelect();
        window.location.reload();
    };

    const handleGenerate = async (courseId: string) => {
        if (!userEmail) throw new Error("No hay sesión de usuario activa.");
        await generateCertificateApi(userEmail, courseId);
        setCourses(prevCourses => prevCourses.map(c => 
            c.id === courseId ? { ...c, status: 'success' } : c
        ));
    };
    
    const renderContent = () => {
        switch(step) {
            case 'loading': return <Spinner />;
            case 'login': return <LoginStep onLogin={handleLogin} error={error} />;
            case 'list': 
                if (!teacherData) return <Spinner />;
                return <CertificateListStep teacherData={teacherData} courses={courses} onLogout={handleLogout} onGenerate={handleGenerate} />;
            default: return <LoginStep onLogin={handleLogin} error={"Ocurrió un error inesperado."} />;
        }
    };

    return (
        <main className="container mx-auto px-4 py-8 sm:py-12">
            <div className="max-w-3xl mx-auto">
                <a href="index.html" className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 hover:underline mb-8">← Volver al Portal Principal</a>
                <div className="bg-white rounded-lg shadow-xl p-6 sm:p-8 min-h-[300px] flex items-center justify-center">
                    {renderContent()}
                </div>
            </div>
        </main>
    );
};

// ============================================================================
// === RENDER ROOT ============================================================
// ============================================================================

const rootElement = document.getElementById('root');
if (rootElement) {
    const root = ReactDOM.createRoot(rootElement);
    root.render(<React.StrictMode><ConstanciasApp /></React.StrictMode>);
}
