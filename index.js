
// =============================================================================
// SISTEMA DE INSCRIPCIÓN A CURSOS - INSTITUTO TECNOLÓGICO DE DURANGO
// Versión: 2.1.0 - Corrección de Cancelación y Bloqueos
// =============================================================================

const COURSES_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSAe4dmVN4CArjEy_lvI5qrXf16naxZLO1lAxGm2Pj4TrdnoebBg03Vv4-DCXciAkHJFiZaBMKletUs/pub?gid=0&single=true&output=csv';
const TEACHERS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSAe4dmVN4CArjEy_lvI5qrXf16naxZLO1lAxGm2Pj4TrdnoebBg03Vv4-DCXciAkHJFiZaBMKletUs/pub?gid=987931491&single=true&output=csv';
const CURP_REGEX = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[0-9A-Z]\d$/;
const MOCK_DEPARTMENTS = ["DEPARTAMENTO DE SISTEMAS Y COMPUTACION", "DEPARTAMENTO DE INGENIERÍA ELÉCTRICA Y ELECTRÓNICA", "DEPARTAMENTO DE CIENCIAS ECONOMICO-ADMINISTRATIVAS", "DEPARTAMENTO DE INGENIERÍA QUÍMICA-BIOQUÍMICA", "DEPARTAMENTO DE CIENCIAS DE LA TIERRA", "DEPARTAMENTO DE CIENCIAS BASICAS", "DEPARTAMENTO DE METAL-MECÁNICA", "DEPARTAMENTO DE INGENIERÍA INDUSTRIAL", "DIVISION DE ESTUDIOS DE POSGRADO E INVESTIGACION", "ADMINISTRATIVO", "EXTERNO"];

const removeAccents = (text) => !text ? '' : text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const parseCSVLine = (line) => { const result = []; let current = ''; let inQuotes = false; for (let i = 0; i < line.length; i++) { const char = line[i]; if (char === '"') { if (inQuotes && line[i + 1] === '"') { current += '"'; i++; } else { inQuotes = !inQuotes; } } else if (char === ',' && !inQuotes) { result.push(current.trim()); current = ''; } else { current += char; } } result.push(current.trim()); return result; };
const cleanCSVValue = (val) => { let cleaned = val.trim(); if (cleaned.startsWith('"') && cleaned.endsWith('"')) cleaned = cleaned.substring(1, cleaned.length - 1).replace(/""/g, '"'); return cleaned; };

const getTeachers = async () => { try { const response = await fetch(`${TEACHERS_CSV_URL}&_=${Date.now()}`); if (!response.ok) throw new Error('Error'); const csvText = await response.text(); return csvText.trim().split(/\r?\n/).slice(1).map(line => { const v = parseCSVLine(line); return v.length < 3 ? null : { nombreCompleto: cleanCSVValue(v[0]), curp: cleanCSVValue(v[1]), email: cleanCSVValue(v[2]) }; }).filter(Boolean); } catch (e) { return []; } };
const getCourses = async () => { try { const response = await fetch(`${COURSES_CSV_URL}&_=${Date.now()}`); if (!response.ok) throw new Error('Error'); const csvText = await response.text(); return csvText.trim().split(/\r?\n/).slice(1).map(line => { const v = parseCSVLine(line); return v.length < 8 ? null : { id: cleanCSVValue(v[0]), name: cleanCSVValue(v[1]), dates: cleanCSVValue(v[2]), period: cleanCSVValue(v[3]), hours: parseInt(cleanCSVValue(v[4])) || 30, location: cleanCSVValue(v[5]), schedule: cleanCSVValue(v[6]), type: cleanCSVValue(v[7]) || 'No especificado' }; }).filter(Boolean); } catch (e) { return []; } };
const getDepartments = () => Promise.resolve(MOCK_DEPARTMENTS);

