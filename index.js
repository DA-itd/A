
// =============================================================================
// SISTEMA DE INSCRIPCIÓN A CURSOS - INSTITUTO TECNOLÓGICO DE DURANGO
// Versión: 5.1.0 - Fix Stepper Layout & White Screen + Gender Field
// =============================================================================

const COURSES_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSAe4dmVN4CArjEy_lvI5qrXf16naxZLO1lAxGm2Pj4TrdnoebBg03Vv4-DCXciAkHJFiZaBMKletUs/pub?gid=0&single=true&output=csv';
const TEACHERS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSAe4dmVN4CArjEy_lvI5qrXf16naxZLO1lAxGm2Pj4TrdnoebBg03Vv4-DCXciAkHJFiZaBMKletUs/pub?gid=987931491&single=true&output=csv';
const MOCK_DEPARTMENTS = ["DEPARTAMENTO DE SISTEMAS Y COMPUTACION", "DEPARTAMENTO DE INGENIERÍA ELÉCTRICA Y ELECTRÓNICA", "DEPARTAMENTO DE CIENCIAS ECONOMICO-ADMINISTRATIVAS", "DEPARTAMENTO DE INGENIERÍA QUÍMICA-BIOQUÍMICA", "DEPARTAMENTO DE CIENCIAS DE LA TIERRA", "DEPARTAMENTO DE CIENCIAS BASICAS", "DEPARTAMENTO DE METAL-MECÁNICA", "DEPARTAMENTO DE INGENIERÍA INDUSTRIAL", "DIVISION DE ESTUDIOS DE POSGRADO E INVESTIGACION", "ADMINISTRATIVO", "EXTERNO"];

const parseCSVLine = (line) => { const result = []; let current = ''; let inQuotes = false; for (let i = 0; i < line.length; i++) { const char = line[i]; if (char === '"') { if (inQuotes && line[i + 1] === '"') { current += '"'; i++; } else { inQuotes = !inQuotes; } } else if (char === ',' && !inQuotes) { result.push(current.trim()); current = ''; } else { current += char; } } result.push(current.trim()); return result; };
const cleanCSVValue = (val) => { let cleaned = val.trim(); if (cleaned.startsWith('"') && cleaned.endsWith('"')) cleaned = cleaned.substring(1, cleaned.length - 1).replace(/""/g, '"'); return cleaned; };

const getTeachers = async () => { try { const response = await fetch(`${TEACHERS_CSV_URL}&_=${Date.now()}`); if (!response.ok) throw new Error('Error'); const csvText = await response.text(); return csvText.trim().split(/\r?\n/).slice(1).map(line => { const v = parseCSVLine(line); return v.length < 3 ? null : { nombreCompleto: cleanCSVValue(v[0]), curp: cleanCSVValue(v[1]), email: cleanCSVValue(v[2]) }; }).filter(Boolean); } catch (e) { return []; } };
const getCourses = async () => { try { const response = await fetch(`${COURSES_CSV_URL}&_=${Date.now()}`); if (!response.ok) throw new Error('Error'); const csvText = await response.text(); return csvText.trim().split(/\r?\n/).slice(1).map(line => { const v = parseCSVLine(line); return v.length < 8 ? null : { id: cleanCSVValue(v[0]), name: cleanCSVValue(v[1]), dates: cleanCSVValue(v[2]), period: cleanCSVValue(v[3]), hours: parseInt(cleanCSVValue(v[4])) || 30, location: cleanCSVValue(v[5]), schedule: cleanCSVValue(v[6]), type: cleanCSVValue(v[7]) || 'No especificado' }; }).filter(Boolean); } catch (e) { return []; } };
const getDepartments = () => Promise.resolve(MOCK_DEPARTMENTS);

