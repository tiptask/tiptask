'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import type { Creator, Task } from '@/types'

const CATEGORIES = ['general', 'dj', 'fitness', 'gaming', 'art', 'cooking', 'talk']

type NewTask = {
  title: string
  description: string
  category: string
  price_type: 'fixed' | 'minimum' | 'free'
  price: string
}

const emptyTask: NewTask = {
  title: '',
  description: '',
  category: 'general',
  price_type: 'minimum',
  price: '',
}

export default function TasksPage() {
  const router = useRouter()
  const [creator, setCreator] = useState<Creator | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [newTask, setNewTask] = useState<NewTask>(emptyTask)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: creatorData } = await supabase
        .from('creators').select('*').eq('id', user.id).single()
      setCreator(creatorData)

      const { data: tasksData } = await supabase
        .from('tasks')
        .select('*')
        .eq('creator_id', user.id)
        .order('created_at', { ascending: false })
      setTasks(tasksData || [])
      setLoading(false)
    }
    load()
  }, [router])

  async function saveTask() {
    if (!creator) return
    if (!newTask.title.trim()) { setError('Task title is required'); return }
    if (newTask.price_type !== 'free' && !newTask.price) { setError('Please enter a price'); return }

    setSaving(true)
    setError('')

    const { data, error: insertError } = await supabase.from('tasks').insert({
      creator_id: creator.id,
      title: newTask.title.trim(),
      description: newTask.description.trim() || null,
      category: newTask.category,
      suggested_amount: newTask.price_type === 'fixed' ? parseFloat(newTask.price) : null,
      min_amount: newTask.price_type === 'minimum' ? parseFloat(newTask.price) : newTask.price_type === 'free' ? 1 : parseFloat(newTask.price),
      is_active: true,
    }).select().single()

    if (insertError) {
      setError(insertError.message)
    } else {
      setTasks(prev => [data, ...prev])
      setNewTask(emptyTask)
      setShowForm(false)
    }
    setSaving(false)
  }

  async function toggleTask(task: Task) {
    await supabase.from('tasks').update({ is_active: !task.is_active }).eq('id', task.id)
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, is_active: !t.is_active } : t))
  }

  async function deleteTask(id: string) {
    await supabase.from('tasks').delete().eq('id', id)
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  if (loading) return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center">
      <p className="text-gray-400">Loading...</p>
    </main>
  )

  return (
    <main className="min-h-screen bg-black text-white p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/dashboard')} className="text-gray-400 hover:text-white transition">← Back</button>
            <h1 className="text-2xl font-bold">My Tasks</h1>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-white text-black px-4 py-2 rounded-xl font-semibold hover:bg-gray-100 transition text-sm"
          >
            + Add task
          </button>
        </div>

        {showForm && (
          <div className="bg-gray-900 rounded-2xl p-6 mb-6 space-y-4">
            <h2 className="font-semibold text-lg">New task</h2>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Title *</label>
              <input
                type="text"
                value={newTask.title}
                onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))}
                placeholder="e.g. Play a song request"
                className="w-full bg-black border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-white transition"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Description <span className="text-gray-600">(optional)</span></label>
              <input
                type="text"
                value={newTask.description}
                onChange={e => setNewTask(p => ({ ...p, description: e.target.value }))}
                placeholder="Short explanation for viewers"
                className="w-full bg-black border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-white transition"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Category</label>
              <select
                value={newTask.category}
                onChange={e => setNewTask(p => ({ ...p, category: e.target.value }))}
                className="w-full bg-black border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white transition"
              >
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Pricing</label>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {(['fixed', 'minimum', 'free'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => setNewTask(p => ({ ...p, price_type: type }))}
                    className={`py-2 rounded-xl text-sm font-medium transition ${
                      newTask.price_type === type ? 'bg-white text-black' : 'bg-black border border-gray-700 text-gray-400 hover:border-gray-500'
                    }`}
                  >
                    {type === 'fixed' ? 'Fixed price' : type === 'minimum' ? 'Minimum' : 'Viewer decides'}
                  </button>
                ))}
              </div>
              {newTask.price_type !== 'free' && (
                <div className="relative">
                  <input
                    type="number"
                    value={newTask.price}
                    onChange={e => setNewTask(p => ({ ...p, price: e.target.value }))}
                    placeholder={newTask.price_type === 'fixed' ? 'Fixed amount' : 'Minimum amount'}
                    min="1"
                    className="w-full bg-black border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-white transition pr-16"
                  />
                  <span className="absolute right-4 top-3 text-gray-500">RON</span>
                </div>
              )}
              <p className="text-gray-600 text-xs mt-2">
                {newTask.price_type === 'fixed' ? 'Viewers pay exactly this amount' :
                 newTask.price_type === 'minimum' ? 'Viewers can pay more if they want' :
                 'Viewers choose how much to pay'}
              </p>
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <div className="flex gap-3">
              <button
                onClick={saveTask}
                disabled={saving}
                className="flex-1 bg-white text-black py-3 rounded-xl font-semibold hover:bg-gray-100 transition disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save task'}
              </button>
              <button
                onClick={() => { setShowForm(false); setNewTask(emptyTask); setError('') }}
                className="px-6 py-3 border border-gray-700 rounded-xl text-gray-400 hover:border-gray-500 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {tasks.length === 0 && !showForm ? (
          <div className="text-center py-20">
            <p className="text-gray-600 mb-2">No tasks yet</p>
            <p className="text-gray-700 text-sm">Add tasks so viewers know what they can request</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map(task => (
              <div key={task.id} className={`bg-gray-900 rounded-2xl p-4 flex items-center gap-4 ${!task.is_active ? 'opacity-50' : ''}`}>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{task.title}</p>
                    <span className="text-xs text-gray-600 bg-gray-800 px-2 py-0.5 rounded-full">{task.category}</span>
                  </div>
                  {task.description && <p className="text-gray-500 text-sm mt-0.5">{task.description}</p>}
                  <p className="text-gray-400 text-sm mt-1">
                    {task.suggested_amount
                      ? `${task.suggested_amount} ${creator?.currency?.toUpperCase() ?? "RON"} fixed`
                      : task.min_amount && task.min_amount > 1
                      ? `min. ${task.min_amount} ${creator?.currency?.toUpperCase() ?? "RON"}`
                      : 'Viewer decides'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleTask(task)}
                    className={`w-10 h-6 rounded-full transition ${task.is_active ? 'bg-white' : 'bg-gray-700'}`}
                  >
                    <div className={`w-4 h-4 bg-black rounded-full mx-auto transition-transform ${task.is_active ? 'translate-x-2' : '-translate-x-1'}`} />
                  </button>
                  <button
                    onClick={() => deleteTask(task.id)}
                    className="text-gray-600 hover:text-red-400 transition text-lg px-1"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
