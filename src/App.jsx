import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import EventList from './pages/EventList'
import EventDetail from './pages/EventDetail'
import EventForm from './pages/EventForm'
import TaskList from './pages/TaskList'
import StakeholderList from './pages/StakeholderList'
import StakeholderForm from './pages/StakeholderForm'
import GoalManagement from './pages/GoalManagement'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="events" element={<EventList />} />
          <Route path="events/new" element={<EventForm />} />
          <Route path="events/:id" element={<EventDetail />} />
          <Route path="events/:id/edit" element={<EventForm />} />
          <Route path="tasks" element={<TaskList />} />
          <Route path="stakeholders" element={<StakeholderList />} />
          <Route path="stakeholders/new" element={<StakeholderForm />} />
          <Route path="stakeholders/:id/edit" element={<StakeholderForm />} />
          <Route path="goals" element={<GoalManagement />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
