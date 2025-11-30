
// =============================================================================
// SISTEMA DE INSCRIPCIÓN A CURSOS - INSTITUTO TECNOLÓGICO DE DURANGO
// Versión: 7.2.0 - UI Fixes & Auto Gender
// =============================================================================

const COURSES_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSAe4dmVN4CArjEy_lvI5qrXf16naxZLO1lAxGm2Pj4TrdnoebBg03Vv4-DCXciAkHJFiZaBMKletUs/pub?gid=0&single=true&output=csv';
const TEACHERS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSAe4dmVN4CArjEy_lvI5qrXf16naxZLO1lAxGm2Pj4TrdnoebBg03Vv4-DCXciAkHJFiZaBMKletUs/pub?gid=987931491&single=true&output=csv';
const MOCK_DEPARTMENTS = ["DEPARTAMENTO DE SISTEMAS Y COMPUTACION", "DEPARTAMENTO DE INGENIERÍA ELÉCTRICA Y ELECTRÓNICA", "DEPARTAMENTO DE CIENCIAS ECONOMICO-ADMINISTRATIVAS", "DEPARTAMENTO DE INGENIERÍA QUÍMICA-BIOQUÍMICA", "DEPARTAMENTO DE CIENCIAS DE LA TIERRA", "DEPARTAMENTO DE CIENCIAS BASICAS", "DEPARTAMENTO DE METAL-MECÁNICA", "DEPARTAMENTO DE INGENIERÍA INDUSTRIAL", "DIVISION DE ESTUDIOS DE POSGRADO E INVESTIGACION", "ADMINISTRATIVO", "EXTERNO"];

const parseCSVLine = (line) => { const result = []; let current = ''; let inQuotes = false; for (let i = 0; i < line.length; i++) { const char = line[i]; if (char === '"') { if (inQuotes && line[i + 1] === '"') { current += '"'; i++; } else { inQuotes = !inQuotes; } } else if (char === ',' && !inQuotes) { result.push(current.trim()); current = ''; } else { current += char; } } result.push(current.trim()); return result; };
const cleanCSVValue = (val) => { let cleaned = val.trim(); if (cleaned.startsWith('"') && cleaned.endsWith('"')) cleaned = cleaned.substring(1, cleaned.length - 1).replace(/""/g, '"'); return cleaned; };

const getTeachers = async () => { try { const response = await fetch(`${TEACHERS_CSV_URL}&_=${Date.now()}`); if (!response.ok) throw new Error('Error'); const csvText = await response.text(); return csvText.trim().split(/\r?\n/).slice(1).map(line => { const v = parseCSVLine(line); return v.length < 3 ? null : { nombreCompleto: cleanCSVValue(v[0]), curp: cleanCSVValue(v[1]), email: cleanCSVValue(v[2]) }; }).filter(Boolean); } catch (e) { return []; } };
const getCourses = async () => { try { const response = await fetch(`${COURSES_CSV_URL}&_=${Date.now()}`); if (!response.ok) throw new Error('Error'); const csvText = await response.text(); return csvText.trim().split(/\r?\n/).slice(1).map(line => { const v = parseCSVLine(line); return v.length < 8 ? null : { id: cleanCSVValue(v[0]), name: cleanCSVValue(v[1]), dates: cleanCSVValue(v[2]), period: cleanCSVValue(v[3]), hours: parseInt(cleanCSVValue(v[4])) || 30, location: cleanCSVValue(v[5]), schedule: cleanCSVValue(v[6]), type: cleanCSVValue(v[7]) || 'No especificado' }; }).filter(Boolean); } catch (e) { return []; } };
const getDepartments = () => Promise.resolve(MOCK_DEPARTMENTS);

const getGenderFromCurp = (curp) => {
    if (!curp || curp.length < 11) return '';
    const genderChar = curp.charAt(10).toUpperCase();
    if (genderChar === 'H') return 'Hombre';
    if (genderChar === 'M') return 'Mujer';
    return '';
};

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
        const res = await fetch(window.CONFIG.APPS_SCRIPT_URL, { method: 'POST', mode: 'cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ ...payload, action: 'cancelSingle' }) });
        const json = await res.json();
        if (!json.success) throw new Error(json.message);
        return json;
    } catch (e) { throw new Error("No se pudo cancelar. " + e.message); }
};

