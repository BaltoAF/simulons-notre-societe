import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AppProvider } from './lib/state'
import { FiletSecurite } from './components/FiletSecurite'
import { ecouterErreurs } from './lib/erreurs'
import { typographieAuto } from './lib/typo'
import './styles.css'

ecouterErreurs()
typographieAuto()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppProvider>
        <FiletSecurite>
          <App />
        </FiletSecurite>
      </AppProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
