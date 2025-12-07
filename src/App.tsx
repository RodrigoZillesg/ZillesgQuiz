import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './App.css'

// Components
import { ProtectedRoute } from './components/ProtectedRoute'

// Pages - Public
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'

// Pages - Host
import HostDashboard from './pages/host/Dashboard'
import CreateRoom from './pages/host/CreateRoom'
import RoomLobby from './pages/host/RoomLobby'
import SelectQuestions from './pages/host/SelectQuestions'
import ManageQuestions from './pages/host/ManageQuestions'
import QuestionReports from './pages/host/QuestionReports'
import HostGame from './pages/host/HostGame'
import HostResults from './pages/host/HostResults'
import Profile from './pages/host/Profile'
import KnowledgeBase from './pages/host/KnowledgeBase'

// Pages - Player
import JoinRoom from './pages/play/JoinRoom'
import PlayerLobby from './pages/play/PlayerLobby'
import PlayerGame from './pages/play/PlayerGame'
import PlayerResults from './pages/play/PlayerResults'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected host routes */}
        <Route
          path="/host"
          element={
            <ProtectedRoute requireHost>
              <HostDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/host/create"
          element={
            <ProtectedRoute requireHost>
              <CreateRoom />
            </ProtectedRoute>
          }
        />
        <Route
          path="/host/room/:code"
          element={
            <ProtectedRoute requireHost>
              <RoomLobby />
            </ProtectedRoute>
          }
        />
        <Route
          path="/host/room/:code/questions"
          element={
            <ProtectedRoute requireHost>
              <SelectQuestions />
            </ProtectedRoute>
          }
        />
        <Route
          path="/host/game/:code"
          element={
            <ProtectedRoute requireHost>
              <HostGame />
            </ProtectedRoute>
          }
        />
        <Route
          path="/host/room/:code/results"
          element={
            <ProtectedRoute requireHost>
              <HostResults />
            </ProtectedRoute>
          }
        />
        <Route
          path="/host/profile"
          element={
            <ProtectedRoute requireHost>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/host/questions"
          element={
            <ProtectedRoute requireHost requireAdmin>
              <ManageQuestions />
            </ProtectedRoute>
          }
        />
        <Route
          path="/host/reports"
          element={
            <ProtectedRoute requireHost requireAdmin>
              <QuestionReports />
            </ProtectedRoute>
          }
        />
        <Route
          path="/host/knowledge"
          element={
            <ProtectedRoute requireHost requireAdmin>
              <KnowledgeBase />
            </ProtectedRoute>
          }
        />

        {/* Player routes */}
        <Route path="/play/:code" element={<JoinRoom />} />
        <Route path="/play/:code/lobby" element={<PlayerLobby />} />
        <Route path="/play/:code/game" element={<PlayerGame />} />
        <Route path="/play/:code/results" element={<PlayerResults />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
