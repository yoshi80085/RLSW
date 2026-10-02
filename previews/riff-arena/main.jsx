import React from 'react';
import {createRoot} from 'react-dom/client';
import {App} from './App.jsx';

// Keep the root outside the React-refresh component module: tuning edits must
// never create a second scene/animation loop on the same container.
const root=createRoot(document.getElementById('root'));
root.render(React.createElement(App));
if(import.meta.hot) import.meta.hot.dispose(()=>root.unmount());
