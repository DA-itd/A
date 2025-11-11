// ============================================================================
// === LÓGICA DE REACT PARA LA PÁGINA DE INSCRIPCIONES (inscripciones.html) ===
// ============================================================================

const { useState, useEffect, useCallback, useMemo } = React;

// ============================================================================
// === API Service: Comunicación con el Backend (Google Apps Script) =========
// ============================================================================
const apiService = {
  getTeachers: async () => {
    const response = await fetch(`${window.CONFIG.APPS_SCRIPT_URL}?action=getTeachersList&_=${Date.now()}`);
    if (!response.ok) throw new Error('No se pudo cargar la lista de docentes.');
    const result = await response.json();
    if (result.success) return result.data;
    throw new Error(result.message || 'Error en la respuesta del servidor.');
  },
  getCourses: async () => {
    const response = await fetch(`${window.CONFIG.APPS_SCRIPT_URL}?action=getCoursesList&_=${Date.now()}`);
    if (!response.ok) throw new Error('No se pudo cargar la lista de cursos.');
    const result = await response.json();
    if (result.success) return result.data;
    throw new Error(result.message || 'Error en la respuesta del servidor.');
  },
  lookupByCurp: async (curp) => {
    const response = await fetch(`${window.CONFIG.APPS_SCRIPT_URL}?action=lookupByCurp&curp=${curp}&_=${Date.now()}`);
    if (!response.ok) throw new Error('No se pudo verificar el CURP.');
    const result = await response.json();
    if (result.success) return result.data;
    throw new Error(result.message || 'Error al buscar CURP.');
  },
  enrollStudent: async (enrollmentData) => {
    const response = await fetch(window.CONFIG.APPS_SCRIPT_URL, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'enrollStudent', ...enrollmentData })
    });
    if (!response.ok) throw new Error('Error de conexión al registrar.');
    const result = await response.json();
    if (result.success) return result;
    throw new Error(result.message || 'Error desconocido al registrar.');
  }
};

// ============================================================================
// === Componentes de la Interfaz de Usuario (UI) =============================
// ============================================================================

