import React from 'react';

// Since we are not using a bundler, we rely on global objects for libraries
// FIX: Property 'ReactRouterDOM' does not exist on type 'Window & typeof globalThis'.
declare global {
    interface Window {
        ReactRouterDOM: any;
    }
}
const { HashRouter: Router, Routes, Route, Outlet, Link, NavLink } = window.ReactRouterDOM;

// Page Components
import HomePage from './pages/HomePage.tsx';
import VerificadorPage from './pages/VerificadorPage.tsx';
import EncuestasConstanciasPage from './pages/EncuestasConstanciasPage.tsx';

// --- Reusable Layout Components ---

const Header = () => (
    <header className="bg-white shadow-xl sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4 sm:py-6">
            <div className="flex items-center justify-between gap-4">
                <img src="https://cdn.jsdelivr.net/gh/DA-itd/web/TecNM_logo.jpg"
                     alt="TecNM"
                     className="h-12 sm:h-16 md:h-20 object-contain" />
                
                <div className="text-center flex-1 px-2 sm:px-4">
                    <h1 className="text-sm sm:text-xl md:text-2xl lg:text-3xl font-bold text-blue-900 leading-tight">
                        ACTUALIZACIÓN DOCENTE
                    </h1>
                    <p className="text-xs sm:text-sm md:text-base text-blue-700 mt-1 font-semibold">
                        Desarrollo Académico
                    </p>
                    <p className="text-xs sm:text-sm text-blue-600">
                        TecNM - Instituto Tecnológico de Durango
                    </p>
                </div>
                
                <img src="https://cdn.jsdelivr.net/gh/DA-itd/web/logo_itdurango.png"
                     alt="ITD"
                     className="h-12 sm:h-16 md:h-20 object-contain" />
            </div>
        </div>
        <nav className="bg-blue-800 text-white shadow-md">
            <div className="container mx-auto px-4">
                <div className="hidden md:flex space-x-4">
                    <NavLink to="/" className={({ isActive }) => `px-3 py-3 text-sm font-medium hover:bg-blue-700 rounded-md transition-colors ${isActive ? 'bg-blue-900' : ''}`}>Inicio</NavLink>
                </div>
            </div>
        </nav>
    </header>
);

const Footer = () => (
    <footer className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white text-center py-6 sm:py-8 mt-8">
        <div className="container mx-auto px-4">
            <p className="font-semibold text-sm sm:text-base mb-2">
                © Coordinación de Actualización Docente
            </p>
            <p className="text-xs sm:text-sm opacity-90">
                M.C. Alejandro Calderón Rentería
            </p>
            <p className="text-xs sm:text-sm opacity-75 mt-1">
                Todos los derechos reservados 2024
            </p>
        </div>
    </footer>
);

const Layout = () => {
    return (
        <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
            <Header />
            <main className="flex-grow">
                <Outlet /> {/* Child routes will render here */}
            </main>
            <Footer />
        </div>
    );
};

// --- Main Application Component with Routing ---

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="verificador" element={<VerificadorPage />} />
          <Route path="encuestas-y-constancias" element={<EncuestasConstanciasPage />} />
          {/* Future routes like 'formatos', 'instructores' can be added here */}
        </Route>
      </Routes>
    </Router>
  );
};

export default App;
