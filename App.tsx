declare const React: any;
declare global {
    interface Window {
        ReactRouterDOM: any;
    }
}
const { HashRouter: Router, Routes, Route } = window.ReactRouterDOM;

import Layout from './components/Layout.tsx';
import HomePage from './pages/HomePage.tsx';
import VerificadorPage from './pages/VerificadorPage.tsx';
import EncuestasConstanciasPage from './pages/EncuestasConstanciasPage.tsx';


const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="verificador" element={<VerificadorPage />} />
          <Route path="encuestas-y-constancias" element={<EncuestasConstanciasPage />} />
          {/* Los enlaces a páginas HTML antiguas ahora son manejados por el enrutador */}
        </Route>
      </Routes>
    </Router>
  );
};

export default App;
