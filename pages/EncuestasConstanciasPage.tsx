declare const React: any;
declare const window: any;

const EncuestasConstanciasPage = () => {
    const { useState, useEffect, useCallback } = React;
        
    const CONFIG = {
        GOOGLE_CLIENT_ID: '524996225715-5l95j3lces5hi49c19rfgotdrfo2seq1.apps.googleusercontent.com',
        APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbz99U2AFCliLI34Aqh7nK__MT0NNIsE1DKr7glVGL7zxJhfxiR8izQUaD1BgPDVe5DNow/exec',
        SESSION_KEY: 'unified_session',
        SESSION_TIMEOUT_MINUTES: 60,
        INSTITUTIONAL_DOMAIN: '@itdurango.edu.mx',
        SURVEY_URLS: {
            opinion: 'https://forms.gle/BBLvYmwzQDbFESXF7',
            eficacia: 'https://forms.gle/G1HUp2thYPbvy7t49'
        },
        ENTRY_IDS: {
            opinion: { course: 'entry.152060533', department: 'entry.1854497676' },
            eficacia: { name: 'entry.198393507', department: 'entry.864708779' }
        }
    };

    const sessionManager = {
        save: (data) => {
            const sessionData = { ...data, timestamp: new Date().getTime() };
            localStorage.setItem(CONFIG.SESSION_KEY, JSON.stringify(sessionData));
        },
        load: () => {
            const stored = localStorage.getItem(CONFIG.SESSION_KEY);
            if (!stored) return null;
            const sessionData = JSON.parse(stored);
            const elapsed = (new Date().getTime() - sessionData.timestamp) / (1000 * 60);
            if (elapsed > CONFIG.SESSION_TIMEOUT_MINUTES) {
                sessionManager.clear();
                return null;
            }
            return sessionData;
        },
        clear: () => localStorage.removeItem(CONFIG.SESSION_KEY)
    };

    const apiService = {
        fetchData: async (email) => {
            const url = new URL(CONFIG.APPS_SCRIPT_URL);
            url.searchParams.append('action', 'getConsolidatedStatus');
            url.searchParams.append('email', email);
            url.searchParams.append('_', Date.now().toString());

            const response = await fetch(url.toString(), { cache: 'no-store' });
            if (!response.ok) throw new Error(`Error del servidor: ${response.status}`);
            
            const result = await response.json();
            if (result.success && result.data) return result.data;
            throw new Error(result.message || 'No se pudieron cargar los datos.');
        },
        recordSurvey: async (data) => {
            const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
                method: 'POST', mode: 'cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: 'submitSurveyRecord', ...data })
            });
            const result = await response.json();
            if (!result.success) throw new Error(result.message || 'Error al registrar.');
        },
        generateCertificate: async (email, courseId) => {
             const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
                method: 'POST', mode: 'cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: 'emailStoredCertificate', email, courseId })
            });
            const result = await response.json();
            if (!result.success) throw new Error(result.message || 'Error al generar constancia.');
        }
    };
    
    const [step, setStep] = useState('loading');
    const [error, setError] = useState(null);
    const [isActionInProgress, setIsActionInProgress] = useState(false);
    const [actionText, setActionText] = useState('');
    const [appData, setAppData] = useState(null);

    const loadData = useCallback(async (email) => {
        try {
            const data = await apiService.fetchData(email);
            setAppData(data);
            setStep('dashboard');
            return data.teacherData;
        } catch (err) {
            setError(err.message);
            sessionManager.clear();
            setStep('login');
            return null;
        }
    }, []);

    const handleLogin = useCallback(async (response) => {
        if (!response.credential) {
            setError("Error de autenticación con Google.");
            setStep('login');
            return;
        }
        try {
            const decoded = JSON.parse(atob(response.credential.split('.')[1]));
            if (!decoded.email.endsWith(CONFIG.INSTITUTIONAL_DOMAIN)) {
                setError(`Debe usar una cuenta institucional (${CONFIG.INSTITUTIONAL_DOMAIN}).`);
                setStep('login');
                return;
            }
            setStep('loading');
            const teacherData = await loadData(decoded.email);
            if (teacherData) {
                sessionManager.save({ ...teacherData, email: decoded.email });
            }
        } catch (err) {
            setError(err.message);
            setStep('login');
        }
    }, [loadData]);

    useEffect(() => {
        const session = sessionManager.load();
        if (session && session.email) {
            loadData(session.email);
        } else {
            setStep('login');
        }
    }, [loadData]);

    const handleLogout = () => {
        sessionManager.clear();
        if (window.google) window.google.accounts.id.disableAutoSelect();
        window.location.reload();
    };

    const handleAction = async (type, data) => {
        setIsActionInProgress(true);
        try {
            if (type === 'survey') {
                setActionText('Registrando y redirigiendo a la encuesta...');
                await apiService.recordSurvey(data.recordData);
                window.location.href = data.url;
            } else if (type === 'certificate') {
                setActionText('Generando y enviando constancia a tu correo...');
                const session = sessionManager.load();
                await apiService.generateCertificate(session.email, data.courseId);
                alert('¡Éxito! Tu constancia ha sido enviada a tu correo institucional. Revisa tu bandeja de entrada (y la de spam).');
                setIsActionInProgress(false);
                loadData(session.email);
            }
        } catch (err) {
            alert(`Error: ${err.message}`);
            setIsActionInProgress(false);
        }
    };

    const renderContent = () => {
        if (step === 'loading') {
            return <div className="flex justify-center items-center h-64">
                       <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-800"></div>
                   </div>;
        }
        if (step === 'login') return <LoginStep onLogin={handleLogin} error={error} CONFIG={CONFIG}/>;
        if (step === 'dashboard' && appData) {
            return <DashboardStep appData={appData} onLogout={handleLogout} onAction={handleAction} CONFIG={CONFIG} />;
        }
        return <LoginStep onLogin={handleLogin} error={"Ocurrió un error inesperado. Por favor, recarga la página."} CONFIG={CONFIG}/>;
    };

    return (
        <div className="container mx-auto px-4 py-8 sm:py-12">
            {isActionInProgress && <RedirectingOverlay text={actionText} />}
             <div className="max-w-3xl mx-auto">
                <div className="bg-white rounded-lg shadow-xl p-6 sm:p-8">
                   {renderContent()}
                </div>
            </div>
        </div>
    );
};

