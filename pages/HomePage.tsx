declare const React: any;
declare global {
    interface Window {
        ReactRouterDOM: any;
    }
}
const { Link } = window.ReactRouterDOM;

const HomePage = () => {

    React.useEffect(() => {
        const inspirationalQuotes = [
            { quote: "La educación es el arma más poderosa que puedes usar para cambiar el mundo.", author: "Nelson Mandela" },
            { quote: "La mente que se abre a una nueva idea jamás volverá a su tamaño original.", author: "Albert Einstein" },
            { quote: "Un maestro afecta la eternidad; nunca se sabe dónde termina su influencia.", author: "Henry Adams" },
        ];

        const quoteContainer = document.getElementById('quote-container');
        if (!quoteContainer) return;
        
        const rotateQuotes = () => {
            const randomIndex = Math.floor(Math.random() * inspirationalQuotes.length);
            const quote = inspirationalQuotes[randomIndex];
            quoteContainer.style.opacity = '0';
            setTimeout(() => {
                quoteContainer.innerHTML = `
                    <p class="text-base sm:text-lg italic text-gray-700 leading-relaxed">"${quote.quote}"</p>
                    <p class="text-sm sm:text-base text-gray-600 text-right mt-2">- ${quote.author}</p>`;
                quoteContainer.style.opacity = '1';
            }, 500);
        };
        
        rotateQuotes();
        const intervalId = setInterval(rotateQuotes, 10000);

        return () => clearInterval(intervalId);

    }, []);

    return (
        <div className="container mx-auto px-4 py-8 sm:py-12">
            <section className="max-w-4xl mx-auto mb-8 animate-fadeInUp">
                <div id="quote-container" className="quote-container rounded-lg p-6 text-center transition-opacity duration-500 ease-in-out">
                </div>
            </section>
        
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto mb-12">
                
                <Link to="/encuestas-y-constancias" 
                   className="card-portal bg-white rounded-2xl shadow-lg p-6 text-center border-2 border-transparent hover:border-rose-400 animate-fadeInUp" style={{animationDelay: '0.1s', textDecoration: 'none'}}>
                    <div className="text-4xl sm:text-5xl mb-4 transform transition-transform hover:scale-110">📊</div>
                    <h3 className="text-lg font-bold text-gray-800 mb-2">
                        Encuestas y Constancias
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-600 mb-4">
                        Responde encuestas y obtén tus constancias
                    </p>
                    <div className="inline-block bg-rose-100 text-rose-700 text-xs font-semibold px-3 py-1 rounded-full">
                        ✓ Iniciar
                    </div>
                </Link>

                <a href="formatos.html" 
                   className="card-portal bg-white rounded-2xl shadow-lg p-6 text-center border-2 border-transparent hover:border-green-400 animate-fadeInUp" style={{animationDelay: '0.2s', textDecoration: 'none'}}>
                    <div className="text-4xl sm:text-5xl mb-4 transform transition-transform hover:scale-110">📋</div>
                    <h3 className="text-lg font-bold text-gray-800 mb-2">
                        Formatos Oficiales
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-600 mb-4">
                        Descargar formatos y documentos
                    </p>
                    <div className="inline-block bg-green-100 text-green-700 text-xs font-semibold px-3 py-1 rounded-full">
                        ✓ Disponible
                    </div>
                </a>

                <Link to="/verificador" 
                   className="card-portal bg-white rounded-2xl shadow-lg p-6 text-center border-2 border-transparent hover:border-cyan-400 animate-fadeInUp" style={{animationDelay: '0.3s', textDecoration: 'none'}}>
                    <div className="text-4xl sm:text-5xl mb-4 transform transition-transform hover:scale-110">✅</div>
                    <h3 className="text-lg font-bold text-gray-800 mb-2">
                        Validación de Constancias
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-600 mb-4">
                        Verificar la autenticidad de documentos.
                    </p>
                    <div className="inline-block bg-cyan-100 text-cyan-700 text-xs font-semibold px-3 py-1 rounded-full">
                        ✓ Disponible
                    </div>
                </Link>

                <a href="inscripciones.html" 
                   className="card-portal bg-white rounded-2xl shadow-lg p-6 text-center border-2 border-transparent hover:border-blue-400 animate-fadeInUp" style={{animationDelay: '0.4s', textDecoration: 'none'}}>
                    <div className="text-4xl sm:text-5xl mb-4 transform transition-transform hover:scale-110">📝</div>
                    <h3 className="text-lg font-bold text-gray-800 mb-2">
                        Inscripción a Cursos
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-600 mb-4">
                        Registrarse en cursos de actualización
                    </p>
                    <div className="inline-block bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full">
                        ✓ Disponible
                    </div>
                </a>

                <a href="instructores.html" 
                   className="card-portal bg-white rounded-2xl shadow-lg p-6 text-center border-2 border-transparent hover:border-indigo-400 animate-fadeInUp" style={{animationDelay: '0.5s', textDecoration: 'none'}}>
                    <div className="text-4xl sm:text-5xl mb-4 transform transition-transform hover:scale-110">👨‍🏫</div>
                    <h3 className="text-lg font-bold text-gray-800 mb-2">
                        Área para Instructores
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-600 mb-4">
                        Subir propuestas y evidencias
                    </p>
                    <div className="inline-block bg-indigo-100 text-indigo-700 text-xs font-semibold px-3 py-1 rounded-full">
                        ✓ Disponible
                    </div>
                </a>
            </div>
        </div>
    );
};

export default HomePage;