const getRegistrationByCurp = async (curp) => {
    try {
        const url = new URL(window.CONFIG.APPS_SCRIPT_URL);
        url.searchParams.append('action', 'lookupByCurp');
        url.searchParams.append('curp', curp.toUpperCase());
        url.searchParams.append('_', Date.now());
        const res = await fetch(url, { mode: 'cors' });
        const json = await res.json();
        return json?.success ? json.data.registeredCourses : [];
    } catch (e) { return []; }
};

const cancelSingleCourse = async (payload) => {
    try {
        const res = await fetch(window.CONFIG.APPS_SCRIPT_URL, {
            method: 'POST', mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ ...payload, action: 'cancelSingle' })
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.message);
        return json;
    } catch (e) { throw new Error("No se pudo cancelar."); }
};

const submitRegistration = async (data) => {
    try {
        const res = await fetch(window.CONFIG.APPS_SCRIPT_URL, {
            method: 'POST', mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(data)
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.message);
        return json;
    } catch (e) { throw e; }
};

// =============================================================================
// COMPONENTES REACT
// =============================================================================

const ExistingRegistrationModal = ({ isOpen, courses, onModify, onClose, onDeleteCourse, deletingCourseId, onCancelAll }) => {
    if (!isOpen) return null;
    return React.createElement('div', { className: 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4' },
        React.createElement('div', { className: 'relative mx-auto p-6 border w-full max-w-lg shadow-lg rounded-md bg-white' },
            React.createElement('h3', { className: 'text-xl font-bold text-gray-800' }, 'Registro Existente Encontrado'),
            React.createElement('div', { className: 'mt-4' },
                React.createElement('p', { className: 'text-gray-600' }, 'Ya estás inscrito en los siguientes cursos:'),
                React.createElement('div', { className: 'mt-4 space-y-2 bg-gray-50 p-4 rounded-md border max-h-60 overflow-y-auto' },
                    courses.map(c => React.createElement('div', { key: c.id, className: 'flex justify-between items-center py-2 border-b last:border-0' },
                        React.createElement('span', { className: 'font-semibold text-sm text-gray-700' }, c.name),
                        React.createElement('button', {
                            onClick: () => onDeleteCourse(c.id),
                            disabled: !!deletingCourseId,
                            className: 'text-red-500 hover:bg-red-50 p-2 rounded transition-colors'
                        }, deletingCourseId === c.id ? '⏳' : '🗑️')
                    ))
                ),
                React.createElement('div', { className: 'mt-6 flex flex-col gap-3' },
                    React.createElement('button', { onClick: onModify, className: 'bg-blue-600 text-white font-bold py-2 px-4 rounded hover:bg-blue-700' }, 'Modificar Inscripción (Agregar/Quitar)'),
                    React.createElement('button', { onClick: onCancelAll, className: 'bg-red-600 text-white font-bold py-2 px-4 rounded hover:bg-red-700' }, 'Cancelar TODA la Inscripción'),
                    React.createElement('button', { onClick: onClose, className: 'bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded hover:bg-gray-300' }, 'Cerrar')
                )
            )
        )
    );
};

const Step1PersonalInfo = ({ formData, setFormData, departments, teachers, allCourses, setSelectedCourses, setOriginalSelectedCourses, onNext, onGoToStep }) => {
    const { useState, useEffect, useRef } = React;
    const [errors, setErrors] = useState({});
    const [isChecking, setIsChecking] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [existingCourses, setExistingCourses] = useState([]);
    const [deletingId, setDeletingId] = useState(null);
    const lastCurp = useRef('');

    useEffect(() => {
        const check = async () => {
            if (formData.curp.length === 18 && formData.curp !== lastCurp.current) {
                setIsChecking(true);
                lastCurp.current = formData.curp;
                try {
                    const ids = await getRegistrationByCurp(formData.curp);
                    if (ids.length > 0) {
                        const found = allCourses.filter(c => ids.includes(c.id));
                        setExistingCourses(found);
                        setOriginalSelectedCourses(found); // Guardar estado original
                        setIsModalOpen(true);
                    }
                } finally { setIsChecking(false); }
            }
        };
        check();
    }, [formData.curp, allCourses]);

    const handleDelete = async (cid) => {
        setDeletingId(cid);
        try {
            const course = existingCourses.find(c => c.id === cid);
            await cancelSingleCourse({ 
                curp: formData.curp, email: formData.email, fullName: formData.fullName, 
                courseToCancel: { id: course.id, name: course.name } 
            });
            // Actualizar estado local inmediatamente
            const updated = existingCourses.filter(c => c.id !== cid);
            setExistingCourses(updated);
            setOriginalSelectedCourses(updated);
            if (updated.length === 0) setIsModalOpen(false);
        } catch (e) { alert(e.message); } 
        finally { setDeletingId(null); }
    };

    const handleModify = () => {
        setSelectedCourses(existingCourses); // Pre-cargar selección
        setOriginalSelectedCourses(existingCourses); // Marcar como originales para detectar bajas
        setIsModalOpen(false);
        if(validate()) onNext();
    };

    const validate = () => {
        const errs = {};
        if(!formData.fullName) errs.fullName = "Requerido";
        if(formData.curp.length !== 18) errs.curp = "18 caracteres";
        if(!formData.email) errs.email = "Requerido";
        if(!formData.department) errs.department = "Requerido";
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    return React.createElement('div', { className: 'max-w-4xl mx-auto' },
        React.createElement(ExistingRegistrationModal, {
            isOpen: isModalOpen, courses: existingCourses,
            onModify: handleModify,
            onClose: () => setIsModalOpen(false),
            onDeleteCourse: handleDelete, deletingCourseId: deletingId,
            onCancelAll: () => { setSelectedCourses([]); setOriginalSelectedCourses(existingCourses); setIsModalOpen(false); onGoToStep(3); }
        }),
        React.createElement('div', { className: 'bg-white p-6 rounded-lg shadow' },
            React.createElement('h2', { className: 'text-2xl font-bold mb-6' }, 'Datos Personales'),
            React.createElement('div', { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
                React.createElement('div', null,
                    React.createElement('label', { className: 'block text-sm font-medium' }, 'Nombre *'),
                    React.createElement('input', { 
                        className: 'w-full border p-2 rounded', 
                        value: formData.fullName, 
                        onChange: e => setFormData({...formData, fullName: e.target.value.toUpperCase()}),
                        list: 'teachers-list'
                    }),
                    React.createElement('datalist', { id: 'teachers-list' }, 
                        teachers.map(t => React.createElement('option', { value: t.nombreCompleto }))
                    ),
                    errors.fullName && React.createElement('p', { className: 'text-red-500 text-xs' }, errors.fullName)
                ),
                React.createElement('div', null,
                    React.createElement('label', { className: 'block text-sm font-medium' }, 'CURP *'),
                    React.createElement('div', { className: 'relative' },
                        React.createElement('input', { 
                            className: 'w-full border p-2 rounded', 
                            value: formData.curp, 
                            maxLength: 18,
                            onChange: e => setFormData({...formData, curp: e.target.value.toUpperCase()}) 
                        }),
                        isChecking && React.createElement('span', { className: 'absolute right-2 top-2 text-xs text-blue-500' }, 'Verificando...')
                    ),
                    errors.curp && React.createElement('p', { className: 'text-red-500 text-xs' }, errors.curp)
                ),
                React.createElement('div', null,
                    React.createElement('label', { className: 'block text-sm font-medium' }, 'Email *'),
                    React.createElement('input', { 
                        className: 'w-full border p-2 rounded', type: 'email',
                        value: formData.email, 
                        onChange: e => setFormData({...formData, email: e.target.value.toLowerCase()}) 
                    }),
                    errors.email && React.createElement('p', { className: 'text-red-500 text-xs' }, errors.email)
                ),
                React.createElement('div', null,
                    React.createElement('label', { className: 'block text-sm font-medium' }, 'Departamento *'),
                    React.createElement('select', { 
                        className: 'w-full border p-2 rounded', 
                        value: formData.department, 
                        onChange: e => setFormData({...formData, department: e.target.value}) 
                    },
                        React.createElement('option', { value: '' }, 'Seleccione...'),
                        departments.map(d => React.createElement('option', { key: d, value: d }, d))
                    ),
                    errors.department && React.createElement('p', { className: 'text-red-500 text-xs' }, errors.department)
                )
            ),
            React.createElement('button', {
                className: 'mt-6 bg-blue-700 text-white px-6 py-2 rounded font-bold w-full md:w-auto',
                onClick: () => { if(validate()) onNext(); }
            }, 'Siguiente')
        )
    );
};

const App = () => {
    const { useState, useEffect } = React;
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({ fullName: '', curp: '', email: '', department: '', gender: 'Mujer' });
    const [allCourses, setAllCourses] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [selected, setSelected] = useState([]);
    const [original, setOriginal] = useState([]);
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        Promise.all([getCourses(), getTeachers(), getDepartments()])
            .then(([c, t, d]) => { setAllCourses(c); setTeachers(t); setDepartments(d); setLoading(false); })
            .catch(() => setError("Error cargando datos"));
    }, []);

    const handleSubmit = async () => {
        try {
            const res = await submitRegistration({
                action: 'enrollStudent',
                ...formData,
                selectedCourses: selected,
                previousRegistrationIds: original.map(c => c.id) // Enviar originales para procesar bajas
            });
            setResult(res);
            setStep(4);
        } catch (e) { setError(e.message); setStep(3); }
    };

    if (loading) return React.createElement('div', { className: 'p-10 text-center' }, 'Cargando...');

    return React.createElement('div', { className: 'min-h-screen bg-gray-100 pb-10' },
        React.createElement(Stepper, { currentStep: step, steps: ["Datos", "Cursos", "Confirmar", "Fin"] }),
        React.createElement('div', { className: 'container mx-auto px-4' },
            error && React.createElement('div', { className: 'bg-red-100 text-red-700 p-4 mb-4 rounded' }, error),
            step === 1 && React.createElement(Step1PersonalInfo, { 
                formData, setFormData, departments, teachers, allCourses, 
                setSelectedCourses: setSelected, setOriginalSelectedCourses: setOriginal,
                onNext: () => setStep(2), onGoToStep: setStep 
            }),
            step === 2 && React.createElement(Step2CourseSelection, { 
                courses: allCourses, selectedCourses: selected, setSelectedCourses: setSelected, 
                originalSelectedCourses: original,
                onNext: () => setStep(3), onBack: () => setStep(1) 
            }),
            step === 3 && React.createElement(Step3Confirmation, { 
                formData, courses: selected, originalCourses: original, 
                onSubmit: handleSubmit, onBack: () => setStep(2) 
            }),
            step === 4 && React.createElement(Step4Success, { 
                registrationResult: result?.results || [], applicantName: formData.fullName, 
                emailSent: result?.emailSent 
            })
        )
    );
};

// Componentes auxiliares (Step2, Step3, Step4, Stepper) se mantienen con lógica visual similar
// Simplificados aquí para brevedad en la respuesta, asegurando que la lógica de estado (selected/original) sea la clave.

const Step2CourseSelection = ({ courses, selectedCourses, setSelectedCourses, originalSelectedCourses, onNext, onBack }) => {
    const toggle = (c) => {
        if (selectedCourses.some(sc => sc.id === c.id)) setSelectedCourses(selectedCourses.filter(sc => sc.id !== c.id));
        else if (selectedCourses.length < 3) setSelectedCourses([...selectedCourses, c]);
    };
    return React.createElement('div', { className: 'bg-white p-6 rounded shadow' },
        React.createElement('h2', { className: 'text-xl font-bold mb-4' }, `Selección (${selectedCourses.length}/3)`),
        React.createElement('div', { className: 'grid gap-4 md:grid-cols-2' },
            courses.map(c => {
                const isSel = selectedCourses.some(sc => sc.id === c.id);
                const isOrig = originalSelectedCourses.some(oc => oc.id === c.id);
                return React.createElement('div', { 
                    key: c.id, onClick: () => toggle(c),
                    className: `p-4 border rounded cursor-pointer ${isSel ? (isOrig ? 'bg-blue-100 border-blue-500' : 'bg-green-100 border-green-500') : 'hover:bg-gray-50'}`
                }, 
                    React.createElement('h3', { className: 'font-bold' }, c.name),
                    React.createElement('p', { className: 'text-sm' }, c.schedule),
                    isOrig && !isSel && React.createElement('span', { className: 'text-xs text-red-500 font-bold' }, ' (Se dará de baja)')
                );
            })
        ),
        React.createElement('div', { className: 'mt-6 flex justify-between' },
            React.createElement('button', { onClick: onBack, className: 'bg-gray-300 px-4 py-2 rounded' }, 'Atrás'),
            React.createElement('button', { onClick: onNext, className: 'bg-blue-700 text-white px-4 py-2 rounded' }, 'Siguiente')
        )
    );
};

const Step3Confirmation = ({ formData, courses, originalCourses, onSubmit, onBack }) => {
    const toAdd = courses.filter(c => !originalCourses.some(oc => oc.id === c.id));
    const toDrop = originalCourses.filter(oc => !courses.some(c => c.id === oc.id));
    return React.createElement('div', { className: 'bg-white p-6 rounded shadow max-w-2xl mx-auto' },
        React.createElement('h2', { className: 'text-xl font-bold mb-4' }, 'Confirmación'),
        React.createElement('div', { className: 'mb-4' },
            React.createElement('p', { className: 'font-bold' }, formData.fullName),
            React.createElement('p', null, formData.email)
        ),
        toAdd.length > 0 && React.createElement('div', { className: 'mb-4 p-3 bg-green-50 rounded' },
            React.createElement('h4', { className: 'font-bold text-green-700' }, 'Altas:'),
            toAdd.map(c => React.createElement('div', { key: c.id }, c.name))
        ),
        toDrop.length > 0 && React.createElement('div', { className: 'mb-4 p-3 bg-red-50 rounded' },
            React.createElement('h4', { className: 'font-bold text-red-700' }, 'Bajas:'),
            toDrop.map(c => React.createElement('div', { key: c.id }, c.name))
        ),
        toAdd.length === 0 && toDrop.length === 0 && courses.length > 0 && React.createElement('p', { className: 'text-gray-500 italic' }, 'Sin cambios en la selección.'),
        React.createElement('div', { className: 'mt-6 flex justify-between' },
            React.createElement('button', { onClick: onBack, className: 'bg-gray-300 px-4 py-2 rounded' }, 'Atrás'),
            React.createElement('button', { onClick: onSubmit, className: 'bg-blue-700 text-white px-6 py-2 rounded font-bold' }, 'Confirmar')
        )
    );
};

const Step4Success = ({ registrationResult, applicantName, emailSent }) => React.createElement('div', { className: 'text-center p-10 bg-white rounded shadow' },
    React.createElement('h2', { className: 'text-3xl font-bold text-green-600 mb-4' }, '¡Proceso Finalizado!'),
    React.createElement('p', { className: 'text-lg' }, `Gracias ${applicantName}.`),
    emailSent ? React.createElement('p', { className: 'text-blue-600 font-bold mt-2' }, 'Se ha enviado un correo con los detalles.') : React.createElement('p', { className: 'text-red-500' }, 'No se pudo enviar el correo, toma captura.'),
    React.createElement('a', { href: 'index.html', className: 'mt-8 inline-block bg-blue-700 text-white px-6 py-2 rounded' }, 'Volver al Inicio')
);

const Stepper = ({ currentStep, steps }) => React.createElement('div', { className: 'flex justify-center my-6' }, steps.map((s, i) => React.createElement('div', { key: i, className: `mx-2 px-3 py-1 rounded-full ${i + 1 === currentStep ? 'bg-blue-700 text-white' : 'bg-gray-300'}` }, `${i+1}. ${s}`)));

window.addEventListener('load', () => {
    const root = document.getElementById('root');
    if (root) ReactDOM.createRoot(root).render(React.createElement(App));
});