const Stepper = ({ currentStep }) => {
  const steps = ['Información', 'Cursos', 'Confirmar', 'Finalizado'];
  return (
    <div className="flex justify-center items-center mb-8 sm:mb-12">
      {steps.map((step, index) => {
        const stepNumber = index + 1;
        const isActive = stepNumber === currentStep;
        const isCompleted = stepNumber < currentStep;
        return (
          <React.Fragment key={step}>
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white font-bold transition-colors ${
                  isActive ? 'bg-blue-600 ring-4 ring-blue-200' : isCompleted ? 'bg-green-500' : 'bg-gray-300'
                }`}
              >
                {isCompleted ? '✓' : stepNumber}
              </div>
              <p className={`mt-2 text-xs sm:text-sm font-semibold ${isActive ? 'text-blue-600' : isCompleted ? 'text-green-500' : 'text-gray-500'}`}>
                {step}
              </p>
            </div>
            {stepNumber < steps.length && (
              <div className={`flex-1 h-1 mx-2 sm:mx-4 transition-colors ${isCompleted ? 'bg-green-500' : 'bg-gray-300'}`}></div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

const Spinner = () => (
    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
);

// ============================================================================
// === Pasos del Formulario de Inscripción ====================================
// ============================================================================

const Step1_Info = ({ formData, setFormData, onNext, teachers }) => {
    const [error, setError] = useState(null);
    const [isSearching, setIsSearching] = useState(false);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value.toUpperCase() }));
    };

    const handleCurpBlur = async () => {
        if (formData.curp.length !== 18) {
            setError('El CURP debe tener 18 caracteres.');
            return;
        }
        setError(null);
        setIsSearching(true);
        try {
            const result = await apiService.lookupByCurp(formData.curp);
            if (result.found) {
                setFormData(prev => ({
                    ...prev,
                    fullName: result.fullName || '',
                    email: result.email || '',
                    department: result.department || '',
                }));
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setIsSearching(false);
        }
    };
    
    const handleSubmit = (e) => {
        e.preventDefault();
        if (formData.curp.length !== 18 || !formData.fullName || !formData.email || !formData.department || !formData.gender) {
            setError("Todos los campos son obligatorios.");
            return;
        }
        setError(null);
        onNext();
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <h2 className="text-xl font-bold text-gray-800">1. Información del Docente</h2>
            {error && <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md">{error}</div>}
            
            <div>
                <label htmlFor="curp" className="block text-sm font-medium text-gray-700">CURP *</label>
                <div className="relative mt-1">
                    <input type="text" name="curp" id="curp" value={formData.curp} onChange={handleInputChange} onBlur={handleCurpBlur}
                           className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                           maxLength="18" required />
                    {isSearching && <div className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400">Buscando...</div>}
                </div>
            </div>

            <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">Nombre Completo *</label>
                <input type="text" name="fullName" id="fullName" value={formData.fullName} onChange={handleInputChange}
                       className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" required />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email Institucional *</label>
                    <input type="email" name="email" id="email" value={formData.email} onChange={handleInputChange}
                           className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" required />
                </div>
                <div>
                    <label htmlFor="department" className="block text-sm font-medium text-gray-700">Departamento de Adscripción *</label>
                    <input type="text" name="department" id="department" value={formData.department} onChange={handleInputChange}
                           className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" required />
                </div>
            </div>

             <div>
                <label className="block text-sm font-medium text-gray-700">Género *</label>
                <select name="gender" value={formData.gender} onChange={handleInputChange} required
                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md">
                    <option value="">Seleccione...</option>
                    <option value="HOMBRE">HOMBRE</option>
                    <option value="MUJER">MUJER</option>
                </select>
            </div>
            
            <div className="flex justify-end pt-4">
                <button type="submit" className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700">
                    Siguiente →
                </button>
            </div>
        </form>
    );
};


const Step2_Courses = ({ onNext, onBack, selectedCourses, setSelectedCourses, courses }) => {
    const [error, setError] = useState(null);

    const handleSelectCourse = (course) => {
        setError(null);
        setSelectedCourses(prev => {
            const isSelected = prev.some(c => c.id_curso === course.id_curso);
            if (isSelected) {
                return prev.filter(c => c.id_curso !== course.id_curso);
            } else {
                if (prev.length >= 3) {
                    setError('Puedes seleccionar un máximo de 3 cursos.');
                    return prev;
                }
                return [...prev, course];
            }
        });
    };

    const groupedCourses = useMemo(() => {
        return courses.reduce((acc, course) => {
            const period = course.periodo || 'Sin Periodo';
            if (!acc[period]) acc[period] = [];
            acc[period].push(course);
            return acc;
        }, {});
    }, [courses]);

    return (
        <div>
            <h2 className="text-xl font-bold text-gray-800 mb-4">2. Selección de Cursos</h2>
            {error && <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md mb-6">{error}</div>}
            
            <div className="space-y-8">
                {Object.entries(groupedCourses).map(([period, courseList]) => (
                    <div key={period}>
                        <h3 className="text-lg font-semibold text-blue-800 border-b-2 border-blue-200 pb-2 mb-4">{period}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {courseList.map(course => {
                                const isSelected = selectedCourses.some(c => c.id_curso === course.id_curso);
                                return (
                                    <div key={course.id_curso} onClick={() => handleSelectCourse(course)}
                                         className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${isSelected ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-300' : 'bg-white border-gray-200 hover:border-blue-400'}`}>
                                        <p className="font-bold text-gray-800">{course.nombre_curso}</p>
                                        <p className="text-xs text-gray-500 mt-2">{course.fecha_curso} | {course.horario}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex justify-between pt-8 mt-4 border-t">
                <button onClick={onBack} className="px-6 py-2 bg-gray-200 text-gray-700 font-semibold rounded-md hover:bg-gray-300">
                    ← Anterior
                </button>
                <button onClick={onNext} disabled={selectedCourses.length === 0}
                        className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 disabled:bg-gray-400">
                    Siguiente →
                </button>
            </div>
        </div>
    );
};

const Step3_Confirm = ({ onBack, onConfirm, formData, selectedCourses }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      // Loop through each selected course and submit them individually
      for (const course of selectedCourses) {
        const enrollmentData = { ...formData, course };
        await apiService.enrollStudent(enrollmentData);
      }
      onConfirm(); // Move to the final step
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
        <h2 className="text-xl font-bold text-gray-800 mb-4">3. Confirmación de Registro</h2>
        {error && <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md mb-6">{error}</div>}
        
        <div className="bg-white p-6 rounded-lg shadow-md border space-y-4">
            <h3 className="font-bold text-lg">Resumen de su Registro</h3>
            <div>
                <p className="text-sm text-gray-500">Nombre:</p>
                <p>{formData.fullName}</p>
            </div>
             <div>
                <p className="text-sm text-gray-500">CURP:</p>
                <p>{formData.curp}</p>
            </div>
            <div>
                <p className="text-sm text-gray-500">Email:</p>
                <p className="lowercase">{formData.email}</p>
            </div>
            <div>
                <p className="text-sm text-gray-500">Cursos Seleccionados:</p>
                <ul className="list-disc list-inside mt-1">
                    {selectedCourses.map(c => <li key={c.id_curso}>{c.nombre_curso}</li>)}
                </ul>
            </div>
        </div>

        <div className="flex justify-between pt-8 mt-4 border-t">
            <button onClick={onBack} disabled={isSubmitting} className="px-6 py-2 bg-gray-200 text-gray-700 font-semibold rounded-md hover:bg-gray-300 disabled:opacity-50">
                ← Anterior
            </button>
            <button onClick={handleSubmit} disabled={isSubmitting}
                    className="px-6 py-2 bg-green-600 text-white font-semibold rounded-md hover:bg-green-700 disabled:bg-gray-400 flex items-center gap-2">
                {isSubmitting && <Spinner />}
                {isSubmitting ? 'Enviando...' : 'Confirmar e Inscribir'}
            </button>
        </div>
    </div>
  );
};


const Step4_Final = () => (
    <div className="text-center py-8">
        <div className="text-6xl mb-4">🎉</div>
        <h2 className="text-2xl font-bold text-green-700">¡Inscripción Exitosa!</h2>
        <p className="text-gray-600 mt-2">Has sido registrado en los cursos seleccionados.</p>
        <p className="text-sm text-gray-500 mt-4">Recibirás más información en tu correo institucional.</p>
        <a href="index.html" className="mt-8 inline-block px-6 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700">
            Volver al Portal Principal
        </a>
    </div>
);

// ============================================================================
// === Componente Principal de la Aplicación =================================
// ============================================================================

const App = () => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    curp: '',
    fullName: '',
    email: '',
    department: '',
    gender: ''
  });
  const [selectedCourses, setSelectedCourses] = useState([]);
  const [courses, setCourses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const [coursesData, teachersData] = await Promise.all([
          apiService.getCourses(),
          apiService.getTeachers()
        ]);
        setCourses(coursesData);
        setTeachers(teachersData);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const renderStep = () => {
    if (isLoading) return <div className="text-center p-8">Cargando datos...</div>;
    if (error) return <div className="text-center p-8 text-red-600">{error}</div>;

    switch (step) {
      case 1:
        return <Step1_Info formData={formData} setFormData={setFormData} onNext={() => setStep(2)} teachers={teachers} />;
      case 2:
        return <Step2_Courses onNext={() => setStep(3)} onBack={() => setStep(1)} selectedCourses={selectedCourses} setSelectedCourses={setSelectedCourses} courses={courses} />;
      case 3:
        return <Step3_Confirm onBack={() => setStep(2)} onConfirm={() => setStep(4)} formData={formData} selectedCourses={selectedCourses} />;
      case 4:
        return <Step4_Final />;
      default:
        return <div>Paso no encontrado</div>;
    }
  };

  return (
    <main className="container mx-auto px-4 py-8 sm:py-12">
      <div className="max-w-4xl mx-auto">
        <Stepper currentStep={step} />
        <div className="bg-white rounded-lg shadow-xl p-6 sm:p-8">
            {renderStep()}
        </div>
      </div>
    </main>
  );
};

// ============================================================================
// === Renderizar la Aplicación en el DOM =====================================
// ============================================================================

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
