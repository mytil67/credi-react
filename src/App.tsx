import React, { useState } from 'react';
import Sidebar from './layouts/Sidebar';
import UploadPage from './pages/UploadPage'; // <--- Import
import DataPage from './pages/DataPage';
import SummaryPage from './pages/SummaryPage';
import StrikesPage from './pages/StrikesPage';
import TerritoriesPage from './pages/TerritoriesPage';
import CheckPage from './pages/CheckPage';

function App() {
  const [activeTab, setActiveTab] = useState('upload');

const renderContent = () => {
    switch (activeTab) {
      case 'upload':
        return <UploadPage />;
      case 'data':
        return <DataPage />; 
		case 'territories': return <TerritoriesPage />;// <--- Utilisation
		case 'strikes': return <StrikesPage />;
      case 'summary': return <SummaryPage />;
	  case 'check': return <CheckPage />;
        return null;
    }
  };

  return (
    <div className="flex min-h-screen bg-background font-sans">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="flex-1 ml-64 transition-all duration-300">
        {renderContent()}
      </main>
    </div>
  );
}

export default App;