const checkRegistration = async (curp, fullName) => {
    try {
        const url = new URL(window.CONFIG.APPS_SCRIPT_URL);
        url.searchParams.append('action', 'lookupByCurp');
        url.searchParams.append('curp', curp.toUpperCase());
        url.searchParams.append('fullName', fullName.toUpperCase());
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
    } catch (e) { throw new Error("No se pudo cancelar. " + e.message); }
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
            React.createElement('div', { className: 'flex items-center gap-3 mb-4' },
                React.createElement('div', { className: 'text-3xl' }, '⚠️'),
                React.createElement('h3', { className: 'text-xl font-bold text-gray-800' }, 'Registro Existente Encontrado')
            ),
            React.createElement('div', { className: 'mt-2' },
                React.createElement('p', { className: 'text-gray-600 mb-4' }, 'El sistema detectó que ya tienes cursos inscritos con este Nombre o CURP. ¿Qué deseas hacer?'),
                React.createElement('div', { className: 'mt-4 space-y-2 bg-blue-50 p-4 rounded-md border border-blue-100 max-h-60 overflow-y-auto' },
                    courses.map(c => React.createElement('div', { key: c.id, className: 'flex justify-between items-center py-2 border-b border-blue-200 last:border-0' },
                        React.createElement('span', { className: 'font-semibold text-sm text-blue-900' }, c.name),
                        React.createElement('button', {
                            onClick: () => onDeleteCourse(c.id),
                            disabled: !!deletingCourseId,
                            title: "Dar de baja este curso",
                            className: 'text-red-500 hover:bg-red-100 p-2 rounded transition-colors'
                        }, deletingCourseId === c.id ? '⏳' : '🗑️ Baja')
                    ))
                ),
                React.createElement('div', { className: 'mt-6 flex flex-col gap-3' },
                    React.createElement('button', { onClick: onModify, className: 'bg-blue-600 text-white font-bold py-3 px-4 rounded hover:bg-blue-700 shadow-md transition-all' }, '✏️ Modificar Mi Inscripción (Agregar/Quitar)'),
                    React.createElement('button', { onClick: onCancelAll, className: 'bg-white text-red-600 border border-red-200 font-bold py-2 px-4 rounded hover:bg-red-50' }, '❌ Cancelar Toda la Inscripción'),
                    React.createElement('button', { onClick: onClose, className: 'text-gray-500 hover:text-gray-700 text-sm mt-2 underline' }, 'Cerrar y corregir datos')
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
    const lastChecked = useRef({ curp: '', name: '' });

    const triggerCheck = async (curp, name) => {
        if (curp.length < 10 && name.length < 5) return false;
        
        setIsChecking(true);
        lastChecked.current = { curp, name };
        
        try {
            const ids = await checkRegistration(curp, name);
            if (ids.length > 0) {
                const found = allCourses.filter(c => ids.includes(c.id));
                if (found.length > 0) {
                    setExistingCourses(found);
                    setOriginalSelectedCourses(found); 
                    setIsModalOpen(true);
                    return true;
                }
            }
            return false;
        } finally { setIsChecking(false); }
    };

    useEffect(() => {
        if(formData.curp.length === 18 && formData.curp !== lastChecked.current.curp) {
            triggerCheck(formData.curp, formData.fullName);
        }
    }, [formData.curp]);

    const handleNameChange = (e) => {
        const val = e.target.value.toUpperCase();
        const teacher = teachers.find(t => t.nombreCompleto === val);
        
        if (teacher) {
            setFormData({ ...formData, fullName: teacher.nombreCompleto, curp: teacher.curp || formData.curp, email: teacher.email || formData.email });
            triggerCheck(teacher.curp || '', teacher.nombreCompleto);
        } else {
            setFormData({...formData, fullName: val});
        }
    };

    const handleNameBlur = () => {
        if(formData.fullName.length > 5 && formData.fullName !== lastChecked.current.name) {
            triggerCheck(formData.curp, formData.fullName);
        }
    };

    const handleNext = async () => {
        if (!validate()) return;
        setIsChecking(true);
        const hasDuplicates = await triggerCheck(formData.curp, formData.fullName);
        if (!hasDuplicates) {
            onNext();
        }
    };

    const handleDelete = async (cid) => {
        setDeletingId(cid);
        try {
            const course = existingCourses.find(c => c.id === cid);
            await cancelSingleCourse({ curp: formData.curp, fullName: formData.fullName, email: formData.email, courseToCancel: { id: course.id, name: course.name } });
            const updated = existingCourses.filter(c => c.id !== cid);
            setExistingCourses(updated);
            setOriginalSelectedCourses(updated);
            if (updated.length === 0) setIsModalOpen(false);
        } catch (e) { alert(e.message); } 
        finally { setDeletingId(null); }
    };

    const handleModify = () => {
        setSelectedCourses(existingCourses);
        setOriginalSelectedCourses(existingCourses);
        setIsModalOpen(false);
        if(validate()) onNext();
    };

    const validate = () => {
        const errs = {};
        if(!formData.fullName) errs.fullName = "Requerido";
        if(formData.curp.length !== 18) errs.curp = "18 caracteres";
        if(!formData.email) errs.email = "Requerido";
        if(!formData.department) errs.department = "Requerido";
        if(!formData.gender) errs.gender = "Requerido";
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
        React.createElement('div', { className: 'bg-white p-8 rounded-xl shadow-lg border-t-4 border-blue-900' },
            React.createElement('h2', { className: 'text-2xl font-bold mb-6 text-gray-800 border-b pb-2' }, 'Paso 1: Datos Personales'),
            React.createElement('div', { className: 'grid grid-cols-1 md:grid-cols-2 gap-6' },
                React.createElement('div', null,
                    React.createElement('label', { className: 'block text-sm font-bold text-gray-700 mb-1' }, 'Nombre Completo *'),
                    React.createElement('div', { className: 'relative' },
                        React.createElement('input', { 
                            className: 'w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all', 
                            value: formData.fullName, 
                            onChange: handleNameChange,
                            onBlur: handleNameBlur,
                            list: 'teachers-list',
                            placeholder: 'Apellido Paterno, Materno y Nombres'
                        }),
                        isChecking && React.createElement('span', { className: 'absolute right-3 top-3 text-xs text-blue-600 font-bold animate-pulse' }, 'Verificando...')
                    ),
                    React.createElement('datalist', { id: 'teachers-list' }, teachers.map(t => React.createElement('option', { value: t.nombreCompleto }))),
                    errors.fullName && React.createElement('p', { className: 'text-red-500 text-xs mt-1' }, errors.fullName)
                ),
                React.createElement('div', null,
                    React.createElement('label', { className: 'block text-sm font-bold text-gray-700 mb-1' }, 'CURP *'),
                    React.createElement('input', { 
                        className: 'w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all', 
                        value: formData.curp, 
                        maxLength: 18, 
                        onChange: e => setFormData({...formData, curp: e.target.value.toUpperCase()}),
                        placeholder: 'Clave Única de Registro de Población'
                    }),
                    errors.curp && React.createElement('p', { className: 'text-red-500 text-xs mt-1' }, errors.curp)
                ),
                React.createElement('div', null,
                    React.createElement('label', { className: 'block text-sm font-bold text-gray-700 mb-1' }, 'Email Institucional *'),
                    React.createElement('input', { 
                        className: 'w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all', 
                        type: 'email', 
                        value: formData.email, 
                        onChange: e => setFormData({...formData, email: e.target.value.toLowerCase()}),
                        placeholder: '@itdurango.edu.mx'
                    }),
                    errors.email && React.createElement('p', { className: 'text-red-500 text-xs mt-1' }, errors.email)
                ),
                React.createElement('div', null,
                    React.createElement('label', { className: 'block text-sm font-bold text-gray-700 mb-1' }, 'Género *'),
                    React.createElement('select', { 
                        className: 'w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white', 
                        value: formData.gender, 
                        onChange: e => setFormData({...formData, gender: e.target.value}) 
                    },
                        React.createElement('option', { value: 'Mujer' }, 'Mujer'),
                        React.createElement('option', { value: 'Hombre' }, 'Hombre')
                    ),
                    errors.gender && React.createElement('p', { className: 'text-red-500 text-xs mt-1' }, errors.gender)
                ),
                React.createElement('div', { className: 'md:col-span-2' },
                    React.createElement('label', { className: 'block text-sm font-bold text-gray-700 mb-1' }, 'Departamento de Adscripción *'),
                    React.createElement('select', { 
                        className: 'w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white', 
                        value: formData.department, 
                        onChange: e => setFormData({...formData, department: e.target.value}) 
                    },
                        React.createElement('option', { value: '' }, '-- Seleccione su departamento --'),
                        departments.map(d => React.createElement('option', { key: d, value: d }, d))
                    ),
                    errors.department && React.createElement('p', { className: 'text-red-500 text-xs mt-1' }, errors.department)
                )
            ),
            React.createElement('div', { className: 'mt-8 flex justify-end' },
                React.createElement('button', {
                    className: `px-8 py-3 rounded-lg font-bold text-white transition-all shadow-md transform hover:-translate-y-1 ${isChecking ? 'bg-gray-400 cursor-wait' : 'bg-blue-900 hover:bg-blue-800'}`,
                    onClick: handleNext,
                    disabled: isChecking
                }, isChecking ? 'Verificando...' : 'Siguiente Paso ➝')
            )
        )
    );
};

const Step2CourseSelection = ({ courses, selectedCourses, setSelectedCourses, originalSelectedCourses, onNext, onBack }) => {
    const toggle = (c) => {
        if (selectedCourses.some(sc => sc.id === c.id)) setSelectedCourses(selectedCourses.filter(sc => sc.id !== c.id));
        else if (selectedCourses.length < 3) setSelectedCourses([...selectedCourses, c]);
        else alert("Máximo 3 cursos permitidos");
    };
    return React.createElement('div', { className: 'bg-white p-8 rounded-xl shadow-lg border-t-4 border-blue-900' },
        React.createElement('div', { className: 'flex justify-between items-center mb-6 border-b pb-4' },
            React.createElement('h2', { className: 'text-2xl font-bold text-gray-800' }, 'Paso 2: Selección de Cursos'),
            React.createElement('span', { className: 'bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-bold' }, `${selectedCourses.length} / 3 Seleccionados`)
        ),
        React.createElement('div', { className: 'grid gap-4 md:grid-cols-2 lg:grid-cols-3 max-h-[600px] overflow-y-auto custom-scrollbar p-1' },
            courses.map(c => {
                const isSel = selectedCourses.some(sc => sc.id === c.id);
                const isOrig = originalSelectedCourses.some(oc => oc.id === c.id);
                return React.createElement('div', { 
                    key: c.id, onClick: () => toggle(c),
                    className: `p-4 border-2 rounded-xl cursor-pointer transition-all hover:shadow-md relative ${isSel ? (isOrig ? 'bg-blue-50 border-blue-500' : 'bg-green-50 border-green-500 transform scale-[1.02]') : 'bg-white border-gray-200 hover:border-gray-300'}`
                }, 
                    isSel && React.createElement('div', { className: 'absolute top-2 right-2 text-xl' }, isOrig ? '🟦' : '✅'),
                    React.createElement('h3', { className: 'font-bold text-gray-800 mb-1 pr-6' }, c.name),
                    React.createElement('div', { className: 'text-xs text-gray-500 space-y-1' },
                        React.createElement('p', null, `📅 ${c.dates}`),
                        React.createElement('p', null, `⏰ ${c.schedule}`),
                        React.createElement('p', null, `📍 ${c.location}`)
                    ),
                    isOrig && !isSel && React.createElement('span', { className: 'text-xs text-red-500 font-bold block mt-2 bg-red-50 p-1 rounded text-center' }, '⚠️ Se dará de baja')
                );
            })
        ),
        React.createElement('div', { className: 'mt-8 flex justify-between' },
            React.createElement('button', { onClick: onBack, className: 'px-6 py-2 rounded-lg font-bold text-gray-600 bg-gray-200 hover:bg-gray-300 transition-colors' }, '← Atrás'),
            React.createElement('button', { onClick: onNext, className: 'px-8 py-3 rounded-lg font-bold text-white bg-blue-900 hover:bg-blue-800 shadow-md transition-all' }, 'Siguiente Paso ➝')
        )
    );
};

const Step3Confirmation = ({ formData, courses, originalCourses, onSubmit, onBack }) => {
    const toAdd = courses.filter(c => !originalCourses.some(oc => oc.id === c.id));
    const toDrop = originalCourses.filter(oc => !courses.some(c => c.id === oc.id));
    return React.createElement('div', { className: 'bg-white p-8 rounded-xl shadow-lg border-t-4 border-blue-900 max-w-3xl mx-auto' },
        React.createElement('h2', { className: 'text-2xl font-bold mb-6 text-gray-800 text-center' }, 'Confirmar Inscripción'),
        
        React.createElement('div', { className: 'bg-gray-50 p-4 rounded-lg mb-6 border border-gray-200' },
            React.createElement('h3', { className: 'font-bold text-gray-700 mb-2 uppercase text-xs tracking-wider' }, 'Datos del Solicitante'),
            React.createElement('p', { className: 'text-lg font-bold text-gray-900' }, formData.fullName),
            React.createElement('p', { className: 'text-gray-600' }, formData.email),
            React.createElement('p', { className: 'text-gray-600 text-sm' }, `${formData.gender} • ${formData.department}`)
        ),

        toAdd.length > 0 && React.createElement('div', { className: 'mb-4 p-4 bg-green-50 border-l-4 border-green-500 rounded shadow-sm' },
            React.createElement('h4', { className: 'font-bold text-green-800 mb-2 flex items-center gap-2' }, React.createElement('span', null, '✨'), 'Nuevos Cursos (Altas):'),
            toAdd.map(c => React.createElement('div', { key: c.id, className: 'text-sm mb-2 pb-2 border-b border-green-100 last:border-0' }, 
                React.createElement('p', { className: 'font-bold' }, c.name),
                React.createElement('p', { className: 'text-green-700 text-xs' }, `${c.dates} | ${c.schedule}`)
            ))
        ),
        
        toDrop.length > 0 && React.createElement('div', { className: 'mb-4 p-4 bg-red-50 border-l-4 border-red-500 rounded shadow-sm' },
            React.createElement('h4', { className: 'font-bold text-red-800 mb-2 flex items-center gap-2' }, React.createElement('span', null, '🗑️'), 'Cursos a Cancelar (Bajas):'),
            toDrop.map(c => React.createElement('div', { key: c.id, className: 'text-sm mb-1' }, `❌ ${c.name}`))
        ),
        
        toAdd.length === 0 && toDrop.length === 0 && courses.length > 0 && React.createElement('div', { className: 'p-4 bg-blue-50 text-blue-800 rounded mb-4 text-center' }, 
            'No hay cambios en tu selección actual. Se mantendrán tus cursos vigentes.'
        ),
        
        React.createElement('div', { className: 'mt-8 flex justify-between gap-4' },
            React.createElement('button', { onClick: onBack, className: 'px-6 py-2 rounded-lg font-bold text-gray-600 bg-gray-200 hover:bg-gray-300 transition-colors' }, '← Corregir'),
            React.createElement('button', { onClick: onSubmit, className: 'flex-1 px-6 py-3 rounded-lg font-bold text-white bg-green-600 hover:bg-green-700 shadow-lg transition-all transform hover:scale-[1.02]' }, '✅ Confirmar Inscripción')
        )
    );
};

const Step4Success = ({ registrationResult, applicantName, emailSent }) => React.createElement('div', { className: 'text-center p-10 bg-white rounded-xl shadow-2xl max-w-2xl mx-auto border-t-8 border-green-500' },
    React.createElement('div', { className: 'text-7xl mb-6 animate-bounce' }, '🎉'),
    React.createElement('h2', { className: 'text-3xl font-bold text-gray-800 mb-2' }, '¡Inscripción Exitosa!'),
    React.createElement('p', { className: 'text-lg text-gray-600 mb-6' }, `Gracias ${applicantName}, tus cursos han sido registrados correctamente.`),
    
    registrationResult && registrationResult.length > 0 && React.createElement('div', { className: 'bg-gray-50 p-6 rounded-lg mb-6 text-left border border-gray-200' },
        React.createElement('h3', { className: 'font-bold text-gray-700 mb-3 border-b pb-2' }, 'Folios Generados:'),
        registrationResult.map((r, i) => React.createElement('div', { key: i, className: 'flex justify-between items-center mb-2' },
            React.createElement('span', { className: 'text-sm text-gray-600' }, r.status),
            React.createElement('span', { className: 'font-mono font-bold text-blue-700 bg-blue-100 px-2 py-1 rounded' }, r.folio)
        ))
    ),

    emailSent 
        ? React.createElement('div', { className: 'p-4 bg-blue-50 text-blue-800 rounded-lg flex items-center justify-center gap-2' }, React.createElement('span', null, '📧'), 'Se ha enviado un correo de confirmación.') 
        : React.createElement('div', { className: 'p-4 bg-red-50 text-red-700 rounded-lg border border-red-200' }, '⚠️ No se pudo enviar el correo. Toma captura de esta pantalla.'),
    
    React.createElement('a', { href: 'index.html', className: 'mt-8 inline-block bg-blue-900 text-white px-8 py-3 rounded-lg font-bold hover:bg-blue-800 transition-all shadow-md hover:shadow-lg' }, 'Volver al Inicio')
);

const Stepper = ({ currentStep, steps }) => React.createElement('div', { className: 'flex justify-between items-center w-full max-w-3xl mx-auto my-8 px-4' }, steps.map((s, i) => React.createElement('div', { key: i, className: `flex items-center ${i < steps.length - 1 ? 'flex-1' : ''}` },
    React.createElement('div', { className: 'relative flex flex-col items-center z-10' },
        React.createElement('div', { className: `flex items-center justify-center w-10 h-10 rounded-full font-bold transition-all duration-300 border-2 ${i + 1 <= currentStep ? 'bg-blue-900 text-white border-blue-900 scale-110 shadow-md' : 'bg-white text-gray-400 border-gray-300'}` }, i + 1),
        React.createElement('span', { className: `absolute top-12 text-xs font-bold whitespace-nowrap ${i + 1 <= currentStep ? 'text-blue-900' : 'text-gray-400'}` }, s)
    ),
    i < steps.length - 1 && React.createElement('div', { className: `flex-1 h-1 mx-2 rounded transition-colors duration-300 ${i + 1 < currentStep ? 'bg-blue-900' : 'bg-gray-200'}` })
)));

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
            .catch(() => setError("Error cargando datos del servidor. Verifique su conexión."));
    }, []);

    const handleSubmit = async () => {
        setLoading(true);
        try {
            const res = await submitRegistration({
                action: 'enrollStudent',
                ...formData,
                selectedCourses: selected,
                previousRegistrationIds: original.map(c => c.id) 
            });
            setResult(res);
            setStep(4);
        } catch (e) { setError(e.message); setStep(3); }
        finally { setLoading(false); }
    };

    if (loading && step === 1) return React.createElement('div', { className: 'min-h-screen flex flex-col items-center justify-center bg-gray-50' }, 
        React.createElement('div', { className: 'animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-900 mb-4' }),
        React.createElement('p', { className: 'text-gray-600 font-bold' }, 'Cargando sistema de inscripciones...')
    );

    return React.createElement('div', { className: 'min-h-screen bg-gray-50 pb-12 font-sans' },
        React.createElement(Stepper, { currentStep: step, steps: ["Datos", "Cursos", "Confirmar", "Fin"] }),
        React.createElement('div', { className: 'container mx-auto px-4' },
            error && React.createElement('div', { className: 'max-w-4xl mx-auto bg-red-50 text-red-700 p-4 mb-6 rounded-lg border-l-4 border-red-600 shadow-sm flex items-center gap-3' }, 
                React.createElement('span', { className: 'text-2xl' }, '🚫'),
                React.createElement('div', null, React.createElement('strong', null, 'Error: '), error)
            ),
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

window.addEventListener('load', () => {
    const root = document.getElementById('root');
    if (root) ReactDOM.createRoot(root).render(React.createElement(App));
});