const LoginStep = ({ onLogin, error, CONFIG }) => {
    React.useEffect(() => {
        if (window.google) {
            window.google.accounts.id.initialize({ client_id: CONFIG.GOOGLE_CLIENT_ID, callback: onLogin });
            window.google.accounts.id.prompt();
        }
    }, [onLogin, CONFIG.GOOGLE_CLIENT_ID]);
    
    return (
        <div className="animate-fadeIn text-center">
            <div className="text-6xl mb-4">✍️</div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">Panel de Encuestas y Constancias</h2>
            <p className="text-gray-600 mt-2 max-w-2xl mx-auto">
                Inicia sesión con tu cuenta institucional ({CONFIG.INSTITUTIONAL_DOMAIN}) para continuar.
            </p>
            {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded my-6 text-left" role="alert">
                    <strong className="font-bold">Error: </strong>
                    <span className="block sm:inline">{error}</span>
                </div>
            )}
        </div>
    );
};

const DashboardStep = ({ appData, onLogout, onAction, CONFIG }) => {
    const { teacherData, courses, efficacySurvey } = appData;
            
    const handleSurveyClick = (type, data) => {
        let recordData, url;
        
        if (type === 'opinion') {
            recordData = {
                teacherName: teacherData.fullName, teacherEmail: teacherData.email, department: teacherData.department,
                courseId: data.id, courseName: data.name, surveyType: 'opinion'
            };
            url = new URL(CONFIG.SURVEY_URLS.opinion);
            url.searchParams.set(CONFIG.ENTRY_IDS.opinion.course, data.name);
            url.searchParams.set(CONFIG.ENTRY_IDS.opinion.department, teacherData.department);
        } else {
             recordData = {
                teacherName: teacherData.fullName, teacherEmail: teacherData.email, department: teacherData.department,
                courseId: data.periodId, courseName: `Encuesta General de Eficacia (${data.periodName})`, surveyType: 'eficacia'
            };
            url = new URL(CONFIG.SURVEY_URLS.eficacia);
            url.searchParams.set(CONFIG.ENTRY_IDS.eficacia.name, teacherData.fullName);
            url.searchParams.set(CONFIG.ENTRY_IDS.eficacia.department, teacherData.department);
        }
        onAction('survey', { recordData, url: url.toString() });
    };
    
    const handleCertificateClick = (course) => {
         onAction('certificate', { courseId: course.id });
    };

    // FIX: Make the 'children' prop optional by providing a default value.
    // This resolves the error when the Step component is used without children.
    const Step = ({ title, status, children = null }) => {
        const colors = {
            done: { bg: 'bg-green-100', text: 'text-green-800', icon: '✅' },
            pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: '⏳' },
            next: { bg: 'bg-blue-100', text: 'text-blue-800', icon: '➡️' },
            disabled: { bg: 'bg-gray-100', text: 'text-gray-500', icon: '⚪' }
        };
        const { bg, text, icon } = colors[status] || colors['disabled'];
        return (
            <div className={`step-item p-3 rounded-lg ${bg} ${text}`}>
                <div className="flex items-center gap-3">
                    <span className="text-xl">{icon}</span>
                    <div className="flex-1">
                        <p className="font-bold text-sm">{title}</p>
                        {children && <div className="mt-2">{children}</div>}
                    </div>
                </div>
            </div>
        );
    };

    return (
         <div className="animate-fadeIn">
            <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">Panel de Actividades</h2>
                    <p className="text-gray-600 mt-1">Hola, <strong>{teacherData.fullName}</strong></p>
                </div>
                <button onClick={onLogout} className="text-sm bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded-lg">
                    Cerrar Sesión
                </button>
            </div>
             <div className="space-y-8">
                {efficacySurvey && (
                     <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md border-l-4 border-green-500">
                        <h3 className="text-lg font-bold text-gray-900 mb-1">Encuesta General de Eficacia</h3>
                        <p className="text-sm text-gray-600 mb-4">Periodo: {efficacySurvey.periodName}</p>
                        {efficacySurvey.completed ? (
                            <p className="font-semibold text-green-700">✔️ Gracias por completar esta encuesta.</p>
                        ) : (
                            <button onClick={() => handleSurveyClick('eficacia', efficacySurvey)} className="w-full sm:w-auto text-center font-semibold py-2 px-4 rounded-md text-white bg-green-600 hover:bg-green-700">
                                📈 Responder Encuesta de Eficacia
                            </button>
                        )}
                     </div>
                )}
                
                {courses && courses.map(course => {
                    const opinionStatus = course.surveyCompleted ? 'done' : course.isOpinionActive ? 'next' : 'disabled';

                    return (
                    <div key={course.id} className="bg-white p-4 sm:p-6 rounded-lg shadow-md border-l-4 border-indigo-500">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">{course.name}</h3>
                        <div className="space-y-3">
                            <Step title="1. Contestar Encuesta de Opinión" status={opinionStatus}>
                                {course.isOpinionActive && (
                                    <button onClick={() => handleSurveyClick('opinion', course)} className="w-full sm:w-auto text-center font-semibold py-2 px-4 rounded-md text-white bg-blue-600 hover:bg-blue-700">
                                        💬 Responder Encuesta
                                    </button>
                                )}
                                {!course.surveyCompleted && !course.isOpinionActive && (
                                    <p className="text-xs text-yellow-800 font-semibold">
                                        Temporalmente desactivada.
                                    </p>
                                )}
                            </Step>

                            <Step title="2. Validación de Asistencia" status={!course.surveyCompleted ? 'disabled' : course.attendanceApproved ? 'done' : 'pending'} />
                            
                            <Step title="3. Obtener Constancia" status={!course.surveyCompleted || !course.attendanceApproved ? 'disabled' : 'next'}>
                                {course.surveyCompleted && course.attendanceApproved && (
                                     <button onClick={() => handleCertificateClick(course)} className="w-full sm:w-auto text-center font-semibold py-2 px-4 rounded-md text-white bg-indigo-600 hover:bg-indigo-700">
                                        ✉️ Enviar a mi Correo
                                    </button>
                                )}
                            </Step>
                        </div>
                    </div>
                    )
                })}
                
                 {courses.length === 0 && !efficacySurvey && (
                    <div className="text-center bg-blue-50 text-blue-800 p-8 rounded-lg">
                        <p className="font-semibold text-lg">No tienes actividades pendientes por ahora.</p>
                        <p className="mt-2 text-sm">Vuelve más tarde para revisar si hay nuevas encuestas disponibles.</p>
                    </div>
                 )}
            </div>
         </div>
    );
};

const RedirectingOverlay = ({ text }) => (
    <div className="fixed inset-0 bg-gray-800 bg-opacity-75 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <p className="text-lg font-semibold text-gray-700">{text}</p>
        </div>
    </div>
);


export default EncuestasConstanciasPage;