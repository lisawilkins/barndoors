import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './lib/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import ManagerRoute from './components/ManagerRoute'
import Login from './pages/Login'
import Home from './pages/Home'
import Herd from './pages/Herd'
import HerdDetail from './pages/HerdDetail'
import HerdForm from './pages/HerdForm'
import Hands from './pages/Hands'
import HandForm from './pages/HandForm'
import ManagerForm from './pages/ManagerForm'
import Chores from './pages/Chores'
import ChoreForm from './pages/ChoreForm'
import Reports from './pages/Reports'
import FeedScheduleReport from './pages/FeedScheduleReport'

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
            path="/herd"
            element={
              <ProtectedRoute>
                <Herd />
              </ProtectedRoute>
            }
          />
          <Route
            path="/herd/new"
            element={
              <ProtectedRoute>
                <ManagerRoute>
                  <HerdForm />
                </ManagerRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/herd/:id/edit"
            element={
              <ProtectedRoute>
                <ManagerRoute>
                  <HerdForm />
                </ManagerRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/herd/:id"
            element={
              <ProtectedRoute>
                <HerdDetail />
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
            path="/hands/new"
            element={
              <ProtectedRoute>
                <ManagerRoute>
                  <HandForm />
                </ManagerRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/hands/new-manager"
            element={
              <ProtectedRoute>
                <ManagerRoute>
                  <ManagerForm />
                </ManagerRoute>
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
          <Route
            path="/reports"
            element={
              <ProtectedRoute>
                <Reports />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports/feed-schedule"
            element={
              <ProtectedRoute>
                <FeedScheduleReport />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
