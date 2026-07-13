import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './lib/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import ManagerRoute from './components/ManagerRoute'
import Login from './pages/Login'
import Home from './pages/Home'
import Heard from './pages/Heard'
import HeardDetail from './pages/HeardDetail'
import HeardForm from './pages/HeardForm'
import Hands from './pages/Hands'
import HandForm from './pages/HandForm'
import Chores from './pages/Chores'
import ChoreForm from './pages/ChoreForm'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />

          <Route
            path="/heard"
            element={
              <ProtectedRoute>
                <Heard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/heard/new"
            element={
              <ProtectedRoute>
                <ManagerRoute>
                  <HeardForm />
                </ManagerRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/heard/:id/edit"
            element={
              <ProtectedRoute>
                <ManagerRoute>
                  <HeardForm />
                </ManagerRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/heard/:id"
            element={
              <ProtectedRoute>
                <HeardDetail />
              </ProtectedRoute>
            }
          />

          <Route
            path="/hands"
            element={
              <ProtectedRoute>
                <Hands />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hands/:id"
            element={
              <ProtectedRoute>
                <ManagerRoute>
                  <HandForm />
                </ManagerRoute>
              </ProtectedRoute>
            }
          />

          <Route
            path="/chores"
            element={
              <ProtectedRoute>
                <Chores />
              </ProtectedRoute>
            }
          />
          <Route
            path="/chores/new"
            element={
              <ProtectedRoute>
                <ManagerRoute>
                  <ChoreForm />
                </ManagerRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/chores/:id"
            element={
              <ProtectedRoute>
                <ManagerRoute>
                  <ChoreForm />
                </ManagerRoute>
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