const cancelSelectedCourses = async (payload) => {
    try {
        const res = await fetch(window.CONFIG.APPS_SCRIPT_URL, { 
            method: 'POST', mode: 'cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
            body: JSON.stringify({ ...payload, action: 'cancelSelectedCourses' }) 
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.message);
        return json;
    } catch (e) { throw new Error("No se pudo cancelar todo. " + e.message); }
};

const submitRegistration = async (data) => {
    try {
        const res = await fetch(window.CONFIG.APPS_SCRIPT_URL, { method: 'POST', mode: 'cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(data) });
        const json = await res.json();
        if (!json.success) throw new Error(json.message);
        return json;
    } catch (e) { throw e; }
};

// =============================================================================
// COMPONENTES UI
// =============================================================================

const ExistingRegistrationModal = ({ isOpen, courses, onModify, onClose, onDeleteCourse, deletingCourseId, onCancelAll, isDeletingAll }) => {
    if (!isOpen) return null;
    return React.createElement('div', { className: 'fixed inset-0 bg-slate-900 bg-opacity-75 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4 backdrop-blur-sm' },
        React.createElement('div', { className: 'relative mx-auto p-6 border w-full max-w-lg shadow-2xl rounded-xl bg-white' },
            React.createElement('div', { className: 'flex items-center gap-4 mb-4 text-amber-600' },
                React.createElement('span', { className: 'text-4xl' }, '⚠️'),
                React.createElement('h3', { className: 'text-xl font-bold text-gray-800' }, 'Registro Existente')
            ),
            React.createElement('p', { className: 'text-gray-600 mb-6' }, 'El sistema detectó que ya tienes cursos inscritos. ¿Qué deseas hacer?'),
            React.createElement('div', { className: 'space-y-2 bg-slate-50 p-4 rounded-lg border border-slate-200 max-h-60 overflow-y-auto mb-6' },
                courses.map(c => React.createElement('div', { key: c.id, className: 'flex justify-between items-center py-3 border-b border-slate-200 last:border-0' },
                    React.createElement('span', { className: 'font-semibold text-sm text-slate-800' }, c.name),
                    React.createElement('button', {
                        onClick: () => onDeleteCourse(c.id),
                        disabled: !!deletingCourseId || isDeletingAll,
                        className: 'text-red-500 hover:bg-red-50 px-3 py-1 rounded-md text-xs font-bold border border-red-200 transition-colors'
                    }, deletingCourseId === c.id ? '⏳' : 'BAJA')
                ))
            ),
            React.createElement('div', { className: 'flex flex-col gap-3' },
                React.createElement('button', { 
                    onClick: onModify, 
                    disabled: isDeletingAll,
                    className: 'bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 shadow-lg transition-all disabled:opacity-50' 
                }, '✏️ Modificar Mi Inscripción'),
                
                React.createElement('button', { 
                    onClick: onCancelAll, 
                    disabled: isDeletingAll,
                    className: 'bg-white text-red-600 border border-red-200 font-bold py-2 px-4 rounded-lg hover:bg-red-50 disabled:opacity-50 flex justify-center items-center gap-2' 
                }, isDeletingAll ? React.createElement('span', {className: 'animate-spin h-4 w-4 border-2 border-red-600 rounded-full border-t-transparent'}) : null, 
                   isDeletingAll ? 'Procesando Baja...' : '❌ Dar de Baja TODOS los Cursos'),
                
                React.createElement('button', { 
                    onClick: onClose, 
                    disabled: isDeletingAll,
                    className: 'text-slate-400 hover:text-slate-600 text-sm mt-2 disabled:opacity-50' 
                }, 'Cerrar ventana')
            )
        )
    );
};

const Step1PersonalInfo = ({ formData, setFormData, departments, teachers, allCourses, setSelectedCourses, setOriginalSelectedCourses, onNext }) => {
    const { useState, useEffect, useRef, useMemo } = React;
    const [errors, setErrors] = useState({});
    const [isChecking, setIsChecking] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [existingCourses, setExistingCourses] = useState([]);
    const [deletingId, setDeletingId] = useState(null);
    const [isDeletingAll, setIsDeletingAll] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const lastChecked = useRef({ curp: '', name: '' });

    const suggestions = useMemo(() => {
        const input = formData.fullName ? formData.fullName.toUpperCase() : '';
        if (input.length < 3) return []; 
        return teachers.filter(t => t.nombreCompleto.includes(input)).slice(0, 8);
    }, [teachers, formData.fullName]);

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
            const gender = getGenderFromCurp(formData.curp);
            if (gender) setFormData(prev => ({ ...prev, gender }));
        }
    }, [formData.curp]);

    const handleNameChange = (e) => {
        setFormData({...formData, fullName: e.target.value.toUpperCase()});
        setShowSuggestions(true);
    };

    const handleSuggestionClick = (teacher) => {
        const autoGender = teacher.curp ? getGenderFromCurp(teacher.curp) : formData.gender;
        setFormData(prev => ({ 
            ...prev, 
            fullName: teacher.nombreCompleto, 
            curp: teacher.curp || prev.curp, 
            email: teacher.email || prev.email,
            gender: autoGender
        }));
        setShowSuggestions(false);
        triggerCheck(teacher.curp || '', teacher.nombreCompleto);
    };

    const handleNameBlur = () => {
        setTimeout(() => setShowSuggestions(false), 200);
        if(formData.fullName.length > 5 && formData.fullName !== lastChecked.current.name) {
            triggerCheck(formData.curp, formData.fullName);
        }
    };

    const handleNext = async () => {
        if (!validate()) return;
        setIsChecking(true);
        const hasDuplicates = await triggerCheck(formData.curp, formData.fullName);
        if (!hasDuplicates) onNext();
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

    const handleCancelAll = async () => {
        if (!confirm("¿Estás seguro de que deseas dar de baja TODOS los cursos actuales? Esta acción es irreversible.")) return;
        setIsDeletingAll(true);
        try {
            await cancelSelectedCourses({ curp: formData.curp, fullName: formData.fullName, email: formData.email, courseIds: existingCourses.map(c => c.id) });
            setExistingCourses([]); setOriginalSelectedCourses([]); setSelectedCourses([]); setIsModalOpen(false);
            alert("Se han dado de baja todos los cursos exitosamente.");
        } catch (e) { alert("Error al cancelar cursos: " + e.message); } 
        finally { setIsDeletingAll(false); }
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
            onModify: handleModify, onClose: () => setIsModalOpen(false),
            onDeleteCourse: handleDelete, deletingCourseId: deletingId,
            onCancelAll: handleCancelAll, isDeletingAll: isDeletingAll
        }),
        React.createElement('div', { className: 'bg-white p-8 rounded-2xl shadow-xl border-t-8 border-blue-900' },
            React.createElement('div', { className: 'mb-8 pb-4 border-b border-gray-100' },
                React.createElement('h2', { className: 'text-2xl font-bold text-gray-800' }, 'Datos Personales'),
                React.createElement('p', { className: 'text-sm text-gray-500' }, 'Ingrese sus datos para verificar su historial.')
            ),
            React.createElement('div', { className: 'grid grid-cols-1 md:grid-cols-2 gap-6' },
                React.createElement('div', { className: 'relative' },
                    React.createElement('label', { className: 'block text-sm font-bold text-gray-700 mb-2' }, 'Nombre Completo *'),
                    React.createElement('input', { 
                        className: 'w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none transition-all uppercase', 
                        value: formData.fullName, onChange: handleNameChange, onBlur: handleNameBlur,
                        placeholder: 'Nombre Apellido Paterno Materno',
                        autoComplete: 'off'
                    }),
                    showSuggestions && suggestions.length > 0 && React.createElement('ul', { className: 'absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-xl mt-1 max-h-60 overflow-auto' },
                        suggestions.map((t, idx) => React.createElement('li', {
                            key: idx,
                            onMouseDown: (e) => { e.preventDefault(); handleSuggestionClick(t); },
                            className: 'px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm text-gray-700 border-b border-gray-100 last:border-0'
                        }, t.nombreCompleto))
                    ),
                    isChecking && React.createElement('span', { className: 'absolute right-3 top-10 text-xs text-blue-600 font-bold animate-pulse' }, 'Buscando...'),
                    errors.fullName && React.createElement('p', { className: 'text-red-500 text-xs mt-1' }, errors.fullName)
                ),
                React.createElement('div', null,
                    React.createElement('label', { className: 'block text-sm font-bold text-gray-700 mb-2' }, 'CURP *'),
                    React.createElement('input', { 
                        className: 'w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none transition-all uppercase', 
                        value: formData.curp, maxLength: 18, 
                        onChange: e => {
                            const val = e.target.value.toUpperCase();
                            const autoGender = getGenderFromCurp(val);
                            setFormData(prev => ({...prev, curp: val, ...(autoGender && {gender: autoGender})}));
                        }
                    }),
                    errors.curp && React.createElement('p', { className: 'text-red-500 text-xs mt-1' }, errors.curp)
                ),
                React.createElement('div', null,
                    React.createElement('label', { className: 'block text-sm font-bold text-gray-700 mb-2' }, 'Email Institucional *'),
                    React.createElement('input', { 
                        className: 'w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none transition-all', 
                        type: 'email', value: formData.email, 
                        onChange: e => setFormData({...formData, email: e.target.value.toLowerCase()}),
                        placeholder: '@itdurango.edu.mx'
                    }),
                    errors.email && React.createElement('p', { className: 'text-red-500 text-xs mt-1' }, errors.email)
                ),
                React.createElement('div', null,
                    React.createElement('label', { className: 'block text-sm font-bold text-gray-700 mb-2' }, 'Género *'),
                    React.createElement('select', { 
                        className: 'w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none bg-white', 
                        value: formData.gender, onChange: e => setFormData({...formData, gender: e.target.value}) 
                    },
                        React.createElement('option', { value: '' }, '-- Seleccione --'),
                        React.createElement('option', { value: 'Mujer' }, 'Mujer'),
                        React.createElement('option', { value: 'Hombre' }, 'Hombre')
                    ),
                    errors.gender && React.createElement('p', { className: 'text-red-500 text-xs mt-1' }, errors.gender)
                ),
                React.createElement('div', { className: 'md:col-span-2' },
                    React.createElement('label', { className: 'block text-sm font-bold text-gray-700 mb-2' }, 'Departamento *'),
                    React.createElement('select', { 
                        className: 'w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none bg-white', 
                        value: formData.department, onChange: e => setFormData({...formData, department: e.target.value}) 
                    },
                        React.createElement('option', { value: '' }, '-- Seleccione Departamento --'),
                        departments.map(d => React.createElement('option', { key: d, value: d }, d))
                    ),
                    errors.department && React.createElement('p', { className: 'text-red-500 text-xs mt-1' }, errors.department)
                )
            ),
            React.createElement('div', { className: 'mt-8 flex justify-end' },
                React.createElement('button', {
                    className: `px-10 py-3 rounded-lg font-bold text-white transition-all shadow-lg transform hover:-translate-y-1 ${isChecking ? 'bg-slate-400 cursor-wait' : 'bg-blue-900 hover:bg-blue-800'}`,
                    onClick: handleNext, disabled: isChecking
                }, isChecking ? 'Verificando...' : 'Siguiente')
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

    const groupedCourses = courses.reduce((groups, course) => {
        const dateKey = course.dates || 'Fechas por definir';
        if (!groups[dateKey]) groups[dateKey] = [];
        groups[dateKey].push(course);
        return groups;
    }, {});

    return React.createElement('div', { className: 'bg-white p-8 rounded-2xl shadow-xl border-t-8 border-blue-900' },
        React.createElement('div', { className: 'flex justify-between items-center mb-8 pb-4 border-b border-gray-100' },
            React.createElement('h2', { className: 'text-2xl font-bold text-gray-800' }, 'Selección de Cursos'),
            React.createElement('div', { className: 'bg-blue-50 text-blue-800 px-4 py-2 rounded-full font-bold shadow-sm' }, 
                `${selectedCourses.length} / 3 Seleccionados`
            )
        ),
        
        React.createElement('div', { className: 'max-h-[650px] overflow-y-auto custom-scrollbar p-2 space-y-8' },
            Object.entries(groupedCourses).map(([dateLabel, groupCourses]) => 
                React.createElement('div', { key: dateLabel },
                    React.createElement('div', { className: 'flex items-center gap-3 mb-4' },
                        React.createElement('div', { className: 'h-8 w-1 bg-blue-500 rounded-full' }),
                        React.createElement('h3', { className: 'text-lg font-bold text-slate-700' }, dateLabel)
                    ),
                    React.createElement('div', { className: 'grid gap-4 md:grid-cols-2 lg:grid-cols-3' },
                        groupCourses.map(c => {
                            const isSel = selectedCourses.some(sc => sc.id === c.id);
                            const isOrig = originalSelectedCourses.some(oc => oc.id === c.id);
                            return React.createElement('div', { 
                                key: c.id, onClick: () => toggle(c),
                                className: `p-5 rounded-xl cursor-pointer transition-all border-2 relative group ${
                                    isSel 
                                        ? (isOrig ? 'bg-blue-50 border-blue-500 shadow-md' : 'bg-green-50 border-green-500 shadow-md transform scale-[1.02]') 
                                        : 'bg-white border-slate-100 hover:border-slate-300 hover:shadow-lg'
                                }`
                            }, 
                                isSel && React.createElement('div', { className: 'absolute top-3 right-3 text-xl animate-bounce' }, isOrig ? '🟦' : '✅'),
                                React.createElement('h4', { className: 'font-bold text-slate-800 mb-2 pr-6 leading-tight' }, c.name),
                                React.createElement('div', { className: 'space-y-1' },
                                    React.createElement('div', { className: 'flex items-center gap-2 text-xs text-slate-500' },
                                        React.createElement('span', null, '⏰'),
                                        React.createElement('span', null, c.schedule)
                                    ),
                                    React.createElement('div', { className: 'flex items-center gap-2 text-xs text-slate-500' },
                                        React.createElement('span', null, '📍'),
                                        React.createElement('span', null, c.location)
                                    )
                                ),
                                isOrig && !isSel && React.createElement('div', { className: 'mt-3 text-xs text-red-600 font-bold bg-red-50 py-1 px-2 rounded inline-block' }, '⚠️ Se dará de baja')
                            );
                        })
                    )
                )
            )
        ),
        
        React.createElement('div', { className: 'mt-8 flex justify-between pt-4 border-t border-gray-100' },
            React.createElement('button', { onClick: onBack, className: 'px-6 py-2 rounded-lg font-bold text-slate-600 hover:bg-slate-100 transition-colors' }, '← Atrás'),
            React.createElement('button', { onClick: onNext, className: 'px-10 py-3 rounded-lg font-bold text-white bg-blue-900 hover:bg-blue-800 shadow-lg transition-all' }, 'Siguiente')
        )
    );
};

const Step3Confirmation = ({ formData, courses, originalCourses, onSubmit, onBack }) => {
    const toAdd = courses.filter(c => !originalCourses.some(oc => oc.id === c.id));
    const toDrop = originalCourses.filter(oc => !courses.some(c => c.id === oc.id));
    return React.createElement('div', { className: 'bg-white p-8 rounded-2xl shadow-xl border-t-8 border-blue-900 max-w-3xl mx-auto' },
        React.createElement('h2', { className: 'text-3xl font-bold mb-8 text-slate-800 text-center' }, 'Confirmar Movimientos'),
        
        React.createElement('div', { className: 'bg-slate-50 p-6 rounded-xl mb-8 border border-slate-100' },
            React.createElement('div', { className: 'grid md:grid-cols-2 gap-4' },
                React.createElement('div', null,
                    React.createElement('p', { className: 'text-xs text-slate-400 uppercase font-bold tracking-wider' }, 'Solicitante'),
                    React.createElement('p', { className: 'text-lg font-bold text-slate-800' }, formData.fullName)
                ),
                React.createElement('div', null,
                    React.createElement('p', { className: 'text-xs text-slate-400 uppercase font-bold tracking-wider' }, 'Email'),
                    React.createElement('p', { className: 'text-slate-600' }, formData.email)
                )
            )
        ),

        toAdd.length > 0 && React.createElement('div', { className: 'mb-6' },
            React.createElement('h4', { className: 'font-bold text-green-700 mb-3 flex items-center gap-2' }, '✨ Altas (Nuevos Cursos)'),
            React.createElement('div', { className: 'bg-green-50 rounded-xl border border-green-100 overflow-hidden' },
                toAdd.map(c => React.createElement('div', { key: c.id, className: 'p-4 border-b border-green-100 last:border-0' }, 
                    React.createElement('p', { className: 'font-bold text-green-900' }, c.name),
                    React.createElement('p', { className: 'text-xs text-green-700 mt-1' }, `${c.dates} • ${c.schedule}`)
                ))
            )
        ),
        
        toDrop.length > 0 && React.createElement('div', { className: 'mb-6' },
            React.createElement('h4', { className: 'font-bold text-red-700 mb-3 flex items-center gap-2' }, '🗑️ Bajas (Cursos a Cancelar)'),
            React.createElement('div', { className: 'bg-red-50 rounded-xl border border-red-100 overflow-hidden' },
                toDrop.map(c => React.createElement('div', { key: c.id, className: 'p-4 border-b border-red-100 last:border-0' }, 
                    React.createElement('p', { className: 'font-bold text-red-900' }, c.name),
                    React.createElement('p', { className: 'text-xs text-red-700 mt-1' }, 'Se liberará este lugar')
                ))
            )
        ),
        
        toAdd.length === 0 && toDrop.length === 0 && courses.length > 0 && React.createElement('div', { className: 'p-6 bg-blue-50 text-blue-800 rounded-xl text-center border border-blue-100 mb-6' }, 
            'No hay cambios en tu selección. Se mantendrán tus cursos actuales.'
        ),
        
        React.createElement('div', { className: 'flex justify-between gap-4 mt-8 pt-6 border-t border-gray-100' },
            React.createElement('button', { onClick: onBack, className: 'px-6 py-3 rounded-lg font-bold text-slate-500 hover:bg-slate-100 transition-colors' }, 'Corregir'),
            React.createElement('button', { onClick: onSubmit, className: 'flex-1 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold py-3 rounded-lg shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1' }, '✅ Confirmar Inscripción')
        )
    );
};

const Step4Success = ({ registrationResult, applicantName, emailSent }) => React.createElement('div', { className: 'text-center p-12 bg-white rounded-2xl shadow-2xl max-w-3xl mx-auto border-t-8 border-green-500' },
    React.createElement('div', { className: 'text-8xl mb-6' }, '🎉'),
    React.createElement('h2', { className: 'text-4xl font-bold text-slate-800 mb-4' }, '¡Todo Listo!'),
    React.createElement('p', { className: 'text-lg text-slate-600 mb-8' }, `Gracias ${applicantName}, el proceso ha finalizado correctamente.`),
    
    registrationResult && registrationResult.length > 0 && React.createElement('div', { className: 'bg-slate-50 p-8 rounded-xl mb-8 text-left border border-slate-100' },
        React.createElement('h3', { className: 'font-bold text-slate-400 uppercase text-xs tracking-wider mb-4' }, 'Comprobantes Generados'),
        registrationResult.map((r, i) => React.createElement('div', { key: i, className: 'flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 pb-4 border-b border-slate-200 last:border-0 last:pb-0 last:mb-0' },
            React.createElement('div', { className: 'mb-2 sm:mb-0' },
                React.createElement('p', { className: 'font-bold text-slate-800' }, r.name || 'Curso Registrado'),
                React.createElement('span', { className: 'text-xs text-green-600 font-bold bg-green-100 px-2 py-1 rounded' }, r.status)
            ),
            React.createElement('span', { className: 'font-mono font-bold text-blue-600 bg-blue-50 px-3 py-2 rounded border border-blue-100' }, r.folio)
        ))
    ),

    emailSent 
        ? React.createElement('div', { className: 'p-4 bg-blue-50 text-blue-800 rounded-lg flex items-center justify-center gap-2 mb-8' }, React.createElement('span', null, '📧'), 'Se ha enviado un correo con los detalles.') 
        : React.createElement('div', { className: 'p-4 bg-red-50 text-red-700 rounded-lg border border-red-200 mb-8' }, '⚠️ No se pudo enviar el correo. Por favor toma captura de esta pantalla.'),
    
    React.createElement('a', { href: 'index.html', className: 'inline-block bg-slate-800 text-white px-10 py-4 rounded-xl font-bold hover:bg-slate-700 transition-all shadow-lg' }, 'Volver al Inicio'),
    
    // FOOTER EN PANTALLA FINAL
    React.createElement('footer', { className: 'mt-12 pt-8 border-t border-slate-100 text-center text-xs text-slate-400' },
        React.createElement('p', { className: 'font-bold mb-1' }, 'Coordinación de Actualización Docente'),
        React.createElement('p', null, `Instituto Tecnológico de Durango • ${new Date().getFullYear()}`)
    )
);

const Stepper = ({ currentStep, steps }) => React.createElement('div', { className: 'flex justify-between items-center w-full max-w-3xl mx-auto my-10 px-4' }, steps.map((s, i) => React.createElement('div', { key: i, className: `flex items-center ${i < steps.length - 1 ? 'flex-1' : ''}` },
    React.createElement('div', { className: 'relative flex flex-col items-center z-10' },
        React.createElement('div', { className: `flex items-center justify-center w-12 h-12 rounded-full font-bold text-lg transition-all duration-500 border-4 ${i + 1 <= currentStep ? 'bg-blue-900 text-white border-blue-900 shadow-lg scale-110' : 'bg-white text-slate-300 border-slate-200'}` }, i + 1),
        React.createElement('span', { className: `absolute top-14 text-xs font-bold whitespace-nowrap tracking-wide ${i + 1 <= currentStep ? 'text-blue-900' : 'text-slate-300'}` }, s)
    ),
    i < steps.length - 1 && React.createElement('div', { className: `flex-1 h-1 mx-4 rounded-full transition-all duration-700 ${i + 1 < currentStep ? 'bg-blue-900' : 'bg-slate-200'}` })
)));

const App = () => {
    const { useState, useEffect } = React;
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({ fullName: '', curp: '', email: '', department: '', gender: '' });
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
            .catch(() => setError("Error cargando datos del servidor."));
    }, []);

    const handleSubmit = async () => {
        setLoading(true);
        try {
            const res = await submitRegistration({
                action: 'enrollStudent', ...formData, selectedCourses: selected, previousRegistrationIds: original.map(c => c.id) 
            });
            setResult(res); setStep(4);
        } catch (e) { setError(e.message); setStep(3); }
        finally { setLoading(false); }
    };

    if (loading && step === 1) return React.createElement('div', { className: 'min-h-screen flex flex-col items-center justify-center bg-slate-50' }, 
        React.createElement('div', { className: 'animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-900 mb-6' }),
        React.createElement('p', { className: 'text-slate-600 font-bold text-lg' }, 'Cargando sistema...')
    );

    return React.createElement('div', { className: 'min-h-screen bg-slate-50 pb-20 font-sans' },
        React.createElement('div', { className: 'fixed top-4 left-4 z-50' },
            React.createElement('a', { href: 'index.html', className: 'bg-white/90 backdrop-blur text-blue-900 px-4 py-2 rounded-full shadow-md font-bold text-sm hover:bg-blue-900 hover:text-white transition-all flex items-center gap-2' }, '← Volver al Portal')
        ),
        
        React.createElement(Stepper, { currentStep: step, steps: ["Datos", "Cursos", "Confirmar", "Fin"] }),
        
        React.createElement('div', { className: 'container mx-auto px-4' },
            error && React.createElement('div', { className: 'max-w-4xl mx-auto bg-red-50 text-red-700 p-4 mb-8 rounded-xl border-l-4 border-red-500 shadow-sm flex items-center gap-4' }, 
                React.createElement('span', { className: 'text-2xl' }, '🚫'),
                React.createElement('div', null, React.createElement('strong', { className: 'block' }, 'Error de Conexión'), error)
            ),
            step === 1 && React.createElement(Step1PersonalInfo, { 
                formData, setFormData, departments, teachers, allCourses, 
                setSelectedCourses: setSelected, setOriginalSelectedCourses: setOriginal,
                onNext: () => setStep(2)
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
