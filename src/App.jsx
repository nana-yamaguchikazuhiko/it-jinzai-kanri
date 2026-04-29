import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import PasswordGate from './components/PasswordGate'
import Dashboard from './pages/Dashboard'
import EventList from './pages/EventList'
import EventDetail from './pages/EventDetail'
import EventForm from './pages/EventForm'
import TaskList from './pages/TaskList'
import StakeholderList from './pages/StakeholderList'
import StakeholderForm from './pages/StakeholderForm'
import GoalManagement from './pages/GoalManagement'
import TaskTemplateManager from './pages/TaskTemplateManager'
import MailList from './pages/MailList'
import SnippetList from './pages/SnippetList'

export default function App() {
  return (
    <PasswordGate>
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
          <Route path="templates" element={<TaskTemplateManager />} />
          <Route path="mails" element={<MailList />} />
          <Route path="snippets" element={<SnippetList />} />
        </Route>
      </Routes>
    </BrowserRouter>
    </PasswordGate>
  )
}
